/**
 * Document store. Owns branches, their append-only operation logs, undo/redo
 * and adoption (PRD section 7, Storage; 8.8 Decision Branches).
 *
 * Undo/redo and branches share one mechanism: each branch is a state derived
 * from an operation log, with a nearest snapshot (forkSnapshot) used for
 * adoption conflict detection.
 */

import {
  type Branch,
  type Decision,
  type DecisionRecord,
  type DocState,
  type Id,
  type Mass,
  type RejectedBranch,
  emptyDocState,
  newId,
  normalizeDocState,
} from "@qreasee/shared";
import { applyOperation, cloneState, type Operation } from "./operations";

export interface BranchData {
  id: Id;
  branch: Branch;
  state: DocState;
  opLog: Operation[];
  undo: DocState[];
  redo: DocState[];
  /** Mutation counter for indicator caching. */
  version: number;
  /** Main's state when this branch was forked, for conflict detection. */
  forkSnapshot: DocState;
  forkVersion: number;
}

export interface CreateBranchInput {
  name: string;
  color?: string;
  decisionId?: Id;
  fromBranchId?: Id;
  owner?: string;
}

export interface Conflict {
  massId: Id;
  main?: Mass;
  branch?: Mass;
}

export interface AdoptInput {
  branchId: Id;
  rationale: string;
  by: string;
  resolutions?: Record<Id, "main" | "branch">;
  buildRejected?: (branch: Branch, state: DocState) => RejectedBranch;
}

export type AdoptResult =
  | { ok: true; record: DecisionRecord }
  | { ok: false; conflicts: Conflict[] };

export const BRANCH_COLORS = [
  "#f0913b",
  "#5eead4",
  "#c084fc",
  "#34d399",
  "#f472b6",
  "#60a5fa",
  "#4ade80",
  "#fb923c",
];

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function scopeMassIds(
  decision: Decision | undefined,
  main: DocState,
  branch: DocState,
): Id[] {
  if (!decision || decision.scope.kind === "whole") {
    const ids = new Set<Id>();
    for (const m of main.masses) ids.add(m.id);
    for (const m of branch.masses) ids.add(m.id);
    return [...ids];
  }
  if (decision.scope.kind === "masses") {
    return [...decision.scope.massIds];
  }
  // level scope
  const levelId = decision.scope.levelId;
  const ids = new Set<Id>();
  for (const m of [...main.masses, ...branch.masses]) {
    if (m.levelIds.includes(levelId)) ids.add(m.id);
  }
  return [...ids];
}

export class DocumentStore {
  private branches = new Map<Id, BranchData>();
  private mainId: Id;
  private activeId: Id;
  private listeners = new Set<() => void>();
  private revision = 0;

  constructor(initialState: DocState = emptyDocState(), mainName = "Main") {
    const mainBranch: Branch = {
      id: newId("br"),
      name: mainName,
      color: "#e2e8f0",
      baseVersion: 0,
      owner: "",
      status: "exploring",
      main: true,
    };
    const state = cloneState(normalizeDocState(initialState));
    this.mainId = mainBranch.id;
    this.activeId = mainBranch.id;
    this.branches.set(mainBranch.id, {
      id: mainBranch.id,
      branch: mainBranch,
      state,
      opLog: [],
      undo: [],
      redo: [],
      version: 1,
      forkSnapshot: cloneState(state),
      forkVersion: 1,
    });
  }

  // --- reads -------------------------------------------------------------
  get mainBranchId(): Id {
    return this.mainId;
  }
  get activeBranchId(): Id {
    return this.activeId;
  }
  get active(): BranchData {
    const b = this.branches.get(this.activeId);
    if (!b) throw new Error("Active branch missing");
    return b;
  }
  get main(): BranchData {
    const b = this.branches.get(this.mainId);
    if (!b) throw new Error("Main branch missing");
    return b;
  }
  getState(branchId?: Id): DocState {
    const b = branchId ? this.branches.get(branchId) : this.active;
    if (!b) throw new Error("Branch missing");
    return b.state;
  }
  listBranches(): Branch[] {
    return [...this.branches.values()].map((b) => b.branch);
  }
  getBranch(id: Id): BranchData | undefined {
    return this.branches.get(id);
  }
  getOpLog(id?: Id): Operation[] {
    return (id ? this.branches.get(id) : this.active)?.opLog ?? [];
  }
  canUndo(branchId?: Id): boolean {
    const b = branchId ? this.branches.get(branchId) : this.active;
    return !!b && b.undo.length > 0;
  }
  canRedo(branchId?: Id): boolean {
    const b = branchId ? this.branches.get(branchId) : this.active;
    return !!b && b.redo.length > 0;
  }
  get revisionNumber(): number {
    return this.revision;
  }

  // --- subscriptions -----------------------------------------------------
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private notify() {
    this.revision += 1;
    for (const l of this.listeners) l();
  }

  // --- mutations ---------------------------------------------------------
  dispatch(op: Operation): void {
    this.dispatchOn(this.active, op);
    this.notify();
  }

  private dispatchOn(branch: BranchData, op: Operation): void {
    branch.undo.push(cloneState(branch.state));
    if (branch.undo.length > 200) branch.undo.shift();
    branch.redo = [];
    branch.state = applyOperation(branch.state, op);
    branch.opLog.push(op);
    branch.version += 1;
  }

  undo(): void {
    const b = this.active;
    const prev = b.undo.pop();
    if (!prev) return;
    b.redo.push(cloneState(b.state));
    b.state = prev;
    b.version += 1;
    this.notify();
  }

  redo(): void {
    const b = this.active;
    const next = b.redo.pop();
    if (!next) return;
    b.undo.push(cloneState(b.state));
    b.state = next;
    b.version += 1;
    this.notify();
  }

  switchBranch(id: Id): void {
    if (!this.branches.has(id)) return;
    this.activeId = id;
    this.notify();
  }

  createBranch(input: CreateBranchInput): Branch {
    const from = this.branches.get(input.fromBranchId ?? this.activeId) ?? this.main;
    const index = this.branches.size;
    const branch: Branch = {
      id: newId("br"),
      name: input.name,
      color: input.color ?? BRANCH_COLORS[index % BRANCH_COLORS.length],
      decisionId: input.decisionId,
      parentBranchId: from.branch.id,
      baseVersion: this.main.version,
      owner: input.owner ?? "",
      status: "exploring",
      main: false,
    };
    const state = cloneState(from.state);
    this.branches.set(branch.id, {
      id: branch.id,
      branch,
      state,
      opLog: [],
      undo: [],
      redo: [],
      version: 1,
      forkSnapshot: cloneState(this.main.state),
      forkVersion: this.main.version,
    });
    this.activeId = branch.id;
    this.notify();
    return branch;
  }

  setBranchStatus(id: Id, status: Branch["status"]): void {
    const b = this.branches.get(id);
    if (!b) return;
    b.branch = { ...b.branch, status };
    this.notify();
  }

  renameBranch(id: Id, name: string): void {
    const b = this.branches.get(id);
    if (!b) return;
    b.branch = { ...b.branch, name };
    this.notify();
  }

  parkBranch(id: Id): void {
    this.setBranchStatus(id, "parked");
  }

  /** DB-07: a parked branch can be revived as a new branch. */
  reviveBranch(parkedId: Id, name?: string): Branch | undefined {
    const parked = this.branches.get(parkedId);
    if (!parked) return undefined;
    const from = this.branches.get(this.activeId) ?? this.main;
    const branch: Branch = {
      id: newId("br"),
      name: name ?? `${parked.branch.name} (revived)`,
      color: parked.branch.color,
      decisionId: parked.branch.decisionId,
      parentBranchId: parked.id,
      baseVersion: this.main.version,
      owner: parked.branch.owner,
      status: "exploring",
      main: false,
    };
    // Build the revived branch's state by re-applying the parked op log on top
    // of the parked fork snapshot. This keeps a real operation lineage.
    let state = cloneState(parked.forkSnapshot);
    for (const op of parked.opLog) state = applyOperation(state, op);
    this.branches.set(branch.id, {
      id: branch.id,
      branch,
      state,
      opLog: [...parked.opLog],
      undo: [],
      redo: [],
      version: 1,
      forkSnapshot: cloneState(this.main.state),
      forkVersion: this.main.version,
    });
    this.activeId = branch.id;
    this.notify();
    return branch;
  }

  // --- adoption (DB-05, DB-06) ------------------------------------------
  adopt(input: AdoptInput): AdoptResult {
    const branch = this.branches.get(input.branchId);
    if (!branch) throw new Error("Branch missing");
    const main = this.main;
    const decision = branch.state.decisions.find(
      (d) => d.id === branch.branch.decisionId,
    );
    const ids = scopeMassIds(decision, main.state, branch.state);

    const findMass = (s: DocState, id: Id) => s.masses.find((m) => m.id === id);
    const conflicts: Conflict[] = [];
    for (const id of ids) {
      const m = findMass(main.state, id);
      const b = findMass(branch.state, id);
      const f = findMass(branch.forkSnapshot, id);
      if (!eq(m, f) && !eq(b, f) && !eq(m, b)) {
        conflicts.push({ massId: id, main: m, branch: b });
      }
    }
    if (conflicts.length > 0) {
      const unresolved = conflicts.filter(
        (c) => !input.resolutions || !input.resolutions[c.massId],
      );
      if (unresolved.length > 0) return { ok: false, conflicts };
    }

    // Build the operation list that brings main in line with the branch.
    const ops: Operation[] = [];
    for (const id of ids) {
      const m = findMass(main.state, id);
      const b = findMass(branch.state, id);
      const resolution = input.resolutions?.[id];
      if (resolution === "main") continue;
      if (b && !m) {
        ops.push({ type: "mass.add", mass: cloneState(b) });
      } else if (b && m && !eq(m, b)) {
        ops.push({ type: "mass.update", id, patch: cloneState(b) });
      } else if (!b && m) {
        ops.push({ type: "mass.remove", id });
      }
    }

    if (ops.length > 0) {
      main.undo.push(cloneState(main.state));
      for (const op of ops) {
        main.state = applyOperation(main.state, op);
        main.opLog.push(op);
      }
      main.version += 1;
    }

    branch.branch = { ...branch.branch, status: "adopted" };
    if (branch.branch.decisionId) {
      for (const other of this.branches.values()) {
        if (
          other.id !== branch.id &&
          other.branch.decisionId === branch.branch.decisionId &&
          other.branch.status !== "parked"
        ) {
          other.branch = { ...other.branch, status: "parked" };
        }
      }
    }

    const rejected: RejectedBranch[] = [...this.branches.values()]
      .filter(
        (b) =>
          b.id !== branch.id &&
          b.branch.decisionId === branch.branch.decisionId &&
          !b.branch.main,
      )
      .map((b) =>
        input.buildRejected
          ? input.buildRejected(b.branch, b.state)
          : { branchId: b.id, name: b.branch.name, color: b.branch.color, indicators: [] },
      );

    const record: DecisionRecord = {
      id: newId("rec"),
      decisionId: branch.branch.decisionId ?? "",
      chosenBranchId: branch.id,
      rationale: input.rationale,
      rejected,
      rulesSnapshot: cloneState(main.state.rules),
      budgetSnapshot: cloneState(main.state.budget),
      by: input.by,
      at: Date.now(),
    };
    main.state = { ...main.state, records: [...main.state.records, record] };
    if (branch.branch.decisionId) {
      main.state = {
        ...main.state,
        decisions: main.state.decisions.map((d) =>
          d.id === branch.branch.decisionId ? { ...d, status: "decided" } : d,
        ),
      };
    }
    main.version += 1;
    this.activeId = this.mainId;
    this.notify();
    return { ok: true, record };
  }

  // --- persistence -------------------------------------------------------
  serialize(): SerializedStore {
    return {
      version: 1,
      mainId: this.mainId,
      activeId: this.activeId,
      branches: [...this.branches.values()].map((b) => ({
        id: b.id,
        branch: b.branch,
        state: b.state,
        opLog: b.opLog,
        version: b.version,
        forkSnapshot: b.forkSnapshot,
        forkVersion: b.forkVersion,
      })),
    };
  }

  static deserialize(data: SerializedStore): DocumentStore {
    const store = new DocumentStore(emptyDocState());
    store.branches.clear();
    store.mainId = data.mainId;
    store.activeId = data.activeId;
    for (const b of data.branches) {
      store.branches.set(b.id, {
        id: b.id,
        branch: b.branch,
        state: normalizeDocState(b.state),
        opLog: b.opLog,
        undo: [],
        redo: [],
        version: b.version,
        forkSnapshot: b.forkSnapshot,
        forkVersion: b.forkVersion,
      });
    }
    if (!store.branches.has(store.mainId)) {
      throw new Error("Serialized store has no main branch");
    }
    return store;
  }
}

export interface SerializedBranch {
  id: Id;
  branch: Branch;
  state: DocState;
  opLog: Operation[];
  version: number;
  forkSnapshot: DocState;
  forkVersion: number;
}

export interface SerializedStore {
  version: 1;
  mainId: Id;
  activeId: Id;
  branches: SerializedBranch[];
}
