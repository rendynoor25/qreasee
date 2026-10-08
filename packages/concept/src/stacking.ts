/**
 * Block stacking (MVP Feature Guide §3.1 "Extrude", owner request): concept
 * blocks are Lego-like — dropping one over another makes it sit on top. Pure and
 * deterministic so the controller and tests agree.
 */

import type { Polygon, Point } from "@qreasee/shared";

export interface StackBox {
  polygon: Polygon;
  /** Absolute base elevation in mm. */
  baseMm: number;
  /** Block height in mm. */
  heightMm: number;
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function aabb(poly: Polygon): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of poly.outer as Point[]) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

/**
 * The elevation a block should sit at so it rests on top of whatever it overlaps.
 * Returns `undefined` when nothing overlaps (the block sits on its level).
 */
export function stackElevationFor(
  boxes: readonly StackBox[],
  moved: Polygon,
  minOverlapRatio = 0.2,
): number | undefined {
  const m = aabb(moved);
  const areaM = Math.max(0, (m.maxX - m.minX) * (m.maxY - m.minY));
  let top: number | undefined;
  for (const b of boxes) {
    const o = aabb(b.polygon);
    const ix = Math.min(m.maxX, o.maxX) - Math.max(m.minX, o.minX);
    const iy = Math.min(m.maxY, o.maxY) - Math.max(m.minY, o.minY);
    if (ix <= 0 || iy <= 0) continue;
    const areaO = Math.max(0, (o.maxX - o.minX) * (o.maxY - o.minY));
    const ratio = (ix * iy) / Math.max(1, Math.min(areaM, areaO));
    if (ratio < minOverlapRatio) continue;
    const candidate = b.baseMm + b.heightMm;
    top = top === undefined ? candidate : Math.max(top, candidate);
  }
  return top;
}
