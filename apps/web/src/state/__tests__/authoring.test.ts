import { describe, expect, it } from "vitest";
import { useApp } from "../store";

describe("plan authoring (W-03)", () => {
  it("draws a wall and places a door on it", () => {
    const before = useApp.getState().docState.walls.length;
    useApp.getState().addWall({ x: 0, y: 0 }, { x: 5000, y: 0 });

    const walls = useApp.getState().docState.walls;
    expect(walls.length).toBe(before + 1);
    const wall = walls[walls.length - 1];
    expect(wall.kind).toBe("exterior");
    expect(wall.thickness).toBe(150);
    expect(wall.origin).toBe("user");

    useApp.getState().placeOpening({ x: 2500, y: 150 }, "door");
    const openings = useApp.getState().docState.openings;
    expect(openings.some((o) => o.wallId === wall.id && o.kind === "door")).toBe(true);
  });

  it("places a window with sill/height and marks the wall partition thickness", () => {
    useApp.getState().setWallKind("partition");
    useApp.getState().addWall({ x: 0, y: 10000 }, { x: 5000, y: 10000 });
    const wall = useApp.getState().docState.walls.slice(-1)[0];
    expect(wall.kind).toBe("partition");
    expect(wall.thickness).toBe(100);

    useApp.getState().placeOpening({ x: 2500, y: 10040 }, "window");
    const win = useApp.getState().docState.openings.filter((o) => o.wallId === wall.id).slice(-1)[0];
    expect(win.kind).toBe("window");
    expect(win.sill).toBeGreaterThan(0);
    expect(win.height).toBeGreaterThan(0);
    useApp.getState().setWallKind("exterior");
  });

  it("draws a room and generates its bounding walls", () => {
    const walls0 = useApp.getState().docState.walls.length;
    const rooms0 = useApp.getState().docState.rooms.length;
    useApp.getState().addRoomPolygon([
      { x: 0, y: 20000 },
      { x: 4000, y: 20000 },
      { x: 4000, y: 23000 },
      { x: 0, y: 23000 },
    ]);
    const s = useApp.getState().docState;
    expect(s.rooms.length).toBe(rooms0 + 1);
    expect(s.walls.length).toBe(walls0 + 4);
    const room = s.rooms[s.rooms.length - 1];
    expect(room.fidelity).toBe("schematic");
    expect(room.areaMm2).toBeCloseTo(4000 * 3000, 0);
  });
});
