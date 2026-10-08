/**
 * Automatic Plan / Section / Elevation drawings as SVG. The sheet is framed so
 * the drawing fills ~80% of the viewBox (12.5% padding each side).
 *
 * W-04: line weights come from a **pen table in paper millimetres** (Studio Kit
 * starter values) multiplied by the view's scale denominator, so a 0.35 mm cut
 * line reads correctly on a 1:100 sheet.
 */

import { bounds } from "@qreasee/geometry";
import {
  DEFAULT_PEN,
  materialById,
  type GridLine,
  type Level,
  type PenTable,
  type Point,
} from "@qreasee/shared";
import type { OpeningMark, Room, Schematic, SectionLine, WallPanel } from "./types";
import { roofPlanLines } from "./roof";
import { hatchSegments, hatchSpacingPaperMm } from "./hatch";
import { defaultSectionLine, sectionAtLine } from "./section";
import { stairTreads } from "./stairs";

type Mapper = (x: number, y: number) => [number, number];

/** W-05: which annotations a view draws. All default true. */
export interface AnnotationToggles {
  dimensions?: boolean;
  tags?: boolean;
  north?: boolean;
  scaleBar?: boolean;
  sections?: boolean;
}

/** A section line on a plan plus the sheet its section view is placed on. */
export interface SectionMarkInput {
  name: string;
  line: { a: Point; b: Point };
  sheetNumber?: string;
}

/** Optional drawing annotations (grids, levels, pen). All are additive. */
export interface DrawingContext {
  grids?: GridLine[];
  levels?: Level[];
  /** Draw grid lines, bubbles and dimension chains. Default true. */
  showGrids?: boolean;
  /** Draw level markers on sections/elevations. Default true. */
  showLevels?: boolean;
  /** W-04 pen table in paper mm. */
  pen?: PenTable;
  /** Scale denominator, e.g. 100 for 1:100. Default 100. */
  scale?: number;
  /** Part 4: dimension text height in paper mm (default 2.5). */
  dimTextMm?: number;
  /** W-05: plan annotations + the model north angle (degrees). */
  annotations?: AnnotationToggles;
  northAngle?: number;
  sections?: SectionMarkInput[];
  /** Part 2 §2: draw the diagnostic overlay (origin, layer bboxes, centerlines). */
  debug?: boolean;
}

class Canvas {
  parts: string[] = [];
  private minX = Infinity;
  private minY = Infinity;
  private maxX = -Infinity;
  private maxY = -Infinity;

  constructor(private map: Mapper) {}

  private track(sx: number, sy: number) {
    this.minX = Math.min(this.minX, sx);
    this.minY = Math.min(this.minY, sy);
    this.maxX = Math.max(this.maxX, sx);
    this.maxY = Math.max(this.maxY, sy);
  }

  private m(x: number, y: number): [number, number] {
    const [sx, sy] = this.map(x, y);
    this.track(sx, sy);
    return [sx, sy];
  }

  /** Map a point and include a margin in the bounds (for bubbles/labels). */
  pad(x: number, y: number, r: number) {
    this.m(x - r, y - r);
    this.m(x + r, y + r);
  }

  circle(x: number, y: number, r: number, attrs: string) {
    const [sx, sy] = this.m(x, y);
    this.pad(x, y, r);
    this.parts.push(`<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${r.toFixed(1)}" ${attrs}/>`);
  }

  polygon(points: readonly Point[] | Array<[number, number]>, attrs: string) {
    if (points.length < 3) return;
    const d = points
      .map((p, i) => {
        const [sx, sy] = Array.isArray(p) ? this.m(p[0], p[1]) : this.m(p.x, p.y);
        return `${i === 0 ? "M" : "L"}${sx.toFixed(1)},${sy.toFixed(1)}`;
      })
      .join(" ");
    this.parts.push(`<path d="${d} Z" ${attrs}/>`);
  }

  line(a: Point | [number, number], b: Point | [number, number], attrs: string) {
    const [ax, ay] = Array.isArray(a) ? this.m(a[0], a[1]) : this.m(a.x, a.y);
    const [bx, by] = Array.isArray(b) ? this.m(b[0], b[1]) : this.m(b.x, b.y);
    this.parts.push(
      `<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" ${attrs}/>`,
    );
  }

  polyline(points: Array<[number, number]>, attrs: string) {
    if (points.length < 2) return;
    const d = points
      .map((p, i) => {
        const [sx, sy] = this.m(p[0], p[1]);
        return `${i === 0 ? "M" : "L"}${sx.toFixed(1)},${sy.toFixed(1)}`;
      })
      .join(" ");
    this.parts.push(`<path d="${d}" ${attrs}/>`);
  }

  text(x: number, y: number, str: string, attrs: string) {
    const [sx, sy] = this.m(x, y);
    this.parts.push(
      `<text x="${sx.toFixed(1)}" y="${sy.toFixed(1)}" ${attrs}>${escapeXml(str)}</text>`,
    );
  }

  /** Text rotated -90° about its own anchor (for vertical dimensions). */
  textRot(x: number, y: number, str: string, attrs: string) {
    const [sx, sy] = this.m(x, y);
    this.parts.push(
      `<text x="${sx.toFixed(1)}" y="${sy.toFixed(1)}" transform="rotate(-90 ${sx.toFixed(1)} ${sy.toFixed(
        1,
      )})" ${attrs}>${escapeXml(str)}</text>`,
    );
  }

  /** Push raw markup without affecting the drawing bounds (e.g. clip paths). */
  raw(markup: string) {
    this.parts.push(markup);
  }

  /** Emit a clipPath rect (model coords) without affecting the bounds. */
  clipRect(id: string, x0: number, y0: number, x1: number, y1: number) {
    const [ax, ay] = this.map(x0, y0);
    const [bx, by] = this.map(x1, y1);
    const rx = Math.min(ax, bx);
    const ry = Math.min(ay, by);
    const rw = Math.abs(bx - ax);
    const rh = Math.abs(by - ay);
    this.parts.push(
      `<clipPath id="${id}"><rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}"/></clipPath>`,
    );
  }

  toSvg(title: string): string {
    if (!Number.isFinite(this.minX)) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>`;
    }
    const w = this.maxX - this.minX;
    const h = this.maxY - this.minY;
    const pad = Math.max(w, h, 1) * 0.125; // ~80% of the sheet
    const vbX = this.minX - pad;
    const vbY = this.minY - pad;
    const vbW = w + pad * 2;
    const vbH = h + pad * 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX.toFixed(1)} ${vbY.toFixed(1)} ${vbW.toFixed(
      1,
    )} ${vbH.toFixed(1)}" width="100%" preserveAspectRatio="xMidYMid meet">
  <rect x="${vbX.toFixed(1)}" y="${vbY.toFixed(1)}" width="${vbW.toFixed(1)}" height="${vbH.toFixed(
    1,
  )}" fill="#ffffff"/>
  ${
    title
      ? `<text x="${(vbX + pad * 0.3).toFixed(1)}" y="${(vbY + pad * 0.9).toFixed(1)}" font-family="sans-serif" font-size="${
          Math.max(w, h) * 0.03
        }" fill="#111">${escapeXml(title)}</text>`
      : ""
  }
  ${this.parts.join("\n  ")}
</svg>`;
  }
}

/** Pen table + scale, resolved from the drawing context. */
interface Pen {
  cut: number;
  projection: number;
  annotation: number;
  grid: number;
  scale: number;
  /** Part 4: dimension text height in model units (paper mm × scale). */
  dimText: number;
  /** paper mm → model sketch units. */
  w: (mm: number) => number;
}

function makePen(ctx: DrawingContext): Pen {
  const scale = ctx.scale && ctx.scale > 0 ? ctx.scale : 100;
  const p = { ...DEFAULT_PEN, ...ctx.pen };
  return { ...p, scale, dimText: (ctx.dimTextMm ?? 2.5) * scale, w: (mm: number) => mm * scale };
}

const stroke = (color: string, width: number, extra = "") =>
  `stroke="${color}" stroke-width="${width.toFixed(1)}" fill="none" ${extra}`.trim();
const fillStroke = (fill: string, color: string, width: number, extra = "") =>
  `fill="${fill}" stroke="${color}" stroke-width="${width.toFixed(1)}" ${extra}`.trim();
const dash = (pen: Pen, aMm: number, bMm: number) =>
  `stroke-dasharray="${pen.w(aMm).toFixed(1)} ${pen.w(bMm).toFixed(1)}"`;
const dashDot = (pen: Pen) =>
  `stroke-dasharray="${pen.w(4).toFixed(1)} ${pen.w(1.5).toFixed(1)} ${pen.w(0.6).toFixed(1)} ${pen
    .w(1.5)
    .toFixed(1)}"`;

const norm = (v: Point): Point => {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
};

/** W-08: hatch a polygon when its material reads as masonry/stone. */
function drawHatch(c: Canvas, polygon: Point[], materialId: string | undefined, pen: Pen, angleDeg = 45) {
  const spacingPaperMm = hatchSpacingPaperMm(materialId);
  if (spacingPaperMm === null) return;
  const attrs = stroke("#111", Math.max(pen.w(pen.annotation) * 0.6, 1));
  for (const [a, b] of hatchSegments(polygon, angleDeg, pen.w(spacingPaperMm))) {
    c.line(a, b, attrs);
  }
}

interface Rect {
  min: Point;
  max: Point;
}

/** Part 3 §1: expand a wall panel's quad outward by `by` (to make the union
 * outline band) and extend its ends by `extend` (to close corner gaps). */
function outsetQuad(poly: Point[], by: number, extend: number): Point[] {
  const a = poly[0];
  const b = poly[1];
  const d = poly[3];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const vx = d.x - a.x;
  const vy = d.y - a.y;
  const vlen = Math.hypot(vx, vy) || 1;
  const ox = vx / vlen;
  const oy = vy / vlen;
  const pt = (base: Point, along: number, out: number): Point => ({
    x: base.x + ux * along + ox * out,
    y: base.y + uy * along + oy * out,
  });
  return [pt(a, -extend, -by), pt(b, extend, -by), pt(b, extend, by), pt(a, -extend, by)];
}

/** Part 2 §3: grid lines with bubbles and the three dimension chains — interior
 * (wall faces), grid-to-grid and overall — ordered outward from the building, on
 * both sides of each axis. */
function drawGrids(c: Canvas, s: Schematic, grids: GridLine[], b: Rect, pen: Pen) {
  const span = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, 1000);
  const bubbleR = Math.max(pen.w(3.6), span * 0.011);
  const tick = Math.max(pen.w(1.1), span * 0.005);
  const offInterior = pen.w(4);
  const offGrid = pen.w(7);
  const offOverall = pen.w(10);
  const endAt = pen.w(13.5);
  const gridAttrs = stroke("#8a93a0", pen.w(pen.grid), dashDot(pen));
  const xs = grids
    .filter((g) => g.axis === "x")
    .slice()
    .sort((a, z) => a.offset - z.offset);
  const ys = grids
    .filter((g) => g.axis === "y")
    .slice()
    .sort((a, z) => a.offset - z.offset);
  const xCoords = xs.map((g) => g.offset);
  const yCoords = ys.map((g) => g.offset);

  for (const g of xs) {
    c.line({ x: g.offset, y: b.min.y - endAt }, { x: g.offset, y: b.max.y + endAt }, gridAttrs);
    bubble(c, g.offset, b.max.y + endAt, bubbleR, g.label, pen);
    bubble(c, g.offset, b.min.y - endAt, bubbleR, g.label, pen);
  }
  for (const g of ys) {
    c.line({ x: b.min.x - endAt, y: g.offset }, { x: b.max.x + endAt, y: g.offset }, gridAttrs);
    bubble(c, b.min.x - endAt, g.offset, bubbleR, g.label, pen);
    bubble(c, b.max.x + endAt, g.offset, bubbleR, g.label, pen);
  }

  // Interior chain: one point per wall centreline inside the building.
  const isVertical = (w: WallPanel) => Math.abs(w.polygon[1].x - w.polygon[0].x) < Math.abs(w.polygon[1].y - w.polygon[0].y);
  const centerX = (w: WallPanel) => (Math.min(...w.polygon.map((p) => p.x)) + Math.max(...w.polygon.map((p) => p.x))) / 2;
  const centerY = (w: WallPanel) => (Math.min(...w.polygon.map((p) => p.y)) + Math.max(...w.polygon.map((p) => p.y))) / 2;
  const wallX = uniqueSorted(s.walls.filter(isVertical).map(centerX)).filter((x) => x > b.min.x + 1 && x < b.max.x - 1);
  const wallY = uniqueSorted(s.walls.filter((w) => !isVertical(w)).map(centerY)).filter(
    (y) => y > b.min.y + 1 && y < b.max.y - 1,
  );

  for (const sign of [-1, 1]) {
    const edgeY = sign < 0 ? b.min.y : b.max.y;
    const at = (off: number) => edgeY + sign * off;
    dimH(c, wallX, at(offInterior), sign, edgeY, tick, pen);
    dimH(c, xCoords, at(offGrid), sign, edgeY, tick, pen);
    dimH(c, [xCoords[0], xCoords[xCoords.length - 1]], at(offOverall), sign, edgeY, tick, pen);
  }
  for (const sign of [-1, 1]) {
    const edgeX = sign < 0 ? b.min.x : b.max.x;
    const at = (off: number) => edgeX + sign * off;
    dimV(c, wallY, at(offInterior), sign, edgeX, tick, pen);
    dimV(c, yCoords, at(offGrid), sign, edgeX, tick, pen);
    dimV(c, [yCoords[0], yCoords[yCoords.length - 1]], at(offOverall), sign, edgeX, tick, pen);
  }
}

/** A grid bubble: a white circle with the label centred by cap height. */
function bubble(c: Canvas, x: number, y: number, r: number, label: string, pen: Pen) {
  c.circle(x, y, r, fillStroke("#ffffff", "#111", pen.w(pen.annotation)));
  c.text(
    x,
    y + r * 0.33,
    label,
    `font-family="sans-serif" font-size="${(r * 0.92).toFixed(0)}" text-anchor="middle" fill="#111"`,
  );
}

function uniqueSorted(vals: number[], tol = 80): number[] {
  const sorted = [...vals].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) {
    if (!out.length || Math.abs(v - out[out.length - 1]) > tol) out.push(v);
  }
  return out;
}

/** A horizontal dimension chain at model y, with 45° ticks + extension lines. */
function dimH(c: Canvas, coords: number[], y: number, sign: number, edgeY: number, tick: number, pen: Pen) {
  if (coords.length < 2) return;
  const attrs = stroke("#111", pen.w(pen.annotation));
  c.line({ x: coords[0], y }, { x: coords[coords.length - 1], y }, attrs);
  for (const x of coords) {
    c.line({ x: x - tick, y: y - tick }, { x: x + tick, y: y + tick }, attrs);
    c.line({ x, y: edgeY }, { x, y: y + sign * tick }, stroke("#111", pen.w(pen.grid) * 1.4));
  }
  for (let i = 0; i < coords.length - 1; i++) {
    const val = Math.round(coords[i + 1] - coords[i]);
    if (val < 60) continue;
    c.text(
      (coords[i] + coords[i + 1]) / 2,
      y - sign * tick * 1.5,
      `${val}`,
      `font-family="sans-serif" font-size="${pen.dimText.toFixed(0)}" text-anchor="middle" fill="#111"`,
    );
  }
}

/** A vertical dimension chain at model x; the text reads from the right. */
function dimV(c: Canvas, coords: number[], x: number, sign: number, edgeX: number, tick: number, pen: Pen) {
  if (coords.length < 2) return;
  const attrs = stroke("#111", pen.w(pen.annotation));
  c.line({ x, y: coords[0] }, { x, y: coords[coords.length - 1] }, attrs);
  for (const y of coords) {
    c.line({ x: x - tick, y: y - tick }, { x: x + tick, y: y + tick }, attrs);
    c.line({ x: edgeX, y }, { x: x + sign * tick, y }, stroke("#111", pen.w(pen.grid) * 1.4));
  }
  for (let i = 0; i < coords.length - 1; i++) {
    const val = Math.round(coords[i + 1] - coords[i]);
    if (val < 60) continue;
    c.textRot(
      x - sign * tick * 1.5,
      (coords[i] + coords[i + 1]) / 2,
      `${val}`,
      `font-family="sans-serif" font-size="${pen.dimText.toFixed(0)}" text-anchor="middle" fill="#111"`,
    );
  }
}

/** Level markers: a dashed line + an elevation tag at the right end. */
function drawLevels(c: Canvas, levels: Level[], x0: number, x1: number, rightX: number, span: number, pen: Pen) {
  const fs = Math.max(240, span * 0.02);
  const tri = fs * 0.9;
  const lineAttrs = stroke("#8a93a0", pen.w(pen.grid), dash(pen, 5, 3));
  for (const l of levels) {
    c.line({ x: x0 - span * 0.06, y: l.elevation }, { x: rightX, y: l.elevation }, lineAttrs);
    c.polygon(
      [
        { x: rightX, y: l.elevation - tri / 2 },
        { x: rightX, y: l.elevation + tri / 2 },
        { x: rightX + tri, y: l.elevation },
      ],
      'fill="#111" stroke="none"',
    );
    c.text(
      rightX + tri * 1.4,
      l.elevation + fs * 0.35,
      `${l.name} +${(l.elevation / 1000).toFixed(2)}`,
      `font-family="sans-serif" font-size="${fs.toFixed(0)}" fill="#111"`,
    );
    // Keep the (right-anchored) level label inside the drawing viewBox.
    const label = `${l.name} +${(l.elevation / 1000).toFixed(2)}`;
    c.pad(rightX + tri * 1.4 + label.length * fs * 0.6, l.elevation, fs * 0.4);
  }
}

// --- W-04 symbols ----------------------------------------------------------

/** A standard door symbol: leaf + quarter-circle swing arc. */
function drawDoorSwing(c: Canvas, op: OpeningMark, pen: Pen) {
  const hinge = op.quad[0];
  const jamb = op.quad[1];
  const inner = op.quad[3];
  const perp = norm({ x: inner.x - hinge.x, y: inner.y - hinge.y });
  const width = Math.hypot(jamb.x - hinge.x, jamb.y - hinge.y);
  const leafEnd = { x: hinge.x + perp.x * width, y: hinge.y + perp.y * width };
  const attrs = stroke("#111", pen.w(pen.annotation));
  c.line(hinge, jamb, attrs);
  c.line(hinge, leafEnd, attrs);
  const a0 = Math.atan2(leafEnd.y - hinge.y, leafEnd.x - hinge.x);
  const a1 = Math.atan2(jamb.y - hinge.y, jamb.x - hinge.x);
  let d = a1 - a0;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 12; i++) {
    const a = a0 + (d * i) / 12;
    pts.push([hinge.x + Math.cos(a) * width, hinge.y + Math.sin(a) * width]);
  }
  c.polyline(pts, attrs);
}

/** A window symbol: two glazing lines across the opening. */
function drawWindowSymbol(c: Canvas, op: OpeningMark, pen: Pen) {
  const a = op.quad[0];
  const b = op.quad[1];
  const d = op.quad[3];
  const attrs = stroke("#111", pen.w(pen.projection));
  c.line(a, b, attrs);
  c.line(d, op.quad[2], attrs);
  for (const t of [1 / 3, 2 / 3]) {
    c.line(
      { x: a.x + (d.x - a.x) * t, y: a.y + (d.y - a.y) * t },
      { x: b.x + (d.x - a.x) * t, y: b.y + (d.y - a.y) * t },
      attrs,
    );
  }
}

/** Part 4 §5: one stair group gets one arrow and one "UP"; a stair below the level
 * is drawn thin in projection with no "UP". */
function drawStair(c: Canvas, st: Schematic["stairs"][number], pen: Pen, label: boolean) {
  const thin = !!st.projection;
  c.polygon(st.outline, stroke("#111", pen.w(pen.projection), dash(pen, 3, 2)));
  const treadAttrs = stroke("#111", thin ? pen.w(pen.grid) : pen.w(pen.annotation));
  for (const [a, b] of stairTreads(st)) c.line(a, b, treadAttrs);
  if (!label) return;
  const r0 = st.runs[0];
  if (!r0) return;
  c.line(r0.a, r0.b, treadAttrs);
  const dir = norm({ x: r0.b.x - r0.a.x, y: r0.b.y - r0.a.y });
  const tip = { x: r0.b.x - dir.x * 200, y: r0.b.y - dir.y * 200 };
  const head = Math.max(220, pen.w(2.2));
  c.polygon(
    [
      { x: r0.b.x, y: r0.b.y },
      { x: tip.x - dir.y * head * 0.5, y: tip.y + dir.x * head * 0.5 },
      { x: tip.x + dir.y * head * 0.5, y: tip.y - dir.x * head * 0.5 },
    ],
    'fill="#111" stroke="none"',
  );
  const mx = (r0.a.x + r0.b.x) / 2;
  const my = (r0.a.y + r0.b.y) / 2;
  c.text(mx, my - pen.w(1.5), "UP", `font-family="sans-serif" font-size="${pen.w(2.8).toFixed(0)}" text-anchor="middle" fill="#111"`);
}

/** Short section code, e.g. "Potongan A-A'" → "A". */
function sectionCode(name: string): string {
  const m = name.match(/\b([A-Z])\b/);
  return m ? m[1] : name.slice(0, 3);
}

/** Part 2 §5: a section line like the reference — a black dash-dot line, a split
 * circle head (detail number over sheet code) with a filled arrow, and a thick
 * end bar. Printed in black; colour is only for on-screen selection. */
function drawSections(c: Canvas, sections: SectionMarkInput[], pen: Pen) {
  sections.forEach((m, i) => {
    const len = Math.hypot(m.line.b.x - m.line.a.x, m.line.b.y - m.line.a.y) || 1;
    const dir = norm({ x: m.line.b.x - m.line.a.x, y: m.line.b.y - m.line.a.y });
    const perp = { x: -dir.y, y: dir.x };
    const r = Math.max(320, len * 0.018);
    const detail = String(i + 1);
    const code = m.sheetNumber ?? sectionCode(m.name);
    c.line(m.line.a, m.line.b, stroke("#111", pen.w(pen.annotation), dashDot(pen)));
    const a = m.line.a;
    const b = m.line.b;
    // Head at the 'a' end: split circle + filled arrow pointing across the line.
    c.circle(a.x, a.y, r, fillStroke("#ffffff", "#111", pen.w(pen.cut)));
    c.line({ x: a.x - r, y: a.y }, { x: a.x + r, y: a.y }, stroke("#111", pen.w(pen.annotation)));
    c.text(a.x, a.y - r * 0.2, detail, `font-family="sans-serif" font-size="${(r * 1.0).toFixed(0)}" text-anchor="middle" fill="#111"`);
    c.text(a.x, a.y + r * 0.85, code, `font-family="sans-serif" font-size="${(r * 0.85).toFixed(0)}" text-anchor="middle" fill="#111"`);
    const tip = { x: a.x + perp.x * r * 1.9, y: a.y + perp.y * r * 1.9 };
    const bc = { x: a.x + perp.x * r * 0.9, y: a.y + perp.y * r * 0.9 };
    c.polygon(
      [
        tip,
        { x: bc.x + dir.x * r * 0.7, y: bc.y + dir.y * r * 0.7 },
        { x: bc.x - dir.x * r * 0.7, y: bc.y - dir.y * r * 0.7 },
      ],
      'fill="#111" stroke="none"',
    );
    // Thick end bar at the 'b' end.
    const half = r * 1.4;
    c.line(
      { x: b.x + perp.x * half, y: b.y + perp.y * half },
      { x: b.x - perp.x * half, y: b.y - perp.y * half },
      stroke("#111", pen.w(pen.cut) * 2),
    );
  });
}

/** Part 4 §2.2: door tags (D1, D2, …) only — window tags are removed. */
function drawOpeningTags(c: Canvas, marks: OpeningMark[], pen: Pen) {
  let d = 0;
  const attrs = stroke("#111", pen.w(pen.annotation));
  for (const op of marks) {
    if (op.kind !== "door") continue;
    const label = `D${++d}`;
    const a = op.quad[0];
    const b = op.quad[1];
    const inner = op.quad[3];
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const outward = norm({ x: a.x - inner.x, y: a.y - inner.y });
    const off = pen.w(6);
    const tx = cx + outward.x * off;
    const ty = cy + outward.y * off;
    c.line({ x: cx, y: cy }, { x: tx, y: ty }, attrs);
    c.text(
      tx,
      ty + pen.w(1),
      label,
      `font-family="sans-serif" font-size="${pen.w(2.6).toFixed(0)}" text-anchor="middle" fill="#111"`,
    );
  }
}

/** W-05: a north arrow rotated by the model north angle. */
function drawNorthArrow(c: Canvas, b: Rect, angleDeg: number, pen: Pen) {
  const span = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, 1000);
  const size = span * 0.05;
  const cx = b.max.x + size * 1.8;
  const cy = b.max.y + size * 1.8;
  const a = (angleDeg * Math.PI) / 180;
  const tip = { x: cx + Math.sin(a) * size, y: cy + Math.cos(a) * size };
  const left = { x: cx + Math.sin(a + Math.PI / 2) * size * 0.32, y: cy + Math.cos(a + Math.PI / 2) * size * 0.32 };
  const right = { x: cx + Math.sin(a - Math.PI / 2) * size * 0.32, y: cy + Math.cos(a - Math.PI / 2) * size * 0.32 };
  c.polygon([tip, left, right], 'fill="#111" stroke="none"');
  c.text(
    cx + Math.sin(a) * size * 1.6,
    cy + Math.cos(a) * size * 1.6,
    "N",
    `font-family="sans-serif" font-size="${pen.w(3).toFixed(0)}" text-anchor="middle" fill="#111"`,
  );
}

/** W-05: a graphic scale bar (1 m divisions). */
function drawScaleBar(c: Canvas, b: Rect, pen: Pen) {
  const span = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, 1000);
  const seg = 1000;
  const n = Math.min(5, Math.max(2, Math.round(span / 2000)));
  const y = b.min.y - span * 0.2;
  const x0 = b.min.x;
  const h = pen.w(3);
  const sw = pen.w(pen.annotation).toFixed(1);
  for (let i = 0; i < n; i++) {
    const x = x0 + i * seg;
    c.polygon(
      [
        { x, y },
        { x: x + seg, y },
        { x: x + seg, y: y - h },
        { x, y: y - h },
      ],
      i % 2 === 0 ? 'fill="#111" stroke="none"' : `fill="#ffffff" stroke="#111" stroke-width="${sw}"`,
    );
  }
  const fs = `font-family="sans-serif" font-size="${pen.w(2.4).toFixed(0)}" fill="#111"`;
  c.text(x0, y + pen.w(3), "0", fs);
  c.text(x0 + n * seg, y + pen.w(3), `${n} m`, `font-family="sans-serif" font-size="${pen.w(2.4).toFixed(0)}" text-anchor="end" fill="#111"`);
}

/** Part 2 §2: a diagnostic overlay — world origin, layer bounding boxes and wall
 * centerlines. Toggle with `?debugPlan=1`; never part of a printed sheet. */
function drawDebug(c: Canvas, s: Schematic, pen: Pen) {
  const w = Math.max(pen.w(0.4), 1);
  const fs = `font-family="sans-serif" font-size="${pen.w(3).toFixed(0)}"`;
  const box = (polys: Point[][], color: string, label: string) => {
    const pts = polys.flat();
    if (!pts.length) return;
    const bb = bounds(pts);
    c.polygon(
      [
        { x: bb.min.x, y: bb.min.y },
        { x: bb.max.x, y: bb.min.y },
        { x: bb.max.x, y: bb.max.y },
        { x: bb.min.x, y: bb.max.y },
      ],
      stroke(color, w),
    );
    c.text(bb.min.x, bb.min.y, label, `${fs} fill="${color}"`);
  };
  c.line({ x: -2000, y: 0 }, { x: 2000, y: 0 }, stroke("#e11d48", w));
  c.line({ x: 0, y: -2000 }, { x: 0, y: 2000 }, stroke("#e11d48", w));
  c.text(2000, 0, "world 0,0", `${fs} fill="#e11d48"`);
  box(s.walls.map((x) => x.polygon), "#dc2626", "walls");
  box(s.rooms.map((x) => x.polygon), "#2563eb", "rooms");
  box(s.slabs.map((x) => x.polygon), "#16a34a", "slabs");
  for (const x of s.walls) {
    const p = x.polygon;
    c.line(
      { x: (p[0].x + p[3].x) / 2, y: (p[0].y + p[3].y) / 2 },
      { x: (p[1].x + p[2].x) / 2, y: (p[1].y + p[2].y) / 2 },
      stroke("#a21caf", w),
    );
  }
}

/** Part 4 §6: a plan finish colour by room type (cream / wet / paving / service),
 * until materials carry their own `plan2d` fill. */
function roomPlanFill(name: string): string {
  const n = name.toLowerCase();
  if (/teras|carport|parkir|parking|paving|jalan|taman|grass|lawn/.test(n)) return "#a9aa8f";
  if (/wc|km\b|kamar mandi|mandi|cuci|laundry|jemur|bath|shower/.test(n)) return "#e6e0c6";
  if (/dapur|kitchen|pantry|gudang|garasi|service|art/.test(n)) return "#fbf6e6";
  return "#f4eac2";
}

export function planSvg(s: Schematic, line?: SectionLine, ctx: DrawingContext = {}): string {
  const pen = makePen(ctx);
  // VW-02: the reference (Revit) draws cut walls as a LIGHT fill with a heavy
  // outline, not a dark solid poché.
  const wallFill = "#ecebe7";
  const heavy = pen.w(pen.cut) * 1.5;
  const ann = { dimensions: true, tags: true, north: true, scaleBar: false, sections: true, ...ctx.annotations };
  const c = new Canvas((x, y) => [x, -y]);
  // Part 4 §7: the floor is the ROOM FINISHES, not the raw imported slab polygons
  // (those leaked as grey-blue patches and beige blocks that do not follow the
  // walls). Bounds come from walls + rooms + roof, so the crop tracks the building.
  const boundsPts: Point[] = [
    ...s.rooms.flatMap((r) => r.polygon),
    ...s.walls.flatMap((w) => w.polygon),
    ...(s.roofOnLevel ? s.roof.outline : []),
    ...(s.railings ?? []).flatMap((r) => [r.a, r.b]),
  ];
  const b = bounds(boundsPts.length ? boundsPts : s.roof.outline);
  // Part 4 §6: bound the floor by the walls — clip the room fills to the exterior
  // wall bounding box so they never spill outside the building.
  const wallPts = s.walls.flatMap((w) => w.polygon);
  if (wallPts.length) {
    const wb = bounds(wallPts);
    c.clipRect("roomclip", wb.min.x - 1, wb.min.y - 1, wb.max.x + 1, wb.max.y + 1);
    c.raw('<g clip-path="url(#roomclip)">');
  }
  for (const room of s.rooms) {
    // Part 4 §4/§6: opaque finish fills by room type, text-only tags with a halo.
    c.polygon(room.polygon, `fill="${roomPlanFill(room.name)}" fill-opacity="1" stroke="none"`);
    const b = bounds(room.polygon);
    if (ann.tags) {
      const halo = `stroke="#ffffff" stroke-width="${pen.w(0.8).toFixed(1)}" paint-order="stroke"`;
      c.text(
        b.center.x,
        b.center.y,
        room.name,
        `font-family="sans-serif" font-size="${pen.w(2.4).toFixed(0)}" text-anchor="middle" fill="#1f2937" ${halo}`,
      );
      c.text(
        b.center.x,
        b.center.y + pen.w(3.2),
        `${(room.areaMm2 / 1e6).toFixed(1)} m²`,
        `font-family="sans-serif" font-size="${pen.w(1.7).toFixed(0)}" text-anchor="middle" fill="#475569" ${halo}`,
      );
    }
  }
  if (wallPts.length) c.raw("</g>");
  // Part 3 §1: join the walls. Draw the union of the *outset* footprints in the
  // outline colour, then the wall footprints in poché on top — one continuous
  // outline, no lines inside corners/T-junctions, no boolean library needed.
  const panelThickness = (p: Point[]) => Math.hypot(p[3].x - p[0].x, p[3].y - p[0].y);
  const maxThick = Math.max(100, ...s.walls.map((w) => panelThickness(w.polygon)));
  const extend = maxThick / 2;
  for (const w of s.walls) {
    c.polygon(outsetQuad(w.polygon, heavy / 2, extend), 'fill="#111" stroke="none"');
  }
  for (const w of s.walls) c.polygon(w.polygon, `fill="${wallFill}" stroke="none"`);
  // W-08: railing runs.
  for (const rl of s.railings ?? []) c.line(rl.a, rl.b, stroke("#111", pen.w(pen.annotation)));
  // VW-02: only openings crossed by the cut plane read as a hole; openings above
  // the cut are dashed (seen), those below show in projection over solid poché.
  for (const op of s.openingMarks) {
    const state = op.cutState ?? "cut";
    if (state === "cut") {
      c.polygon(op.quad, 'fill="#ffffff" stroke="none"');
      if (op.kind === "door") drawDoorSwing(c, op, pen);
      else drawWindowSymbol(c, op, pen);
    } else if (state === "above") {
      c.polygon(op.quad, fillStroke(wallFill, "#111", heavy));
      c.polygon(op.quad, stroke("#111", pen.w(pen.projection), dash(pen, 5, 3)));
    } else {
      c.polygon(op.quad, fillStroke(wallFill, "#111", heavy));
      if (op.kind === "door") drawDoorSwing(c, op, pen);
      else drawWindowSymbol(c, op, pen);
    }
  }
  if (ann.tags) drawOpeningTags(c, s.openingMarks, pen);
  // W-08 roof plan: on the roof's own level draw the eaves + ridge/hip/valley
  // lines; on a lower level keep the roof as a dashed outline above.
  if (s.roofOnLevel) {
    const roofPlan = roofPlanLines(s.roof);
    c.polygon(roofPlan.eaves, stroke("#111", pen.w(pen.projection)));
    for (const [ra, rb] of roofPlan.lines) c.line(ra, rb, stroke("#111", pen.w(pen.cut)));
  } else {
    c.polygon(s.roof.outline, stroke("#8a93a0", pen.w(pen.projection), dash(pen, 5, 3)));
  }
  // Part 4 §5: one arrow/"UP" for all the cut flights on the level (the IFC
  // splits one stair into many flights); the stair below draws thin, with no "UP".
  const cutStairs = (s.stairs ?? []).filter((st) => !st.projection);
  const projStairs = (s.stairs ?? []).filter((st) => st.projection);
  cutStairs.forEach((st, i) => drawStair(c, st, pen, i === 0));
  projStairs.forEach((st) => drawStair(c, st, pen, false));
  if (ann.sections) {
    if (ctx.sections && ctx.sections.length) {
      drawSections(c, ctx.sections, pen);
    } else if (line) {
      c.line(line.a, line.b, stroke("#111", pen.w(pen.annotation), dashDot(pen)));
      const r = Math.max(320, Math.hypot(line.b.x - line.a.x, line.b.y - line.a.y) * 0.018);
      for (const p of [line.a, line.b]) {
        c.circle(p.x, p.y, r, fillStroke("#ffffff", "#111", pen.w(pen.cut)));
        c.text(
          p.x,
          p.y + r * 0.35,
          "A",
          `font-family="sans-serif" font-size="${(r * 1.0).toFixed(0)}" text-anchor="middle" fill="#111"`,
        );
      }
    }
  }
  const grids = ctx.grids ?? [];
  if (ann.dimensions) {
    if (grids.length && ctx.showGrids !== false) drawGrids(c, s, grids, b, pen);
    else drawDimensions(c, s, pen);
  }
  if (ann.north) drawNorthArrow(c, b, ctx.northAngle ?? 0, pen);
  if (ann.scaleBar) drawScaleBar(c, b, pen);
  if (ctx.debug) drawDebug(c, s, pen);
  return c.toSvg("");
}

function drawDimensions(c: Canvas, s: Schematic, pen: Pen) {
  const floor = s.slabs.find((sl) => sl.kind === "floor");
  if (!floor) return;
  const b = bounds(floor.polygon);
  const off = pen.w(8);
  const attrs = stroke("#111", pen.w(pen.annotation));
  c.line({ x: b.min.x, y: b.min.y - off }, { x: b.max.x, y: b.min.y - off }, attrs);
  c.text(
    b.center.x,
    b.min.y - off - pen.w(2),
    `${((b.max.x - b.min.x) / 1000).toFixed(2)} m`,
    `font-family="sans-serif" font-size="${pen.w(3).toFixed(0)}" text-anchor="middle" fill="#111"`,
  );
  c.line({ x: b.min.x - off, y: b.min.y }, { x: b.min.x - off, y: b.max.y }, attrs);
  c.textRot(
    b.min.x - off - pen.w(1.5),
    b.center.y,
    `${((b.max.y - b.min.y) / 1000).toFixed(2)} m`,
    `font-family="sans-serif" font-size="${pen.w(3).toFixed(0)}" text-anchor="middle" fill="#111"`,
  );
}

export function sectionSvg(s: Schematic, line?: SectionLine, ctx: DrawingContext = {}): string {
  const pen = makePen(ctx);
  const cut = sectionAtLine(s, line ?? defaultSectionLine(s));
  const c = new Canvas((u, z) => [u, -z]);
  const [u0, u1] = cut.uRange;
  const span = Math.max(1, u1 - u0);
  // Ground.
  c.line(
    { x: u0 - span * 0.1, y: cut.groundZ },
    { x: u1 + span * 0.1, y: cut.groundZ },
    stroke("#111", pen.w(pen.cut)),
  );
  // Slabs.
  for (const sl of cut.slabs) {
    const mat = materialById(sl.material);
    const poly = [
      { x: sl.u0, y: sl.z0 },
      { x: sl.u1, y: sl.z0 },
      { x: sl.u1, y: sl.z1 },
      { x: sl.u0, y: sl.z1 },
    ];
    c.polygon(poly, fillStroke(mat?.color ?? "#cfd4da", "#111", pen.w(pen.projection)));
    drawHatch(c, poly, sl.material, pen);
  }
  // Walls (cut poché).
  for (const w of cut.walls) {
    const mat = materialById(w.material);
    const poly = [
      { x: w.u - w.width / 2, y: w.z0 },
      { x: w.u + w.width / 2, y: w.z0 },
      { x: w.u + w.width / 2, y: w.z1 },
      { x: w.u - w.width / 2, y: w.z1 },
    ];
    c.polygon(poly, fillStroke(mat?.color ?? "#1c1f24", "#111", pen.w(pen.cut)));
    drawHatch(c, poly, w.material, pen);
  }
  // W-02 stairs: stepped profile in section.
  for (const st of cut.stairs) {
    const steps = Math.max(2, st.risers);
    const u0s = st.u - st.halfWidth;
    const du = (st.halfWidth * 2) / steps;
    const dz = (st.z1 - st.z0) / steps;
    const pts: Array<[number, number]> = [[u0s, st.z0]];
    let z = st.z0;
    for (let i = 0; i < steps; i++) {
      const x = u0s + du * (i + 1);
      pts.push([x, z]);
      z += dz;
      pts.push([x, z]);
    }
    c.polyline(pts, stroke("#111", pen.w(pen.cut)));
  }
  // Roof silhouette.
  for (const seg of cut.roofSegments) {
    c.line([seg[0], seg[1]], [seg[2], seg[3]], stroke("#111", pen.w(pen.cut)));
  }
  // Height dimension.
  c.line(
    { x: u0 - span * 0.06, y: cut.groundZ },
    { x: u0 - span * 0.06, y: cut.ridgeZ },
    stroke("#111", pen.w(pen.annotation)),
  );
  c.textRot(
    u0 - span * 0.09,
    (cut.groundZ + cut.ridgeZ) / 2,
    `${((cut.ridgeZ - cut.groundZ) / 1000).toFixed(2)} m`,
    `font-family="sans-serif" font-size="${pen.w(3).toFixed(0)}" text-anchor="middle" fill="#111"`,
  );
  // Level markers.
  const levels = ctx.levels ?? [];
  if (levels.length && ctx.showLevels !== false) {
    drawLevels(c, levels, u0, u1, u1 + span * 0.18, span, pen);
  }
  return c.toSvg("");
}

export function elevationSvg(s: Schematic, ctx: DrawingContext = {}): string {
  const pen = makePen(ctx);
  const c = new Canvas((x, z) => [x, -z]);
  const floor = s.slabs.find((sl) => sl.kind === "floor");
  const footprint = bounds((floor ?? { polygon: s.roof.outline }).polygon);
  const span = Math.max(1, footprint.max.x - footprint.min.x);
  // Wall face, tinted by the exterior wall material.
  const facadeMaterialId = s.walls.find((w) => w.kind === "exterior")?.material;
  const facade = materialById(facadeMaterialId)?.color ?? "#e7d8c2";
  c.polygon(
    [
      { x: footprint.min.x, y: s.baseZ },
      { x: footprint.max.x, y: s.baseZ },
      { x: footprint.max.x, y: s.topZ },
      { x: footprint.min.x, y: s.topZ },
    ],
    fillStroke(facade, "#111", pen.w(pen.cut)),
  );
  // W-08: masonry/stone cladding reads as a hatch (only below the eaves).
  const eaveTop = Math.min(s.topZ, s.roof.eaveZ);
  drawHatch(
    c,
    [
      { x: footprint.min.x, y: s.baseZ },
      { x: footprint.max.x, y: s.baseZ },
      { x: footprint.max.x, y: eaveTop },
      { x: footprint.min.x, y: eaveTop },
    ],
    facadeMaterialId,
    pen,
  );
  // Floor line.
  c.line(
    { x: footprint.min.x, y: s.baseZ },
    { x: footprint.max.x, y: s.baseZ },
    stroke("#111", pen.w(pen.cut)),
  );
  // Roof edges projected to x–z.
  for (const face of s.roof.faces) {
    for (let i = 0; i < face.points.length; i++) {
      const a = face.points[i];
      const b = face.points[(i + 1) % face.points.length];
      c.line([a[0], a[1]], [b[0], b[1]], stroke("#111", pen.w(pen.projection)));
    }
  }
  // W-08: railing runs as a line at their top height.
  for (const rl of s.railings ?? []) {
    const x0 = Math.min(rl.a.x, rl.b.x);
    const x1 = Math.max(rl.a.x, rl.b.x);
    c.line(
      { x: x0, y: rl.z + rl.height },
      { x: x1, y: rl.z + rl.height },
      stroke("#111", pen.w(pen.projection)),
    );
  }
  // Openings on the front facade.
  for (const op of s.openingMarks) {    if (op.wallKind !== "exterior") continue;
    const xs = op.quad.map((p) => p.x);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    c.polygon(
      [
        { x: x0, y: s.baseZ + op.sill },
        { x: x1, y: s.baseZ + op.sill },
        { x: x1, y: s.baseZ + op.sill + op.height },
        { x: x0, y: s.baseZ + op.sill + op.height },
      ],
      fillStroke("#fff", "#111", pen.w(pen.projection)),
    );
  }
  // Level markers.
  const levels = ctx.levels ?? [];
  if (levels.length && ctx.showLevels !== false) {
    drawLevels(c, levels, footprint.min.x, footprint.max.x, footprint.max.x + span * 0.18, span, pen);
  }
  return c.toSvg("");
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
