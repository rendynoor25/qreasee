/** Footprint triangulation with holes, via earcut (PRD 6.1). */

import earcut from "earcut";
import type { Polygon } from "@qreasee/shared";

export interface Triangulation {
  /** Flat [x0,y0, x1,y1, ...] in mm. */
  vertices: number[];
  /** Triangle vertex indices into `vertices` (pairs indexed by /2). */
  indices: number[];
}

export function triangulatePolygon(poly: Polygon): Triangulation {
  const vertices: number[] = [];
  const holeIndices: number[] = [];
  const pushRing = (ring: readonly { x: number; y: number }[]) => {
    for (const p of ring) vertices.push(p.x, p.y);
  };
  pushRing(poly.outer);
  for (const hole of poly.holes) {
    holeIndices.push(vertices.length / 2);
    pushRing(hole);
  }
  if (poly.outer.length < 3) return { vertices, indices: [] };
  const indices = earcut(
    vertices,
    holeIndices.length > 0 ? holeIndices : undefined,
    2,
  );
  return { vertices, indices };
}

export function triangulatePolygons(polys: readonly Polygon[]): Triangulation {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (const poly of polys) {
    const t = triangulatePolygon(poly);
    const offset = vertices.length / 2;
    vertices.push(...t.vertices);
    for (const i of t.indices) indices.push(i + offset);
  }
  return { vertices, indices };
}
