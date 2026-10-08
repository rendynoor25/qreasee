/**
 * LG-04: the keyboard-shortcut store (a personal UI preference — never in
 * DocState or the operation log) and the single `runAction` dispatcher that maps
 * a registry `ActionId` to app behaviour.
 */

import { create } from "zustand";
import {
  ACTION_BY_ID,
  findConflicts,
  matchBinding,
  normalizeEvent,
  parseShortcutStore,
  resolveBindings,
  serializeShortcutStore,
  SHORTCUTS_STORAGE_KEY,
  SHORTCUTS_VERSION,
  type ActionId,
  type Binding,
  type KeyEventLike,
  type ShortcutMap,
} from "@qreasee/shared";
import { useApp, type Tool } from "./store";

interface ShortcutState {
  bindings: Record<ActionId, Binding | null>;
  recording: ActionId | null;
  conflict: { id: ActionId; binding: Binding; others: ActionId[] } | null;
  startRecording: (id: ActionId | null) => void;
  /** Assign, or surface a conflict when another action already owns the key. */
  tryAssign: (id: ActionId, binding: Binding) => ActionId[];
  assignReplacing: (id: ActionId, binding: Binding, others: ActionId[]) => void;
  clear: (id: ActionId) => void;
  reset: (id: ActionId) => void;
  resetAll: () => void;
  exportJson: () => string;
  importJson: (raw: string) => boolean;
  dismiss: () => void;
}

let overrides: ShortcutMap = {};

function readStored(): ShortcutMap {
  try {
    if (typeof localStorage === "undefined") return {};
    return parseShortcutStore(localStorage.getItem(SHORTCUTS_STORAGE_KEY)).bindings;
  } catch {
    return {};
  }
}

function persist(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(
      SHORTCUTS_STORAGE_KEY,
      serializeShortcutStore({ version: SHORTCUTS_VERSION, bindings: overrides }),
    );
  } catch {
    // Quota / private mode: shortcuts simply are not persisted.
  }
}

overrides = readStored();

export const useShortcuts = create<ShortcutState>((set, get) => {
  const apply = (id: ActionId, binding: Binding | null) => {
    overrides = { ...overrides, [id]: binding };
    persist();
    set({ bindings: resolveBindings(overrides) });
  };

  return {
    bindings: resolveBindings(overrides),
    recording: null,
    conflict: null,
    startRecording: (recording) => set({ recording, conflict: null }),
    tryAssign: (id, binding) => {
      const others = findConflicts(get().bindings, id, binding);
      if (others.length > 0) {
        set({ conflict: { id, binding, others } });
        return others;
      }
      apply(id, binding);
      set({ conflict: null });
      return [];
    },
    assignReplacing: (id, binding, others) => {
      for (const other of others) apply(other, null);
      apply(id, binding);
      set({ conflict: null });
    },
    clear: (id) => {
      apply(id, null);
      set({ conflict: null });
    },
    reset: (id) => {
      overrides = { ...overrides };
      delete overrides[id];
      persist();
      set({ bindings: resolveBindings(overrides), conflict: null });
    },
    resetAll: () => {
      overrides = {};
      persist();
      set({ bindings: resolveBindings(overrides), conflict: null });
    },
    exportJson: () => serializeShortcutStore({ version: SHORTCUTS_VERSION, bindings: overrides }),
    importJson: (raw) => {
      try {
        const parsed = parseShortcutStore(raw);
        overrides = parsed.bindings;
        persist();
        set({ bindings: resolveBindings(overrides), conflict: null });
        return true;
      } catch {
        return false;
      }
    },
    dismiss: () => set({ conflict: null }),
  };
});

/** Resolve a keydown to an action, or null. Pure — used by the App handler and tests. */
export function resolveShortcut(
  e: KeyEventLike,
  ctx: {
    screen: string;
    typingValue: boolean;
    tool: string;
    recording: boolean;
    bindings: Record<ActionId, Binding | null>;
    valueEntryTools: ReadonlySet<string>;
  },
): ActionId | null {
  if (ctx.recording) return null;
  if (ctx.screen !== "workspace") return null;
  if (ctx.typingValue) return null;
  const binding = normalizeEvent(e);
  if (!binding) return null;
  const id = matchBinding(ctx.bindings, binding);
  if (!id) return null;
  if (ACTION_BY_ID[id].unavailable) return null;
  // Digits and separators while drawing belong to the value box.
  if (ctx.valueEntryTools.has(ctx.tool) && !binding.ctrlOrCmd && !binding.alt && /^[0-9.,]$/.test(binding.key)) {
    return null;
  }
  return id;
}

/** Execute an action. Document edits always go through existing operations. */
export function runAction(id: ActionId): void {
  const def = ACTION_BY_ID[id];
  if (!def || def.unavailable) return;
  const app = useApp.getState();

  if (id.startsWith("tool.")) {
    app.setTool(id.slice("tool.".length) as Tool);
    return;
  }

  switch (id) {
    case "lens.visual":
      app.setLens("visual");
      break;
    case "lens.rules":
      app.setLens("rules");
      break;
    case "lens.reflect":
      app.setLens("reflect");
      break;
    case "edit.undo":
      app.undo();
      break;
    case "edit.redo":
      app.redo();
      break;
    case "edit.delete":
      if (app.selectedRoomId) app.removeRoom(app.selectedRoomId);
      else if (app.selectedMassId) app.dispatch({ type: "mass.remove", id: app.selectedMassId });
      break;
    case "edit.cancel":
      app.setTool("select");
      break;
    case "edit.group":
      app.groupSelected();
      break;
    case "view.cheatsheet":
      app.setCheatsheetOpen(!app.cheatsheetOpen);
      break;
    case "view.shortcuts":
      app.setPanel("shortcuts");
      break;
    default:
      break;
  }
}
