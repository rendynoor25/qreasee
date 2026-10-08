/**
 * Extrusion of a footprint (with holes) into flat-shaded triangles plus a list
 * of vertical wall faces. The wall list feeds the sun indicator (PRD 9.4); the
 * triangles feed the three.js viewport.
 *
 * 3D convention shared with the web app: (worldX, elevation, worldY) =
 * (point.x, z, point.y). North (+y in 2D) maps to +Z.
 */

import type { Point, Polygon } from "@qreasee/shared";
import { normalizeOrientation } from "./polygon";
import { triangulatePolygon } from "./triangulate";

export interface WallFace {
  /** Running index across all vertical faces of the mass (outer then holes). */
  faceIndex: number;
  ringKind: "outer" | "hole";
  holeIndex?: number;
  segmentIndex: number;
  a: Point;
  b: Point;
  /** Outward unit normal in 2D world XY. */
  normal: Point;
  /** Wall height in mm. */
  height: number;
  /** Face area in mm². */
  area: number;
}

export interface Extrusion {
  /** Non-indexed xyz, 9 numbers per triangle. */
  positions: number[];
  /** Per-vertex normals parallel to `positions`. */
  normals: number[];
  walls: WallFace[];
  baseZ: number;
  topZ: number;
}

export function extrudePolygon(poly: Polygon, baseZ: number, topZ: number): Extrusion {
  const norm = normalizeOrientation(poly);
  const positions: number[] = [];
  const normals: number[] = [];
  const walls: WallFace[] = [];
  const height = Math.max(0, topZ - baseZ);

  const tri = triangulatePolygon(norm);
  const vertAt = (i: number): Point => ({ x: tri.vertices[i * 2], y: tri.vertices[i * 2 + 1] });

  // Top and bottom caps (flat, normal ±Y).
  for (let i = 0; i < tri.indices.length; i += 3) {
    const a = vertAt(tri.indices[i]);
    const b = vertAt(tri.indices[i + 1]);
    const c = vertAt(tri.indices[i + 2]);
    positions.push(a.x, topZ, a.y, b.x, topZ, b.y, c.x, topZ, c.y);
    for (let k = 0; k < 3; k++) normals.push(0, 1, 0);
    positions.push(c.x, baseZ, c.y, b.x, baseZ, b.y, a.x, baseZ, a.y);
    for (let k = 0; k < 3; k++) normals.push(0, -1, 0);
  }

  const addRingWalls = (
    ring: readonly Point[],
    ringKind: "outer" | "hole",
    holeIndex?: number,
  ) => {
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % n];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      const normal: Point =
        ringKind === "outer"
          ? { x: dy / len, y: -dx / len } // outward right-normal of a CCW ring
          : { x: dy / len, y: -dx / len }; // CW hole: same formula points into the hole
      positions.push(
        a.x, baseZ, a.y,
        b.x, baseZ, b.y,
        b.x, topZ, b.y,
        a.x, baseZ, a.y,
        b.x, topZ, b.y,
        a.x, topZ, a.y,
      );
      for (let k = 0; k < 6; k++) normals.push(normal.x, 0, normal.y);
      walls.push({
        faceIndex: walls.length,
        ringKind,
        holeIndex,
        segmentIndex: i,
        a,
        b,
        normal,
        height,
        area: len * height,
      });
    }
  };

  addRingWalls(norm.outer, "outer");
  norm.holes.forEach((hole, hi) => addRingWalls(hole, "hole", hi));

  return { positions, normals, walls, baseZ, topZ };
}
