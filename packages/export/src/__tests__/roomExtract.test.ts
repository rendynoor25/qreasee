import { describe, expect, it } from "vitest";
import { roomsFromWalls } from "../roomExtract";

describe("rooms from walls", () => {
  it("a closed rectangle → one room", () => {
    const walls = [
      { a: { x: 0, y: 0 }, b: { x: 6000, y: 0 } },
      { a: { x: 6000, y: 0 }, b: { x: 6000, y: 4000 } },
      { a: { x: 6000, y: 4000 }, b: { x: 0, y: 4000 } },
      { a: { x: 0, y: 4000 }, b: { x: 0, y: 0 } },
    ];
    const rooms = roomsFromWalls(walls, { cell: 100 });
    expect(rooms.length).toBe(1);
    expect(rooms[0].areaMm2).toBeGreaterThan(18e6);
    // A rectangular room simplifies to a handful of corners, not one per cell.
    expect(rooms[0].polygon.length).toBeLessThanOrEqual(8);
  });

  it("two rooms with a divider → two regions", () => {
    const walls = [
      { a: { x: 0, y: 0 }, b: { x: 12000, y: 0 } },
      { a: { x: 12000, y: 0 }, b: { x: 12000, y: 4000 } },
      { a: { x: 12000, y: 4000 }, b: { x: 0, y: 4000 } },
      { a: { x: 0, y: 4000 }, b: { x: 0, y: 0 } },
      { a: { x: 6000, y: 0 }, b: { x: 6000, y: 4000 } },
    ];
    const rooms = roomsFromWalls(walls, { cell: 100 });
    expect(rooms.length).toBe(2);
  });

  it("a gap in the wall does not leak with gap-closing", () => {
    const walls = [
      { a: { x: 0, y: 0 }, b: { x: 5900, y: 0 } },
      { a: { x: 6000, y: 0 }, b: { x: 6000, y: 4000 } },
      { a: { x: 6000, y: 4000 }, b: { x: 0, y: 4000 } },
      { a: { x: 0, y: 4000 }, b: { x: 0, y: 0 } },
    ];
    const rooms = roomsFromWalls(walls, { cell: 100, closeCells: 1 });
    expect(rooms.length).toBe(1);
  });
});
