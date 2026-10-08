import { describe, expect, it } from "vitest";
import { buildRoof, roofPlanLines } from "../index";

const RECT = [
  { x: 0, y: 0 },
  { x: 9000, y: 0 },
  { x: 9000, y: 5000 },
  { x: 0, y: 5000 },
];

describe("roof plan lines (W-08)", () => {
  it("a hip roof shows one ridge and four hips", () => {
    const roof = buildRoof(RECT, "hip", 30, 600, 7000);
    const plan = roofPlanLines(roof);
    expect(plan.eaves).toHaveLength(4);
    // Ridge + 4 hips = 5 internal edges.
    expect(plan.lines).toHaveLength(5);
    // The ridge is horizontal (constant y) and horizontal in plan.
    const ridge = plan.lines.find(([a, b]) => Math.abs(a.y - b.y) < 1);
    expect(ridge).toBeDefined();
    expect(Math.abs(ridge![0].x - ridge![1].x)).toBeGreaterThan(1000);
  });

  it("a gable roof shows the ridge plus the two raking gable edges", () => {
    const roof = buildRoof(RECT, "gable", 30, 600, 7000);
    const plan = roofPlanLines(roof);
    expect(plan.lines.length).toBeGreaterThanOrEqual(3);
    const ridge = plan.lines.find(([a, b]) => Math.abs(a.y - b.y) < 1);
    expect(ridge).toBeDefined();
  });

  it("a shed roof has no internal lines (single plane)", () => {
    const roof = buildRoof(RECT, "shed", 20, 600, 7000);
    const plan = roofPlanLines(roof);
    expect(plan.lines).toHaveLength(0);
    expect(plan.eaves).toHaveLength(4);
  });

  it("a steeper pitch raises the ridge but keeps the plan lines the same", () => {
    const shallow = buildRoof(RECT, "hip", 15, 600, 7000);
    const steep = buildRoof(RECT, "hip", 45, 600, 7000);
    expect(steep.ridgeZ).toBeGreaterThan(shallow.ridgeZ);
    expect(roofPlanLines(steep).lines).toHaveLength(roofPlanLines(shallow).lines.length);
  });
});
