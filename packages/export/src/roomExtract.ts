/**
 * Derive room regions from wall segments (e.g. the A-WALL lines of a floor plan).
 *
 * Approach: rasterise the walls onto a grid, dilate to close small gaps, flood
 * fill from the border to find the outside, then label the enclosed components.
 * Each region becomes a rectilinear room polygon by tracing its boundary.
 *
 * Pure. Dev/benchmark quality: results depend on the cell size and how complete
 * the walls are.
 */

import type { Point } from "@qreasee/shared";

export interface WallSeg2 {
  a: Point;
  b: Point;
}

export interface RoomRegion {
  polygon: Point[];
  areaMm2: number;
  centroid: Point;
}

export interface RoomExtractOptions {
  /** Raster cell size, mm. Default 100. */
  cell?: number;
  /** Minimum room area, m². Default 1.5. */
  minAreaM2?: number;
  /** Dilation passes to close wall gaps. Default 1. */
  closeCells?: number;
  /** Grow each room outward by this many cells (to the wall centreline). Default 1. */
  ringCells?: number;
}

function ringArea(ring: Point[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

function ringCentroid(ring: Point[]): Point {
  const n = ring.length || 1;
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p.x;
    y += p.y;
  }
  return { x: x / n, y: y / n };
}

export function roomsFromWalls(walls: readonly WallSeg2[], opts: RoomExtractOptions = {}): RoomRegion[] {
  const cell = opts.cell ?? 100;
  const minArea = (opts.minAreaM2 ?? 1.5) * 1e6;
  const close = opts.closeCells ?? 1;
  const segs = walls.filter((w) => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y) > 1);
  if (segs.length === 0) return [];

  const xs = segs.flatMap((w) => [w.a.x, w.b.x]);
  const ys = segs.flatMap((w) => [w.a.y, w.b.y]);
  const minX = Math.min(...xs) - cell;
  const maxX = Math.max(...xs) + cell;
  const minY = Math.min(...ys) - cell;
  const maxY = Math.max(...ys) + cell;
  const nx = Math.max(3, Math.ceil((maxX - minX) / cell));
  const ny = Math.max(3, Math.ceil((maxY - minY) / cell));
  const idx = (i: number, j: number) => i * ny + j;

  const wall = new Uint8Array(nx * ny);
  for (const w of segs) {
    const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
    const steps = Math.max(1, Math.ceil(len / (cell * 0.5)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const i = Math.floor((w.a.x + (w.b.x - w.a.x) * t - minX) / cell);
      const j = Math.floor((w.a.y + (w.b.y - w.a.y) * t - minY) / cell);
      if (i >= 0 && i < nx && j >= 0 && j < ny) wall[idx(i, j)] = 1;
    }
  }
  for (let k = 0; k < close; k++) {
    const copy = wall.slice();
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        if (copy[idx(i, j)]) continue;
        let near = false;
        for (let di = -1; di <= 1 && !near; di++) {
          for (let dj = -1; dj <= 1; dj++) {
            const ii = i + di;
            const jj = j + dj;
            if (ii >= 0 && ii < nx && jj >= 0 && jj < ny && copy[idx(ii, jj)]) {
              near = true;
              break;
            }
          }
        }
        if (near) wall[idx(i, j)] = 1;
      }
    }
  }

  const outside = new Uint8Array(nx * ny);
  const stack: number[] = [];
  const push = (i: number, j: number) => {
    const c = idx(i, j);
    if (!wall[c] && !outside[c]) {
      outside[c] = 1;
      stack.push(c);
    }
  };
  for (let i = 0; i < nx; i++) {
    push(i, 0);
    push(i, ny - 1);
  }
  for (let j = 0; j < ny; j++) {
    push(0, j);
    push(nx - 1, j);
  }
  while (stack.length) {
    const c = stack.pop()!;
    const i = Math.floor(c / ny);
    const j = c % ny;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const ii = i + di;
      const jj = j + dj;
      if (ii < 0 || ii >= nx || jj < 0 || jj >= ny) continue;
      const kk = idx(ii, jj);
      if (!wall[kk] && !outside[kk]) {
        outside[kk] = 1;
        stack.push(kk);
      }
    }
  }

  // Connected components of the interior.
  const label = new Int32Array(nx * ny).fill(-1);
  const regions: number[][] = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const c = idx(i, j);
      if (wall[c] || outside[c] || label[c] >= 0) continue;
      const id = regions.length;
      const cells: number[] = [];
      const st = [c];
      label[c] = id;
      while (st.length) {
        const cc = st.pop()!;
        cells.push(cc);
        const ci = Math.floor(cc / ny);
        const cj = cc % ny;
        for (const [di, dj] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const ii = ci + di;
          const jj = cj + dj;
          if (ii < 0 || ii >= nx || jj < 0 || jj >= ny) continue;
          const kk = idx(ii, jj);
          if (!wall[kk] && !outside[kk] && label[kk] < 0) {
            label[kk] = id;
            st.push(kk);
          }
        }
      }
      regions.push(cells);
    }
  }

  const out: RoomRegion[] = [];
  const ringCells = opts.ringCells ?? 1;
  for (const cells of regions) {
    // Grow the region to the wall centreline (half a wall thickness) without
    // eating another room or the outside.
    let set = new Set(cells);
    for (let r = 0; r < ringCells; r++) {
      const next = new Set<number>();
      for (const c of set) {
        const i = Math.floor(c / ny);
        const j = c % ny;
        for (const [di, dj] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const ii = i + di;
          const jj = j + dj;
          if (ii < 0 || ii >= nx || jj < 0 || jj >= ny) continue;
          const kk = idx(ii, jj);
          if (set.has(kk) || outside[kk]) continue;
          if (label[kk] >= 0 && label[kk] !== label[c]) continue;
          next.add(kk);
        }
      }
      set = new Set([...set, ...next]);
    }
    const area = set.size * cell * cell;
    if (area < minArea) continue;
    const polygon = traceOutline(set, nx, ny, minX, minY, cell);
    if (polygon.length >= 4) out.push({ polygon, areaMm2: ringArea(polygon), centroid: ringCentroid(polygon) });
  }
  return out;
}

/** Trace the boundary of a rectilinear region as a polygon (grid → model mm). */
function traceOutline(
  set: Set<number>,
  nx: number,
  ny: number,
  minX: number,
  minY: number,
  cell: number,
): Point[] {
  const isReg = (i: number, j: number) => i >= 0 && i < nx && j >= 0 && j < ny && set.has(i * ny + j);
  const key = (i: number, j: number) => `${i},${j}`;
  const edges = new Map<string, string[]>();
  const add = (i0: number, j0: number, i1: number, j1: number) => {
    const k = key(i0, j0);
    const arr = edges.get(k) ?? [];
    arr.push(key(i1, j1));
    edges.set(k, arr);
  };
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      if (!isReg(i, j)) continue;
      if (!isReg(i, j + 1)) add(i, j + 1, i + 1, j + 1);
      if (!isReg(i + 1, j)) add(i + 1, j + 1, i + 1, j);
      if (!isReg(i, j - 1)) add(i + 1, j, i, j);
      if (!isReg(i - 1, j)) add(i, j, i, j + 1);
    }
  }

  const loops: string[][] = [];
  for (const start of [...edges.keys()]) {
    if (!edges.get(start)?.length) continue;
    const loop: string[] = [];
    const seen = new Set<string>();
    let cur = start;
    for (let guard = 0; guard < 100_000; guard++) {
      if (seen.has(cur)) break; // entered another loop → not a closed loop from `start`
      seen.add(cur);
      const outs = edges.get(cur);
      if (!outs || outs.length === 0) break;
      loop.push(cur);
      cur = outs.shift()!;
      if (cur === start) break;
    }
    if (cur === start && loop.length >= 4) loops.push(loop);
  }
  if (loops.length === 0) return [];
  loops.sort((a, b) => b.length - a.length);
  const ring = loops[0].map((k) => {
    const [i, j] = k.split(",").map(Number);
    return { x: minX + i * cell, y: minY + j * cell };
  });
  return simplifyRing(ring, Math.max(cell * 1.5, 300));
}

/** Snap to a coarse grid, drop duplicate/collinear points → a few room corners. */
function simplifyRing(ring: Point[], tol = 0): Point[] {
  const step = Math.max(tol, 1);
  const snapped = ring.map((p) => ({ x: Math.round(p.x / step) * step, y: Math.round(p.y / step) * step }));
  const dedup: Point[] = [];
  for (const p of snapped) {
    const last = dedup[dedup.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) dedup.push(p);
  }
  if (dedup.length >= 2 && dedup[0].x === dedup[dedup.length - 1].x && dedup[0].y === dedup[dedup.length - 1].y) {
    dedup.pop();
  }
  const out: Point[] = [];
  const n = dedup.length;
  for (let i = 0; i < n; i++) {
    const a = dedup[(i - 1 + n) % n];
    const b = dedup[i];
    const c = dedup[(i + 1) % n];
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(cross) > 1) out.push(b);
  }
  return out.length >= 4 ? out : dedup;
}
