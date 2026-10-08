import { describe, expect, it } from "vitest";
import { emptyDocState, type DocState, type Mass } from "@qreasee/shared";
import { DocumentStore } from "../store";

function baseState(): DocState {
  const s = emptyDocState();
  s.levels = [{ id: "L1", name: "Lt. 1", elevation: 0, floorToFloor: 3500 }];
  return s;
}

function mass(id: string, layerId?: string): Mass {
  return {
    id,
    levelIds: ["L1"],
    footprint: {
      outer: [
        { x: 0, y: 0 },
        { x: 5000, y: 0 },
        { x: 5000, y: 5000 },
        { x: 0, y: 5000 },
      ],
      holes: [],
    },
    height: 3000,
    fidelity: "massing",
    layerId,
  };
}

describe("layers and object naming (Feature Guide §2)", () => {
  it("starts with one default layer and a current layer", () => {
    const store = new DocumentStore(baseState());
    const s = store.getState();
    expect(s.layers).toHaveLength(1);
    expect(s.activeLayerId).toBe(s.layers[0].id);
  });

  it("adds a layer (which becomes current), renames it, and moves a mass onto it", () => {
    const store = new DocumentStore(baseState());
    store.dispatch({ type: "mass.add", mass: mass("m1") });
    store.dispatch({ type: "layer.add", layer: { id: "layer-1", name: "Walls", visible: true } });
    expect(store.getState().activeLayerId).toBe("layer-1");

    store.dispatch({ type: "mass.setLayer", ids: ["m1"], layerId: "layer-1" });
    expect(store.getState().masses[0].layerId).toBe("layer-1");

    store.dispatch({ type: "layer.update", id: "layer-1", patch: { name: "Dinding" } });
    expect(store.getState().layers.find((l) => l.id === "layer-1")?.name).toBe("Dinding");
  });

  it("toggles layer visibility", () => {
    const store = new DocumentStore(baseState());
    store.dispatch({ type: "layer.update", id: "layer-0", patch: { visible: false } });
    expect(store.getState().layers[0].visible).toBe(false);
  });

  it("removing a layer re-homes its objects and never leaves zero layers", () => {
    const store = new DocumentStore(baseState());
    store.dispatch({ type: "mass.add", mass: mass("m1") });
    store.dispatch({ type: "layer.add", layer: { id: "layer-1", name: "Walls", visible: true } });
    store.dispatch({ type: "mass.setLayer", ids: ["m1"], layerId: "layer-1" });
    store.dispatch({ type: "layer.remove", id: "layer-1" });

    const s = store.getState();
    expect(s.layers).toHaveLength(1);
    expect(s.masses[0].layerId).toBe(s.layers[0].id);

    // Removing the last remaining layer is a no-op.
    store.dispatch({ type: "layer.remove", id: s.layers[0].id });
    expect(store.getState().layers).toHaveLength(1);
  });

  it("layer edits participate in undo/redo", () => {
    const store = new DocumentStore(baseState());
    store.dispatch({ type: "layer.add", layer: { id: "layer-1", name: "Walls", visible: true } });
    store.undo();
    expect(store.getState().layers).toHaveLength(1);
    store.redo();
    expect(store.getState().layers).toHaveLength(2);
  });
});
