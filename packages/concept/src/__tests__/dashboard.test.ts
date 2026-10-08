import { describe, expect, it } from "vitest";
import type { ProgramItem, Room } from "@qreasee/shared";
import { areaDashboard, areaStatus } from "../index";

const item = (over: Partial<ProgramItem>): ProgramItem => ({
  id: over.id ?? "p",
  name: over.name ?? "Room",
  targetArea: over.targetArea ?? 10,
  ...over,
});

function room(programItemId: string, areaM2: number): Room {
  return {
    id: `b-${programItemId}-${areaM2}`,
    levelId: "L1",
    name: "block",
    programItemId,
    fidelity: "concept",
    polygon: {
      outer: [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1000, y: 1000 },
        { x: 0, y: 1000 },
      ],
      holes: [],
    },
    areaMm2: areaM2 * 1_000_000,
  };
}

describe("area dashboard (K-03)", () => {
  it("classifies target vs actual with ±10 / ±20 % bands", () => {
    expect(areaStatus(100, 100)).toBe("ok");
    expect(areaStatus(110, 100)).toBe("ok");
    expect(areaStatus(115, 100)).toBe("near");
    expect(areaStatus(125, 100)).toBe("over");
    expect(areaStatus(80, 100)).toBe("near");
    expect(areaStatus(70, 100)).toBe("under");
    expect(areaStatus(0, 0)).toBe("needs-input");
  });

  it("compares each program row against its blocks", () => {
    const program = [
      item({ id: "a", name: "Dorm room", qty: 2, areaEach: 12 }), // target 24
      item({ id: "b", name: "Bathroom", qty: 1, areaEach: 4 }), // target 4
    ];
    const rooms = [room("a", 12), room("a", 12), room("b", 3)];
    const rows = areaDashboard(program, rooms);
    expect(rows.find((r) => r.programItemId === "a")!.actualM2).toBe(24);
    expect(rows.find((r) => r.programItemId === "a")!.status).toBe("ok");
    // Bathroom actual 3 vs target 4 -> -25% -> under
    expect(rows.find((r) => r.programItemId === "b")!.status).toBe("under");
  });

  it("reports under when no blocks exist yet", () => {
    const rows = areaDashboard([item({ id: "x", qty: 1, areaEach: 10 })], []);
    expect(rows[0].actualM2).toBe(0);
    expect(rows[0].status).toBe("under");
  });
});
