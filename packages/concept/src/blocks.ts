/**
 * K-04 (minimal): turn program rows into concept-fidelity room blocks. One block
 * per qty instance, area-true rectangle, flowed in a grid beside the site so the
 * architect can then arrange them. Pure and deterministic.
 */

import type { Level, Point, ProgramItem, Room, Zone } from "@qreasee/shared";

const GROUP_ZONE: Record<string, Zone> = {
  Public: "public",
  "Semi-private": "semi-private",
  Private: "private",
  Wet: "service",
  Service: "service",
  Outdoor: "outdoor",
  Circulation: "circulation",
};

function rectMm(cxM: number, cyM: number, wM: number, dM: number): Point[] {
  const m = 1000;
  const x0 = cxM * m;
  const y0 = cyM * m;
  const x1 = (cxM + wM) * m;
  const y1 = (cyM + dM) * m;
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

export interface BlockOptions {
  levels: Pick<Level, "id">[];
  siteWidthM: number;
  siteDepthM: number;
  marginM?: number;
  gapM?: number;
  rowWidthM?: number;
  /** Height of each concept block in mm (a "balok"); default 3000. */
  defaultHeightMm?: number;
}

export function blocksFromProgram(
  program: readonly ProgramItem[],
  opts: BlockOptions,
): Room[] {
  const ground = opts.levels[0]?.id;
  const upper = opts.levels[1]?.id ?? ground;
  if (!ground) return [];

  const margin = opts.marginM ?? 4;
  const gap = opts.gapM ?? 1;
  const rowWidth = opts.rowWidthM ?? 40;
  const startX = opts.siteWidthM + margin;

  let x = startX;
  let y = 0;
  let rowH = 0;
  const rooms: Room[] = [];

  for (const item of program) {
    const qty = Math.max(1, Math.round(item.qty ?? 1));
    const area = item.areaEach ?? item.targetArea;
    if (!(area > 0)) continue;
    const wet = item.needs?.wet ?? false;
    const aspect = wet ? 1.6 : 1.3; // width / depth
    const w = Math.sqrt(area * aspect);
    const d = area / w;
    const levelId = item.levelPref === "upper" ? upper : ground;

    for (let i = 0; i < qty; i++) {
      if (x + w > startX + rowWidth) {
        x = startX;
        y += rowH + gap;
        rowH = 0;
      }
      rooms.push({
        id: `block-${item.id}-${i}`,
        levelId,
        name: item.name,
        programItemId: item.id,
        instanceIndex: i,
        fidelity: "concept",
        polygon: { outer: rectMm(x, y, w, d), holes: [] },
        areaMm2: area * 1_000_000,
        height: opts.defaultHeightMm ?? 3000,
        color: item.color,
        group: item.group,
        zone: item.group ? GROUP_ZONE[item.group] : undefined,
      });
      x += w + gap;
      rowH = Math.max(rowH, d);
    }
  }

  return rooms;
}
