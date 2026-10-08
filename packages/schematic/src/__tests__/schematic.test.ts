import { describe, expect, it } from "vitest";
import type { GridLine, Level, Mass, Point } from "@qreasee/shared";
import {
  DEFAULT_SCHEMATIC_OPTIONS,
  buildRoof,
  defaultSectionLine,
  deriveRooms,
  elevationSvg,
  generateSchematic,
  planSvg,
  sectionAtLine,
  sectionSvg,
} from "../index";

const m = 1000;
const rect = (x: number, y: number, w: number, h: number): Point[] => [
  { x: x * m, y: y * m },
  { x: (x + w) * m, y: y * m },
  { x: (x + w) * m, y: (y + h) * m },
  { x: x * m, y: (y + h) * m },
];

const mass: Mass = {
  id: "m1",
  levelIds: ["L1"],
  footprint: { outer: rect(0, 0, 12, 9), holes: [] },
  height: 3500,
  fidelity: "massing",
};

describe("deriveRooms", () => {
  it("partitions a 12x9 m mass into four rooms", () => {
    const derived = deriveRooms(mass.footprint, [
      { name: "Living", targetAreaM2: 40 },
      { name: "Bed 1", targetAreaM2: 30 },
      { name: "Bed 2", targetAreaM2: 20 },
      { name: "Bath", targetAreaM2: 10 },
    ], 150);
    expect(derived.rooms.length).toBe(4);
    const total = derived.rooms.reduce((s, r) => s + r.areaMm2, 0);
    // Rooms cover the footprint (108 m²) within clipping tolerance.
    expect(total / 1e6).toBeGreaterThan(90);
    expect(derived.partitions.length).toBeGreaterThan(0);
    expect(derived.rooms.some((r) => r.name === "Living")).toBe(true);
  });
});

describe("buildRoof", () => {
  const outer = rect(0, 0, 12, 9);
  it("builds a hip roof above the eave", () => {
    const roof = buildRoof(outer, "hip", 30, 600, 4000);
    expect(roof.faces.length).toBe(4);
    expect(roof.ridgeZ).toBeGreaterThan(roof.eaveZ);
    // Outline includes the 600 mm overhang on every side.
    expect(Math.min(...roof.outline.map((p) => p.x))).toBe(-600);
    expect(Math.max(...roof.outline.map((p) => p.x))).toBe(12 * m + 600);
  });
  it("builds gable and shed roofs", () => {
    expect(buildRoof(outer, "gable", 40, 500, 4000).faces.length).toBe(4);
    expect(buildRoof(outer, "shed", 20, 500, 4000).faces.length).toBe(1);
  });
});

describe("generateSchematic", () => {
  const s = generateSchematic(
    mass,
    [{ name: "Living", targetAreaM2: 50 }, { name: "Bed", targetAreaM2: 30 }],
    DEFAULT_SCHEMATIC_OPTIONS,
    0,
    3500,
  );
  it("produces walls, slabs and openings", () => {
    expect(s.rooms.length).toBe(2);
    expect(s.walls.length).toBeGreaterThan(8);
    expect(s.slabs.map((x) => x.kind).sort()).toEqual(["ceiling", "floor"]);
    expect(s.openingMarks.filter((o) => o.kind === "window").length).toBeGreaterThanOrEqual(4);
    expect(s.openingMarks.filter((o) => o.kind === "door").length).toBeGreaterThanOrEqual(1);
  });
  it("draws a framed plan with rooms (title lives on the sheet)", () => {
    const svg = planSvg(s);
    expect(svg).toContain("<svg");
    expect(svg).toContain(s.rooms[0].name);
    expect(svg).toMatch(/viewBox="[-\d. ]+"/);
  });
  it("draws section and elevation geometry", () => {
    // VW-04: the view name/scale moved to the per-viewport title on the sheet.
    expect(sectionSvg(s)).toContain("<line");
    expect(elevationSvg(s)).toContain("<line");
  });
  it("cuts a real section along a line", () => {
    const cut = sectionAtLine(s, defaultSectionLine(s));
    expect(cut.slabs.length).toBe(2);
    expect(cut.walls.length).toBeGreaterThan(0);
    expect(cut.roofSegments.length).toBeGreaterThan(0);
    expect(cut.ridgeZ).toBeGreaterThan(cut.eaveZ);
  });
  it("assigns materials to elements and honours overrides", () => {
    const custom = generateSchematic(mass, [], { ...DEFAULT_SCHEMATIC_OPTIONS, materials: { "slab-floor": "floor-granite" } }, 0, 3500);
    expect(custom.slabs.find((x) => x.id === "slab-floor")?.material).toBe("floor-granite");
    expect(custom.walls[0].material).toBeTruthy();
  });
});

describe("drawing annotations (grids, dimensions, levels)", () => {
  const s = generateSchematic(
    mass,
    [{ name: "Living", targetAreaM2: 50 }],
    DEFAULT_SCHEMATIC_OPTIONS,
    0,
    3500,
  );
  const grids: GridLine[] = [
    { id: "gx1", axis: "x", label: "1", offset: 0 },
    { id: "gx2", axis: "x", label: "2", offset: 6000 },
    { id: "gx3", axis: "x", label: "3", offset: 12000 },
    { id: "gy1", axis: "y", label: "A", offset: 0 },
    { id: "gy2", axis: "y", label: "B", offset: 9000 },
  ];
  const levels: Level[] = [
    { id: "L1", name: "Lt. 1", elevation: 0, floorToFloor: 3500 },
    { id: "L2", name: "Lt. 2", elevation: 3600, floorToFloor: 3400 },
  ];

  it("plan draws grid bubbles, labels and the three dimension chains", () => {
    const svg = planSvg(s, undefined, { grids, levels });
    expect(svg).toContain("<circle"); // bubbles
    expect(svg).toMatch(/>1</); // grid label
    expect(svg).toContain("6000"); // 0→6000 bay
    expect(svg).toContain("9000"); // A→B bay
    // Part 2 §3: the overall chain runs alongside the grid chain, on both sides.
    expect(svg).toContain("12000"); // overall 0→12000
    expect((svg.match(/>6000</g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("section and elevation draw level markers", () => {
    expect(sectionSvg(s, undefined, { grids, levels })).toContain("+3.60");
    expect(elevationSvg(s, { grids, levels })).toContain("+3.60");
  });

  it("falls back to overall dimensions when there are no grids", () => {
    const svg = planSvg(s);
    expect(svg).not.toContain("<circle");
    expect(svg).toContain("12.00 m");
  });
});

describe("plan graphics (W-04)", () => {
  const s = generateSchematic(
    mass,
    [{ name: "Living", targetAreaM2: 50 }, { name: "Bed", targetAreaM2: 30 }],
    DEFAULT_SCHEMATIC_OPTIONS,
    0,
    3500,
  );
  const pen = { cut: 1, projection: 0.5, annotation: 0.3, grid: 0.2 };

  it("scales pen weights by the view scale", () => {
    const svg = planSvg(s, undefined, { pen, scale: 100 });
    // Dimension/annotation lines use the annotation pen: 0.3 mm × 100.
    expect(svg).toContain('stroke-width="30.0"');
  });

  it("joins walls into one outline (outset band + poché fill)", () => {
    const svg = planSvg(s, undefined, { pen, scale: 100 });
    // Part 3 §1: the union outline is a filled outset band under the poché fill.
    expect(svg).toContain('fill="#111"');
    expect(svg).toContain('fill="#ecebe7"');
  });

  it("draws room tags as text only (no fixture boxes)", () => {
    const wc = { id: "wc1", name: "KM/WC", polygon: rect(1, 1, 2, 2), areaMm2: 4_000_000, material: "floor-ceramic" };
    const withWc = planSvg({ ...s, rooms: [...s.rooms, wc] }, undefined, { pen, scale: 100 });
    expect(withWc).toContain("KM/WC"); // the tag text
    expect(withWc).not.toContain("<circle"); // no furniture box/symbol
  });

  it("draws grids as dash-dot with bubbles", () => {
    const grids: GridLine[] = [
      { id: "gx1", axis: "x", label: "1", offset: 0 },
      { id: "gx2", axis: "x", label: "2", offset: 6000 },
      { id: "gy1", axis: "y", label: "A", offset: 0 },
      { id: "gy2", axis: "y", label: "B", offset: 5000 },
    ];
    const svg = planSvg(s, undefined, { pen, scale: 100, grids });
    expect(svg).toContain("stroke-dasharray");
    expect(svg).toContain("<circle");
  });
});

describe("plan annotations (W-05)", () => {
  const s = generateSchematic(
    mass,
    [{ name: "Living", targetAreaM2: 50 }, { name: "Bed", targetAreaM2: 30 }],
    DEFAULT_SCHEMATIC_OPTIONS,
    0,
    3500,
  );

  it("draws a section mark with its sheet number", () => {
    const svg = planSvg(s, undefined, {
      sections: [
        { name: "Potongan A-A'", line: { a: { x: 0, y: -2000 }, b: { x: 0, y: 11000 } }, sheetNumber: "A105" },
      ],
    });
    expect(svg).toContain("A105");
  });

  it("draws a north arrow and (opt-in) a scale bar", () => {
    const svg = planSvg(s, undefined, { northAngle: 30, annotations: { scaleBar: true } });
    expect(svg).toContain(">N<");
    expect(svg).toContain("5 m");
  });

  it("tags doors and windows (D1 / W1)", () => {
    const svg = planSvg(s);
    expect(svg).toMatch(/D1|W1/);
  });
});
