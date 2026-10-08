/** Program fit and cost range (PRD 9.3). */

import type { DocState, Id, IndicatorStatus } from "@qreasee/shared";
import { polygonAreaMm2 } from "@qreasee/geometry";
import { programItemTotalM2 } from "@qreasee/shared";
import { gfaRangeMm2 } from "./areas";

export interface ProgramFit {
  id: Id;
  name: string;
  targetAreaMm2: number;
  actualAreaMm2: number;
  status: IndicatorStatus;
  deltaPercent: number;
}

function programStatus(actual: number, target: number): IndicatorStatus {
  if (target <= 0) return "needs-input";
  const ratio = actual / target;
  const delta = Math.abs(ratio - 1);
  if (delta <= 0.1) return "ok";
  if (delta <= 0.2) return "near";
  return ratio > 1 ? "over" : "under";
}

/** Sum footprint area of masses labelled with each program use, per level. */
export function programFit(state: DocState): ProgramFit[] {
  return state.brief.program.map((item) => {
    const actual = state.masses
      .filter((m) => m.use === item.name)
      .reduce(
        (sum, m) => sum + polygonAreaMm2(m.footprint) * Math.max(1, m.levelIds.length),
        0,
      );
    const target = programItemTotalM2(item) * 1_000_000;
    return {
      id: item.id,
      name: item.name,
      targetAreaMm2: target,
      actualAreaMm2: actual,
      status: programStatus(actual, target),
      deltaPercent: target > 0 ? ((actual - target) / target) * 100 : 0,
    };
  });
}

export interface CostRange {
  low: number;
  high: number;
}

export function costRange(state: DocState): CostRange | null {
  const rate = state.budget.ratePerM2;
  if (!rate || rate.low <= 0 || rate.high <= 0) return null;
  const gfa = gfaRangeMm2(state);
  const low = (gfa.low / 1_000_000) * rate.low;
  const high = (gfa.high / 1_000_000) * rate.high;
  return { low: Math.min(low, high), high: Math.max(low, high) };
}

export function budgetCeiling(state: DocState): number | undefined {
  return state.budget.ceiling ?? state.budget.high;
}

export function costStatus(
  range: CostRange | null,
  state: DocState,
): IndicatorStatus {
  if (!range) return "needs-input";
  const ceiling = budgetCeiling(state);
  if (ceiling === undefined || ceiling <= 0) return "ok"; // range shown, nothing to compare
  if (range.high <= ceiling) return "ok";
  if (range.low > ceiling) return "over";
  return "near"; // ceiling falls inside the range
}
