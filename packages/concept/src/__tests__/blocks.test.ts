import { describe, expect, it } from "vitest";
import type { Point, ProgramItem } from "@qreasee/shared";
import { blocksFromProgram } from "../index";

function areaM2(ring: Point[]): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s / 2) / 1_000_000;
}

const item = (over: Partial<ProgramItem>): ProgramItem => ({
  id: over.id ?? "p",
  name: over.name ?? "Room",
  targetArea: over.targetArea ?? 12,
  ...over,
});

describe("blocks from program (K-04)", () => {
  const levels = [{ id: "L1" }, { id: "L2" }];

  it("creates one area-true block per instance", () => {
    const rooms = blocksFromProgram(
      [item({ id: "bed", name: "Bedroom", qty: 2, areaEach: 12, group: "Private" })],
      { levels, siteWidthM: 12, siteDepthM: 25 },
    );
    expect(rooms).toHaveLength(2);
    expect(rooms[0].fidelity).toBe("concept");
    expect(areaM2(rooms[0].polygon.outer)).toBeCloseTo(12, 3);
    expect(rooms[0].group).toBe("Private");
    expect(rooms[0].height).toBe(3000);
  });

  it("honours a custom block height", () => {
    const rooms = blocksFromProgram([item({ qty: 1, areaEach: 12 })], {
      levels,
      siteWidthM: 12,
      siteDepthM: 25,
      defaultHeightMm: 3600,
    });
    expect(rooms[0].height).toBe(3600);
  });

  it("places blocks beside the site (not on it)", () => {
    const rooms = blocksFromProgram([item({ qty: 1, areaEach: 20 })], {
      levels,
      siteWidthM: 12,
      siteDepthM: 25,
    });
    const minX = Math.min(...rooms[0].polygon.outer.map((p) => p.x));
    expect(minX).toBeGreaterThanOrEqual(12_000);
  });

  it("puts levelPref 'upper' blocks on the second level", () => {
    const rooms = blocksFromProgram(
      [
        item({ id: "a", name: "Living", qty: 1, areaEach: 20, levelPref: "ground" }),
        item({ id: "b", name: "Bedroom", qty: 1, areaEach: 12, levelPref: "upper" }),
      ],
      { levels, siteWidthM: 12, siteDepthM: 25 },
    );
    expect(rooms.find((r) => r.name === "Living")!.levelId).toBe("L1");
    expect(rooms.find((r) => r.name === "Bedroom")!.levelId).toBe("L2");
  });

  it("does not overlap blocks (sampled centres)", () => {
    const rooms = blocksFromProgram(
      [item({ id: "r", name: "Room", qty: 8, areaEach: 16 })],
      { levels, siteWidthM: 12, siteDepthM: 25 },
    );
    const centres = rooms.map((r) => {
      const xs = r.polygon.outer.map((p) => p.x);
      const ys = r.polygon.outer.map((p) => p.y);
      return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
    });
    for (let i = 0; i < centres.length; i++) {
      for (let j = i + 1; j < centres.length; j++) {
        const d = Math.hypot(centres[i].x - centres[j].x, centres[i].y - centres[j].y);
        expect(d).toBeGreaterThan(1000);
      }
    }
  });

  it("is deterministic", () => {
    const program = [item({ id: "x", qty: 3, areaEach: 10 })];
    const a = blocksFromProgram(program, { levels, siteWidthM: 12, siteDepthM: 25 });
    const b = blocksFromProgram(program, { levels, siteWidthM: 12, siteDepthM: 25 });
    expect(a).toEqual(b);
  });
});
