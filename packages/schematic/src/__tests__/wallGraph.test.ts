import { describe, expect, it } from "vitest";
import { wallGraph } from "../wallGraph";

describe("wall graph (Part 3 §1)", () => {
  it("free end: no extension", () => {
    const g = wallGraph([{ id: "w1", a: { x: 0, y: 0 }, b: { x: 3000, y: 0 }, thickness: 150 }]);
    expect(g.ext.w1).toEqual({ a: 0, b: 0 });
  });

  it("L-corner: each wall extends by half the other's thickness", () => {
    const g = wallGraph([
      { id: "h", a: { x: 0, y: 0 }, b: { x: 3000, y: 0 }, thickness: 150 },
      { id: "v", a: { x: 3000, y: 0 }, b: { x: 3000, y: 3000 }, thickness: 100 },
    ]);
    expect(g.ext.h.b).toBe(50); // v/2
    expect(g.ext.v.a).toBe(75); // h/2
    expect(g.ext.h.a).toBe(0);
    expect(g.ext.v.b).toBe(0);
  });

  it("T-junction: the stem reaches the through wall's far face", () => {
    const g = wallGraph([
      { id: "through", a: { x: 0, y: 0 }, b: { x: 6000, y: 0 }, thickness: 150 },
      { id: "stem", a: { x: 3000, y: 0 }, b: { x: 3000, y: 3000 }, thickness: 100 },
    ]);
    expect(g.ext.stem.a).toBe(75); // through/2
    expect(g.ext.through).toEqual({ a: 0, b: 0 }); // passes straight through
  });

  it("X-crossing: four wall ends at one node all extend", () => {
    const g = wallGraph([
      { id: "hl", a: { x: 0, y: 0 }, b: { x: 3000, y: 0 }, thickness: 150 },
      { id: "hr", a: { x: 3000, y: 0 }, b: { x: 6000, y: 0 }, thickness: 150 },
      { id: "vu", a: { x: 3000, y: 0 }, b: { x: 3000, y: 3000 }, thickness: 150 },
      { id: "vd", a: { x: 3000, y: 0 }, b: { x: 3000, y: -3000 }, thickness: 150 },
    ]);
    expect(g.ext.hl.b).toBe(75);
    expect(g.ext.hr.a).toBe(75);
    expect(g.ext.vu.a).toBe(75);
    expect(g.ext.vd.a).toBe(75);
    expect(g.ext.hl.a).toBe(0);
  });

  it("collinear run: coincident ends merge and extend by each other", () => {
    const g = wallGraph([
      { id: "r1", a: { x: 0, y: 0 }, b: { x: 3000, y: 0 }, thickness: 150 },
      { id: "r2", a: { x: 3000, y: 0 }, b: { x: 6000, y: 0 }, thickness: 150 },
    ]);
    expect(g.ext.r1.b).toBe(75);
    expect(g.ext.r2.a).toBe(75);
  });
});
