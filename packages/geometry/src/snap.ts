/**
 * LG-03 / MD-03 — 3D screen-space snapping ("inference").
 *
 * Pure module: no React, no three.js. The viewport injects a `project(point3D)`
 * that returns screen pixels, so candidates are matched in PIXELS (constant feel
 * at any zoom / camera) instead of world units. Candidates are generated in 3D
 * (plan x/y + elevation z), so top corners and stacked blocks snap at their real
 * height.
 *
 * Coordinate note: `Point3 = { x, y, z }` where x/y are plan millimetres and z is
 * elevation (mm). The viewport maps this to three.js as (x, z, -y).
 */

import type { DocState, Point } from "@qreasee/shared";

export type SnapKind =
  | "close"
  | "endpoint"
  | "midpoint"
  | "intersection"
  | "edge"
  | "axis"
  | "parallel"
  | "perpendicular"
  | "grid";

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface SnapGuide {
  kind: "vertical" | "axis-x" | "axis-y" | "parallel" | "perpendicular";
  from: Point3;
  to: Point3;
}

export type SnapPointKind = Exclude<SnapKind, "edge">;

export interface SnapPointCandidate {
  kind: SnapPointKind;
  point: Point3;
  sourceId?: string;
  guides?: SnapGuide[];
}

export interface SnapEdgeCandidate {
  kind: "edge";
  a: Point3;
  b: Point3;
  sourceId?: string;
}

export type SnapCandidate = SnapPointCandidate | SnapEdgeCandidate;

export interface SnapContext {
  activeLevelId: string | null;
  activeLevelElevation: number;
  /** Cursor's plan point on the drawing plane (for axis / parallel guides). */
  cursorPlan?: Point | null;
  /** Draft polyline points (plan mm) for close / parallel / perpendicular. */
  draftPoints: Point[];
  /** Only consider underlay geometry within this plan radius (mm). */
  underlayCullMm?: number;
  includeUnderlays?: boolean;
  includeGuides?: boolean;
}

export interface SnapView {
  /** Project a model point to screen pixels; null when not projectable. */
  project: (p: Point3) => { x: number; y: number } | null;
  /** Distance from the camera (tie-break: smaller is nearer). */
  distance?: (p: Point3) => number;
  /** True when the point is hidden behind geometry. */
  isOccluded?: (p: Point3) => boolean;
  /** Skip occlusion (top-down orthographic view). */
  skipOcclusion?: boolean;
}

export interface SnapOptions {
  /** Match radius in screen pixels. Default 14. */
  radiusPx?: number;
}

export interface SnapResult {
  kind: SnapKind;
  point: Point3;
  sourceId?: string;
  /** i18n key, e.g. "snap.endpoint". */
  label: string;
  guides: SnapGuide[];
  /** Screen distance of the match, in pixels (debug). */
  px: number;
}

const LABEL: Record<SnapKind, string> = {
  close: "snap.close",
  endpoint: "snap.endpoint",
  midpoint: "snap.midpoint",
  intersection: "snap.intersection",
  edge: "snap.edge",
  axis: "snap.axis",
  parallel: "snap.parallel",
  perpendicular: "snap.perpendicular",
  grid: "snap.grid",
};

/** Lower wins. endpoint > midpoint > intersection > edge > guide/axis > grid. */
const PRIORITY: Record<SnapKind, number> = {
  close: 0,
  endpoint: 1,
  midpoint: 2,
  intersection: 3,
  edge: 4,
  axis: 5,
  parallel: 6,
  perpendicular: 7,
  grid: 8,
};

export const SNAP_LABEL = LABEL;

function uniqueSorted(values: number[]): number[] {
  const out: number[] = [];
  for (const v of [...values].sort((a, b) => a - b)) {
    if (out.length === 0 || Math.abs(out[out.length - 1] - v) > 1) out.push(v);
  }
  return out;
}

function ringEdges(ring: readonly Point[]): Array<[Point, Point]> {
  const out: Array<[Point, Point]> = [];
  for (let i = 0; i < ring.length; i++) out.push([ring[i], ring[(i + 1) % ring.length]]);
  return out;
}

function baseElevation(state: DocState, levelIds: readonly string[]): number {
  const map = new Map(state.levels.map((l) => [l.id, l.elevation] as const));
  const els = levelIds.map((id) => map.get(id) ?? 0);
  return els.length ? Math.min(...els) : 0;
}

function levelElevations(state: DocState, levelIds: readonly string[]): number[] {
  const map = new Map(state.levels.map((l) => [l.id, l.elevation] as const));
  return levelIds.map((id) => map.get(id) ?? 0);
}

/** Add every endpoint / midpoint / edge of a box footprint at the given heights. */
function addBox(
  candidates: SnapCandidate[],
  rings: readonly Point[][],
  baseZ: number,
  topZ: number,
  heights: number[],
  sourceId: string,
) {
  for (const h of heights) {
    for (const ring of rings) {
      for (const v of ring) {
        candidates.push({ kind: "endpoint", point: { x: v.x, y: v.y, z: h }, sourceId });
      }
      for (const [a, b] of ringEdges(ring)) {
        candidates.push({
          kind: "midpoint",
          point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: h },
          sourceId,
        });
        candidates.push({
          kind: "edge",
          a: { x: a.x, y: a.y, z: h },
          b: { x: b.x, y: b.y, z: h },
          sourceId,
        });
      }
    }
  }
  // Vertical edges (base → top) and their midpoints.
  if (Math.abs(topZ - baseZ) > 1) {
    for (const ring of rings) {
      for (const v of ring) {
        candidates.push({
          kind: "edge",
          a: { x: v.x, y: v.y, z: baseZ },
          b: { x: v.x, y: v.y, z: topZ },
          sourceId,
        });
        candidates.push({
          kind: "midpoint",
          point: { x: v.x, y: v.y, z: (baseZ + topZ) / 2 },
          sourceId,
        });
      }
    }
  }
}

export function buildSnapCandidates(state: DocState, ctx: SnapContext): SnapCandidate[] {
  const candidates: SnapCandidate[] = [];

  // Masses.
  for (const mass of state.masses) {
    const base = baseElevation(state, mass.levelIds);
    const top = base + mass.height;
    const heights = uniqueSorted(
      [base, top, ...levelElevations(state, mass.levelIds)].filter((h) => h >= base - 1 && h <= top + 1),
    );
    addBox(candidates, [mass.footprint.outer, ...mass.footprint.holes], base, top, heights, mass.id);
  }

  // Concept blocks / rooms.
  for (const room of state.rooms) {
    const level = state.levels.find((l) => l.id === room.levelId);
    const base = room.elevationMm ?? level?.elevation ?? 0;
    const top = base + (room.height ?? 3000);
    addBox(candidates, [room.polygon.outer, ...room.polygon.holes], base, top, uniqueSorted([base, top]), room.id);
  }

  // Site boundary, green and paved surfaces (on the ground).
  if (state.site.boundary.length >= 2) {
    addBox(candidates, [state.site.boundary], 0, 0, [0], "site");
  }
  for (const g of state.site.greenPolygons) addBox(candidates, [g.points], 0, 0, [0], g.id);
  for (const p of state.site.pavedPolygons) addBox(candidates, [p.points], 0, 0, [0], p.id);

  // Grid intersections at each level elevation.
  const xs = state.grids.filter((g) => g.axis === "x").map((g) => g.offset);
  const ys = state.grids.filter((g) => g.axis === "y").map((g) => g.offset);
  const gridHeights = uniqueSorted(state.levels.map((l) => l.elevation).concat(ctx.activeLevelElevation));
  for (const x of xs) {
    for (const y of ys) {
      for (const z of gridHeights) {
        candidates.push({ kind: "intersection", point: { x, y, z }, sourceId: `grid-${x}-${y}` });
      }
    }
  }

  // Underlays (I-03c): only near the cursor, to stay responsive.
  if (ctx.includeUnderlays !== false && ctx.cursorPlan) {
    const cull = ctx.underlayCullMm ?? Infinity;
    const c = ctx.cursorPlan;
    for (const u of state.underlays ?? []) {
      if (u.visible === false) continue;
      if (ctx.activeLevelId && u.levelId !== ctx.activeLevelId) continue;
      const level = state.levels.find((l) => l.id === u.levelId);
      const z = (level?.elevation ?? 0) + (u.elevationMm ?? 0);
      const vis = u.layerVisibility ?? {};
      for (const line of u.lines) {
        if (line.layer && vis[line.layer] === false) continue;
        const nearA = Math.hypot(line.a.x - c.x, line.a.y - c.y) <= cull;
        const nearB = Math.hypot(line.b.x - c.x, line.b.y - c.y) <= cull;
        const mid = { x: (line.a.x + line.b.x) / 2, y: (line.a.y + line.b.y) / 2 };
        const nearMid = Math.hypot(mid.x - c.x, mid.y - c.y) <= cull;
        if (!nearA && !nearB && !nearMid) continue;
        if (nearA) candidates.push({ kind: "endpoint", point: { x: line.a.x, y: line.a.y, z }, sourceId: u.id });
        if (nearB) candidates.push({ kind: "endpoint", point: { x: line.b.x, y: line.b.y, z }, sourceId: u.id });
        if (nearMid) candidates.push({ kind: "midpoint", point: { x: mid.x, y: mid.y, z }, sourceId: u.id });
        candidates.push({
          kind: "edge",
          a: { x: line.a.x, y: line.a.y, z },
          b: { x: line.b.x, y: line.b.y, z },
          sourceId: u.id,
        });
      }
    }
  }

  // Guides from the cursor / draft (axis, parallel, perpendicular).
  if (ctx.includeGuides !== false && ctx.cursorPlan) {
    const c = ctx.cursorPlan;
    const z = ctx.activeLevelElevation;
    candidates.push({
      kind: "axis",
      point: { x: 0, y: c.y, z },
      guides: [{ kind: "axis-y", from: { x: c.x, y: c.y, z }, to: { x: 0, y: c.y, z } }],
    });
    candidates.push({
      kind: "axis",
      point: { x: c.x, y: 0, z },
      guides: [{ kind: "axis-x", from: { x: c.x, y: c.y, z }, to: { x: c.x, y: 0, z } }],
    });

    const n = ctx.draftPoints.length;
    if (n >= 2) {
      const a = ctx.draftPoints[n - 2];
      const b = ctx.draftPoints[n - 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      // Parallel: project cursor onto the line through b with direction u.
      const parT = (c.x - b.x) * ux + (c.y - b.y) * uy;
      const par = { x: b.x + ux * parT, y: b.y + uy * parT };
      candidates.push({
        kind: "parallel",
        point: { x: par.x, y: par.y, z },
        guides: [{ kind: "parallel", from: { x: b.x, y: b.y, z }, to: { x: par.x, y: par.y, z } }],
      });
      // Perpendicular: direction (-uy, ux).
      const nx = -uy;
      const ny = ux;
      const perpT = (c.x - b.x) * nx + (c.y - b.y) * ny;
      const perp = { x: b.x + nx * perpT, y: b.y + ny * perpT };
      candidates.push({
        kind: "perpendicular",
        point: { x: perp.x, y: perp.y, z },
        guides: [{ kind: "perpendicular", from: { x: b.x, y: b.y, z }, to: { x: perp.x, y: perp.y, z } }],
      });
    }

    // Close the loop back to the first draft point.
    if (n >= 3) {
      const first = ctx.draftPoints[0];
      candidates.push({ kind: "close", point: { x: first.x, y: first.y, z } });
    }
  }

  return candidates;
}

function closestOnSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): { t: number; d: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return { t, d: Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)) };
}

interface Best {
  kind: SnapKind;
  point: Point3;
  sourceId?: string;
  guides: SnapGuide[];
  px: number;
  camDist: number;
}

function beats(a: Best, b: Best, activeElevation: number): boolean {
  if (PRIORITY[a.kind] !== PRIORITY[b.kind]) return PRIORITY[a.kind] < PRIORITY[b.kind];
  if (Math.abs(a.px - b.px) > 0.5) return a.px < b.px;
  if (Math.abs(a.camDist - b.camDist) > 1) return a.camDist < b.camDist;
  return Math.abs(a.point.z - activeElevation) < Math.abs(b.point.z - activeElevation);
}

export function pickSnap(
  candidates: readonly SnapCandidate[],
  pointerPx: { x: number; y: number },
  view: SnapView,
  opts: SnapOptions = {},
  activeElevation = 0,
): SnapResult | null {
  const radius = opts.radiusPx ?? 14;
  let best: Best | null = null;

  for (const c of candidates) {
    let point: Point3;
    let px: number;
    if (c.kind === "edge") {
      const A = view.project(c.a);
      const B = view.project(c.b);
      if (!A || !B) continue;
      const { t, d } = closestOnSegment(pointerPx, A, B);
      if (d > radius) continue;
      point = {
        x: c.a.x + (c.b.x - c.a.x) * t,
        y: c.a.y + (c.b.y - c.a.y) * t,
        z: c.a.z + (c.b.z - c.a.z) * t,
      };
      px = d;
    } else {
      const P = view.project(c.point);
      if (!P) continue;
      const d = Math.hypot(P.x - pointerPx.x, P.y - pointerPx.y);
      if (d > radius) continue;
      point = c.point;
      px = d;
    }
    if (!view.skipOcclusion && view.isOccluded?.(point)) continue;

    const cand: Best = {
      kind: c.kind,
      point,
      sourceId: c.kind === "edge" ? c.sourceId : (c as SnapPointCandidate).sourceId,
      guides: c.kind === "edge" ? [] : (c as SnapPointCandidate).guides ?? [],
      px,
      camDist: view.distance?.(point) ?? 0,
    };
    if (!best || beats(cand, best, activeElevation)) best = cand;
  }

  if (!best) return null;
  return {
    kind: best.kind,
    point: best.point,
    sourceId: best.sourceId,
    label: LABEL[best.kind],
    guides: best.guides,
    px: best.px,
  };
}

export interface NearbySnapMarker {
  kind: SnapKind;
  screen: { x: number; y: number };
  point: Point3;
  label: string;
  px: number;
}

/**
 * Every candidate whose projection is within `radiusPx` of the pointer, for
 * drawing the marker overlay. The active result is highlighted by the caller.
 */
export function nearbySnapMarkers(
  candidates: readonly SnapCandidate[],
  pointerPx: { x: number; y: number },
  view: SnapView,
  radiusPx = 40,
): NearbySnapMarker[] {
  const out: NearbySnapMarker[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    let point: Point3;
    let screen: { x: number; y: number };
    let px: number;
    if (c.kind === "edge") {
      const A = view.project(c.a);
      const B = view.project(c.b);
      if (!A || !B) continue;
      const { t, d } = closestOnSegment(pointerPx, A, B);
      if (d > radiusPx) continue;
      screen = { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t };
      point = {
        x: c.a.x + (c.b.x - c.a.x) * t,
        y: c.a.y + (c.b.y - c.a.y) * t,
        z: c.a.z + (c.b.z - c.a.z) * t,
      };
      px = d;
    } else {
      const P = view.project(c.point);
      if (!P) continue;
      px = Math.hypot(P.x - pointerPx.x, P.y - pointerPx.y);
      if (px > radiusPx) continue;
      screen = P;
      point = c.point;
    }
    if (!view.skipOcclusion && view.isOccluded?.(point)) continue;
    const key = `${Math.round(screen.x)},${Math.round(screen.y)},${c.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ kind: c.kind, screen, point, label: LABEL[c.kind], px });
  }
  return out;
}
