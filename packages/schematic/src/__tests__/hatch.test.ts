import { describe, expect, it } from "vitest";
import { hatchSegments, hatchSpacingPaperMm } from "../hatch";

const SQUARE = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
  { x: 1000, y: 1000 },
  { x: 0, y: 1000 },
];

describe("hatch segments (W-08)", () => {
  it("clips parallel lines inside a square", () => {
    const segs = hatchSegments(SQUARE, 45, 200);
    expect(segs.length).toBeGreaterThan(2);
    // Every segment stays inside the polygon's bounding box.
    for (const [a, b] of segs) {
      for (const p of [a, b]) {
        expect(p.x).toBeGreaterThanOrEqual(-1);
        expect(p.x).toBeLessThanOrEqual(1001);
        expect(p.y).toBeGreaterThanOrEqual(-1);
        expect(p.y).toBeLessThanOrEqual(1001);
      }
    }
  });

  it("is denser with a smaller spacing", () => {
    expect(hatchSegments(SQUARE, 45, 100).length).toBeGreaterThan(
      hatchSegments(SQUARE, 45, 400).length,
    );
  });

  it("returns nothing for a degenerate polygon or spacing", () => {
    expect(hatchSegments([], 45, 200)).toHaveLength(0);
    expect(hatchSegments(SQUARE, 45, 0)).toHaveLength(0);
  });

  it("hatches masonry/stone materials and leaves others flat", () => {
    expect(hatchSpacingPaperMm("qr-brick-brown")).toBe(3);
    expect(hatchSpacingPaperMm("qr-stone-andesite")).toBe(3);
    expect(hatchSpacingPaperMm("qr-concrete-screed")).toBeNull();
    expect(hatchSpacingPaperMm("wall-paint-white")).toBeNull();
    expect(hatchSpacingPaperMm(undefined)).toBeNull();
  });
});
