import { describe, expect, it } from "vitest";
import {
  emptyDocState,
  type DocState,
  type ElementOrigin,
  type Roof,
  type Wall,
} from "@qreasee/shared";
import { DocumentStore } from "../store";

function state(): DocState {
  const s = emptyDocState();
  s.levels = [{ id: "L1", name: "Lt. 1", elevation: 0, floorToFloor: 3600 }];
  return s;
}

function wall(id: string, origin?: ElementOrigin, thickness = 150): Wall {
  return {
    id,
    levelId: "L1",
    a: { x: 0, y: 0 },
    b: { x: 5000, y: 0 },
    thickness,
    height: 3600,
    kind: "exterior",
    origin,
  };
}

function roof(id: string, origin?: ElementOrigin): Roof {
  return {
    id,
    levelId: "L1",
    type: "hip",
    pitchDeg: 30,
    overhang: 600,
    polygon: {
      outer: [
        { x: 0, y: 0 },
        { x: 5000, y: 0 },
        { x: 5000, y: 5000 },
        { x: 0, y: 5000 },
      ],
      holes: [],
    },
    baseZ: 3600,
    origin,
  };
}

describe("schematic entities are document state (W-01)", () => {
  it("adds, edits and removes a wall, undoably", () => {
    const store = new DocumentStore(state());
    store.dispatch({ type: "wall.add", wall: wall("w1") });
    expect(store.getState().walls).toHaveLength(1);
    // Authored elements default to origin "user".
    expect(store.getState().walls[0].origin).toBe("user");

    store.dispatch({ type: "wall.update", id: "w1", patch: { thickness: 200 } });
    expect(store.getState().walls[0].thickness).toBe(200);

    store.undo();
    expect(store.getState().walls[0].thickness).toBe(150);

    store.dispatch({ type: "wall.remove", id: "w1" });
    expect(store.getState().walls).toHaveLength(0);
  });

  it("removing a wall removes its openings", () => {
    const store = new DocumentStore(state());
    store.dispatch({ type: "wall.add", wall: wall("w1") });
    store.dispatch({
      type: "opening.add",
      opening: { id: "o1", wallId: "w1", kind: "window", offset: 1000, width: 900, sill: 900, height: 1500 },
    });
    expect(store.getState().openings).toHaveLength(1);
    store.dispatch({ type: "wall.remove", id: "w1" });
    expect(store.getState().openings).toHaveLength(0);
  });

  it("editing an element marks it user-authored", () => {
    const store = new DocumentStore(state());
    store.dispatch({ type: "schematic.setGenerated", walls: [wall("wall-ext-0-0", "generated")], openings: [], slabs: [], roofs: [], rooms: [] });
    store.dispatch({ type: "wall.update", id: "wall-ext-0-0", patch: { thickness: 250 } });
    expect(store.getState().walls[0].origin).toBe("user");
  });

  it("regeneration replaces generated elements but keeps user edits and additions", () => {
    const store = new DocumentStore(state());
    const generated = () => [wall("wall-ext-0-0", "generated")];
    store.dispatch({ type: "schematic.setGenerated", walls: generated(), openings: [], slabs: [], roofs: [], rooms: [] });

    // The user edits the generated wall (origin flips to user) and adds one.
    store.dispatch({ type: "wall.update", id: "wall-ext-0-0", patch: { thickness: 250 } });
    store.dispatch({ type: "wall.add", wall: wall("user-1", undefined, 120) });

    // Regenerate with a fresh generated wall of the same id.
    store.dispatch({ type: "schematic.setGenerated", walls: generated(), openings: [], slabs: [], roofs: [], rooms: [] });

    const walls = store.getState().walls;
    expect(walls.map((w) => w.id).sort()).toEqual(["user-1", "wall-ext-0-0"]);
    expect(walls.find((w) => w.id === "wall-ext-0-0")?.thickness).toBe(250); // user edit survived
  });

  it("carries walls across branches", () => {
    const store = new DocumentStore(state());
    store.dispatch({ type: "wall.add", wall: wall("w1") });
    const branch = store.createBranch({ name: "Alt" });
    expect(store.getState().walls).toHaveLength(1);

    store.switchBranch(store.mainBranchId);
    store.dispatch({ type: "wall.remove", id: "w1" });
    expect(store.getState().walls).toHaveLength(0);
    expect(store.getState(branch.id).walls).toHaveLength(1);
  });

  it("stores slabs, roofs and stairs too", () => {
    const store = new DocumentStore(state());
    store.dispatch({ type: "roof.add", roof: roof("r1") });
    store.dispatch({
      type: "slab.add",
      slab: {
        id: "s1",
        levelId: "L1",
        kind: "floor",
        polygon: { outer: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], holes: [] },
        z: 0,
        thickness: 120,
      },
    });
    store.dispatch({
      type: "stair.add",
      stair: { id: "st1", levelId: "L1", kind: "straight", from: { x: 0, y: 0 }, to: { x: 3000, y: 0 }, width: 1000, floorToFloor: 3600 },
    });
    const s = store.getState();
    expect(s.roofs).toHaveLength(1);
    expect(s.slabs).toHaveLength(1);
    expect(s.stairs).toHaveLength(1);
    expect(s.stairs[0].origin).toBe("user");
  });
});
