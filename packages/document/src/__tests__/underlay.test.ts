import { describe, expect, it } from "vitest";
import { emptyDocState, type DocState, type Underlay } from "@qreasee/shared";
import { DocumentStore } from "../store";

function state(): DocState {
  const s = emptyDocState();
  s.levels = [{ id: "L1", name: "Lt. 1", elevation: 0, floorToFloor: 3600 }];
  return s;
}

function underlay(id: string): Underlay {
  return {
    id,
    name: "Ground floor",
    levelId: "L1",
    lines: [
      { a: { x: 0, y: 0 }, b: { x: 5000, y: 0 }, layer: "WALL" },
      { a: { x: 5000, y: 0 }, b: { x: 5000, y: 3000 }, layer: "WALL" },
    ],
    origin: "user",
  };
}

describe("underlays are document state (I-03)", () => {
  it("adds, toggles, and removes an underlay, undoably", () => {
    const store = new DocumentStore(state());
    store.dispatch({ type: "underlay.add", underlay: underlay("u1") });
    expect(store.getState().underlays).toHaveLength(1);
    expect(store.getState().underlays[0].lines).toHaveLength(2);

    store.dispatch({ type: "underlay.update", id: "u1", patch: { visible: false } });
    expect(store.getState().underlays[0].visible).toBe(false);

    store.dispatch({ type: "underlay.remove", id: "u1" });
    expect(store.getState().underlays).toHaveLength(0);

    store.undo();
    expect(store.getState().underlays).toHaveLength(1);
    store.undo();
    expect(store.getState().underlays[0].visible).toBeUndefined();
  });

  it("normalises old documents to an empty underlay list", () => {
    const s = state();
    // Simulate a document saved before underlays existed.
    delete (s as { underlays?: unknown }).underlays;
    const store = new DocumentStore(s);
    expect(store.getState().underlays).toEqual([]);
  });
});
