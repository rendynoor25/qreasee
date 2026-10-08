import { describe, expect, it } from "vitest";
import { emptyDocState, type Mass, type Point } from "@qreasee/shared";
import { DEFAULT_SCHEMATIC_OPTIONS, schematicFromDoc, stairGeometry, starterFromMass } from "../index";

const m = 1000;
const rect = (x: number, y: number, w: number, d: number): Point[] => [
  { x: x * m, y: y * m },
  { x: (x + w) * m, y: y * m },
  { x: (x + w) * m, y: (y + d) * m },
  { x: x * m, y: (y + d) * m },
];

const mass: Mass = {
  id: "m1",
  levelIds: ["L1"],
  footprint: { outer: rect(0, 0, 12, 9), holes: [] },
  height: 3500,
  fidelity: "massing",
};

describe("schematic document model (W-01)", () => {
  const program = [
    { name: "Living", targetAreaM2: 50 },
    { name: "Bed", targetAreaM2: 30 },
  ];
  const entities = starterFromMass(mass, program, DEFAULT_SCHEMATIC_OPTIONS, [
    { id: "L1", elevation: 0, floorToFloor: 3500 },
  ]);

  it("emits generated walls, openings, slabs, a roof and rooms", () => {
    expect(entities.walls.length).toBeGreaterThanOrEqual(5); // 4 exterior + partitions
    expect(entities.walls.every((w) => w.origin === "generated")).toBe(true);
    expect(entities.openings.length).toBeGreaterThanOrEqual(5); // windows + doors
    expect(entities.slabs.map((s) => s.id).sort()).toEqual(["slab-ceiling", "slab-floor"]);
    expect(entities.roofs).toHaveLength(1);
    expect(entities.rooms).toHaveLength(2);
    expect(entities.rooms.every((r) => r.fidelity === "schematic")).toBe(true);
  });

  it("rebuilds the derived view model from a document", () => {
    const doc = emptyDocState();
    doc.levels = [{ id: "L1", name: "Lt. 1", elevation: 0, floorToFloor: 3500 }];
    doc.walls = entities.walls;
    doc.openings = entities.openings;
    doc.slabs = entities.slabs;
    doc.roofs = entities.roofs;
    doc.rooms = entities.rooms;

    const sch = schematicFromDoc({ doc, options: DEFAULT_SCHEMATIC_OPTIONS, massId: "m1" });
    expect(sch).not.toBeNull();
    expect(sch!.walls.length).toBeGreaterThanOrEqual(entities.walls.length);
    expect(sch!.openingMarks.length).toBeGreaterThanOrEqual(5);
    expect(sch!.rooms).toHaveLength(2);
    expect(sch!.rooms[0].areaMm2).toBeGreaterThan(0);
    expect(sch!.slabs).toHaveLength(2);
    expect(sch!.roof.type).toBe("hip");
  });

  it("returns null when there are no schematic entities", () => {
    expect(schematicFromDoc({ doc: emptyDocState(), options: DEFAULT_SCHEMATIC_OPTIONS })).toBeNull();
  });
});

describe("stairs (W-02)", () => {
  it("derives the riser count from the floor-to-floor height", () => {
    const g = stairGeometry(
      { id: "s1", levelId: "L1", kind: "straight", from: { x: 0, y: 0 }, to: { x: 4000, y: 0 }, width: 1000, floorToFloor: 3600 },
      0,
    );
    expect(g.risers).toBe(Math.round(3600 / 180));
    expect(g.riserMm).toBeCloseTo(180, 5);
    expect(g.treadMm).toBeGreaterThan(0);
    expect(g.topZ).toBe(3600);
    expect(g.outline).toHaveLength(4);
  });

  it("builds an L stair from two runs", () => {
    const g = stairGeometry(
      { id: "s2", levelId: "L1", kind: "L", from: { x: 0, y: 0 }, mid: { x: 2000, y: 0 }, to: { x: 2000, y: 3000 }, width: 1000, floorToFloor: 3600 },
      0,
    );
    expect(g.runs).toHaveLength(2);
  });
});

describe("multi-level model (W-02)", () => {
  const mass2: Mass = { ...mass, id: "m2", levelIds: ["L1", "L2"] };
  const levels = [
    { id: "L1", elevation: 0, floorToFloor: 3500 },
    { id: "L2", elevation: 3500, floorToFloor: 3500 },
  ];

  it("generates walls, rooms and floors on every level the mass spans", () => {
    const ents = starterFromMass(mass2, [], DEFAULT_SCHEMATIC_OPTIONS, levels);
    const levelsWithWalls = new Set(ents.walls.map((w) => w.levelId));
    expect([...levelsWithWalls].sort()).toEqual(["L1", "L2"]);
    const levelsWithRooms = new Set(ents.rooms.map((r) => r.levelId));
    expect([...levelsWithRooms].sort()).toEqual(["L1", "L2"]);
    // A roof over the top level only.
    expect(ents.roofs).toHaveLength(1);
    expect(ents.roofs[0].levelId).toBe("L2");
  });

  it("filters the view model to one storey for plan drawings", () => {
    const doc = emptyDocState();
    doc.levels = [
      { id: "L1", name: "Lt. 1", elevation: 0, floorToFloor: 3500 },
      { id: "L2", name: "Lt. 2", elevation: 3500, floorToFloor: 3500 },
    ];
    Object.assign(doc, starterFromMass(mass2, [], DEFAULT_SCHEMATIC_OPTIONS, levels));

    const l1 = schematicFromDoc({ doc, options: DEFAULT_SCHEMATIC_OPTIONS, levelId: "L1" })!;
    const l2 = schematicFromDoc({ doc, options: DEFAULT_SCHEMATIC_OPTIONS, levelId: "L2" })!;
    expect(l1.levelId).toBe("L1");
    expect(l2.levelId).toBe("L2");
    expect(l1.walls[0].elementId).not.toBe(l2.walls[0].elementId);
    // Every panel on the L1 plan comes from an L1 wall (and vice versa).
    expect(l1.walls.every((w) => (w.elementId ?? "").includes("L1"))).toBe(true);
    expect(l2.walls.every((w) => (w.elementId ?? "").includes("L2"))).toBe(true);
  });
});
