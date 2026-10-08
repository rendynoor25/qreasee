import { describe, expect, it } from "vitest";
import { emptyDocState, type DocState, type Sheet, type SheetItem } from "@qreasee/shared";
import { DocumentStore } from "../store";

function baseState(): DocState {
  return emptyDocState();
}

function sheet(id: string): Sheet {
  return { id, name: `Sheet ${id}`, number: `K-0${id}`, size: "A3", items: [] };
}

describe("sheets (D-02)", () => {
  it("adds, updates and removes a sheet", () => {
    const store = new DocumentStore(baseState());
    store.dispatch({ type: "sheet.add", sheet: sheet("1") });
    expect(store.getState().sheets).toHaveLength(1);

    store.dispatch({ type: "sheet.update", id: "1", patch: { name: "Ground floor", size: "A2" } });
    expect(store.getState().sheets[0].name).toBe("Ground floor");
    expect(store.getState().sheets[0].size).toBe("A2");

    store.dispatch({ type: "sheet.remove", id: "1" });
    expect(store.getState().sheets).toHaveLength(0);
  });

  it("sets items (placed views + annotations) in one undoable step", () => {
    const store = new DocumentStore(baseState());
    store.dispatch({ type: "sheet.add", sheet: sheet("1") });
    const items: SheetItem[] = [
      { id: "v1", kind: "view", viewId: "sys:plan", x: 20, y: 20, w: 180, h: 130 },
      { id: "t1", kind: "text", x: 30, y: 200, text: "Living", sizeMm: 6 },
      { id: "d1", kind: "dimension", x1: 0, y1: 0, x2: 4000, y2: 0 },
    ];
    store.dispatch({ type: "sheet.setItems", id: "1", items });
    expect(store.getState().sheets[0].items).toHaveLength(3);

    store.undo();
    expect(store.getState().sheets[0].items).toHaveLength(0);
    store.redo();
    expect(store.getState().sheets[0].items).toHaveLength(3);
  });

  it("keeps sheets branch-local", () => {
    const store = new DocumentStore(baseState());
    store.dispatch({ type: "sheet.add", sheet: sheet("1") });
    const branch = store.createBranch({ name: "Alt" });
    expect(store.getState(branch.id).sheets).toHaveLength(1);
    store.switchBranch(store.mainBranchId);
    store.dispatch({ type: "sheet.remove", id: "1" });
    expect(store.getState().sheets).toHaveLength(0);
    expect(store.getState(branch.id).sheets).toHaveLength(1);
  });
});
