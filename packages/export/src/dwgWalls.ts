/**
 * Part 3 §6.5: rebuild walls from a Revit DWG (via DXF). The A-WALL layer holds
 * the two faces of every wall as axis-aligned line pairs. We pair each face with
 * its nearest parallel partner within a wall thickness and use the overlap as the
 * wall extent. Pure and deterministic.
 *
 * This is a dev/benchmark tool — Qreasee never reads a DWG at runtime. It is
 * intentionally NOT the default sample source yet (it drops some walls); a full
 * rebuild needs the Part 3 §1 wall graph.
 */

import type { Point } from "@qreasee/shared";
import type { DxfModel } from "./dxfImport";

export interface ExtractedWall {
  a: Point;
  b: Point;
  thickness: number;
}

interface Seg {
  pos: number;
  lo: number;
  hi: number;
}

const inRegion = (l: { a: Point; b: Point }, r: { minX: number; maxX: number }) =>
  l.a.x >= r.minX && l.a.x <= r.maxX && l.b.x >= r.minX && l.b.x <= r.maxX;

/** Merge parallel segments whose spacing is below `tol` (double lines / sweeps). */
function mergeClose(segs: Seg[], tol: number): Seg[] {
  const sorted = [...segs].sort((a, b) => a.pos - b.pos);
  const out: Seg[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    const overlap = last ? Math.min(last.hi, s.hi) - Math.max(last.lo, s.lo) : -1;
    if (last && Math.abs(s.pos - last.pos) <= tol && overlap > 200) {
      last.lo = Math.min(last.lo, s.lo);
      last.hi = Math.max(last.hi, s.hi);
      last.pos = (last.pos + s.pos) / 2;
    } else {
      out.push({ ...s });
    }
  }
  return out;
}

/** Greedy nearest pairing of parallel faces within [minT, maxT]. */
function pairSegments(
  segs: Seg[],
  minT: number,
  maxT: number,
  emit: (mid: number, thickness: number, lo: number, hi: number) => void,
): void {
  const used = new Array(segs.length).fill(false);
  const order = segs.map((_, i) => i).sort((a, b) => segs[a].pos - segs[b].pos);
  for (let ii = 0; ii < order.length; ii++) {
    const i = order[ii];
    if (used[i]) continue;
    let best = -1;
    let bestD = Infinity;
    for (let jj = ii + 1; jj < order.length; jj++) {
      const j = order[jj];
      if (used[j]) continue;
      const d = Math.abs(segs[j].pos - segs[i].pos);
      if (d > maxT) break;
      if (d < minT) continue;
      const lo = Math.max(segs[i].lo, segs[j].lo);
      const hi = Math.min(segs[i].hi, segs[j].hi);
      if (hi - lo < 250) continue;
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    used[i] = true;
    if (best >= 0) {
      used[best] = true;
      const lo = Math.max(segs[i].lo, segs[best].lo);
      const hi = Math.min(segs[i].hi, segs[best].hi);
      emit((segs[i].pos + segs[best].pos) / 2, bestD, lo, hi);
    }
  }
}

export interface ExtractOptions {
  layer?: string;
  region?: { minX: number; maxX: number };
  minThickness?: number;
  maxThickness?: number;
}

/** Axis-aligned walls (centreline + thickness) reconstructed from the DWG faces. */
export function wallsFromDxf(model: DxfModel, opts: ExtractOptions = {}): ExtractedWall[] {
  const layer = opts.layer ?? "A-WALL";
  const region = opts.region ?? { minX: -Infinity, maxX: Infinity };
  const minT = opts.minThickness ?? 70;
  const maxT = opts.maxThickness ?? 420;

  const H: Seg[] = [];
  const V: Seg[] = [];
  for (const l of model.lines) {
    if (l.layer !== layer || !inRegion(l, region)) continue;
    const dx = l.b.x - l.a.x;
    const dy = l.b.y - l.a.y;
    if (Math.abs(dy) <= Math.abs(dx) * 0.12) {
      H.push({ pos: (l.a.y + l.b.y) / 2, lo: Math.min(l.a.x, l.b.x), hi: Math.max(l.a.x, l.b.x) });
    } else if (Math.abs(dx) <= Math.abs(dy) * 0.12) {
      V.push({ pos: (l.a.x + l.b.x) / 2, lo: Math.min(l.a.y, l.b.y), hi: Math.max(l.a.y, l.b.y) });
    }
  }

  const walls: ExtractedWall[] = [];
  pairSegments(mergeClose(H, 45), minT, maxT, (pos, t, lo, hi) =>
    walls.push({ a: { x: lo, y: pos }, b: { x: hi, y: pos }, thickness: Math.round(t) }),
  );
  pairSegments(mergeClose(V, 45), minT, maxT, (pos, t, lo, hi) =>
    walls.push({ a: { x: pos, y: lo }, b: { x: pos, y: hi }, thickness: Math.round(t) }),
  );
  return walls;
}
