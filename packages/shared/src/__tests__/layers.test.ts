import { describe, expect, it } from "vitest";
import { DEFAULT_LAYER_ID, emptyDocState, normalizeDocState } from "../index";

describe("layers backfill (Feature Guide §2)", () => {
  it("emptyDocState starts with the default layer as current", () => {
    const s = emptyDocState();
    expect(s.layers).toHaveLength(1);
    expect(s.layers[0].id).toBe(DEFAULT_LAYER_ID);
    expect(s.activeLayerId).toBe(DEFAULT_LAYER_ID);
  });

  it("normalizeDocState adds a default layer to a pre-layers document", () => {
    const old = { ...emptyDocState() } as Record<string, unknown>;
    delete old.layers;
    delete old.activeLayerId;
    const s = normalizeDocState(old as never);
    expect(s.layers).toHaveLength(1);
    expect(s.activeLayerId).toBe(s.layers[0].id);
  });

  it("keeps a valid active layer id and repairs a dangling one", () => {
    const s = emptyDocState();
    s.layers = [
      { id: "layer-0", name: "Layer 0", visible: true },
      { id: "layer-1", name: "Walls", visible: true },
    ];
    expect(normalizeDocState({ ...s, activeLayerId: "layer-1" }).activeLayerId).toBe("layer-1");
    expect(normalizeDocState({ ...s, activeLayerId: "ghost" }).activeLayerId).toBe("layer-0");
  });
});
