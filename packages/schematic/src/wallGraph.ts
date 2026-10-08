/**
 * Part 3 §1: the wall graph. Walls are edges; their endpoints cluster into shared
 * nodes (within `max(thickness) * 0.75`), and an endpoint that lands on another
 * wall's segment becomes a T‑junction. Each wall end is then extended by half the
 * thickness of the wall it meets, so the union of the wall footprints closes at
 * corners, T‑junctions and crossings — one continuous outline.
 *
 * Pure. Plan, section and 3D all use the extended geometry from here.
 */

import type { Point } from "@qreasee/shared";

export interface GraphWall {
  id: string;
  a: Point;
  b: Point;
  thickness: number;
}

export interface EndExt {
  /** Extension at the `a` end, mm. */
  a: number;
  /** Extension at the `b` end, mm. */
  b: number;
}

export interface WallGraphResult {
  /** Per wall, how far to extend each end (mm). */
  ext: Record<string, EndExt>;
  nodeCount: number;
}

const dist = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y);

function distToSeg(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

export function wallGraph(walls: readonly GraphWall[]): WallGraphResult {
  const ext: Record<string, EndExt> = {};
  for (const w of walls) ext[w.id] = { a: 0, b: 0 };
  if (walls.length === 0) return { ext, nodeCount: 0 };
  const maxT = Math.max(...walls.map((w) => w.thickness));
  const tol = Math.max(60, maxT * 0.75);

  interface Node {
    p: Point;
    ends: { id: string; end: "a" | "b" }[];
  }
  const nodes: Node[] = [];
  for (const w of walls) {
    for (const end of ["a", "b"] as const) {
      const p = w[end];
      const node = nodes.find((n) => dist(n.p, p) <= tol);
      if (node) node.ends.push({ id: w.id, end });
      else nodes.push({ p: { x: p.x, y: p.y }, ends: [{ id: w.id, end }] });
    }
  }

  for (const node of nodes) {
    const connected = new Set(node.ends.map((e) => e.id));
    // A wall that passes through the node (no endpoint here) is a T‑junction.
    for (const w of walls) {
      if (connected.has(w.id)) continue;
      if (distToSeg(node.p, w.a, w.b) <= tol) connected.add(w.id);
    }
    if (connected.size < 2) continue; // free end
    const ids = [...connected];
    const thicknessOf = (id: string) => walls.find((w) => w.id === id)?.thickness ?? 0;
    for (const { id, end } of node.ends) {
      const others = ids.filter((x) => x !== id);
      if (others.length === 0) continue;
      ext[id][end] = Math.max(...others.map(thicknessOf)) / 2;
    }
  }

  return { ext, nodeCount: nodes.length };
}
