/**
 * v4.2 §4.3: system views are derived from levels and the four directions. They
 * are never stored; only their per-view customisations live in
 * `DocState.viewOverrides`. Custom views and saved scenes live in `DocState.views`.
 */

import type { Level, View, ViewDirection } from "./types";

const ELEVATIONS: ViewDirection[] = ["N", "E", "S", "W"];
const ELEVATION_NAME: Record<ViewDirection, string> = {
  N: "North",
  E: "East",
  S: "South",
  W: "West",
};

export interface SystemViewInput {
  levels: Pick<Level, "id" | "name">[];
  hasSite: boolean;
  hasSection: boolean;
}

export function systemViews(input: SystemViewInput): View[] {
  const views: View[] = [];
  if (input.hasSite) {
    views.push({ id: "sys:plan:site", kind: "plan", name: "Site Plan", system: true, createdAt: 0 });
  }
  for (const [i, level] of input.levels.entries()) {
    views.push({
      id: `sys:plan:${level.id}`,
      kind: "plan",
      name: `Plan · ${level.name}`,
      system: true,
      levelId: level.id,
      // Part 4: the topmost plan is the roof plan — look down with no cut so the
      // whole roof shows; every other plan cuts 1.2 m above its level.
      cutPlane: i === input.levels.length - 1 && input.levels.length > 1 ? null : 1200,
      createdAt: 0,
    });
  }
  for (const direction of ELEVATIONS) {
    views.push({
      id: `sys:elev:${direction}`,
      kind: "elevation",
      name: `${ELEVATION_NAME[direction]} elevation`,
      system: true,
      direction,
      createdAt: 0,
    });
  }
  views.push({ id: "sys:3d:default", kind: "3d", name: "3D · Default", system: true, createdAt: 0 });
  if (input.hasSection) {
    views.push({ id: "sys:section:A", kind: "section", name: "Section A–A", system: true, createdAt: 0 });
  }
  return views;
}

/** Apply per-view overrides onto the derived system views. */
export function mergeViewOverrides(
  system: readonly View[],
  overrides: Record<string, Partial<View>>,
): View[] {
  return system.map((v) => (overrides[v.id] ? { ...v, ...overrides[v.id] } : v));
}

/** System views plus custom views, in display order. */
export function allViews(state: {
  levels: Pick<Level, "id" | "name">[];
  siteBoundaryLength: number;
  hasSection: boolean;
  views: View[];
  viewOverrides: Record<string, Partial<View>>;
}): View[] {
  const system = mergeViewOverrides(
    systemViews({
      levels: state.levels,
      hasSite: state.siteBoundaryLength >= 3,
      hasSection: state.hasSection,
    }),
    state.viewOverrides,
  );
  return [...system, ...state.views];
}

export function findView(views: readonly View[], id: string | null): View | undefined {
  if (!id) return undefined;
  return views.find((v) => v.id === id);
}

export const DEFAULT_VIEW_ID = "sys:3d:default";
