import { describe, expect, it } from "vitest";
import type { Point, Polygon } from "@qreasee/shared";
import {
  buildableArea,
  differencePolygons,
  extrudePolygon,
  isSimpleRing,
  pointInPolygon,
  polygonAreaMm2,
  ringArea,
  signedArea,
  triangulatePolygon,
  unionAreaMm2,
  unionPolygons,
} from "../index";

const m = 1000; // 1 m in mm
const sq = (x: number, y: number, s: number): Point[] => [
  { x: x * m, y: y * m },
  { x: (x + s) * m, y: y * m },
  { x: (x + s) * m, y: (y + s) * m },
  { x: x * m, y: (y + s) * m },
];
const poly = (outer: Point[]): Polygon => ({ outer, holes: [] });
const areaM2 = (mm2: number) => mm2 / 1_000_000;

describe("polygon measures", () => {
  it("computes a CCW square as positive area", () => {
    const square = sq(0, 0, 10);
    expect(signedArea(square)).toBeGreaterThan(0);
    expect(areaM2(ringArea(square))).toBeCloseTo(100, 6);
  });

  it("subtracts courtyard holes", () => {
    const courtyard: Polygon = { outer: sq(0, 0, 20), holes: [sq(6, 6, 8)] };
    // 20*20 - 8*8 = 400 - 64 = 336 m²
    expect(areaM2(polygonAreaMm2(courtyard))).toBeCloseTo(336, 6);
  });

  it("computes a concave L-shaped site", () => {
    // 20x20 square minus a 10x10 bite = 300 m²
    const l: Point[] = [
      { x: 0, y: 0 },
      { x: 20 * m, y: 0 },
      { x: 20 * m, y: 10 * m },
      { x: 10 * m, y: 10 * m },
      { x: 10 * m, y: 20 * m },
      { x: 0, y: 20 * m },
    ];
    expect(areaM2(ringArea(l))).toBeCloseTo(300, 6);
  });
});

describe("point in polygon", () => {
  it("handles holes", () => {
    const courtyard: Polygon = { outer: sq(0, 0, 20), holes: [sq(6, 6, 8)] };
    expect(pointInPolygon({ x: 1 * m, y: 1 * m }, courtyard)).toBe(true);
    expect(pointInPolygon({ x: 10 * m, y: 10 * m }, courtyard)).toBe(false);
  });
});

describe("clipper booleans", () => {
  it("unions two overlapping squares (175 m²)", () => {
    const u = unionPolygons([poly(sq(0, 0, 10)), poly(sq(5, 5, 10))]);
    expect(areaM2(unionAreaMm2([poly(sq(0, 0, 10)), poly(sq(5, 5, 10))]))).toBeCloseTo(175, 3);
    expect(u.length).toBeGreaterThan(0);
  });

  it("differences an overlapping square (75 m²)", () => {
    const d = differencePolygons([poly(sq(0, 0, 10))], [poly(sq(5, 5, 10))]);
    const total = d.reduce((s, p) => s + polygonAreaMm2(p), 0);
    expect(areaM2(total)).toBeCloseTo(75, 3);
  });

  it("keeps a courtyard hole out of the union area (336 m²)", () => {
    const courtyard: Polygon = { outer: sq(0, 0, 20), holes: [sq(6, 6, 8)] };
    expect(areaM2(unionAreaMm2([courtyard]))).toBeCloseTo(336, 2);
  });
});

describe("buildable area and setbacks", () => {
  it("insets a 20x20 site by 1 m on every edge (324 m²)", () => {
    const boundary = sq(0, 0, 20);
    const buildable = buildableArea(boundary, { 0: m, 1: m, 2: m, 3: m });
    const total = buildable.reduce((s, p) => s + polygonAreaMm2(p), 0);
    expect(areaM2(total)).toBeCloseTo(324, 2);
  });

  it("uses per-edge setbacks on a corner site", () => {
    // 20x20, front edge (index 0) 4 m, others 0 -> 20 x 16 = 320 m²
    const boundary = sq(0, 0, 20);
    const buildable = buildableArea(boundary, { 0: 4 * m });
    const total = buildable.reduce((s, p) => s + polygonAreaMm2(p), 0);
    expect(areaM2(total)).toBeCloseTo(320, 2);
  });
});

describe("triangulation", () => {
  it("makes two triangles for a square", () => {
    const t = triangulatePolygon(poly(sq(0, 0, 10)));
    expect(t.indices.length).toBe(6);
  });

  it("triangulates a courtyard with a hole", () => {
    const t = triangulatePolygon({ outer: sq(0, 0, 20), holes: [sq(6, 6, 8)] });
    expect(t.indices.length).toBeGreaterThanOrEqual(18); // >= 6 triangles
  });
});

describe("extrusion", () => {
  it("creates four wall faces for a square mass", () => {
    const e = extrudePolygon(poly(sq(0, 0, 10)), 0, 3000);
    expect(e.walls.length).toBe(4);
    const total = e.walls.reduce((s, w) => s + w.area, 0);
    // 4 walls x 10 m x 3 m = 120 m²
    expect(areaM2(total)).toBeCloseTo(120, 3);
  });

  it("includes courtyard walls for a footprint with a hole", () => {
    const e = extrudePolygon({ outer: sq(0, 0, 20), holes: [sq(6, 6, 8)] }, 0, 3000);
    expect(e.walls.length).toBe(8);
    expect(e.walls.filter((w) => w.ringKind === "hole").length).toBe(4);
  });
});

describe("robustness", () => {
  it("rejects a self-intersecting bowtie", () => {
    const bowtie: Point[] = [
      { x: 0, y: 0 },
      { x: 10 * m, y: 10 * m },
      { x: 10 * m, y: 0 },
      { x: 0, y: 10 * m },
    ];
    expect(isSimpleRing(bowtie)).toBe(false);
  });

  it("accepts a simple square", () => {
    expect(isSimpleRing(sq(0, 0, 10))).toBe(true);
  });
});
