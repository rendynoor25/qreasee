/**
 * LG-04 — keyboard shortcuts. Single source of truth for actions, their default
 * bindings and the browser-reserved combinations. Pure: no React, no DOM, no
 * three. The web layer maps an `ActionId` to behaviour and stores user overrides
 * in `localStorage` (a personal preference, never in DocState or the op log).
 *
 * NOTE: `RESERVED_BROWSER_BINDINGS` reflects Chrome/Safari behaviour at the time
 * of writing. It is **not** claimed to be complete and must be re-checked against
 * current browser docs when the remap UI ships to users.
 */

import { z } from "zod";

export type ActionCategory = "tools" | "edit" | "view" | "lens";
export type ActionScope = "workspace" | "global";

export interface Binding {
  /** Lowercased `KeyboardEvent.key`; " " is stored as "space". */
  key: string;
  ctrlOrCmd: boolean;
  shift: boolean;
  alt: boolean;
}

export interface ActionDef {
  id: ActionId;
  /** i18n key for the human label. */
  labelKey: string;
  category: ActionCategory;
  scope: ActionScope;
  defaultBinding?: Binding;
  /** Tool not built yet — shown greyed out with `unavailableReasonKey`. */
  unavailable?: boolean;
  unavailableReasonKey?: string;
}

export type ActionId =
  | "tool.select"
  | "tool.move"
  | "tool.rectangle"
  | "tool.polygon"
  | "tool.circle"
  | "tool.ellipse"
  | "tool.arc"
  | "tool.pushpull"
  | "tool.offset"
  | "tool.rotate"
  | "tool.copy"
  | "tool.tape"
  | "tool.eraser"
  | "tool.paint"
  | "tool.wall"
  | "tool.room"
  | "tool.door"
  | "tool.window"
  | "tool.stair"
  | "tool.roof"
  | "tool.railing"
  | "tool.section"
  | "tool.pan"
  | "tool.site"
  | "tool.green"
  | "tool.road"
  | "tool.vertex"
  | "edit.undo"
  | "edit.redo"
  | "edit.delete"
  | "edit.cancel"
  | "edit.group"
  | "lens.visual"
  | "lens.rules"
  | "lens.reflect"
  | "view.cheatsheet"
  | "view.shortcuts";

const b = (key: string, mods: Partial<Omit<Binding, "key">> = {}): Binding => ({
  key,
  ctrlOrCmd: mods.ctrlOrCmd ?? false,
  shift: mods.shift ?? false,
  alt: mods.alt ?? false,
});

export const ACTIONS: ActionDef[] = [
  // Owner-requested tool defaults (do not change).
  { id: "tool.move", labelKey: "shortcut.action.move", category: "tools", scope: "workspace", defaultBinding: b("m") },
  { id: "tool.rotate", labelKey: "shortcut.action.rotate", category: "tools", scope: "workspace", defaultBinding: b("r") },
  { id: "tool.copy", labelKey: "shortcut.action.copy", category: "tools", scope: "workspace", defaultBinding: b("c") },
  { id: "tool.tape", labelKey: "shortcut.action.tape", category: "tools", scope: "workspace", defaultBinding: b("t") },
  { id: "tool.eraser", labelKey: "shortcut.action.eraser", category: "tools", scope: "workspace", defaultBinding: b("e") },
  {
    id: "tool.paint",
    labelKey: "shortcut.action.paint",
    category: "tools",
    scope: "workspace",
    defaultBinding: b("p"),
  },
  { id: "edit.group", labelKey: "shortcut.action.group", category: "edit", scope: "workspace", defaultBinding: b("g") },
  // Proposed defaults for the tools the owner's list collides with (confirm).
  { id: "tool.select", labelKey: "shortcut.action.select", category: "tools", scope: "workspace", defaultBinding: b("space") },
  { id: "tool.rectangle", labelKey: "shortcut.action.rectangle", category: "tools", scope: "workspace", defaultBinding: b("b") },
  { id: "tool.polygon", labelKey: "shortcut.action.polygon", category: "tools", scope: "workspace", defaultBinding: b("l") },
  { id: "tool.circle", labelKey: "shortcut.action.circle", category: "tools", scope: "workspace", defaultBinding: b("o") },
  { id: "tool.arc", labelKey: "shortcut.action.arc", category: "tools", scope: "workspace", defaultBinding: b("a") },
  { id: "tool.pushpull", labelKey: "shortcut.action.pushpull", category: "tools", scope: "workspace", defaultBinding: b("h") },
  { id: "tool.offset", labelKey: "shortcut.action.offset", category: "tools", scope: "workspace", defaultBinding: b("f") },
  // Other tools (remappable; no default so they never collide).
  { id: "tool.ellipse", labelKey: "shortcut.action.ellipse", category: "tools", scope: "workspace" },
  { id: "tool.vertex", labelKey: "shortcut.action.vertex", category: "tools", scope: "workspace" },
  { id: "tool.wall", labelKey: "shortcut.action.wall", category: "tools", scope: "workspace" },
  { id: "tool.room", labelKey: "shortcut.action.room", category: "tools", scope: "workspace" },
  { id: "tool.door", labelKey: "shortcut.action.door", category: "tools", scope: "workspace" },
  { id: "tool.window", labelKey: "shortcut.action.window", category: "tools", scope: "workspace" },
  { id: "tool.stair", labelKey: "shortcut.action.stair", category: "tools", scope: "workspace" },
  { id: "tool.roof", labelKey: "shortcut.action.roof", category: "tools", scope: "workspace" },
  { id: "tool.railing", labelKey: "shortcut.action.railing", category: "tools", scope: "workspace" },
  { id: "tool.section", labelKey: "shortcut.action.section", category: "tools", scope: "workspace" },
  { id: "tool.pan", labelKey: "shortcut.action.pan", category: "tools", scope: "workspace" },
  { id: "tool.site", labelKey: "shortcut.action.site", category: "tools", scope: "workspace" },
  { id: "tool.green", labelKey: "shortcut.action.green", category: "tools", scope: "workspace" },
  { id: "tool.road", labelKey: "shortcut.action.road", category: "tools", scope: "workspace" },
  // Existing keys to keep.
  { id: "lens.visual", labelKey: "shortcut.action.lensVisual", category: "lens", scope: "workspace", defaultBinding: b("1") },
  { id: "lens.rules", labelKey: "shortcut.action.lensRules", category: "lens", scope: "workspace", defaultBinding: b("2") },
  { id: "lens.reflect", labelKey: "shortcut.action.lensReflect", category: "lens", scope: "workspace", defaultBinding: b("3") },
  { id: "edit.undo", labelKey: "shortcut.action.undo", category: "edit", scope: "global", defaultBinding: b("z", { ctrlOrCmd: true }) },
  { id: "edit.redo", labelKey: "shortcut.action.redo", category: "edit", scope: "global", defaultBinding: b("z", { ctrlOrCmd: true, shift: true }) },
  { id: "edit.delete", labelKey: "shortcut.action.delete", category: "edit", scope: "workspace", defaultBinding: b("delete") },
  { id: "edit.cancel", labelKey: "shortcut.action.cancel", category: "edit", scope: "workspace", defaultBinding: b("escape") },
  { id: "view.cheatsheet", labelKey: "shortcut.action.cheatsheet", category: "view", scope: "global", defaultBinding: b("?", { shift: true }) },
  { id: "view.shortcuts", labelKey: "shortcut.action.shortcuts", category: "view", scope: "global" },
];

export const ACTION_BY_ID: Record<ActionId, ActionDef> = Object.fromEntries(
  ACTIONS.map((a) => [a.id, a]),
) as Record<ActionId, ActionDef>;

/** A user's bindings: `null` means the action was explicitly cleared. */
export type ShortcutMap = Partial<Record<ActionId, Binding | null>>;

export function defaultBindings(): ShortcutMap {
  const out: ShortcutMap = {};
  for (const a of ACTIONS) if (a.defaultBinding) out[a.id] = a.defaultBinding;
  return out;
}

/** Resolve the effective binding for every action (overrides win). */
export function resolveBindings(overrides: ShortcutMap | undefined): Record<ActionId, Binding | null> {
  const out = {} as Record<ActionId, Binding | null>;
  for (const a of ACTIONS) {
    out[a.id] = overrides && a.id in overrides ? (overrides[a.id] ?? null) : (a.defaultBinding ?? null);
  }
  return out;
}

export interface KeyEventLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  isComposing?: boolean;
}

export function normalizeKey(key: string): string | null {
  if (key === " ") return "space";
  if (key.length === 0) return null;
  return key.toLowerCase();
}

/** Normalize a keydown event; null while composing or for modifier-only keys. */
export function normalizeEvent(e: KeyEventLike): Binding | null {
  if (e.isComposing) return null;
  const key = normalizeKey(e.key);
  if (!key) return null;
  if (["control", "meta", "shift", "alt", "capslock", "os"].includes(key)) return null;
  return { key, ctrlOrCmd: e.ctrlKey || e.metaKey, shift: e.shiftKey, alt: e.altKey };
}

export function bindingsEqual(a: Binding | null, c: Binding | null): boolean {
  if (!a || !c) return a === c;
  return a.key === c.key && a.ctrlOrCmd === c.ctrlOrCmd && a.shift === c.shift && a.alt === c.alt;
}

/** The action whose binding equals `b`, or null. */
export function matchBinding(
  bindings: Record<ActionId, Binding | null>,
  b: Binding,
): ActionId | null {
  for (const a of ACTIONS) {
    if (bindingsEqual(bindings[a.id], b)) return a.id;
  }
  return null;
}

/** Every other action currently bound to `b`. */
export function findConflicts(
  bindings: Record<ActionId, Binding | null>,
  id: ActionId,
  b: Binding,
): ActionId[] {
  return ACTIONS.filter((a) => a.id !== id && bindingsEqual(bindings[a.id], b)).map((a) => a.id);
}

const MAC_SYMBOLS: Record<string, string> = {
  space: "Space",
  escape: "Esc",
  delete: "Del",
  backspace: "⌫",
  enter: "↵",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  tab: "⇥",
};

function keyLabel(key: string): string {
  if (MAC_SYMBOLS[key]) return MAC_SYMBOLS[key];
  if (key.length === 1) return key.toUpperCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** Human label: "M", "Shift+B", "⌘⇧Z" (Mac) or "Ctrl+Shift+Z". */
export function bindingToLabel(binding: Binding | null, isMac: boolean): string {
  if (!binding) return "";
  const parts: string[] = [];
  if (binding.ctrlOrCmd) parts.push(isMac ? "⌘" : "Ctrl");
  if (binding.alt) parts.push(isMac ? "⌥" : "Alt");
  if (binding.shift) parts.push(isMac ? "⇧" : "Shift");
  parts.push(keyLabel(binding.key));
  if (isMac && (binding.ctrlOrCmd || binding.alt || binding.shift)) return parts.join("");
  return parts.join("+");
}

// --- browser / OS reserved combinations -----------------------------------

/**
 * Combinations a web page cannot safely own (Chrome/Safari). Re-check against
 * current browser docs — this list is a starting point, not a guarantee.
 */
export const RESERVED_BROWSER_BINDINGS: Binding[] = [
  ...["t", "n", "w", "q", "m", "h", "l", "d", "f", "r", "p", "s", "o", "u", "j", "k", "e", "g"].map(
    (k) => b(k, { ctrlOrCmd: true }),
  ),
  b("t", { ctrlOrCmd: true, shift: true }),
  b("n", { ctrlOrCmd: true, shift: true }),
  b("tab", { ctrlOrCmd: true }),
  b("pageup", { ctrlOrCmd: true }),
  b("pagedown", { ctrlOrCmd: true }),
  b("arrowleft", { alt: true }),
  b("arrowright", { alt: true }),
  ...Array.from({ length: 12 }, (_, i) => b(`f${i + 1}`)),
  b("space", { ctrlOrCmd: true }), // Cmd+Space (Spotlight)
  b("`", { ctrlOrCmd: true }),
];

export type BindingRejection = "browser" | "altMac" | "needsModifier" | "empty";

export interface ValidationResult {
  ok: boolean;
  reasonKey?: string;
  reason?: BindingRejection;
}

/**
 * Reject combinations the browser/OS owns. Allowed: a single key, Shift+key, and
 * Ctrl/Cmd+key (letter or digit) when not reserved — so e.g. Ctrl+C can be bound
 * to Copy. Alt+letter is rejected on macOS (Option types special characters).
 *
 * The built-in defaults are trusted and bypass this (so undo/redo stay valid).
 */
export function validateBinding(binding: Binding | null, isMac: boolean): ValidationResult {
  if (!binding || !binding.key) return { ok: false, reasonKey: "shortcut.reason.empty", reason: "empty" };

  if (RESERVED_BROWSER_BINDINGS.some((r) => bindingsEqual(r, binding))) {
    return { ok: false, reasonKey: "shortcut.reason.browser", reason: "browser" };
  }
  if (isMac && binding.alt && !binding.ctrlOrCmd) {
    return { ok: false, reasonKey: "shortcut.reason.altMac", reason: "altMac" };
  }
  return { ok: true };
}

// --- persistence (user overrides only) -------------------------------------

export const SHORTCUTS_STORAGE_KEY = "qreasee.shortcuts.v1";
export const SHORTCUTS_VERSION = 1;

export interface ShortcutStore {
  version: 1;
  bindings: ShortcutMap;
}

const bindingSchema = z.object({
  key: z.string().min(1),
  ctrlOrCmd: z.boolean(),
  shift: z.boolean(),
  alt: z.boolean(),
});
const storeSchema = z.object({
  version: z.literal(1),
  bindings: z.record(z.string(), bindingSchema.nullable()).optional(),
});

/** Parse stored overrides; corrupt or unknown data never throws (defaults). */
export function parseShortcutStore(raw: string | null): ShortcutStore {
  const empty: ShortcutStore = { version: SHORTCUTS_VERSION, bindings: {} };
  if (!raw) return empty;
  try {
    const parsed = storeSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return empty;
    const bindings: ShortcutMap = {};
    for (const [key, value] of Object.entries(parsed.data.bindings ?? {})) {
      if (key in ACTION_BY_ID) bindings[key as ActionId] = value ?? null;
    }
    return { version: SHORTCUTS_VERSION, bindings };
  } catch {
    return empty;
  }
}

export function serializeShortcutStore(store: ShortcutStore): string {
  return JSON.stringify({ version: SHORTCUTS_VERSION, bindings: store.bindings });
}
