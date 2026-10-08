/** Regulation checks (PRD 9.2). Deterministic, unit-tested. */

import type { DocState, Id, IndicatorStatus } from "@qreasee/shared";
import {
  buildableArea,
  differencePolygons,
  polygonsAreaMm2,
} from "@qreasee/geometry";
import {
  buildingHeightRangeMm,
  coverageAreaMm2,
  floorCount,
  gfaMm2,
  greenAreaMm2,
  siteAreaMm2,
} from "./areas";

/** ok below 90% of max; near 90–100%; over above max (PRD 9.2). */
export function limitStatus(value: number, max: number | undefined): IndicatorStatus {
  if (max === undefined || max <= 0) return "needs-input";
  const r = value / max;
  if (r < 0.9) return "ok";
  if (r <= 1) return "near";
  return "over";
}

export interface RegulationValue<T = number> {
  status: IndicatorStatus;
  value: T;
  limit?: number;
}

export function kdb(state: DocState): RegulationValue {
  const site = siteAreaMm2(state);
  if (site <= 0) return { status: "needs-input", value: 0 };
  const value = (coverageAreaMm2(state) / site) * 100;
  return { status: limitStatus(value, state.rules.kdbMax), value, limit: state.rules.kdbMax };
}

export function klb(state: DocState): RegulationValue {
  const site = siteAreaMm2(state);
  if (site <= 0) return { status: "needs-input", value: 0 };
  const value = gfaMm2(state) / site;
  return { status: limitStatus(value, state.rules.klbMax), value, limit: state.rules.klbMax };
}

export function kdh(state: DocState): RegulationValue & { upperBoundMm2: number } {
  const site = siteAreaMm2(state);
  const coverage = coverageAreaMm2(state);
  const upperBoundMm2 = Math.max(0, site - coverage);
  if (site <= 0) return { status: "needs-input", value: 0, upperBoundMm2 };
  const value = (greenAreaMm2(state) / site) * 100;
  const min = state.rules.kdhMin;
  if (min === undefined || min <= 0) {
    return { status: "needs-input", value, limit: min, upperBoundMm2 };
  }
  // Higher is better: below min is a violation ("over"), within +10% is "near".
  let status: IndicatorStatus;
  if (value < min) status = "over";
  else if (value <= min * 1.1) status = "near";
  else status = "ok";
  return { status, value, limit: min, upperBoundMm2 };
}

export function height(state: DocState): RegulationValue<{ low: number; high: number }> {
  const range = buildingHeightRangeMm(state);
  return {
    status: limitStatus(range.high, state.rules.heightMax),
    value: range,
    limit: state.rules.heightMax,
  };
}

export function floors(state: DocState): RegulationValue {
  const value = floorCount(state);
  return { status: limitStatus(value, state.rules.floorsMax), value, limit: state.rules.floorsMax };
}

export interface SetbackResult {
  status: IndicatorStatus;
  breachAreaMm2: number;
  massIds: Id[];
}

/** Breach = footprint area outside the buildable area, greater than 0.01 m². */
export function setback(state: DocState): SetbackResult {
  if (state.site.boundary.length < 3 || state.masses.length === 0) {
    return { status: "needs-input", breachAreaMm2: 0, massIds: [] };
  }
  const buildable = buildableArea(state.site.boundary, state.rules.setbacks);
  if (buildable.length === 0) {
    return { status: "needs-input", breachAreaMm2: 0, massIds: [] };
  }
  let total = 0;
  const massIds: Id[] = [];
  for (const m of state.masses) {
    const outside = differencePolygons([m.footprint], buildable);
    const area = polygonsAreaMm2(outside);
    if (area > 10_000) {
      // 0.01 m²
      total += area;
      massIds.push(m.id);
    }
  }
  return {
    status: total > 0 ? "over" : "ok",
    breachAreaMm2: total,
    massIds,
  };
}

/**
 * Masses that cross a setback or the height limit, for the quiet red tint while
 * sketching (IN-02). Height breaches are only reported when a limit is set.
 */
export function breachingMassIds(state: DocState): Set<string> {
  const ids = new Set<string>(setback(state).massIds);
  const h = state.rules.heightMax;
  if (h !== undefined && h > 0) {
    const l1 = state.levels.length > 0 ? Math.min(...state.levels.map((l) => l.elevation)) : 0;
    for (const m of state.masses) {
      const base = m.levelIds.length
        ? Math.min(...m.levelIds.map((id) => state.levels.find((l) => l.id === id)?.elevation ?? 0))
        : 0;
      const top = (m.intent?.height?.high ?? m.height) + base - l1;
      if (top > h) ids.add(m.id);
    }
  }
  return ids;
}
