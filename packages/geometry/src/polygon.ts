/**
 * Pure polygon predicates and measures. No UI or rendering imports so this runs
 * in Node tests and in Web Workers alike (PRD coding-agent rule).
 */

import type { Point, Polygon } from "@qreasee/shared";

/** Signed area (shoelace). Positive = counter-clockwise in world XY. */
export function signedArea(ring: readonly Point[]): number {
  let sum = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export function ringArea(ring: readonly Point[]): number {
  return Math.abs(signedArea(ring));
}

/** Polygon area in mm², holes subtracted. */
export function polygonAreaMm2(poly: Polygon): number {
  const holes = poly.holes.reduce((s, h) => s + ringArea(h), 0);
  return Math.max(0, ringArea(poly.outer) - holes);
}

export function ringPerimeter(ring: readonly Point[]): number {
  let sum = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    sum += distance(ring[i], ring[(i + 1) % n]);
  }
  return sum;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export interface Bounds {
  min: Point;
  max: Point;
  width: number;
  height: number;
  center: Point;
}

export function bounds(points: readonly Point[]): Bounds {
  if (points.length === 0) {
    return { min: { x: 0, y: 0 }, max: { x: 0, y: 0 }, width: 0, height: 0, center: { x: 0, y: 0 } };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    min: { x: minX, y: minY },
    max: { x: maxX, y: maxY },
    width: maxX - minX,
    height: maxY - minY,
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
  };
}

/** Area-weighted centroid of the outer ring; falls back to the average. */
export function centroid(ring: readonly Point[]): Point {
  const a = signedArea(ring);
  if (Math.abs(a) < 1e-9) {
    if (ring.length === 0) return { x: 0, y: 0 };
    const s = ring.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: s.x / ring.length, y: s.y / ring.length };
  }
  let cx = 0;
  let cy = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % n];
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

/** Ray-casting point-in-ring. Boundary counts as inside. */
export function pointInRing(p: Point, ring: readonly Point[]): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = ring[i];
    const b = ring[j];
    const onEdge =
      pointOnSegment(p, a, b) !== null;
    if (onEdge) return true;
    const intersects =
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Returns the parameter t in [0,1] if p lies on segment a-b, else null. */
export function pointOnSegment(p: Point, a: Point, b: Point): number | null {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-9) {
    // Degenerate zero-length edge: only the point itself is "on" it.
    return Math.abs(apx) <= 1e-6 && Math.abs(apy) <= 1e-6 ? 0 : null;
  }
  const crossV = abx * apy - aby * apx;
  if (Math.abs(crossV) > 1e-6) return null;
  const dotV = apx * abx + apy * aby;
  if (dotV < 0) return null;
  if (dotV > lenSq) return null;
  return dotV / lenSq;
}

export function pointInPolygon(p: Point, poly: Polygon): boolean {
  if (!pointInRing(p, poly.outer)) return false;
  for (const hole of poly.holes) {
    if (pointInRing(p, hole)) return false;
  }
  return true;
}

function orient(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentsProperlyIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (o1 === 0 || o2 === 0 || o3 === 0 || o4 === 0) return false; // ignore collinear touching
  return o1 > 0 !== o2 > 0 && o3 > 0 !== o4 > 0;
}

/** A ring is simple if no two non-adjacent edges properly cross (NFR: robustness). */
export function isSimpleRing(ring: readonly Point[]): boolean {
  const n = ring.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (j === i) continue;
      // Skip adjacent edges (share a vertex).
      if (j === (i + 1) % n || (j + 1) % n === i) continue;
      const c = ring[j];
      const d = ring[(j + 1) % n];
      if (segmentsProperlyIntersect(a, b, c, d)) return false;
    }
  }
  return true;
}

export function isSimplePolygon(poly: Polygon): boolean {
  if (!isSimpleRing(poly.outer)) return false;
  for (const hole of poly.holes) {
    if (!isSimpleRing(hole)) return false;
    // A hole vertex must sit inside the outer ring.
    if (!pointInRing(hole[0], poly.outer)) return false;
  }
  return true;
}

/** Ensure the ring is closed exactly once (first point repeated only implicitly). */
export function openRing(ring: readonly Point[]): Point[] {
  return cleanRing(ring);
}

export function samePoint(a: Point, b: Point, eps = 1e-6): boolean {
  return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
}

/** Drop consecutive duplicate points (and a repeated closing point). */
export function cleanRing(ring: readonly Point[], eps = 1e-6): Point[] {
  const out: Point[] = [];
  for (const p of ring) {
    const last = out[out.length - 1];
    if (!last || !samePoint(last, p, eps)) out.push({ x: p.x, y: p.y });
  }
  while (out.length > 1 && samePoint(out[0], out[out.length - 1], eps)) out.pop();
  return out;
}

/** Drop collinear middle points, keeping at least three vertices. */
export function removeCollinear(ring: readonly Point[], eps = 1e-6): Point[] {
  const cleaned = cleanRing(ring, eps);
  const n = cleaned.length;
  if (n < 3) return cleaned;
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const prev = cleaned[(i - 1 + n) % n];
    const cur = cleaned[i];
    const next = cleaned[(i + 1) % n];
    const crossV = (cur.x - prev.x) * (next.y - prev.y) - (cur.y - prev.y) * (next.x - prev.x);
    if (Math.abs(crossV) > eps) out.push(cur);
  }
  return out.length >= 3 ? out : cleaned;
}

export function makeCcw(ring: readonly Point[]): Point[] {
  return signedArea(ring) < 0 ? [...ring].reverse() : [...ring];
}

export function makeCw(ring: readonly Point[]): Point[] {
  return signedArea(ring) > 0 ? [...ring].reverse() : [...ring];
}

/** Outer ring CCW, holes CW — the convention Clipper2 and extrusion expect. */
export function normalizeOrientation(poly: Polygon): Polygon {
  return {
    outer: makeCcw(openRing(poly.outer)),
    holes: poly.holes.map((h) => makeCw(openRing(h))),
  };
}

export function clonePolygon(poly: Polygon): Polygon {
  return {
    outer: poly.outer.map((p) => ({ ...p })),
    holes: poly.holes.map((h) => h.map((p) => ({ ...p }))),
  };
}

export function translateRing(ring: readonly Point[], dx: number, dy: number): Point[] {
  return ring.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

export function translatePolygon(poly: Polygon, dx: number, dy: number): Polygon {
  return {
    outer: translateRing(poly.outer, dx, dy),
    holes: poly.holes.map((h) => translateRing(h, dx, dy)),
  };
}

export function scalePolygon(poly: Polygon, k: number, origin: Point = { x: 0, y: 0 }): Polygon {
  const map = (r: readonly Point[]) =>
    r.map((p) => ({ x: origin.x + (p.x - origin.x) * k, y: origin.y + (p.y - origin.y) * k }));
  return { outer: map(poly.outer), holes: poly.holes.map(map) };
}

/** Rotate a polygon about an origin, degrees counter-clockwise in world XY. */
export function rotatePolygon(poly: Polygon, degrees: number, origin: Point = { x: 0, y: 0 }): Polygon {
  const r = (degrees * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const map = (ring: readonly Point[]) =>
    ring.map((p) => {
      const dx = p.x - origin.x;
      const dy = p.y - origin.y;
      return { x: origin.x + dx * c - dy * s, y: origin.y + dx * s + dy * c };
    });
  return { outer: map(poly.outer), holes: poly.holes.map(map) };
}
