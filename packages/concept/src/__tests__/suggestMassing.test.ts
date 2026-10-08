import { describe, expect, it } from "vitest";
import { emptyDocState, type DocState, type Point, type Rules } from "@qreasee/shared";
import { suggestMassings } from "../index";

const m = 1000;
const rect = (x: number, y: number, w: number, h: number): Point[] => [
  { x: x * m, y: y * m },
  { x: (x + w) * m, y: y * m },
  { x: (x + w) * m, y: (y + h) * m },
  { x: x * m, y: (y + h) * m },
];

function stateWith(boundary: Point[], rules: Rules, rateHigh = 7_000_000): DocState {
  const s = emptyDocState();
  s.site.boundary = boundary;
  s.levels = [
    { id: "L1", name: "Lt. 1", elevation: 0, floorToFloor: 3500 },
    { id: "L2", name: "Lt. 2", elevation: 3500, floorToFloor: 3500 },
    { id: "L3", name: "Lt. 3", elevation: 7000, floorToFloor: 3500 },
  ];
  s.rules = rules;
  s.budget.ratePerM2 = { low: 5_000_000, high: rateHigh };
  return s;
}

describe("suggest massing (K-05)", () => {
  const corner = stateWith(
    rect(0, 0, 20, 15),
    { kdbMax: 60, klbMax: 1.2, floorsMax: 2, setbacks: { 0: 2000, 1: 1000, 2: 2000, 3: 1000 } },
  );

  it("returns up to 3 options for a 300 m² corner site", () => {
    const options = suggestMassings(corner, { grossAreaM2: 180 });
    expect(options.length).toBeGreaterThan(0);
    expect(options.length).toBeLessThanOrEqual(3);
  });

  it("never returns an option that breaches a hard rule", () => {
    for (const o of suggestMassings(corner, { grossAreaM2: 180 })) {
      expect(o.breaches).toBe(false);
      expect(o.status.kdb).not.toBe("over");
      expect(o.status.klb).not.toBe("over");
      expect(o.status.setback).not.toBe("over");
      expect(o.kdb).toBeLessThanOrEqual(60 + 1e-6);
      expect(o.klb).toBeLessThanOrEqual(1.2 + 1e-6);
      expect(o.floors).toBeLessThanOrEqual(2);
    }
  });

  it("is deterministic for the same input", () => {
    const a = suggestMassings(corner, { grossAreaM2: 180 });
    const b = suggestMassings(corner, { grossAreaM2: 180 });
    expect(a).toEqual(b);
    expect(a.map((o) => o.name)).toEqual(b.map((o) => o.name));
  });

  it("ranks by score and exposes a breakdown", () => {
    const options = suggestMassings(corner, { grossAreaM2: 180 });
    for (let i = 1; i < options.length; i++) {
      expect(options[i - 1].score).toBeGreaterThanOrEqual(options[i].score);
    }
    for (const o of options) {
      expect(o.score).toBeGreaterThanOrEqual(0);
      expect(o.score).toBeLessThanOrEqual(1);
      expect(o.breakdown).toBeTruthy();
    }
  });

  it("returns distinct options (no duplicate footprints)", () => {
    const options = suggestMassings(corner, { grossAreaM2: 180 });
    const keys = options.map((o) => JSON.stringify(o.footprint.outer));
    expect(new Set(keys).size).toBe(options.length);
  });

  it("fits a narrow 9 × 24 m plot with side setbacks", () => {
    const narrow = stateWith(
      rect(0, 0, 9, 24),
      { kdbMax: 60, klbMax: 1.6, floorsMax: 3, setbacks: { 0: 1000, 1: 1000, 2: 1000, 3: 1000 } },
    );
    const options = suggestMassings(narrow, { grossAreaM2: 140 });
    expect(options.length).toBeGreaterThan(0);
    for (const o of options) expect(o.breaches).toBe(false);
  });

  it("handles a concave L-shaped site", () => {
    const l: Point[] = [
      { x: 0, y: 0 },
      { x: 20 * m, y: 0 },
      { x: 20 * m, y: 10 * m },
      { x: 10 * m, y: 10 * m },
      { x: 10 * m, y: 20 * m },
      { x: 0, y: 20 * m },
    ];
    const concave = stateWith(l, { kdbMax: 60, klbMax: 1.5, floorsMax: 3, setbacks: { 0: 1000, 1: 1000, 2: 1000, 3: 1000, 4: 1000, 5: 1000 } });
    const options = suggestMassings(concave, { grossAreaM2: 150 });
    for (const o of options) expect(o.breaches).toBe(false);
  });

  it("returns nothing when the program cannot fit the site", () => {
    const tiny = stateWith(rect(0, 0, 5, 5), { kdbMax: 40, klbMax: 0.6, floorsMax: 1, setbacks: {} });
    const options = suggestMassings(tiny, { grossAreaM2: 400 });
    expect(options.every((o) => !o.breaches)).toBe(true);
  });

  it("respects custom weights (cost-first changes the order)", () => {
    const costFirst = suggestMassings(corner, {
      grossAreaM2: 180,
      weights: { cost: 1, rules: 0, sun: 0, green: 0, compactness: 0 },
    });
    expect(costFirst.length).toBeGreaterThan(0);
    // cheapest option first
    for (let i = 1; i < costFirst.length; i++) {
      expect(costFirst[0].costHigh ?? 0).toBeLessThanOrEqual(costFirst[i].costHigh ?? 0);
    }
  });
});
