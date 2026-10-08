/**
 * Clipper2 adapter. We do not hand-roll polygon booleans (PRD coding-agent
 * rule); all unions, differences and offsets go through Clipper2.
 *
 * Coordinates are millimetres and already integral enough for Clipper's integer
 * engine; we round on the way in and stay in mm on the way out.
 */

import {
  Clipper,
  EndType,
  FillRule,
  JoinType,
  Paths64,
  type Path64,
} from "clipper2-js";
import type { Point, Polygon } from "@qreasee/shared";
import {
  normalizeOrientation,
  pointInRing,
  removeCollinear,
  ringArea,
  signedArea,
} from "./polygon";

function ringToPath(ring: readonly Point[]): Path64 {
  const flat: number[] = [];
  for (const p of ring) flat.push(Math.round(p.x), Math.round(p.y));
  return Clipper.makePath(flat);
}

function pathToRing(path: Path64): Point[] {
  const ring: Point[] = [];
  for (const p of path) ring.push({ x: p.x, y: p.y });
  return ring;
}

export function polygonsToPaths(polys: readonly Polygon[]): Paths64 {
  const paths = new Paths64();
  for (const raw of polys) {
    // NonZero fill needs outer CCW and holes CW, or holes get filled in.
    const poly = normalizeOrientation(raw);
    if (poly.outer.length >= 3) paths.push(ringToPath(poly.outer));
    for (const hole of poly.holes) {
      if (hole.length >= 3) paths.push(ringToPath(hole));
    }
  }
  return paths;
}

/**
 * Rebuild polygons from Clipper output. A ring is a hole when an odd number of
 * other rings contain it (even-odd nesting); holes attach to the smallest
 * containing outer.
 */
export function pathsToPolygons(paths: Paths64): Polygon[] {
  const rings: Point[][] = [];
  for (const path of paths) {
    if (path.length < 3) continue;
    const cleaned = removeCollinear(pathToRing(path));
    if (cleaned.length >= 3) rings.push(cleaned);
  }
  const depth = rings.map(
    (ring, i) =>
      rings.filter((other, j) => j !== i && pointInRing(ring[0], other)).length,
  );
  const outerIdx: number[] = [];
  rings.forEach((_, i) => {
    if (depth[i] % 2 === 0) outerIdx.push(i);
  });
  const polys: Polygon[] = outerIdx.map((i) => ({ outer: rings[i], holes: [] }));
  rings.forEach((ring, i) => {
    if (depth[i] % 2 === 0) return;
    let best = -1;
    let bestArea = Infinity;
    outerIdx.forEach((oi) => {
      if (pointInRing(ring[0], rings[oi])) {
        const a = ringArea(rings[oi]);
        if (a < bestArea) {
          bestArea = a;
          best = oi;
        }
      }
    });
    if (best >= 0) polys[outerIdx.indexOf(best)].holes.push(ring);
  });
  return polys;
}

export function unionPolygons(polys: readonly Polygon[]): Polygon[] {
  if (polys.length === 0) return [];
  return pathsToPolygons(Clipper.Union(polygonsToPaths(polys), undefined, FillRule.NonZero));
}

export function differencePolygons(
  subject: readonly Polygon[],
  clips: readonly Polygon[],
): Polygon[] {
  if (subject.length === 0) return [];
  if (clips.length === 0) return subject.map((p) => ({ outer: p.outer, holes: p.holes }));
  return pathsToPolygons(
    Clipper.Difference(polygonsToPaths(subject), polygonsToPaths(clips), FillRule.NonZero),
  );
}

export function intersectPolygons(
  subject: readonly Polygon[],
  clips: readonly Polygon[],
): Polygon[] {
  if (subject.length === 0 || clips.length === 0) return [];
  return pathsToPolygons(
    Clipper.Intersect(polygonsToPaths(subject), polygonsToPaths(clips), FillRule.NonZero),
  );
}

/** Total absolute area of a set of disjoint polygons, in mm². */
export function polygonsAreaMm2(polys: readonly Polygon[]): number {
  return polys.reduce((sum, poly) => {
    const holes = poly.holes.reduce((s, h) => s + ringArea(h), 0);
    return sum + Math.max(0, ringArea(poly.outer) - holes);
  }, 0);
}

/** Area of the union of the inputs, in mm². */
export function unionAreaMm2(polys: readonly Polygon[]): number {
  return polygonsAreaMm2(unionPolygons(polys));
}

/**
 * Outward/inward offset. Positive delta grows the polygon. Orientation is
 * normalised first so the sign behaves the same for any input winding.
 */
export function inflatePolygon(poly: Polygon, deltaMm: number): Polygon[] {
  const outerCcw = signedArea(poly.outer) >= 0 ? poly.outer : [...poly.outer].reverse();
  const holes = poly.holes.map((h) => (signedArea(h) <= 0 ? h : [...h].reverse()));
  const prepared: Polygon = { outer: outerCcw, holes };
  const result = Clipper.InflatePaths(
    polygonsToPaths([prepared]),
    deltaMm,
    JoinType.Miter,
    EndType.Polygon,
    2,
  );
  return pathsToPolygons(result);
}
