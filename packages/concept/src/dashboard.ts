/**
 * K-03: the Area Dashboard. Compares each program row's target area with the
 * actual area of its concept blocks, with a text status (never colour alone).
 * Pure and fixture-tested; the UI renders these rows and updates on every edit.
 */

import { programItemTotalM2, type ProgramItem, type Room } from "@qreasee/shared";

export type AreaStatus = "ok" | "near" | "over" | "under" | "needs-input";

/** ok within ±10 %, near within ±20 %, otherwise over/under (PRD 9.3). */
export function areaStatus(actualM2: number, targetM2: number): AreaStatus {
  if (!(targetM2 > 0)) return "needs-input";
  const delta = Math.abs(actualM2 - targetM2) / targetM2;
  if (delta <= 0.1 + 1e-9) return "ok";
  if (delta <= 0.2 + 1e-9) return "near";
  return actualM2 > targetM2 ? "over" : "under";
}

export interface AreaDashboardRow {
  programItemId: string;
  name: string;
  group?: string;
  targetM2: number;
  actualM2: number;
  status: AreaStatus;
}

export function areaDashboard(
  program: readonly ProgramItem[],
  rooms: readonly Room[],
): AreaDashboardRow[] {
  return program.map((item) => {
    const targetM2 = programItemTotalM2(item);
    const actualM2 = rooms
      .filter((r) => r.programItemId === item.id)
      .reduce((sum, r) => sum + r.areaMm2 / 1_000_000, 0);
    return {
      programItemId: item.id,
      name: item.name,
      group: item.group,
      targetM2,
      actualM2,
      status: areaStatus(actualM2, targetM2),
    };
  });
}
