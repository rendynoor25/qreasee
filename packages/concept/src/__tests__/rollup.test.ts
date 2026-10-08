import { describe, expect, it } from "vitest";
import type { ProgramItem } from "@qreasee/shared";
import { rollupProgram } from "../index";

const item = (over: Partial<ProgramItem>): ProgramItem => ({
  id: over.id ?? "p",
  name: over.name ?? "Room",
  targetArea: 0,
  ...over,
});

describe("program rollup (K-03)", () => {
  const program: ProgramItem[] = [
    item({ id: "a", group: "Public", qty: 1, areaEach: 100 }),
    item({ id: "b", group: "Private", qty: 2, areaEach: 25 }),
  ];

  it("computes net, circulation and gross (hand-calculated)", () => {
    const r = rollupProgram({
      program,
      settings: { circulationPct: 20, areaUnit: "m2" },
      siteAreaM2: 100,
      rules: { klbMax: 1.8 },
      budget: { ratePerM2: { low: 5_000_000, high: 7_000_000 } },
    });
    expect(r.netM2).toBe(150); // 100 + 2*25
    expect(r.circulationM2).toBe(30); // 20%
    expect(r.grossM2).toBe(180);
    expect(r.allowedGfaM2).toBe(180); // 1.8 * 100
    expect(r.status).toBe("near"); // gross == allowed
    expect(r.costLow).toBe(900_000_000); // 180 * 5M
    expect(r.costHigh).toBe(1_260_000_000); // 180 * 7M
    expect(r.roomCount).toBe(3);
    expect(r.groupCount).toBe(2);
  });

  it("groups totals and shares", () => {
    const r = rollupProgram({ program, siteAreaM2: 100, rules: {}, budget: {} });
    const pub = r.perGroup.find((g) => g.group === "Public")!;
    const priv = r.perGroup.find((g) => g.group === "Private")!;
    expect(pub.netM2).toBe(100);
    expect(pub.share).toBeCloseTo(100 / 150, 6);
    expect(priv.netM2).toBe(50);
    expect(priv.roomCount).toBe(2);
  });

  it("falls back to targetArea when qty/areaEach are absent", () => {
    const r = rollupProgram({
      program: [item({ id: "old", targetArea: 40 })],
      siteAreaM2: 100,
      rules: {},
      budget: {},
    });
    expect(r.netM2).toBe(40);
  });

  it("is needs-input without KLB, and cost is null without a rate", () => {
    const r = rollupProgram({ program, siteAreaM2: 100, rules: {}, budget: {} });
    expect(r.status).toBe("needs-input");
    expect(r.allowedGfaM2).toBeNull();
    expect(r.costLow).toBeNull();
    expect(r.costHigh).toBeNull();
  });

  it("flags over when gross exceeds the allowance", () => {
    const r = rollupProgram({ program, settings: { circulationPct: 20, areaUnit: "m2" }, siteAreaM2: 50, rules: { klbMax: 1.2 }, budget: {} });
    // allowed = 60, gross = 180 -> over
    expect(r.status).toBe("over");
  });
});
