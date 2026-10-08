/**
 * W-08 / VW-08: an axonometric (isometric) snapshot of the real model for the
 * cover and concept sheets. Pure: builds 3D faces from the document entities,
 * projects them and paints back-to-front. No WebGL.
 *
 * It is deliberately a *clean exterior* view: the exterior wall shell with its
 * openings cut out, one roof generated over the mass footprint, and the stairs.
 * Imported bounding-box roofs and interior slabs are skipped because they are
 * approximations and would z-fight (the messy look the owner flagged).
 *
 * The camera sits at (+X, −Y, +Z) so the FRONT (−Y, the grid-A / entrance side)
 * and the right side are visible.
 */

import type { DocState, Point, Wall as DocWall, Opening as DocOpening } from "@qreasee/shared";
import { buildRoof } from "./roof";
import { stairGeometry } from "./stairs";

type P3 = [number, number, number];
interface Face {
  pts: P3[];
  color: string;
  /** A point on the interior side of the face, used to orient the normal. */
  ref: P3;
}

const INV2 = 1 / Math.SQRT2;
const INV6 = 1 / Math.sqrt(6);
const proj = (p: P3): [number, number] => [(p[0] + p[1]) * INV2, (p[0] - p[1] - 2 * p[2]) * INV6];
/** Painter's depth: larger is nearer the camera at (+X, −Y, +Z). */
const depthOf = (p: P3) => p[0] - p[1] + p[2];
/** Direction from the scene toward the camera. */
const CAM: P3 = [1, -1, 1];

const dot3 = (a: P3, b: P3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const centroid = (pts: P3[]): P3 => {
  const s = pts.reduce<P3>((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]);
  return [s[0] / pts.length, s[1] / pts.length, s[2] / pts.length];
};
/** Newell's method — robust for non-planar polygons. */
function normal(pts: P3[]): P3 {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}
/** Flip the winding so the normal points away from the interior reference. */
function orientOutward(f: Face) {
  const n = normal(f.pts);
  const c = centroid(f.pts);
  if (dot3(n, [f.ref[0] - c[0], f.ref[1] - c[1], f.ref[2] - c[2]]) > 0) f.pts.reverse();
}
const frontFacing = (f: Face) => dot3(normal(f.pts), CAM) > 1e-4;

function levelZ(doc: DocState, id: string): number {
  return doc.levels.find((l) => l.id === id)?.elevation ?? 0;
}

function shade(hex: string, factor: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((n & 255) * factor));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Face brightness from its normal against a fixed light direction. */
function faceBrightness(pts: P3[]): number {
  if (pts.length < 3) return 0.9;
  const [a, b, c] = pts;
  const u: P3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v: P3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  let nx = u[1] * v[2] - u[2] * v[1];
  let ny = u[2] * v[0] - u[0] * v[2];
  let nz = u[0] * v[1] - u[1] * v[0];
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len;
  ny /= len;
  nz /= len;
  const dot = Math.abs(nx * 0.35 + ny * 0.45 + nz * 0.82);
  return 0.5 + 0.5 * dot;
}

interface Seg {
  u0: number;
  u1: number;
  z0: number;
  z1: number;
}

/** Split a wall along its openings into full-height and sill/head boxes. */
function wallSegments(w: DocWall, openings: DocOpening[]): Seg[] {
  const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y) || 1;
  const sorted = [...openings].sort((a, b) => a.offset - b.offset);
  const segs: Seg[] = [];
  let cursor = 0;
  for (const op of sorted) {
    const s = Math.max(0, op.offset - op.width / 2);
    const e = Math.min(len, op.offset + op.width / 2);
    if (e <= s) continue;
    if (s > cursor) segs.push({ u0: cursor, u1: s, z0: 0, z1: w.height });
    if (op.sill > 0) segs.push({ u0: s, u1: e, z0: 0, z1: op.sill });
    const head = op.sill + op.height;
    if (head < w.height) segs.push({ u0: s, u1: e, z0: head, z1: w.height });
    cursor = e;
  }
  if (cursor < len) segs.push({ u0: cursor, u1: len, z0: 0, z1: w.height });
  return segs;
}

/** Push the four vertical side faces of a wall box (no top/bottom caps). */
function pushBox(a: Point, b: Point, off0: number, off1: number, z0: number, z1: number, color: string, faces: Face[]) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const ref: P3 = [(a.x + b.x) / 2, (a.y + b.y) / 2, (z0 + z1) / 2];
  const ring: P3[] = [
    [a.x + nx * off0, a.y + ny * off0, z0],
    [b.x + nx * off0, b.y + ny * off0, z0],
    [b.x + nx * off1, b.y + ny * off1, z0],
    [a.x + nx * off1, a.y + ny * off1, z0],
  ];
  for (let i = 0; i < 4; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % 4];
    faces.push({ pts: [[p[0], p[1], z0], [q[0], q[1], z0], [q[0], q[1], z1], [p[0], p[1], z1]], color, ref });
  }
}

function wallFaces(doc: DocState, faces: Face[]) {
  const color = "#cdbfa9";
  const mass = doc.masses[0];
  const outer = mass?.footprint.outer ?? [];
  const xs = outer.map((p) => p.x);
  const ys = outer.map((p) => p.y);
  const pad = 800;
  const bbox = {
    minX: Math.min(...xs) - pad,
    maxX: Math.max(...xs) + pad,
    minY: Math.min(...ys) - pad,
    maxY: Math.max(...ys) + pad,
  };
  const levels = new Set(mass?.levelIds ?? []);
  const inside = (p: Point) =>
    outer.length < 3 || (p.x >= bbox.minX && p.x <= bbox.maxX && p.y >= bbox.minY && p.y <= bbox.maxY);
  for (const w of doc.walls) {
    if (w.kind !== "exterior") continue;
    if (w.height < 500) continue; // low parapets/railings, not the shell
    if (levels.size && !levels.has(w.levelId)) continue;
    const mid: Point = { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 };
    if (!inside(w.a) || !inside(w.b) || !inside(mid)) continue; // site/fence walls
    const z0 = levelZ(doc, w.levelId);
    const half = w.thickness / 2;
    const dx = w.b.x - w.a.x;
    const dy = w.b.y - w.a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const openings = doc.openings.filter((o) => o.wallId === w.id);
    for (const seg of wallSegments(w, openings)) {
      const a: Point = { x: w.a.x + ux * seg.u0, y: w.a.y + uy * seg.u0 };
      const b: Point = { x: w.a.x + ux * seg.u1, y: w.a.y + uy * seg.u1 };
      pushBox(a, b, -half, half, z0 + seg.z0, z0 + seg.z1, color, faces);
    }
  }
}

/** One clean roof over the mass footprint, at the top of the model. */
function roofFaces(doc: DocState, faces: Face[]) {
  const mass = doc.masses[0];
  const outer = mass?.footprint.outer;
  if (!outer || outer.length < 3) return;
  const topZ = Math.max(
    0,
    ...doc.walls.map((w) => levelZ(doc, w.levelId) + w.height),
    ...doc.slabs.map((s) => s.z + s.thickness),
  );
  const sample = doc.roofs[0];
  const plan = sample?.polygon.outer && sample.polygon.outer.length >= 3 ? sample.polygon.outer : outer;
  const roof = buildRoof(plan, sample?.type ?? "hip", sample?.pitchDeg ?? 30, sample?.overhang ?? 600, topZ);
  const ref: P3 = [plan.reduce((s, p) => s + p.x, 0) / plan.length, plan.reduce((s, p) => s + p.y, 0) / plan.length, topZ];
  for (const f of roof.faces) {
    faces.push({ pts: f.points.map((p) => [p[0], p[2], p[1]] as P3), color: "#b06a43", ref });
  }
}

function stairFaces(doc: DocState, faces: Face[]) {
  for (const st of doc.stairs) {
    const g = stairGeometry(st, levelZ(doc, st.levelId));
    const totalLen = g.runs.reduce((s, r) => s + Math.hypot(r.b.x - r.a.x, r.b.y - r.a.y), 0) || 1;
    let cum = 0;
    for (const run of g.runs) {
      const dx = run.b.x - run.a.x;
      const dy = run.b.y - run.a.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const nx = -uy * (run.width / 2);
      const ny = ux * (run.width / 2);
      const steps = Math.max(1, Math.round((g.risers * len) / totalLen));
      const tread = len / steps;
      for (let i = 0; i < steps; i++) {
        const t0 = i * tread;
        const t1 = (i + 1) * tread;
        const ax = run.a.x + ux * t0;
        const ay = run.a.y + uy * t0;
        const bx = run.a.x + ux * t1;
        const by = run.a.y + uy * t1;
        const top = g.baseZ + (cum + i + 1) * g.riserMm;
        faces.push({
          pts: [
            [ax + nx, ay + ny, top],
            [bx + nx, by + ny, top],
            [bx - nx, by - ny, top],
            [ax - nx, ay - ny, top],
          ],
          color: "#b9c0c8",
          ref: [(ax + bx) / 2, (ay + by) / 2, g.baseZ],
        });
      }
      cum += steps;
    }
  }
}

/** A flat ground rectangle under the building (a soft base). */
function groundFace(doc: DocState, faces: Face[]) {
  const mass = doc.masses[0];
  const outer = mass?.footprint.outer;
  if (!outer || outer.length < 3) return;
  const xs = outer.map((p) => p.x);
  const ys = outer.map((p) => p.y);
  const pad = 1500;
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  faces.push({
    pts: [
      [minX, minY, -20],
      [maxX, minY, -20],
      [maxX, maxY, -20],
      [minX, maxY, -20],
    ],
    color: "#e2e5e8",
    ref: [(minX + maxX) / 2, (minY + maxY) / 2, -500],
  });
}

/** Render the whole model as an isometric SVG (returned as markup, not a data URL). */
export function axonModelSvg(doc: DocState, title = ""): string {
  const faces: Face[] = [];
  groundFace(doc, faces);
  wallFaces(doc, faces);
  stairFaces(doc, faces);
  roofFaces(doc, faces);
  if (faces.length === 0) return "";

  for (const f of faces) orientOutward(f);
  const ordered = faces
    .filter(frontFacing)
    .map((f) => ({ f, d: f.pts.reduce((s, p) => s + depthOf(p), 0) / f.pts.length }))
    .sort((a, b) => a.d - b.d);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const drawn: string[] = [];
  for (const { f } of ordered) {
    const pts = f.pts.map(proj);
    const fill = shade(f.color, faceBrightness(f.pts));
    drawn.push(
      `<polygon points="${pts
        .map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`)
        .join(" ")}" fill="${fill}" stroke="#5b6169" stroke-width="1.5"/>`,
    );
    for (const p of pts) {
      minX = Math.min(minX, p[0]);
      minY = Math.min(minY, p[1]);
      maxX = Math.max(maxX, p[0]);
      maxY = Math.max(maxY, p[1]);
    }
  }
  const pad = Math.max(maxX - minX, maxY - minY, 1) * 0.05;
  const vx = minX - pad;
  const vy = minY - pad;
  const vw = maxX - minX + pad * 2;
  const vh = maxY - minY + pad * 2;
  const label = title
    ? `<text x="${(vx + pad * 0.4).toFixed(1)}" y="${(vy + pad * 1.6).toFixed(1)}" font-family="sans-serif" font-size="${(
        Math.max(vw, vh) * 0.04
      ).toFixed(0)}" fill="#111">${title}</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(
    1,
  )}" width="100%"><rect x="${vx.toFixed(1)}" y="${vy.toFixed(1)}" width="${vw.toFixed(1)}" height="${vh.toFixed(
    1,
  )}" fill="#f4f6f8"/>${drawn.join("")}${label}</svg>`;
}
