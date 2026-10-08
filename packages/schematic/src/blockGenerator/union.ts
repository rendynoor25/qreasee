/**
 * BG-02/03: pure polygon union and difference for block footprints, by coordinate
 * compression. Rectilinear polygons are exact; diagonal edges are stepped to the
 * vertex grid. Both return rectangles (one polygon each).
 */

import type { Point } from "@qreasee/shared";

function sortedUnique(values: number[]): number[] {
  const s = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of s) if (out.length === 0 || v - out[out.length - 1] > 1) out.push(v);
  return out;
}

export function pointInPolygon(p: Point, ring: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** Fill the compressed grid, then merge filled cells into rectangles. */
function rectangularize(rings: Point[][], keep: (c: Point) => boolean): Point[][] {
  if (rings.length === 0) return [];
  const xs = sortedUnique(rings.flatMap((p) => p.map((v) => v.x)));
  const ys = sortedUnique(rings.flatMap((p) => p.map((v) => v.y)));
  const nx = xs.length - 1;
  const ny = ys.length - 1;
  if (nx < 1 || ny < 1) return [];

  const filled: boolean[][] = [];
  for (let i = 0; i < nx; i++) {
    filled[i] = [];
    for (let j = 0; j < ny; j++) {
      filled[i][j] = keep({ x: (xs[i] + xs[i + 1]) / 2, y: (ys[j] + ys[j + 1]) / 2 });
    }
  }

  const used: boolean[][] = Array.from({ length: nx }, () => new Array(ny).fill(false));
  const rects: Point[][] = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      if (!filled[i][j] || used[i][j]) continue;
      let i2 = i;
      while (i2 + 1 < nx && filled[i2 + 1][j] && !used[i2 + 1][j]) i2++;
      const rowFree = (j3: number) => {
        for (let k = i; k <= i2; k++) if (!filled[k][j3] || used[k][j3]) return false;
        return true;
      };
      let j2 = j;
      while (j2 + 1 < ny && rowFree(j2 + 1)) j2++;
      for (let k = i; k <= i2; k++) for (let m = j; m <= j2; m++) used[k][m] = true;
      rects.push([
        { x: xs[i], y: ys[j] },
        { x: xs[i2 + 1], y: ys[j] },
        { x: xs[i2 + 1], y: ys[j2 + 1] },
        { x: xs[i], y: ys[j2 + 1] },
      ]);
    }
  }
  return rects;
}

/** A ∪ B, as rectangles. */
export function unionPolygons(polys: readonly Point[][]): Point[][] {
  const rings = polys.filter((p) => p.length >= 3);
  return rectangularize(rings, (c) => rings.some((r) => pointInPolygon(c, r)));
}

/** A \ B, as rectangles. */
export function subtractPolygons(base: readonly Point[][], cut: readonly Point[][]): Point[][] {
  const a = base.filter((p) => p.length >= 3);
  const b = cut.filter((p) => p.length >= 3);
  if (a.length === 0) return [];
  const rings = [...a, ...b];
  return rectangularize(rings, (c) => a.some((r) => pointInPolygon(c, r)) && !b.some((r) => pointInPolygon(c, r)));
}
