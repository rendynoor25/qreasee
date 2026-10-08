/**
 * C-01: the live "Program + Area Summary" for the concept plan. Groups the
 * placed concept rooms by name (the room type) and totals their area. Pure and
 * deterministic, so the table updates on every edit and can be fixture-tested.
 */

import type { Room } from "@qreasee/shared";

export interface AreaSummaryRow {
  /** The room type, i.e. the (possibly renamed) room name. */
  name: string;
  count: number;
  totalM2: number;
}

export interface AreaSummary {
  rows: AreaSummaryRow[];
  totalM2: number;
  roomCount: number;
}

/** Group rooms by name: one row per type with count and total area. */
export function areaSummary(rooms: readonly Room[]): AreaSummary {
  const byName = new Map<string, AreaSummaryRow>();
  for (const room of rooms) {
    const name = (room.name || "Room").trim() || "Room";
    const row = byName.get(name) ?? { name, count: 0, totalM2: 0 };
    row.count += 1;
    row.totalM2 += room.areaMm2 / 1_000_000;
    byName.set(name, row);
  }
  // Largest area first, then alphabetical — stable and predictable.
  const rows = [...byName.values()].sort(
    (a, b) => b.totalM2 - a.totalM2 || a.name.localeCompare(b.name),
  );
  return {
    rows,
    totalM2: rows.reduce((sum, r) => sum + r.totalM2, 0),
    roomCount: rooms.length,
  };
}
