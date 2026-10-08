/**
 * I-03: import ASCII DXF linework as an underlay, and (I-03c) handle the entity
 * types that carry most real drawings: LINE, LWPOLYLINE, POLYLINE/VERTEX,
 * CIRCLE, ARC, ELLIPSE, SPLINE, 3DFACE, HATCH outline, and INSERT (block
 * references, expanded with scale/rotation, nested).
 *
 * Pure and deterministic — no DOM, no network.
 */

import type { Point, Underlay, UnderlayLine } from "@qreasee/shared";

export interface DxfLine {
  a: Point;
  b: Point;
  layer: string;
}

export interface DxfModel {
  lines: DxfLine[];
  layers: string[];
  units: "mm" | "cm" | "m" | "in" | "ft" | "unknown";
  /** True when the file had more geometry than we keep. */
  truncated: boolean;
  /** Part 3 §6: entity counts by DXF type, for the inventory. */
  counts: Record<string, number>;
}

/** Keep the document (and localStorage) sane; report when we drop geometry. */
export const MAX_UNDERLAY_LINES = 50_000;

const UNIT_SCALE: Record<DxfModel["units"], number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
  unknown: 1,
};

interface RawEntity {
  type: string;
  pairs: Array<[number, string]>;
}

type Xf = (p: Point) => Point;

const IDENTITY: Xf = (p) => p;

function compose(outer: Xf, inner: Xf): Xf {
  return (p) => outer(inner(p));
}

function tokenize(text: string): Array<[number, string]> {
  const lines = text.split(/\r\n|\r|\n/);
  const out: Array<[number, string]> = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number(lines[i].trim());
    if (Number.isNaN(code)) continue;
    out.push([code, lines[i + 1] ?? ""]);
  }
  return out;
}

interface Sections {
  entities: RawEntity[];
  blocks: Map<string, RawEntity[]>;
}

function parseSections(pairs: Array<[number, string]>): Sections {
  const entities: RawEntity[] = [];
  const blocks = new Map<string, RawEntity[]>();
  let section = "";
  let current: RawEntity | null = null;
  let blockName: string | null = null;
  let blockEntities: RawEntity[] = [];

  const flush = () => {
    if (!current) return;
    if (section === "BLOCKS" && blockName) blockEntities.push(current);
    else if (section === "ENTITIES") entities.push(current);
    current = null;
  };

  for (let i = 0; i < pairs.length; i++) {
    const [code, value] = pairs[i];
    if (code === 0 && value === "SECTION") {
      if (pairs[i + 1] && pairs[i + 1][0] === 2) section = pairs[i + 1][1];
      flush();
      continue;
    }
    if (code === 0 && value === "ENDSEC") {
      flush();
      section = "";
      continue;
    }
    if (section !== "ENTITIES" && section !== "BLOCKS") continue;

    if (code === 0) {
      flush();
      const type = value.trim().toUpperCase();
      if (type === "ENDBLK") {
        if (blockName) blocks.set(blockName, blockEntities);
        blockName = null;
        blockEntities = [];
        continue;
      }
      current = { type, pairs: [] };
      continue;
    }
    if (!current) continue;
    // BLOCK name (code 2) names the block being defined.
    if (current.type === "BLOCK" && code === 2 && blockName === null) blockName = value.trim();
    current.pairs.push([code, value]);
  }
  flush();
  return { entities, blocks };
}

function num(e: RawEntity, code: number, fallback = 0): number {
  const p = e.pairs.find(([c]) => c === code);
  return p ? Number(p[1]) || 0 : fallback;
}
function str(e: RawEntity, code: number, fallback = ""): string {
  const p = e.pairs.find(([c]) => c === code);
  return p ? p[1].trim() : fallback;
}
function allNums(e: RawEntity, code: number): number[] {
  return e.pairs.filter(([c]) => c === code).map(([, v]) => Number(v) || 0);
}

function arcPoints(cx: number, cy: number, r: number, a0: number, a1: number, segments = 32): Point[] {
  let start = (a0 * Math.PI) / 180;
  let end = (a1 * Math.PI) / 180;
  if (end < start) end += Math.PI * 2;
  const pts: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = start + ((end - start) * i) / segments;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

function ellipsePoints(e: RawEntity): Point[] {
  const cx = num(e, 10);
  const cy = num(e, 20);
  const mx = num(e, 11);
  const my = num(e, 21);
  const ratio = num(e, 40, 1) || 1;
  const start = num(e, 41, 0);
  const end = num(e, 42, Math.PI * 2);
  // Major axis vector (relative to centre); minor is perpendicular × ratio.
  const nx = -my * ratio;
  const ny = mx * ratio;
  const pts: Point[] = [];
  const span = end - start || Math.PI * 2;
  const segments = 48;
  for (let i = 0; i <= segments; i++) {
    const t = start + (span * i) / segments;
    pts.push({ x: cx + mx * Math.cos(t) + nx * Math.sin(t), y: cy + my * Math.cos(t) + ny * Math.sin(t) });
  }
  return pts;
}

function deBoor(degree: number, knots: number[], ctrl: Point[], t: number): Point {
  const n = ctrl.length;
  let k = degree;
  while (k < n - 1 && t >= knots[k + 1]) k++;
  const d: Point[] = [];
  for (let j = 0; j <= degree; j++) {
    const idx = Math.min(n - 1, Math.max(0, k - degree + j));
    d[j] = { ...ctrl[idx] };
  }
  for (let r = 1; r <= degree; r++) {
    for (let j = degree; j >= r; j--) {
      const i = k - degree + j;
      const denom = knots[i + degree - r + 1] - knots[i];
      const alpha = denom === 0 ? 0 : (t - knots[i]) / denom;
      d[j] = {
        x: d[j - 1].x * (1 - alpha) + d[j].x * alpha,
        y: d[j - 1].y * (1 - alpha) + d[j].y * alpha,
      };
    }
  }
  return d[degree];
}

function splinePoints(e: RawEntity): Point[] {
  const fitX = allNums(e, 11);
  const fitY = allNums(e, 21);
  if (fitX.length >= 2) return fitX.map((x, i) => ({ x, y: fitY[i] ?? 0 }));

  const cx = allNums(e, 10);
  const cy = allNums(e, 20);
  const ctrl = cx.map((x, i) => ({ x, y: cy[i] ?? 0 }));
  if (ctrl.length < 2) return [];
  const degree = Math.max(1, Math.min(3, Math.round(num(e, 71, 3)) || 3));
  const knots = allNums(e, 40);
  if (knots.length < ctrl.length + degree + 1) return ctrl;
  const t0 = knots[degree];
  const t1 = knots[ctrl.length];
  const segments = Math.min(64, Math.max(8, ctrl.length * 4));
  const pts: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = t0 + ((t1 - t0) * i) / segments;
    pts.push(deBoor(degree, knots, ctrl, t));
  }
  return pts;
}

interface Ctx {
  scale: number;
  blocks: Map<string, RawEntity[]>;
  add: (l: DxfLine) => void;
  layerSet: Set<string>;
}

function pushPolyline(pts: Point[], closed: boolean, layer: string, xf: Xf, ctx: Ctx) {
  const world = pts.map(xf);
  for (let i = 0; i < world.length - 1; i++) {
    ctx.add({ a: world[i], b: world[i + 1], layer });
  }
  if (closed && world.length > 2) {
    ctx.add({ a: world[world.length - 1], b: world[0], layer });
  }
}

function emit(e: RawEntity, xf: Xf, ctx: Ctx, depth: number) {
  const layer = str(e, 8, "0");
  if (layer) ctx.layerSet.add(layer);

  const pt = (codeX: number, codeY: number): Point => ({ x: num(e, codeX), y: num(e, codeY) });

  switch (e.type) {
    case "LINE":
      ctx.add({ a: xf(pt(10, 20)), b: xf(pt(11, 21)), layer });
      break;
    case "LWPOLYLINE": {
      const xs = allNums(e, 10);
      const ys = allNums(e, 20);
      const pts = xs.map((x, i) => ({ x, y: ys[i] ?? 0 }));
      pushPolyline(pts, (num(e, 70) & 1) === 1, layer, xf, ctx);
      break;
    }
    case "POLYLINE": {
      // Vertices follow as separate VERTEX entities; handled by the caller.
      const xs = allNums(e, 10);
      const ys = allNums(e, 20);
      if (xs.length >= 2) {
        pushPolyline(xs.map((x, i) => ({ x, y: ys[i] ?? 0 })), (num(e, 70) & 1) === 1, layer, xf, ctx);
      }
      break;
    }
    case "CIRCLE":
      pushPolyline(arcPoints(num(e, 10), num(e, 20), num(e, 40), 0, 360), false, layer, xf, ctx);
      break;
    case "ARC":
      pushPolyline(arcPoints(num(e, 10), num(e, 20), num(e, 40), num(e, 50), num(e, 51)), false, layer, xf, ctx);
      break;
    case "ELLIPSE":
      pushPolyline(ellipsePoints(e), false, layer, xf, ctx);
      break;
    case "SPLINE":
      pushPolyline(splinePoints(e), false, layer, xf, ctx);
      break;
    case "3DFACE":
    case "SOLID": {
      const pts: Point[] = [pt(10, 20), pt(11, 21), pt(12, 22), pt(13, 23)];
      const unique = pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y);
      pushPolyline(unique, true, layer, xf, ctx);
      break;
    }
    case "HATCH": {
      // Best-effort outline: the vertex pairs of the boundary paths.
      const xs = allNums(e, 10);
      const ys = allNums(e, 20);
      const pts = xs.map((x, i) => ({ x, y: ys[i] ?? 0 }));
      if (pts.length >= 2) pushPolyline(pts, true, layer, xf, ctx);
      break;
    }
    case "INSERT": {
      if (depth > 8) break;
      const name = str(e, 2);
      const block = ctx.blocks.get(name);
      if (!block) break;
      const bx = num(e, 10);
      const by = num(e, 20);
      const sx = num(e, 41, 1) || 1;
      const sy = num(e, 42, 1) || 1;
      const angle = (num(e, 50) * Math.PI) / 180;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const cols = Math.max(1, Math.round(num(e, 70, 1) || 1));
      const rows = Math.max(1, Math.round(num(e, 71, 1) || 1));
      const colSpacing = num(e, 44, 0);
      const rowSpacing = num(e, 45, 0);
      // Block geometry is stored relative to the block's base point.
      const baseX = num(block[0] ?? e, 10, 0);
      const baseY = num(block[0] ?? e, 20, 0);
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const ox = bx + col * colSpacing;
          const oy = by + row * rowSpacing;
          const local: Xf = (p) => {
            const lx = (p.x - baseX) * sx;
            const ly = (p.y - baseY) * sy;
            return { x: ox + lx * c - ly * s, y: oy + lx * s + ly * c };
          };
          const composed = compose(xf, local);
          for (const child of block) {
            if (child.type === "BLOCK" || child.type === "ENDBLK") continue;
            emit(child, composed, ctx, depth + 1);
          }
        }
      }
      break;
    }
    default:
      break;
  }
}

export function parseDxf(text: string): DxfModel {
  const pairs = tokenize(text);
  const { entities, blocks } = parseSections(pairs);

  let units: DxfModel["units"] = "unknown";
  for (let i = 0; i < pairs.length - 1; i++) {
    if (pairs[i][0] === 9 && pairs[i][1].trim() === "$INSUNITS") {
      const v = pairs[i + 1][1].trim();
      units = v === "1" ? "in" : v === "2" ? "ft" : v === "4" ? "mm" : v === "5" ? "cm" : v === "6" ? "m" : "unknown";
      break;
    }
  }
  const scale = UNIT_SCALE[units];

  const lines: DxfLine[] = [];
  const layerSet = new Set<string>();
  let truncated = false;
  const ctx: Ctx = {
    scale,
    blocks,
    layerSet,
    add: (l) => {
      if (lines.length >= MAX_UNDERLAY_LINES) {
        truncated = true;
        return;
      }
      lines.push({ a: { x: l.a.x * scale, y: l.a.y * scale }, b: { x: l.b.x * scale, y: l.b.y * scale }, layer: l.layer });
    },
  };

  // A POLYLINE gathers its following VERTEX entities; other entities are
  // independent. Walk the list so VERTEX can be folded into its parent.
  let pending: { layer: string; closed: boolean; pts: Point[] } | null = null;
  const flushPending = () => {
    if (pending && pending.pts.length >= 2) {
      pushPolyline(pending.pts, pending.closed, pending.layer, IDENTITY, ctx);
    }
    pending = null;
  };

  for (const e of entities) {
    if (lines.length >= MAX_UNDERLAY_LINES) {
      truncated = true;
      break;
    }
    if (e.type === "VERTEX") {
      if (pending) pending.pts.push({ x: num(e, 10), y: num(e, 20) });
      continue;
    }
    if (e.type === "SEQEND") {
      flushPending();
      continue;
    }
    if (pending) flushPending();
    if (e.type === "POLYLINE") {
      pending = { layer: str(e, 8, "0"), closed: (num(e, 70) & 1) === 1, pts: [] };
      continue;
    }
    emit(e, IDENTITY, ctx, 0);
  }
  flushPending();

  const counts: Record<string, number> = {};
  for (const e of entities) counts[e.type] = (counts[e.type] ?? 0) + 1;

  return { lines, layers: [...layerSet].sort(), units, truncated, counts };
}

export function dxfToUnderlay(
  model: DxfModel,
  opts: { id: string; name: string; levelId: string; color?: string; elevationMm?: number },
): Underlay {
  const lines: UnderlayLine[] = model.lines.map((l) => ({ a: l.a, b: l.b, layer: l.layer }));
  return {
    id: opts.id,
    name: opts.name,
    levelId: opts.levelId,
    elevationMm: opts.elevationMm,
    lines,
    layerVisibility: {},
    color: opts.color ?? "#7c8797",
    origin: "user",
  };
}
