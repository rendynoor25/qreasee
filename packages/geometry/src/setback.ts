/** Setback strips, buildable area and offsets for CX-06 and the setback indicator. */

import type { Point, Polygon } from "@qreasee/shared";
import { differencePolygons, unionPolygons } from "./clipper";
import { makeCcw, openRing } from "./polygon";

export interface SetbackSegment {
  edgeIndex: number;
  a: Point;
  b: Point;
}

/** Inward offset lines per site edge, for drawing dashed setback lines. */
export function setbackLines(
  boundary: readonly Point[],
  setbacks: Record<number, number>,
): SetbackSegment[] {
  const ring = makeCcw(openRing(boundary));
  const segments: SetbackSegment[] = [];
  for (let i = 0; i < ring.length; i++) {
    const w = setbacks[i] ?? 0;
    if (w <= 0) continue;
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const nx = -dy / len;
    const ny = dx / len;
    segments.push({
      edgeIndex: i,
      a: { x: a.x + nx * w, y: a.y + ny * w },
      b: { x: b.x + nx * w, y: b.y + ny * w },
    });
  }
  return segments;
}

/**
 * The strip along one site edge with that edge's setback width. The strip is
 * extended slightly *outside* the boundary (overhang) so the clip never shares
 * an exact edge with the subject; Clipper2-js degenerates on coincident edges.
 */
function edgeStrip(a: Point, b: Point, width: number): Polygon | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6 || width <= 0) return null;
  const nx = -dy / len; // left normal = inward for a CCW ring
  const ny = dx / len;
  const ux = dx / len;
  const uy = dy / len;
  const overhang = Math.max(width, 1_000) + 1_000;
  // Extend outward (past the edge) and lengthwise (past both corners) so the
  // clip never shares an exact edge with the subject; the inner edge stays
  // exactly `width` inside the original edge.
  const outA = { x: a.x - ux * overhang - nx * overhang, y: a.y - uy * overhang - ny * overhang };
  const outB = { x: b.x + ux * overhang - nx * overhang, y: b.y + uy * overhang - ny * overhang };
  const inA = { x: a.x - ux * overhang + nx * width, y: a.y - uy * overhang + ny * width };
  const inB = { x: b.x + ux * overhang + nx * width, y: b.y + uy * overhang + ny * width };
  return {
    outer: [outA, outB, inB, inA],
    holes: [],
  };
}

export interface BuildableArea {
  polygons: Polygon[];
  buildableAreaMm2: number;
  siteAreaMm2: number;
}

/**
 * Buildable area = site polygon minus a strip along each edge with that edge's
 * setback width (PRD 9.2, Setback). The union of strips is the setback region.
 */
export function buildableArea(
  boundary: readonly Point[],
  setbacks: Record<number, number>,
): Polygon[] {
  const ring = makeCcw(openRing(boundary));
  if (ring.length < 3) return [];
  const site: Polygon = { outer: ring, holes: [] };
  const strips: Polygon[] = [];
  for (let i = 0; i < ring.length; i++) {
    const strip = edgeStrip(ring[i], ring[(i + 1) % ring.length], setbacks[i] ?? 0);
    if (strip) strips.push(strip);
  }
  if (strips.length === 0) return [site];
  const setbackRegion = unionPolygons(strips);
  return differencePolygons([site], setbackRegion);
}
