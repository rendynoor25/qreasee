import { describe, expect, it } from "vitest";
import { emptyDocState } from "@qreasee/shared";
import { axonModelSvg } from "../axon";

describe("model axonometric (W-08)", () => {
  it("renders the real model — walls, slabs and roof — as filled faces", () => {
    const s = emptyDocState();
    s.levels = [{ id: "L1", name: "Lt. 1", elevation: 0, floorToFloor: 3500 }];
    s.masses = [
      {
        id: "m1",
        levelIds: ["L1"],
        footprint: {
          outer: [
            { x: 0, y: 0 },
            { x: 9000, y: 0 },
            { x: 9000, y: 5000 },
            { x: 0, y: 5000 },
          ],
          holes: [],
        },
        height: 3500,
        fidelity: "massing",
      },
    ];
    s.walls = [
      { id: "w1", levelId: "L1", a: { x: 0, y: 0 }, b: { x: 9000, y: 0 }, thickness: 150, height: 3500, kind: "exterior" },
      { id: "w2", levelId: "L1", a: { x: 9000, y: 0 }, b: { x: 9000, y: 5000 }, thickness: 150, height: 3500, kind: "exterior" },
    ];
    s.slabs = [
      {
        id: "sl1",
        levelId: "L1",
        kind: "floor",
        polygon: {
          outer: [
            { x: 0, y: 0 },
            { x: 9000, y: 0 },
            { x: 9000, y: 5000 },
            { x: 0, y: 5000 },
          ],
          holes: [],
        },
        z: 0,
        thickness: 120,
      },
    ];
    s.roofs = [
      {
        id: "r1",
        levelId: "L1",
        type: "hip",
        pitchDeg: 30,
        overhang: 600,
        polygon: {
          outer: [
            { x: 0, y: 0 },
            { x: 9000, y: 0 },
            { x: 9000, y: 5000 },
            { x: 0, y: 5000 },
          ],
          holes: [],
        },
        baseZ: 3500,
      },
    ];
    const svg = axonModelSvg(s);
    expect(svg).toContain("<svg");
    // Only front-facing faces survive culling; a simple box+roof still has several.
    expect((svg.match(/<polygon/g) || []).length).toBeGreaterThan(5);
    // Roof + wall faces are shaded, so more than one fill colour appears.
    expect(new Set(svg.match(/fill="#[0-9a-f]{6}"/g) || []).size).toBeGreaterThan(3);
  });

  it("returns nothing for an empty model", () => {
    expect(axonModelSvg(emptyDocState())).toBe("");
  });
});
