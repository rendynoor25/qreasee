/**
 * W-02 stairs: derive step geometry from a `Stair` entity. The riser target is a
 * **starter value** (180 mm), not a code requirement; the actual rise/run is
 * computed from the floor-to-floor height and shown as a derived value.
 */

import type { Point, Stair as DocStair } from "@qreasee/shared";
import type { StairGeom, StairRun } from "./types";

/** Starter target riser height in mm (not a regulation). */
export const TARGET_RISER_MM = 180;

/** Part 4 §5.2: the tread (going) depth used to space the riser lines in plan. */
export const STAIR_GOING_MM = 300;

export function stairGeometry(stair: DocStair, baseZ: number): StairGeom {
  const runs: StairRun[] =
    stair.kind === "L" && stair.mid
      ? [
          { a: stair.from, b: stair.mid, width: stair.width },
          { a: stair.mid, b: stair.to, width: stair.width },
        ]
      : [{ a: stair.from, b: stair.to, width: stair.width }];

  const risers = Math.max(2, Math.min(30, Math.round(stair.floorToFloor / TARGET_RISER_MM)));
  const riserMm = stair.floorToFloor / risers;

  return {
    id: stair.id,
    levelId: stair.levelId,
    kind: stair.kind,
    runs,
    outline: stairOutline(runs),
    baseZ,
    topZ: baseZ + stair.floorToFloor,
    risers,
    riserMm,
    // Part 4 §5.2: the plan spacing is the going (tread depth), not the rise.
    treadMm: STAIR_GOING_MM,
  };
}

/** Axis-aligned bounding rectangle of the stair runs (used for the floor void). */
function stairOutline(runs: StairRun[]): Point[] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of runs) {
    const w = r.width / 2;
    for (const p of [r.a, r.b]) {
      minX = Math.min(minX, p.x - w);
      maxX = Math.max(maxX, p.x + w);
      minY = Math.min(minY, p.y - w);
      maxY = Math.max(maxY, p.y + w);
    }
  }
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

/** Tread divider lines (plan) — a line across the flight at each step. */
export function stairTreads(g: StairGeom): Array<[Point, Point]> {
  const lines: Array<[Point, Point]> = [];
  for (const r of g.runs) {
    const dx = r.b.x - r.a.x;
    const dy = r.b.y - r.a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const n = Math.max(1, Math.round(len / Math.max(1, g.treadMm)));
    for (let i = 1; i < n; i++) {
      const t = (len * i) / n;
      const cx = r.a.x + ux * t;
      const cy = r.a.y + uy * t;
      lines.push([
        { x: cx - (nx * r.width) / 2, y: cy - (ny * r.width) / 2 },
        { x: cx + (nx * r.width) / 2, y: cy + (ny * r.width) / 2 },
      ]);
    }
  }
  return lines;
}
