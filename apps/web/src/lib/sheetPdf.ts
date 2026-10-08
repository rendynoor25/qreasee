/**
 * W-07: vector sheet-set PDF export.
 *
 * Each sheet is built by the same pure SVG builder the editor uses (with
 * `vector: true`, so drawings are inlined as nested `<svg>` rather than a
 * `data:` image), then converted page-by-page with `svg2pdf.js`. Lines stay
 * vector and text stays real (searchable / selectable). An open-licence TTF
 * (Roboto, Apache-2.0) is embedded so glyphs render the same everywhere.
 */

import { SHEET_SIZES, type Sheet } from "@qreasee/shared";
import type { jsPDF as JsPdf } from "jspdf";
import { sheetSvgString, type SheetSvgContext } from "./sheetSvg";

export interface PdfFontData {
  regular: string;
  bold: string;
}

const FONT_FAMILY = "Roboto";
const FONT_URLS = {
  regular: "/fonts/Roboto-Regular.ttf",
  bold: "/fonts/Roboto-Bold.ttf",
};

function toBase64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

/** Load the embedded font from the app's public folder (browser export path). */
async function fetchFonts(): Promise<PdfFontData> {
  const [r, b] = await Promise.all([fetch(FONT_URLS.regular), fetch(FONT_URLS.bold)]);
  if (!r.ok || !b.ok) throw new Error("Could not load the PDF font.");
  return {
    regular: toBase64(new Uint8Array(await r.arrayBuffer())),
    bold: toBase64(new Uint8Array(await b.arrayBuffer())),
  };
}

function registerFonts(pdf: JsPdf, fonts: PdfFontData): void {
  pdf.addFileToVFS("Roboto-Regular.ttf", fonts.regular);
  pdf.addFileToVFS("Roboto-Bold.ttf", fonts.bold);
  // The drawings label their text `font-family="sans-serif"`, so alias the
  // embedded font to both names and everything lands in one embedded face.
  for (const family of [FONT_FAMILY, "sans-serif"]) {
    pdf.addFont("Roboto-Regular.ttf", family, "normal");
    pdf.addFont("Roboto-Bold.ttf", family, "bold");
  }
}

function parseSvg(svg: string): Element {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || root.nodeName === "parsererror") throw new Error("Could not parse the sheet SVG.");
  return root;
}

/**
 * Build the multi-page vector PDF. `fonts` is injectable so tests can supply the
 * TTFs without a network/browser fetch.
 */
export async function buildSheetsPdf(
  sheets: readonly Sheet[],
  ctxFor: (sheet: Sheet) => SheetSvgContext,
  fonts?: PdfFontData,
): Promise<JsPdf> {
  if (sheets.length === 0) throw new Error("There are no sheets to export.");
  const { jsPDF } = await import("jspdf");
  const { svg2pdf } = await import("svg2pdf.js/dist/svg2pdf.es.min.js");

  let pdf: JsPdf | null = null;
  for (const sheet of sheets) {
    const size = SHEET_SIZES[sheet.size];
    const landscape = size.w >= size.h;
    const orientation = landscape ? "landscape" : "portrait";
    const format: [number, number] = [size.w, size.h];
    if (!pdf) {
      pdf = new jsPDF({ orientation, unit: "mm", format, compress: true });
      try {
        registerFonts(pdf, fonts ?? (await fetchFonts()));
      } catch {
        // Font download failed (offline): fall back to a built-in font. Text is
        // still selectable; only the typeface differs.
      }
    } else {
      pdf.addPage(format, orientation);
    }
    const svg = parseSvg(sheetSvgString(sheet, { ...ctxFor(sheet), vector: true }));
    await svg2pdf(svg, pdf, { x: 0, y: 0, width: size.w, height: size.h });
  }
  return pdf!;
}

export async function exportSheetsPdf(
  sheets: readonly Sheet[],
  ctxFor: (sheet: Sheet) => SheetSvgContext,
  filename = "qreasee-sheets.pdf",
): Promise<void> {
  const pdf = await buildSheetsPdf(sheets, ctxFor);
  pdf.save(filename);
}
