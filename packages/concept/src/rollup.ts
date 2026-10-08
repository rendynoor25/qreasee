/**
 * K-03: program rollup. Net area, circulation allowance, gross area, the KLB
 * allowance check and a cost range — the numbers behind the Brief summary panel
 * and the Area Dashboard. Pure and fixture-tested.
 */

import type { Budget, ProgramItem, ProgramSettings, Rules } from "@qreasee/shared";
import { programItemTotalM2, programSettingsOf } from "@qreasee/shared";

export type ProgramRollupStatus = "ok" | "near" | "over" | "needs-input";

export interface ProgramGroupRollup {
  group: string;
  netM2: number;
  share: number;
  roomCount: number;
}

export interface ProgramRollup {
  netM2: number;
  circulationM2: number;
  grossM2: number;
  circulationPct: number;
  allowedGfaM2: number | null;
  status: ProgramRollupStatus;
  costLow: number | null;
  costHigh: number | null;
  perGroup: ProgramGroupRollup[];
  roomCount: number;
  groupCount: number;
}

/** ok below 90% of the allowance; near 90–100%; over above. Mirrors §9.2. */
export function limitStatus(value: number, max: number | null | undefined): ProgramRollupStatus {
  if (max === undefined || max === null || max <= 0) return "needs-input";
  const r = value / max;
  if (r < 0.9) return "ok";
  if (r <= 1) return "near";
  return "over";
}

export interface RollupInput {
  program: readonly ProgramItem[];
  settings?: ProgramSettings;
  siteAreaM2: number;
  rules: Pick<Rules, "klbMax">;
  budget: Pick<Budget, "ratePerM2">;
}

export function rollupProgram(input: RollupInput): ProgramRollup {
  const settings = input.settings ?? programSettingsOf({ text: "", program: [] });
  const pct = settings.circulationPct ?? 20;

  let netM2 = 0;
  let roomCount = 0;
  const groups = new Map<string, { net: number; rooms: number }>();
  for (const item of input.program) {
    const total = programItemTotalM2(item);
    const qty = item.qty ?? 1;
    netM2 += total;
    roomCount += qty;
    const key = item.group ?? "Ungrouped";
    const g = groups.get(key) ?? { net: 0, rooms: 0 };
    g.net += total;
    g.rooms += qty;
    groups.set(key, g);
  }

  const circulationM2 = (netM2 * pct) / 100;
  const grossM2 = netM2 + circulationM2;

  const klbMax = input.rules.klbMax;
  const allowedGfaM2 = klbMax !== undefined && klbMax > 0 ? klbMax * input.siteAreaM2 : null;
  const status = limitStatus(grossM2, allowedGfaM2);

  const rate = input.budget.ratePerM2;
  const costLow = rate && rate.low > 0 ? grossM2 * rate.low : null;
  const costHigh = rate && rate.high > 0 ? grossM2 * rate.high : null;

  const perGroup: ProgramGroupRollup[] = [...groups.entries()].map(([group, g]) => ({
    group,
    netM2: g.net,
    share: netM2 > 0 ? g.net / netM2 : 0,
    roomCount: g.rooms,
  }));

  return {
    netM2,
    circulationM2,
    grossM2,
    circulationPct: pct,
    allowedGfaM2,
    status,
    costLow,
    costHigh,
    perGroup,
    roomCount,
    groupCount: perGroup.length,
  };
}
