/** Roof generation (hip, gable, one-slope) over the footprint bounding box. */

import type { Point } from "@qreasee/shared";
import { bounds } from "@qreasee/geometry";
import type { Roof, RoofFace, RoofType } from "./types";

export interface RoofPlan {
  /** Eaves ring (the roof outline, in plan). */
  eaves: Point[];
  /** Internal edges: ridges, hips and valleys, in plan. */
  lines: Array<[Point, Point]>;
}

/**
 * W-08: the roof seen from above. Boundary edges are the eaves; an edge shared
 * by exactly two faces is a ridge, hip or valley. Vertical (eave-to-ridge at the
 * same plan point) edges are dropped because they have no plan length.
 */
export function roofPlanLines(roof: Roof): RoofPlan {
  const key = (p: [number, number, number]) => `${Math.round(p[0])},${Math.round(p[2])}`;
  const edges = new Map<string, { a: [number, number, number]; b: [number, number, number]; count: number }>();
  for (const face of roof.faces) {
    for (let i = 0; i < face.points.length; i++) {
      const a = face.points[i];
      const b = face.points[(i + 1) % face.points.length];
      const ka = key(a);
      const kb = key(b);
      if (ka === kb) continue;
      const ek = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const existing = edges.get(ek);
      if (existing) existing.count++;
      else edges.set(ek, { a, b, count: 1 });
    }
  }
  const lines: Array<[Point, Point]> = [];
  for (const e of edges.values()) {
    if (e.count !== 2) continue;
    lines.push([
      { x: e.a[0], y: e.a[2] },
      { x: e.b[0], y: e.b[2] },
    ]);
  }
  return { eaves: roof.outline, lines };
}


export function buildRoof(
  outer: readonly Point[],
  type: RoofType,
  pitchDeg: number,
  overhang: number,
  eaveZ: number,
): Roof {
  const b = bounds(outer);
  const minX = b.min.x - overhang;
  const maxX = b.max.x + overhang;
  const minY = b.min.y - overhang;
  const maxY = b.max.y + overhang;
  const wide = maxX - minX >= maxY - minY;

  // Work in (u = along the ridge, v = across it); transpose when needed.
  const U0 = wide ? minX : minY;
  const U1 = wide ? maxX : maxY;
  const V0 = wide ? minY : minX;
  const V1 = wide ? maxY : maxX;
  const map = (u: number, v: number, z: number): [number, number, number] =>
    wide ? [u, z, v] : [v, z, u];

  const pitch = (pitchDeg * Math.PI) / 180;
  const half = (V1 - V0) / 2;
  const cv = (V0 + V1) / 2;
  const rise = Math.tan(pitch) * half;
  const ridgeZ = eaveZ + rise;
  const faces: RoofFace[] = [];

  const push = (pts: Array<[number, number, number]>) => faces.push({ points: pts });

  if (type === "shed") {
    const highZ = eaveZ + Math.tan(pitch) * (V1 - V0);
    push([
      map(U0, V0, eaveZ),
      map(U1, V0, eaveZ),
      map(U1, V1, highZ),
      map(U0, V1, highZ),
    ]);
  } else if (type === "gable") {
    push([map(U0, V0, eaveZ), map(U1, V0, eaveZ), map(U1, cv, ridgeZ), map(U0, cv, ridgeZ)]);
    push([map(U1, V1, eaveZ), map(U0, V1, eaveZ), map(U0, cv, ridgeZ), map(U1, cv, ridgeZ)]);
    // Gable ends.
    push([map(U0, V0, eaveZ), map(U0, cv, ridgeZ), map(U0, V1, eaveZ)]);
    push([map(U1, V1, eaveZ), map(U1, cv, ridgeZ), map(U1, V0, eaveZ)]);
  } else {
    // Hip: ridge shortened by half the span at each end.
    const rs = Math.min(U0 + half, (U0 + U1) / 2);
    const re = Math.max(U1 - half, (U0 + U1) / 2);
    push([map(U0, V0, eaveZ), map(U1, V0, eaveZ), map(re, cv, ridgeZ), map(rs, cv, ridgeZ)]);
    push([map(U1, V1, eaveZ), map(U0, V1, eaveZ), map(rs, cv, ridgeZ), map(re, cv, ridgeZ)]);
    push([map(U0, V0, eaveZ), map(rs, cv, ridgeZ), map(U0, V1, eaveZ)]);
    push([map(U1, V1, eaveZ), map(re, cv, ridgeZ), map(U1, V0, eaveZ)]);
  }

  return {
    type,
    faces,
    outline: [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ],
    eaveZ,
    ridgeZ: type === "shed" ? eaveZ + Math.tan(pitch) * (V1 - V0) : ridgeZ,
  };
}
