/** Derive rooms from a mass footprint by guillotine partition + clipping. */

import { type Point, type Polygon } from "@qreasee/shared";
import { bounds, intersectPolygons, pointInPolygon, polygonAreaMm2 } from "@qreasee/geometry";
import type { DerivedRooms, Partition, Room } from "./types";

export interface RoomPlan {
  name: string;
  targetAreaM2?: number;
}

interface Cell {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const DEFAULT_ROOM_AREA_MM2 = 16_000_000; // ~16 m²

export function deriveRooms(
  footprint: Polygon,
  program: RoomPlan[],
  _exteriorThickness: number,
): DerivedRooms {
  const b = bounds(footprint.outer);
  const totalArea = polygonAreaMm2(footprint);
  const targets = program.map((p) => p.targetAreaM2 ?? 0).filter((a) => a > 0);
  const count =
    targets.length > 0
      ? targets.length
      : Math.max(1, Math.min(12, Math.round(totalArea / DEFAULT_ROOM_AREA_MM2)));

  // Guillotine: repeatedly split the largest cell along its longer side.
  let cells: Cell[] = [{ x0: b.min.x, y0: b.min.y, x1: b.max.x, y1: b.max.y }];
  const splits: { a: Point; b: Point }[] = [];
  while (cells.length < count) {
    cells.sort(
      (c, d) => (d.x1 - d.x0) * (d.y1 - d.y0) - (c.x1 - c.x0) * (c.y1 - c.y0),
    );
    const cell = cells.shift();
    if (!cell) break;
    const w = cell.x1 - cell.x0;
    const h = cell.y1 - cell.y0;
    if (w >= h) {
      const mid = (cell.x0 + cell.x1) / 2;
      cells.push({ ...cell, x1: mid }, { ...cell, x0: mid });
      splits.push({ a: { x: mid, y: cell.y0 }, b: { x: mid, y: cell.y1 } });
    } else {
      const mid = (cell.y0 + cell.y1) / 2;
      cells.push({ ...cell, y1: mid }, { ...cell, y0: mid });
      splits.push({ a: { x: cell.x0, y: mid }, b: { x: cell.x1, y: mid } });
    }
  }

  // Clip each cell to the footprint.
  const rooms: Room[] = [];
  for (const cell of cells) {
    const rect: Polygon = {
      outer: [
        { x: cell.x0, y: cell.y0 },
        { x: cell.x1, y: cell.y0 },
        { x: cell.x1, y: cell.y1 },
        { x: cell.x0, y: cell.y1 },
      ],
      holes: [],
    };
    const clipped = intersectPolygons([rect], [footprint]);
    if (clipped.length === 0) continue;
    const best = clipped.reduce((a, c) => (polygonAreaMm2(c) > polygonAreaMm2(a) ? c : a));
    const area = polygonAreaMm2(best);
    if (area < 2_000_000) continue; // ignore slivers under 2 m²
    rooms.push({ id: `room-${rooms.length}`, name: "", polygon: best.outer, areaMm2: area });
  }

  // Name rooms: largest room gets the largest program target.
  const byArea = [...rooms].sort((a, c) => c.areaMm2 - a.areaMm2);
  const byTarget = [...program].sort(
    (a, c) => (c.targetAreaM2 ?? 0) - (a.targetAreaM2 ?? 0),
  );
  byArea.forEach((room, i) => {
    room.name = byTarget[i]?.name ?? `Room ${i + 1}`;
  });

  // Partitions: split segments clipped to the footprint.
  const partitions: Partition[] = [];
  for (const s of splits) {
    for (const seg of clipSegmentToPolygon(s.a, s.b, footprint)) {
      partitions.push({ id: `part-${partitions.length}`, a: seg[0], b: seg[1] });
    }
  }

  return { rooms, partitions, interior: footprint.outer };
}

/** Keep the runs of a segment whose midpoint is inside the polygon. */
export function clipSegmentToPolygon(
  a: Point,
  b: Point,
  poly: Polygon,
  step = 200,
): Array<[Point, Point]> {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < step) return [];
  const n = Math.ceil(len / step);
  const inside: boolean[] = [];
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    pts.push(p);
    inside.push(pointInPolygon(p, poly));
  }
  const runs: Array<[Point, Point]> = [];
  let start = -1;
  for (let i = 0; i <= n; i++) {
    if (inside[i] && start < 0) start = i;
    if ((!inside[i] || i === n) && start >= 0) {
      const end = !inside[i] ? i - 1 : i;
      if (end > start) runs.push([pts[start], pts[end]]);
      start = -1;
    }
  }
  return runs;
}
