import { describe, expect, it } from "vitest";
import {
  allViews,
  DEFAULT_VIEW_ID,
  emptyDocState,
  findView,
  mergeViewOverrides,
  normalizeDocState,
  systemViews,
} from "../index";

const levels = [
  { id: "L1", name: "Lt. 1" },
  { id: "L2", name: "Lt. 2" },
];

describe("system views (V-01)", () => {
  it("derives a site plan and one plan per level", () => {
    const v = systemViews({ levels, hasSite: true, hasSection: false });
    expect(v.filter((x) => x.kind === "plan").map((x) => x.name)).toEqual([
      "Site Plan",
      "Plan · Lt. 1",
      "Plan · Lt. 2",
    ]);
  });

  it("derives four elevations and a default 3D view", () => {
    const v = systemViews({ levels, hasSite: false, hasSection: false });
    expect(v.filter((x) => x.kind === "elevation").map((x) => x.direction)).toEqual(["N", "E", "S", "W"]);
    expect(v.some((x) => x.id === DEFAULT_VIEW_ID)).toBe(true);
  });

  it("adds a section view only when a section line exists", () => {
    expect(systemViews({ levels, hasSite: false, hasSection: false }).some((x) => x.kind === "section")).toBe(false);
    expect(systemViews({ levels, hasSite: false, hasSection: true }).some((x) => x.kind === "section")).toBe(true);
  });

  it("marks every system view as system", () => {
    expect(systemViews({ levels, hasSite: true, hasSection: true }).every((v) => v.system)).toBe(true);
  });

  it("applies overrides onto system views", () => {
    const merged = mergeViewOverrides(systemViews({ levels, hasSite: false, hasSection: false }), {
      [DEFAULT_VIEW_ID]: { name: "Studio 3D", layers: { grid: false } },
    });
    const v = merged.find((x) => x.id === DEFAULT_VIEW_ID)!;
    expect(v.name).toBe("Studio 3D");
    expect(v.layers?.grid).toBe(false);
  });

  it("ignores overrides for unknown view ids", () => {
    const merged = mergeViewOverrides(systemViews({ levels, hasSite: false, hasSection: false }), {
      "sys:nope": { name: "x" },
    });
    expect(merged.every((v) => v.name !== "x")).toBe(true);
  });

  it("appends custom views after system views", () => {
    const custom = { id: "v1", kind: "3d" as const, name: "Aerial", createdAt: 0 };
    const all = allViews({ levels, siteBoundaryLength: 0, hasSection: false, views: [custom], viewOverrides: {} });
    expect(all[all.length - 1].id).toBe("v1");
    expect(all.length).toBe(systemViews({ levels, hasSite: false, hasSection: false }).length + 1);
  });

  it("findView returns undefined for null or unknown ids", () => {
    expect(findView([], null)).toBeUndefined();
    expect(findView([], "nope")).toBeUndefined();
  });

  it("normalizeDocState fills views, rooms and program settings on old data", () => {
    const old = emptyDocState() as unknown as Record<string, unknown>;
    delete old.views;
    delete old.viewOverrides;
    delete old.rooms;
    delete (old.brief as Record<string, unknown>).settings;
    const n = normalizeDocState(old as never);
    expect(n.views).toEqual([]);
    expect(n.viewOverrides).toEqual({});
    expect(n.rooms).toEqual([]);
    expect(n.brief.settings?.circulationPct).toBe(20);
  });
});
