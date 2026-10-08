/**
 * Area measures (PRD 9.1). Pure functions over a branch state; no UI imports.
 *
 * Site area = area of the site polygon.
 * Coverage area = area of the 2D union of all mass footprints.
 * GFA = sum over levels of the union of footprints present on that level.
 * Green area = sum of site polygons tagged green.
 */

import type { DocState, Id, Mass } from "@qreasee/shared";
import { polygonAreaMm2, ringArea, unionAreaMm2 } from "@qreasee/geometry";

export function siteAreaMm2(state: DocState): number {
  return state.site.boundary.length >= 3 ? ringArea(state.site.boundary) : 0;
}

export function coverageAreaMm2(state: DocState): number {
  return unionAreaMm2(state.masses.map((m) => m.footprint));
}

export function gfaMm2(state: DocState): number {
  return gfaRangeMm2(state).low;
}

/**
 * GFA as a range. Intent masses contribute their low/high area (PRD 9.3,
 * "Intent masses: compute with the low and the high ends of their ranges").
 */
export function gfaRangeMm2(state: DocState): { low: number; high: number } {
  let low = 0;
  let high = 0;
  for (const level of state.levels) {
    const onLevel = state.masses.filter((m) => m.levelIds.includes(level.id));
    for (const m of onLevel) {
      const nominal = polygonAreaMm2(m.footprint);
      const intentLow = m.intent?.area?.low;
      const intentHigh = m.intent?.area?.high;
      const lo = intentLow !== undefined ? intentLow * 1_000_000 : nominal;
      const hi = intentHigh !== undefined ? intentHigh * 1_000_000 : nominal;
      low += Math.min(lo, hi);
      high += Math.max(lo, hi);
    }
  }
  return { low, high };
}

export function greenAreaMm2(state: DocState): number {
  return state.site.greenPolygons.reduce((s, g) => s + ringArea(g.points), 0);
}

export function levelElevation(state: DocState, levelId: Id): number {
  return state.levels.find((l) => l.id === levelId)?.elevation ?? 0;
}

export function massBaseElevation(state: DocState, mass: Mass): number {
  if (mass.levelIds.length === 0) return 0;
  return Math.min(...mass.levelIds.map((id) => levelElevation(state, id)));
}

export function massTopElevation(state: DocState, mass: Mass): number {
  const base = massBaseElevation(state, mass);
  const top = mass.intent?.height?.high ?? mass.height;
  return base + top;
}

/** Height indicator input: highest mass top minus level 1 elevation (PRD 9.2). */
export function buildingHeightRangeMm(state: DocState): { low: number; high: number } {
  if (state.masses.length === 0 || state.levels.length === 0) return { low: 0, high: 0 };
  const l1 = Math.min(...state.levels.map((l) => l.elevation));
  let low = 0;
  let high = 0;
  for (const m of state.masses) {
    const base = massBaseElevation(state, m);
    const hLow = m.intent?.height?.low ?? m.height;
    const hHigh = m.intent?.height?.high ?? m.height;
    low = Math.max(low, base + hLow - l1);
    high = Math.max(high, base + hHigh - l1);
  }
  return { low, high };
}

/** Number of levels that contain at least one mass (PRD 9.2, Floors). */
export function floorCount(state: DocState): number {
  return state.levels.filter((l) => state.masses.some((m) => m.levelIds.includes(l.id))).length;
}
