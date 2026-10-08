/**
 * Pure SVG builder for a sheet. Single source of truth for both the on-screen
 * Sheets editor (injected as markup) and the PDF export (rasterised), so the
 * printed sheet matches what you see.
 *
 * W-06: a placed view stores a scale, so 1 paper mm equals `scale` model mm (true
 * print scale); the title block is the right-hand Indonesian column, filled from
 * the Studio Kit; captured raster items (the 3D cover) are supported.
 */

import { SHEET_SIZES, type Sheet, type SheetItem } from "@qreasee/shared";

export interface SheetTitleData {
  studio: string;
  projectName: string;
  sheetPrefix?: string;
  stageLabel?: string;
  address?: string;
  client?: string;
  consultant?: string;
  drawnBy?: string;
  checkedBy?: string;
  approvedBy?: string;
  scaleLabel: string;
}

export interface SheetSvgContext {
  /** viewId -> drawing SVG string (or null when there is no schematic). */
  drawings: Record<string, string | null>;
  title: SheetTitleData;
  selectedItemId?: string | null;
  drag?: { id: string; dx: number; dy: number } | null;
  dimDraft?: { x1: number; y1: number; x2: number; y2: number } | null;
  sheetIndex?: number;
  sheetCount?: number;
  /** W-07: inline drawings as nested `<svg>` (vector PDF export) instead of a `data:` image. */
  vector?: boolean;
  /** VW-04: viewId -> metadata for the per-viewport title. */
  views?: Record<string, { name: string }>;
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** W-07: the inner markup of a drawing SVG, for inlining into a vector sheet. */
function svgInner(svg: string): string {
  return svg.replace(/^<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "");
}

/** The model-space viewBox a drawing SVG was generated with. */
export function svgViewBox(svg: string): { x: number; y: number; w: number; h: number } | null {
  const m = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(svg);
  if (!m) return null;
  return { x: +m[1], y: +m[2], w: +m[3], h: +m[4] };
}

/**
 * W-06: the size (paper mm) a drawing occupies on a sheet at a given scale.
 * 1 paper mm == `scale` model mm.
 */
export function viewImageSize(svg: string, scale: number): { w: number; h: number } | null {
  const vb = svgViewBox(svg);
  if (!vb) return null;
  const s = scale > 0 ? scale : 100;
  return { w: vb.w / s, h: vb.h / s };
}

function applyOffset(item: SheetItem, dx: number, dy: number): SheetItem {
  if (item.kind === "dimension") {
    return { ...item, x1: item.x1 + dx, y1: item.y1 + dy, x2: item.x2 + dx, y2: item.y2 + dy };
  }
  return { ...item, x: item.x + dx, y: item.y + dy };
}

function itemMarkup(item: SheetItem, ctx: SheetSvgContext, extra = ""): string {
  const selected = item.id === ctx.selectedItemId;
  const stroke = selected ? "#f0913b" : "#334155";
  const frame = (x: number, y: number, w: number, h: number, fill: string) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${selected ? 0.5 : 0.25}"/>`;
  const label =
    "label" in item && item.label
      ? `<text x="${item.x}" y="${item.y - 1.5}" font-size="3.2" fill="#334155">${esc(item.label)}</text>`
      : "";

  if (item.kind === "view") {
    const drawing = ctx.drawings[item.viewId];
    const scale = item.scale ?? 100;
    let image = "";
    if (drawing) {
      const size = viewImageSize(drawing, scale);
      if (size) {
        const ix = item.x + (item.w - size.w) / 2;
        const iy = item.y + (item.h - size.h) / 2;
        const clipId = `clip-${item.id}`;
        const clip = `<clipPath id="${clipId}"><rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}"/></clipPath>`;
        if (ctx.vector) {
          // W-07: nested <svg> keeps the drawing as vectors + real text.
          const vb = svgViewBox(drawing) ?? { x: 0, y: 0, w: size.w * scale, h: size.h * scale };
          image =
            clip +
            `<svg x="${ix}" y="${iy}" width="${size.w}" height="${size.h}" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${clipId})">${svgInner(drawing)}</svg>`;
        } else {
          image =
            clip +
            `<image href="${dataUrl(drawing)}" x="${ix}" y="${iy}" width="${size.w}" height="${size.h}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${clipId})"/>`;
        }
      }
    } else {
      image = `<text x="${item.x + item.w / 2}" y="${item.y + item.h / 2}" text-anchor="middle" font-size="4" fill="#94a3b8">(no drawing)</text>`;
    }
    return `<g data-item-id="${item.id}">${frame(item.x, item.y, item.w, item.h, "#ffffff")}${image}${
      selected ? frame(item.x, item.y, item.w, item.h, "none") : ""
    }${label}${extra}</g>`;
  }

  if (item.kind === "image") {
    return (
      `<g data-item-id="${item.id}">` +
      frame(item.x, item.y, item.w, item.h, "#ffffff") +
      `<image href="${esc(item.src)}" x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" preserveAspectRatio="xMidYMid meet"/>` +
      frame(item.x, item.y, item.w, item.h, "none") +
      label +
      `</g>`
    );
  }

  if (item.kind === "text") {
    const w = Math.max(item.text.length * item.sizeMm * 0.6, item.sizeMm * 2);
    const box = selected
      ? `<rect x="${item.x - 1}" y="${item.y - item.sizeMm}" width="${w + 2}" height="${item.sizeMm * 1.4}" fill="none" stroke="${stroke}" stroke-width="0.2"/>`
      : "";
    return (
      `<g data-item-id="${item.id}">` +
      box +
      `<text x="${item.x}" y="${item.y}" font-size="${item.sizeMm}" fill="#0f172a" font-weight="${item.bold ? 700 : 400}">${esc(item.text)}</text>` +
      `</g>`
    );
  }

  const len = Math.hypot(item.x2 - item.x1, item.y2 - item.y1) / 1000;
  const mx = (item.x1 + item.x2) / 2;
  const my = (item.y1 + item.y2) / 2;
  const col = selected ? stroke : "#0f172a";
  return (
    `<g data-item-id="${item.id}">` +
    `<line x1="${item.x1}" y1="${item.y1}" x2="${item.x2}" y2="${item.y2}" stroke="${col}" stroke-width="0.25"/>` +
    `<line x1="${item.x1}" y1="${item.y1 - 1.2}" x2="${item.x1}" y2="${item.y1 + 1.2}" stroke="#0f172a" stroke-width="0.25"/>` +
    `<line x1="${item.x2}" y1="${item.y2 - 1.2}" x2="${item.x2}" y2="${item.y2 + 1.2}" stroke="#0f172a" stroke-width="0.25"/>` +
    `<text x="${mx}" y="${my - 1}" text-anchor="middle" font-size="3.2" fill="#0f172a">${len.toFixed(2)} m</text>` +
    `</g>`
  );
}

/** VW-04: the per-viewport title from the reference — a split circle (detail
 * number over sheet code), a rule, the view name and "SCALE 1 : …". */
function viewTitleMarkup(
  x: number,
  y: number,
  w: number,
  name: string,
  sheetNumber: string,
  detail: number,
  scale: number,
): string {
  const r = 4.2;
  const cx = x + r;
  const cy = y + r;
  const lx0 = cx + r + 1.5;
  const lx1 = x + Math.max(w, r * 2 + 12);
  const parts = [
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#0f172a" stroke-width="0.3"/>`,
    `<line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}" stroke="#0f172a" stroke-width="0.3"/>`,
    `<text x="${cx}" y="${cy - 1.1}" text-anchor="middle" font-size="3" fill="#0f172a">${detail}</text>`,
    `<text x="${cx}" y="${cy + 3}" text-anchor="middle" font-size="2.3" fill="#0f172a">${esc(sheetNumber)}</text>`,
    `<line x1="${lx0}" y1="${cy}" x2="${lx1}" y2="${cy}" stroke="#0f172a" stroke-width="0.3"/>`,
    `<text x="${lx0 + 2}" y="${cy - 1.6}" font-size="3.4" font-weight="700" fill="#0f172a">${esc(name)}</text>`,
    `<text x="${lx0 + 2}" y="${cy + 3.2}" font-size="2.4" fill="#475569" letter-spacing="0.6">SCALE   1 : ${scale}</text>`,
  ];
  return `<g>${parts.join("")}</g>`;
}

/** W-06: the right-hand Indonesian title-block column, from the Studio Kit. */
function titleBlockMarkup(
  size: { w: number; h: number },
  sheet: Sheet,
  title: SheetTitleData,
  sheetIndex: number,
  sheetCount: number,
): string {
  const cw = 64;
  const x = size.w - cw - 8;
  const y = 8;
  const h = size.h - 16;
  const scaleText = `1:${sheet.items.find((i) => i.kind === "view")?.scale ?? 100}`;

  const cells: Array<{ label?: string; value?: string; bold?: boolean; size?: number; weight: number }> = [
    { value: title.studio, bold: true, size: 4.4, weight: 0.05 },
    { value: title.address ?? "", size: 2.8, weight: 0.035 },
    { label: "KETERANGAN · NOTES", value: "", weight: 0.14 },
    { label: "NAMA PROYEK · PROJECT", value: title.projectName, weight: 0.095 },
    { label: "PEMBERI TUGAS · CLIENT", value: title.client ?? "", weight: 0.085 },
    { label: "KONSULTAN PERENCANA · CONSULTANT", value: title.consultant ?? "", weight: 0.085 },
    { label: "DIGAMBAR · DRAWN", value: title.drawnBy ?? "", weight: 0.075 },
    { label: "DIPERIKSA · CHECKED", value: title.checkedBy ?? "", weight: 0.075 },
    { label: "DISETUJUI · APPROVED", value: title.approvedBy ?? "", weight: 0.075 },
    { label: "JUDUL GAMBAR · DRAWING TITLE", value: sheet.name, bold: true, size: 4.6, weight: 0.095 },
    { label: "SKALA · SCALE", value: scaleText, weight: 0.085 },
    { label: "KODE · SHEET", value: sheet.number, bold: true, size: 5.5, weight: 0.07 },
    { label: "NO LEMBAR · SHEET", value: `${sheetIndex} / ${sheetCount}`, weight: 0.055 },
  ];
  const total = cells.reduce((s, c) => s + c.weight, 0);

  const parts: string[] = [`<rect x="${x}" y="${y}" width="${cw}" height="${h}" fill="#ffffff" stroke="#0f172a" stroke-width="0.6"/>`];
  let yy = y;
  for (const cell of cells) {
    const dh = (h * cell.weight) / total;
    parts.push(`<rect x="${x}" y="${yy.toFixed(1)}" width="${cw}" height="${dh.toFixed(1)}" fill="none" stroke="#0f172a" stroke-width="0.25"/>`);
    if (cell.label) {
      parts.push(`<text x="${x + 2}" y="${(yy + 3.4).toFixed(1)}" font-size="2.6" fill="#475569">${esc(cell.label)}</text>`);
    }
    if (cell.value) {
      parts.push(
        `<text x="${x + 2}" y="${(yy + dh - 2.6).toFixed(1)}" font-size="${cell.size ?? 3.8}" font-weight="${
          cell.bold ? 700 : 400
        }" fill="#0f172a">${esc(cell.value)}</text>`,
      );
    }
    yy += dh;
  }
  return `<g>${parts.join("")}</g>`;
}

export function sheetSvgString(sheet: Sheet, ctx: SheetSvgContext): string {
  const size = SHEET_SIZES[sheet.size];
  const items = sheet.items.map((i) =>
    ctx.drag && i.id === ctx.drag.id ? applyOffset(i, ctx.drag.dx, ctx.drag.dy) : i,
  );
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size.w} ${size.h}" width="${size.w}mm" height="${size.h}mm" font-family="${
      ctx.vector ? "Roboto" : "Arial, Helvetica, sans-serif"
    }">`,
  );
  parts.push(`<rect x="0" y="0" width="${size.w}" height="${size.h}" fill="#ffffff"/>`);
  parts.push(
    `<rect x="8" y="8" width="${size.w - 16}" height="${size.h - 16}" fill="none" stroke="#d4d4d4" stroke-width="0.2"/>`,
  );
  // VW-04: a title under every placed view (split circle + name + scale).
  let detail = 0;
  const titles: Record<string, string> = {};
  for (const item of items) {
    if (item.kind !== "view") continue;
    detail += 1;
    const name = ctx.views?.[item.viewId]?.name;
    if (!name) continue;
    const scale = item.scale ?? 100;
    const drawing = ctx.drawings[item.viewId];
    let tx = item.x;
    let ty = item.y + item.h + 1.5;
    let tw = item.w;
    const vb = drawing ? svgViewBox(drawing) : null;
    if (vb && vb.h > 0 && vb.w > 0) {
      // Match the rendered rect: the drawing is fit (xMidYMid meet) in the box.
      const aspect = vb.w / vb.h;
      let fw = item.w;
      let fh = item.w / aspect;
      if (fh > item.h) {
        fh = item.h;
        fw = item.h * aspect;
      }
      tx = item.x + (item.w - fw) / 2;
      ty = item.y + (item.h - fh) / 2 + fh + 1.5;
      tw = fw;
    }
    titles[item.id] = viewTitleMarkup(tx, ty, tw, name, sheet.number, detail, scale);
  }
  for (const item of items) parts.push(itemMarkup(item, ctx, titles[item.id] ?? ""));
  if (ctx.dimDraft) {
    parts.push(
      `<line x1="${ctx.dimDraft.x1}" y1="${ctx.dimDraft.y1}" x2="${ctx.dimDraft.x2}" y2="${ctx.dimDraft.y2}" stroke="#f0913b" stroke-width="0.3" stroke-dasharray="1.5 1"/>`,
    );
  }
  parts.push(
    titleBlockMarkup(size, sheet, ctx.title, ctx.sheetIndex ?? 1, ctx.sheetCount ?? 1),
  );
  parts.push(`</svg>`);
  return parts.join("");
}
