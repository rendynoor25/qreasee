import { describe, expect, it } from "vitest";
import type { Polygon } from "@qreasee/shared";
import { stackElevationFor, type StackBox } from "../index";

function rect(x: number, y: number, w: number, d: number): Polygon {
  return {
    outer: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + d },
      { x, y: y + d },
    ],
    holes: [],
  };
}

const box = (x: number, y: number, w: number, d: number, base: number, h: number): StackBox => ({
  polygon: rect(x, y, w, d),
  baseMm: base,
  heightMm: h,
});

describe("block stacking (balok)", () => {
  it("sits on top of the block it overlaps", () => {
    const boxes = [box(0, 0, 4000, 4000, 0, 3000)];
    expect(stackElevationFor(boxes, rect(1000, 1000, 4000, 4000))).toBe(3000);
  });

  it("stacks on the highest overlapping block", () => {
    const boxes = [box(0, 0, 4000, 4000, 0, 3000), box(0, 0, 4000, 4000, 3000, 3000)];
    expect(stackElevationFor(boxes, rect(500, 500, 4000, 4000))).toBe(6000);
  });

  it("returns undefined when nothing overlaps (sits on the ground)", () => {
    const boxes = [box(0, 0, 4000, 4000, 0, 3000)];
    expect(stackElevationFor(boxes, rect(20000, 20000, 4000, 4000))).toBeUndefined();
  });

  it("ignores a marginal overlap", () => {
    const boxes = [box(0, 0, 4000, 4000, 0, 3000)];
    expect(stackElevationFor(boxes, rect(3900, 0, 4000, 4000))).toBeUndefined();
  });
});
