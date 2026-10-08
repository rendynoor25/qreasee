import { describe, expect, it } from "vitest";
import { areaSummary } from "@qreasee/concept";
import { buildSampleHouse } from "../sampleHouse";

describe("sample house (S-01, reproduced from the IFC)", () => {
  const { docState, project, mass } = buildSampleHouse();

  it("carries the three real storeys from the IFC", () => {
    expect(docState.levels.map((l) => l.name)).toEqual(["Lantai 1", "Lantai 2", "Ring Balok"]);
    expect(docState.levels.map((l) => l.elevation)).toEqual([0, 3600, 7000]);
  });

  it("has 18 named rooms with a positive area each", () => {
    expect(docState.rooms).toHaveLength(18);
    expect(docState.rooms.every((r) => r.name.trim().length > 0 && r.areaMm2 > 0)).toBe(true);
    expect(docState.rooms.map((r) => r.name)).toContain("R. Keluarga");
    expect(docState.rooms.map((r) => r.name)).toContain("Dapur");
  });

  it("imports walls, doors/windows, slabs, stairs and roofs", () => {
    expect(docState.walls.length).toBeGreaterThanOrEqual(38);
    expect(docState.openings.length).toBeGreaterThanOrEqual(10);
    expect(docState.slabs.length).toBeGreaterThanOrEqual(10);
    expect(docState.stairs.length).toBeGreaterThanOrEqual(1);
    expect(docState.roofs.length).toBeGreaterThanOrEqual(1);
    // Every opening is bound to a real wall.
    for (const o of docState.openings) {
      expect(docState.walls.some((w) => w.id === o.wallId)).toBe(true);
    }
  });

  it("groups the rooms for the Program + Area Summary", () => {
    const s = areaSummary(docState.rooms);
    expect(s.roomCount).toBe(18);
    expect(s.rows.find((r) => r.name === "KM/WC")?.count).toBe(4);
    expect(s.totalM2).toBeGreaterThan(80);
  });

  it("names the project and provides one mass", () => {
    expect(project.name).toMatch(/sample/i);
    expect(mass.footprint.outer.length).toBeGreaterThanOrEqual(4);
  });

  it("carries a material scheme on its entities", () => {
    expect(docState.walls.every((w) => !!w.material)).toBe(true);
    expect(docState.slabs.every((s) => !!s.material)).toBe(true);
    expect(docState.roofs.every((r) => !!r.material)).toBe(true);
    expect(docState.walls.find((w) => w.kind === "exterior")?.material).toBe("qr-brick-brown");
  });

  it("ships a sheet set: a cover with a snapshot, a concept sheet and the drawings", () => {
    expect(docState.sheets).toHaveLength(7);
    const cover = docState.sheets.find((s) => s.number === "A000")!;
    const coverImg = cover.items.find((i) => i.kind === "image");
    expect(coverImg).toBeDefined();
    // The snapshot is the real model axonometric, not a box (many faces).
    expect((coverImg as { src: string }).src).toContain("data:image/svg+xml");
    expect(((coverImg as { src: string }).src.match(/%3Cpolygon/g) || []).length).toBeGreaterThan(20);
    expect(cover.items.some((i) => i.kind === "text")).toBe(true);
    const concept = docState.sheets.find((s) => s.number === "A100")!;
    expect(concept.items.filter((i) => i.kind === "image")).toHaveLength(2);
    const a101 = docState.sheets.find((s) => s.number === "A101")!;
    expect(a101.items.some((i) => i.kind === "view" && i.viewId === "sys:plan:ifc-L1")).toBe(true);
    const a104 = docState.sheets.find((s) => s.number === "A104")!;
    expect(a104.items.filter((i) => i.kind === "view")).toHaveLength(2);
  });

  it("imports railings", () => {
    expect(docState.railings.length).toBeGreaterThanOrEqual(1);
  });
});
