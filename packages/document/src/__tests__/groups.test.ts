import { describe, expect, it } from "vitest";
import { emptyDocState, type DocState, type Mass } from "@qreasee/shared";
import { DocumentStore } from "../store";

function baseState(): DocState {
  const s = emptyDocState();
  s.levels = [{ id: "L1", name: "Lt. 1", elevation: 0, floorToFloor: 3500 }];
  return s;
}

function mass(id: string, x: number): Mass {
  return {
    id,
    levelIds: ["L1"],
    footprint: {
      outer: [
        { x, y: 0 },
        { x: x + 4000, y: 0 },
        { x: x + 4000, y: 4000 },
        { x, y: 4000 },
      ],
      holes: [],
    },
    height: 3000,
    fidelity: "massing",
  };
}

describe("groups / components (Feature Guide §3.2.2)", () => {
  it("creates a group and tags its members", () => {
    const store = new DocumentStore(baseState());
    store.dispatch({ type: "mass.add", mass: mass("m1", 0) });
    store.dispatch({ type: "mass.add", mass: mass("m2", 6000) });
    store.dispatch({
      type: "group.create",
      group: { id: "g1", name: "Wing A", color: "#60a5fa" },
      massIds: ["m1", "m2"],
    });
    const s = store.getState();
    expect(s.groups).toHaveLength(1);
    expect(s.masses.every((m) => m.groupId === "g1")).toBe(true);
  });

  it("moves every member of a group in one undoable step", () => {
    const store = new DocumentStore(baseState());
    store.dispatch({ type: "mass.add", mass: mass("m1", 0) });
    store.dispatch({ type: "mass.add", mass: mass("m2", 6000) });
    store.dispatch({
      type: "group.create",
      group: { id: "g1", name: "Wing A" },
      massIds: ["m1", "m2"],
    });
    store.dispatch({ type: "mass.moveMany", ids: ["m1", "m2"], dx: 1000, dy: 500 });

    const moved = store.getState().masses;
    expect(moved.find((m) => m.id === "m1")?.footprint.outer[0]).toEqual({ x: 1000, y: 500 });
    expect(moved.find((m) => m.id === "m2")?.footprint.outer[0]).toEqual({ x: 7000, y: 500 });

    store.undo();
    expect(store.getState().masses.find((m) => m.id === "m1")?.footprint.outer[0]).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("updates many footprints in one step", () => {
    const store = new DocumentStore(baseState());
    store.dispatch({ type: "mass.add", mass: mass("m1", 0) });
    store.dispatch({ type: "mass.add", mass: mass("m2", 6000) });
    store.dispatch({
      type: "mass.updateMany",
      patches: [
        { id: "m1", patch: { name: "Block A" } },
        { id: "m2", patch: { height: 6000 } },
      ],
    });
    const s = store.getState();
    expect(s.masses.find((m) => m.id === "m1")?.name).toBe("Block A");
    expect(s.masses.find((m) => m.id === "m2")?.height).toBe(6000);
  });

  it("ungroups: removes the group and clears membership", () => {
    const store = new DocumentStore(baseState());
    store.dispatch({ type: "mass.add", mass: mass("m1", 0) });
    store.dispatch({
      type: "group.create",
      group: { id: "g1", name: "Wing A" },
      massIds: ["m1"],
    });
    store.dispatch({ type: "group.remove", id: "g1" });
    const s = store.getState();
    expect(s.groups).toHaveLength(0);
    expect(s.masses[0].groupId).toBeUndefined();
  });
});
