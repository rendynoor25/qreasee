import { describe, expect, it } from "vitest";
import { emptyDocState, type Decision, type DocState, type Level, type Mass } from "@qreasee/shared";
import { DocumentStore } from "../store";

const L1: Level = { id: "L1", name: "Lt. 1", elevation: 0, floorToFloor: 3500 };

function baseState(): DocState {
  const s = emptyDocState();
  s.levels = [L1];
  return s;
}

function mass(id: string, x: number, height = 3000): Mass {
  return {
    id,
    levelIds: [L1.id],
    footprint: {
      outer: [
        { x, y: 0 },
        { x: x + 10000, y: 0 },
        { x: x + 10000, y: 10000 },
        { x, y: 10000 },
      ],
      holes: [],
    },
    height,
    fidelity: "massing",
  };
}

function decision(id: string, scope: Decision["scope"] = { kind: "whole" }): Decision {
  return {
    id,
    title: `Decision ${id}`,
    question: "Which option?",
    scope,
    status: "open",
    createdAt: 0,
  };
}

describe("DocumentStore operation log", () => {
  it("adds a mass and undoes/redoes it", () => {
    const store = new DocumentStore(baseState());
    store.dispatch({ type: "mass.add", mass: mass("m1", 0) });
    expect(store.getState().masses).toHaveLength(1);
    store.undo();
    expect(store.getState().masses).toHaveLength(0);
    store.redo();
    expect(store.getState().masses).toHaveLength(1);
  });

  it("edits a mass through mass.update", () => {
    const store = new DocumentStore(baseState());
    store.dispatch({ type: "mass.add", mass: mass("m1", 0) });
    store.dispatch({ type: "mass.update", id: "m1", patch: { height: 6000 } });
    expect(store.getState().masses[0].height).toBe(6000);
  });
});

describe("Decision branches", () => {
  it("isolates edits per branch and switches instantly", () => {
    const store = new DocumentStore(baseState());
    store.dispatch({ type: "decision.add", decision: decision("d1") });
    store.dispatch({ type: "mass.add", mass: mass("m1", 0) });

    const b = store.createBranch({ name: "L-shape", decisionId: "d1" });
    store.dispatch({ type: "mass.add", mass: mass("m2", 12000) });
    expect(store.getState(b.id).masses).toHaveLength(2);

    store.switchBranch(store.mainBranchId);
    expect(store.getState().masses.map((m) => m.id)).toEqual(["m1"]);
  });

  it("adopts a branch into main and records a rationale", () => {
    const store = new DocumentStore(baseState());
    store.dispatch({ type: "decision.add", decision: decision("d1") });
    store.dispatch({ type: "mass.add", mass: mass("m1", 0) });
    const b = store.createBranch({ name: "Courtyard", decisionId: "d1" });
    store.dispatch({ type: "mass.add", mass: mass("m2", 20000) });
    store.dispatch({ type: "mass.update", id: "m1", patch: { height: 4500 } });

    const result = store.adopt({ branchId: b.id, rationale: "Meets KLB with margin.", by: "u1" });
    expect(result.ok).toBe(true);
    const main = store.getState();
    expect(main.masses.map((m) => m.id).sort()).toEqual(["m1", "m2"]);
    expect(main.masses.find((m) => m.id === "m1")?.height).toBe(4500);
    expect(main.records).toHaveLength(1);
    expect(main.records[0].rationale).toContain("KLB");
    expect(main.decisions[0].status).toBe("decided");
  });

  it("lists conflicts when main and branch both changed the same mass", () => {
    const store = new DocumentStore(baseState());
    store.dispatch({ type: "decision.add", decision: decision("d1") });
    store.dispatch({ type: "mass.add", mass: mass("m1", 0, 3000) });

    const b = store.createBranch({ name: "Tall option", decisionId: "d1" });
    store.dispatch({ type: "mass.update", id: "m1", patch: { height: 4000 } });

    store.switchBranch(store.mainBranchId);
    store.dispatch({ type: "mass.update", id: "m1", patch: { height: 6000 } });

    const blocked = store.adopt({ branchId: b.id, rationale: "Taller.", by: "u1" });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.conflicts.map((c) => c.massId)).toEqual(["m1"]);

    const resolved = store.adopt({
      branchId: b.id,
      rationale: "Taller.",
      by: "u1",
      resolutions: { m1: "branch" },
    });
    expect(resolved.ok).toBe(true);
    expect(store.getState().masses.find((m) => m.id === "m1")?.height).toBe(4000);
  });

  it("parks siblings on adoption and revives a parked branch", () => {
    const store = new DocumentStore(baseState());
    store.dispatch({ type: "decision.add", decision: decision("d1") });
    const a = store.createBranch({ name: "A", decisionId: "d1" });
    const b = store.createBranch({ name: "B", decisionId: "d1" });
    store.adopt({ branchId: b.id, rationale: "B wins.", by: "u1" });
    expect(store.getBranch(a.id)?.branch.status).toBe("parked");

    const revived = store.reviveBranch(a.id, "A again");
    expect(revived).toBeDefined();
    expect(revived?.status).toBe("exploring");
  });
});

describe("program operations (K-01)", () => {
  it("updates program settings and undoes", () => {
    const store = new DocumentStore(baseState());
    store.dispatch({ type: "brief.setSettings", patch: { circulationPct: 25 } });
    expect(store.getState().brief.settings?.circulationPct).toBe(25);
    store.undo();
    expect(store.getState().brief.settings?.circulationPct).toBe(20);
  });

  it("imports rows and reorders them", () => {
    const store = new DocumentStore(baseState());
    store.dispatch({
      type: "brief.importRows",
      rows: [
        { id: "r1", name: "A", targetArea: 10, qty: 1, areaEach: 10 },
        { id: "r2", name: "B", targetArea: 20, qty: 2, areaEach: 10 },
      ],
    });
    expect(store.getState().brief.program.map((p) => p.id)).toEqual(["r1", "r2"]);
    store.dispatch({ type: "brief.reorderProgram", from: 0, to: 1 });
    expect(store.getState().brief.program.map((p) => p.id)).toEqual(["r2", "r1"]);
  });

  it("adds, updates and removes concept rooms (undoable)", () => {
    const store = new DocumentStore(baseState());
    const poly = {
      outer: [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1000, y: 1000 },
        { x: 0, y: 1000 },
      ],
      holes: [],
    };
    store.dispatch({
      type: "rooms.setConcept",
      rooms: [{ id: "r1", levelId: "L1", name: "A", fidelity: "concept", polygon: poly, areaMm2: 1_000_000 }],
    });
    expect(store.getState().rooms).toHaveLength(1);
    store.dispatch({ type: "room.update", id: "r1", patch: { name: "B" } });
    expect(store.getState().rooms[0].name).toBe("B");
    store.undo();
    expect(store.getState().rooms[0].name).toBe("A");
    store.dispatch({ type: "room.remove", id: "r1" });
    expect(store.getState().rooms).toHaveLength(0);
  });
});

describe("view operations (V-01)", () => {
  const custom = { id: "v1", kind: "3d" as const, name: "Aerial", createdAt: 0 };

  it("adds, updates and removes a custom view", () => {
    const store = new DocumentStore(baseState());
    store.dispatch({ type: "view.add", view: custom });
    expect(store.getState().views).toHaveLength(1);
    store.dispatch({ type: "view.update", id: "v1", patch: { name: "Aerial view" } });
    expect(store.getState().views[0].name).toBe("Aerial view");
    store.dispatch({ type: "view.remove", id: "v1" });
    expect(store.getState().views).toHaveLength(0);
  });

  it("duplicates a custom view with a new id", () => {
    const store = new DocumentStore(baseState());
    store.dispatch({ type: "view.add", view: custom });
    store.dispatch({ type: "view.duplicate", id: "v1" });
    const views = store.getState().views;
    expect(views).toHaveLength(2);
    expect(views[1].id).not.toBe("v1");
    expect(views[1].name).toBe("Aerial copy");
  });

  it("writes system-view changes as overrides, not into views[]", () => {
    const store = new DocumentStore(baseState());
    store.dispatch({ type: "view.setOverride", id: "sys:3d:default", patch: { name: "Studio 3D" } });
    expect(store.getState().views).toHaveLength(0);
    expect(store.getState().viewOverrides["sys:3d:default"].name).toBe("Studio 3D");
    store.dispatch({ type: "view.update", id: "sys:3d:default", patch: { layers: { grid: false } } });
    expect(store.getState().viewOverrides["sys:3d:default"].layers?.grid).toBe(false);
  });

  it("undoes a view change", () => {
    const store = new DocumentStore(baseState());
    store.dispatch({ type: "view.add", view: custom });
    store.undo();
    expect(store.getState().views).toHaveLength(0);
  });

  it("normalizes old branch state on deserialize (missing views field)", () => {
    const store = new DocumentStore(baseState());
    const data = store.serialize();
    delete (data.branches[0].state as unknown as Record<string, unknown>).views;
    const restored = DocumentStore.deserialize(data);
    expect(restored.getState().views).toEqual([]);
  });
});

describe("serialization", () => {  it("round-trips branches and op logs", () => {
    const store = new DocumentStore(baseState());
    store.dispatch({ type: "mass.add", mass: mass("m1", 0) });
    store.dispatch({ type: "decision.add", decision: decision("d1") });
    store.createBranch({ name: "B", decisionId: "d1" });

    const restored = DocumentStore.deserialize(store.serialize());
    expect(restored.listBranches()).toHaveLength(2);
    expect(restored.getState(restored.mainBranchId).masses).toHaveLength(1);
  });
});
