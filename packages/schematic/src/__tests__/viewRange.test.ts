import { describe, expect, it } from "vitest";
import { emptyDocState } from "@qreasee/shared";
import { DEFAULT_SCHEMATIC_OPTIONS, cutStateFor, makeViewRange } from "../types";
import { schematicFromDoc } from "../elements";
import { planSvg } from "../drawings";

describe("VW-01/02 view range + plan cut plane", () => {
  it("classifies openings against the cut plane", () => {
    expect(cutStateFor(900, 1500, 1200)).toBe("cut"); // crosses 1200
    expect(cutStateFor(2000, 1200, 1200)).toBe("above"); // sill above the cut
    expect(cutStateFor(0, 900, 1200)).toBe("below"); // head below the cut
  });

  it("defaults the cut plane to one metre above the level", () => {
    expect(makeViewRange().cutPlane).toBe(1200);
    expect(makeViewRange({ cutPlane: 1500 }).cutPlane).toBe(1500);
    expect(makeViewRange({ cutPlane: 1500 }).top).toBe(2000);
  });

  it("marks a high window as seen (above) and a low one as below", () => {
    const doc = emptyDocState();
    doc.levels = [{ id: "L1", name: "Lantai 1", elevation: 0, floorToFloor: 3600 }];
    doc.walls = [
      { id: "w1", levelId: "L1", a: { x: 0, y: 0 }, b: { x: 9000, y: 0 }, thickness: 150, height: 3600, kind: "exterior" },
    ];
    doc.openings = [
      { id: "o1", wallId: "w1", kind: "window", offset: 1500, width: 1200, sill: 900, height: 1500 },
      { id: "o2", wallId: "w1", kind: "window", offset: 3500, width: 1200, sill: 2400, height: 900 },
      { id: "o3", wallId: "w1", kind: "window", offset: 5500, width: 1200, sill: 200, height: 600 },
    ];
    doc.roofs = [
      {
        id: "r1",
        levelId: "L1",
        type: "hip",
        pitchDeg: 30,
        overhang: 600,
        polygon: { outer: [{ x: 0, y: 0 }, { x: 9000, y: 0 }, { x: 9000, y: 3000 }, { x: 0, y: 3000 }], holes: [] },
        baseZ: 3600,
      },
    ];
    const s = schematicFromDoc({ doc, options: DEFAULT_SCHEMATIC_OPTIONS, levelId: "L1" })!;
    const byId = Object.fromEntries(s.openingMarks.map((m) => [m.id, m.cutState]));
    expect(byId.o1).toBe("cut");
    expect(byId.o2).toBe("above");
    expect(byId.o3).toBe("below");
    expect(s.viewRange?.cutPlane).toBe(1200);
  });

  it("shows imported (concept) rooms as named rooms on the plan", () => {
    const doc = emptyDocState();
    doc.levels = [{ id: "L1", name: "Lantai 1", elevation: 0, floorToFloor: 3600 }];
    doc.walls = [
      { id: "w1", levelId: "L1", a: { x: 0, y: 0 }, b: { x: 6000, y: 0 }, thickness: 150, height: 3600, kind: "exterior" },
    ];
    doc.slabs = [
      {
        id: "sl1",
        levelId: "L1",
        kind: "floor",
        polygon: { outer: [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 }], holes: [] },
        z: 0,
        thickness: 120,
      },
    ];
    doc.roofs = [
      {
        id: "r1",
        levelId: "L1",
        type: "hip",
        pitchDeg: 30,
        overhang: 600,
        polygon: { outer: [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 }], holes: [] },
        baseZ: 3600,
      },
    ];
    doc.rooms = [
      {
        id: "rm1",
        levelId: "L1",
        name: "R. Keluarga",
        fidelity: "concept",
        polygon: { outer: [{ x: 200, y: 200 }, { x: 5800, y: 200 }, { x: 5800, y: 3800 }, { x: 200, y: 3800 }], holes: [] },
        areaMm2: 20_000_000,
      },
    ];
    const s = schematicFromDoc({ doc, options: DEFAULT_SCHEMATIC_OPTIONS, levelId: "L1" })!;
    expect(s.rooms.map((r) => r.name)).toContain("R. Keluarga");
    const svg = planSvg(s, undefined, { grids: [], annotations: { north: false, scaleBar: false } });
    expect(svg).toContain("R. Keluarga");
  });
});
