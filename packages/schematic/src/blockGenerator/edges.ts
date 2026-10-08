/**
 * BG-01: edge analysis. For every concept block, split each polygon edge wherever
 * a same-storey neighbour overlaps it collinearly (within `tol`), then classify
 * each resulting segment as SHARED (a neighbour lies across it) or EXTERIOR.
 * Pure.
 */

import type { Point, Room } from "@qreasee/shared";

export interface BlockEdge {
  a: Point;
  b: Point;
  kind: "exterior" | "shared";
  /** Source block id(s); for a shared edge, both blocks, sorted. */
  blockIds: string[];
}

function centroid(ring: Point[]): Point {
  const n = ring.length || 1;
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p.x;
    y += p.y;
  }
  return { x: x / n, y: y / n };
}

/** Perpendicular distance from p to the line through a and b. */
function perpDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}

export function analyseEdges(
  blocks: readonly Room[],
  tol: number,
): { edges: BlockEdge[]; unassigned: number } {
  const info = blocks.map((b) => ({
    id: b.id,
    poly: b.polygon.outer,
    c: centroid(b.polygon.outer),
  }));
  const edges: BlockEdge[] = [];

  for (const blk of info) {
    const ring = blk.poly;
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const p0 = ring[i];
      const p1 = ring[(i + 1) % n];
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) continue;
      const ux = dx / len;
      const uy = dy / len;
      let nx = -uy;
      let ny = ux;
      if (nx * (blk.c.x - p0.x) + ny * (blk.c.y - p0.y) > 0) {
        nx = -nx;
        ny = -ny;
      }

      // Breakpoints from collinear neighbour edges.
      const cuts: number[] = [0, len];
      for (const other of info) {
        if (other.id === blk.id) continue;
        for (let j = 0; j < other.poly.length; j++) {
          const q0 = other.poly[j];
          const q1 = other.poly[(j + 1) % other.poly.length];
          if (Math.abs(perpDist(q0, p0, p1)) > tol || Math.abs(perpDist(q1, p0, p1)) > tol) continue;
          const t0 = (q0.x - p0.x) * ux + (q0.y - p0.y) * uy;
          const t1 = (q1.x - p0.x) * ux + (q1.y - p0.y) * uy;
          const lo = Math.max(0, Math.min(t0, t1));
          const hi = Math.min(len, Math.max(t0, t1));
          if (hi > lo + 1) cuts.push(lo, hi);
        }
      }
      cuts.sort((a, b) => a - b);
      const u: number[] = [];
      for (const c of cuts) if (u.length === 0 || Math.abs(c - u[u.length - 1]) > 1) u.push(c);

      for (let s = 0; s + 1 < u.length; s++) {
        const u0 = u[s];
        const u1 = u[s + 1];
        if (u1 - u0 < tol) continue;
        const mid = (u0 + u1) / 2;
        const a = { x: p0.x + ux * u0, y: p0.y + uy * u0 };
        const b = { x: p0.x + ux * u1, y: p0.y + uy * u1 };

        let sharedWith: string | null = null;
        for (const other of info) {
          if (other.id === blk.id) continue;
          // The neighbour must lie across the edge (on the outward side).
          if (nx * (other.c.x - a.x) + ny * (other.c.y - a.y) <= tol) continue;
          let covers = false;
          for (let j = 0; j < other.poly.length; j++) {
            const q0 = other.poly[j];
            const q1 = other.poly[(j + 1) % other.poly.length];
            if (Math.abs(perpDist(q0, p0, p1)) > tol || Math.abs(perpDist(q1, p0, p1)) > tol) continue;
            const t0 = (q0.x - p0.x) * ux + (q0.y - p0.y) * uy;
            const t1 = (q1.x - p0.x) * ux + (q1.y - p0.y) * uy;
            if (Math.min(t0, t1) - tol <= mid && mid <= Math.max(t0, t1) + tol) {
              covers = true;
              break;
            }
          }
          if (covers) {
            sharedWith = other.id;
            break;
          }
        }

        edges.push({
          a,
          b,
          kind: sharedWith ? "shared" : "exterior",
          blockIds: sharedWith ? [blk.id, sharedWith].sort() : [blk.id],
        });
      }
    }
  }

  return { edges, unassigned: 0 };
}
