import { describe, expect, it } from "vitest";
import type { Room } from "@qreasee/shared";
import { areaSummary } from "../index";

function room(id: string, name: string, areaM2: number): Room {
  const w = (areaM2 * 1_000_000) / 4000;
  return {
    id,
    levelId: "L1",
    name,
    fidelity: "concept",
    polygon: {
      outer: [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: 4000 },
        { x: 0, y: 4000 },
      ],
      holes: [],
    },
    areaMm2: areaM2 * 1_000_000,
  };
}

describe("areaSummary (C-01 Program + Area Summary)", () => {
  it("groups rooms by name with count and total area", () => {
    const s = areaSummary([room("a", "Bedroom", 12), room("b", "Bedroom", 10), room("c", "Kitchen", 8)]);
    expect(s.rows.map((r) => [r.name, r.count, r.totalM2])).toEqual([
      ["Bedroom", 2, 22],
      ["Kitchen", 1, 8],
    ]);
    expect(s.totalM2).toBe(30);
    expect(s.roomCount).toBe(3);
  });

  it("re-groups live when a room is renamed", () => {
    const before = areaSummary([room("a", "Bedroom", 12), room("b", "Bedroom", 10)]);
    expect(before.rows).toHaveLength(1);
    const after = areaSummary([room("a", "Bedroom", 12), { ...room("b", "Bedroom", 10), name: "Study" }]);
    expect(after.rows.map((r) => r.name).sort()).toEqual(["Bedroom", "Study"]);
    expect(after.totalM2).toBe(before.totalM2);
  });

  it("is empty for no rooms", () => {
    expect(areaSummary([])).toEqual({ rows: [], totalM2: 0, roomCount: 0 });
  });

  it("falls back to 'Room' for a blank name", () => {
    const s = areaSummary([{ ...room("a", "  ", 5), name: "   " }, room("b", "Hall", 4)]);
    expect(s.rows.find((r) => r.name === "Room")?.totalM2).toBe(5);
  });

  it("orders rows by total area, then name", () => {
    const s = areaSummary([room("a", "B", 5), room("b", "A", 5), room("c", "C", 9)]);
    expect(s.rows.map((r) => r.name)).toEqual(["C", "A", "B"]);
  });
});
