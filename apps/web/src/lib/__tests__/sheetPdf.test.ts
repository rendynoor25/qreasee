// @vitest-environment jsdom
/**
 * W-07: vector PDF export tests. The sheet set is built with the real
 * `svg2pdf.js` + `jsPDF` pipeline and read back with `pdfjs-dist`, so the
 * assertions are about the actual PDF: page count, paper size, extractable text
 * and vector content.
 *
 * jsdom has no SVG layout (getBBox) or canvas metrics, so the two primitives
 * svg2pdf uses for text measurement are polyfilled below. The browser path uses
 * the real implementations.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEFAULT_SCHEMATIC_OPTIONS,
  elevationSvg,
  generateSchematic,
  planSvg,
  sectionSvg,
} from "@qreasee/schematic";
import type { Sheet } from "@qreasee/shared";
import { buildReferenceHouse } from "../../fixtures/referenceHouse";
import { buildSheetsPdf, type PdfFontData } from "../sheetPdf";

const { project, docState, mass } = buildReferenceHouse();

const schematic = generateSchematic(
  mass,
  docState.brief.program.map((p) => ({ name: p.name, targetAreaM2: p.areaEach ?? p.targetArea })),
  DEFAULT_SCHEMATIC_OPTIONS,
  0,
  mass.height,
);
const drawCtx = { grids: docState.grids, levels: docState.levels };

function drawingFor(viewId: string): string | null {
  const v = docState.views.find((x) => x.id === viewId);
  if (!v) return null;
  if (v.kind === "plan") return planSvg(schematic, v.line, drawCtx);
  if (v.kind === "elevation") return elevationSvg(schematic, drawCtx);
  if (v.kind === "section") return sectionSvg(schematic, v.line, drawCtx);
  return null;
}

const ctxFor = (sheet: Sheet) => {
  const drawings: Record<string, string | null> = {};
  for (const item of sheet.items) {
    if (item.kind === "view") drawings[item.viewId] = drawingFor(item.viewId);
  }
  return {
    drawings,
    title: { studio: "Qreasee Studio", projectName: project.name, scaleLabel: "Skala" },
  };
};

const fontPath = (file: string) => `${process.cwd()}/public/fonts/${file}`;
const fonts: PdfFontData = {
  regular: readFileSync(fontPath("Roboto-Regular.ttf")).toString("base64"),
  bold: readFileSync(fontPath("Roboto-Bold.ttf")).toString("base64"),
};

let bytes: Uint8Array;
let byteLength: number;
let pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let doc: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;

beforeAll(async () => {
  // Test-only polyfills for the two primitives svg2pdf measures text with.
  const proto = SVGElement.prototype as unknown as { getBBox?: () => DOMRect };
  proto.getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect;
  HTMLCanvasElement.prototype.getContext = (() =>
    ({ measureText: () => ({ width: 0 }) }) as unknown as CanvasRenderingContext2D) as never;

  pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await buildSheetsPdf(docState.sheets, ctxFor, fonts);
  bytes = new Uint8Array(pdf.output("arraybuffer") as ArrayBuffer);
  byteLength = bytes.byteLength;
  // Parse once and reuse: pdf.js transfers the data buffer it is given.
  doc = await pdfjs.getDocument({ data: bytes.slice(), useWorkerFetch: false, isEvalSupported: false }).promise;
}, 60_000);

describe("vector sheet-set PDF (W-07)", () => {
  it("exports one page per sheet at the correct paper size", async () => {
    expect(doc.numPages).toBe(7);
    const page = await doc.getPage(1);
    const vp = page.getViewport({ scale: 1 });
    // A3 landscape = 420 × 297 mm.
    expect((vp.width * 25.4) / 72).toBeCloseTo(420, 0);
    expect((vp.height * 25.4) / 72).toBeCloseTo(297, 0);
  });

  it("keeps text real and selectable (title block + sheet number)", async () => {
    const page = await doc.getPage(2); // A101
    const tc = await page.getTextContent();
    const text = tc.items.map((i) => i.str).join(" ");
    expect(text).toMatch(/A101/);
    expect(text).toMatch(/NAMA PROYEK/);
  });

  it("draws vector content, including the cover, with no raster images", async () => {
    for (const n of [1, 2]) {
      const page = await doc.getPage(n);
      const ops = await page.getOperatorList();
      expect(ops.fnArray.length).toBeGreaterThan(40);
      expect(ops.fnArray).not.toContain(pdfjs.OPS.paintImageXObject);
    }
  });

  it("stays under the file-size budget", () => {
    expect(byteLength).toBeLessThan(3_000_000);
  });
});
