import { describe, expect, it } from "vitest";
import {
  ACTIONS,
  ACTION_BY_ID,
  bindingToLabel,
  defaultBindings,
  findConflicts,
  matchBinding,
  normalizeEvent,
  parseShortcutStore,
  resolveBindings,
  RESERVED_BROWSER_BINDINGS,
  validateBinding,
  type Binding,
} from "../shortcuts";

const ev = (key: string, mods: Partial<{ ctrl: boolean; meta: boolean; shift: boolean; alt: boolean; composing: boolean }> = {}) => ({
  key,
  ctrlKey: !!mods.ctrl,
  metaKey: !!mods.meta,
  shiftKey: !!mods.shift,
  altKey: !!mods.alt,
  isComposing: !!mods.composing,
});

describe("normalizeEvent", () => {
  it("treats Ctrl and Cmd the same", () => {
    expect(normalizeEvent(ev("z", { ctrl: true }))).toEqual({ key: "z", ctrlOrCmd: true, shift: false, alt: false });
    expect(normalizeEvent(ev("z", { meta: true }))).toEqual({ key: "z", ctrlOrCmd: true, shift: false, alt: false });
  });

  it("normalizes space and lowercases keys", () => {
    expect(normalizeEvent(ev(" "))?.key).toBe("space");
    expect(normalizeEvent(ev("M"))?.key).toBe("m");
    expect(normalizeEvent(ev("Escape"))?.key).toBe("escape");
  });

  it("ignores IME composition and modifier-only keys", () => {
    expect(normalizeEvent(ev("a", { composing: true }))).toBeNull();
    expect(normalizeEvent(ev("Shift", { shift: true }))).toBeNull();
    expect(normalizeEvent(ev("Control", { ctrl: true }))).toBeNull();
  });
});

describe("matchBinding and labels", () => {
  const bindings = resolveBindings(undefined);

  it("matches the action for a binding", () => {
    expect(matchBinding(bindings, { key: "m", ctrlOrCmd: false, shift: false, alt: false })).toBe("tool.move");
    expect(matchBinding(bindings, { key: "z", ctrlOrCmd: true, shift: false, alt: false })).toBe("edit.undo");
    expect(matchBinding(bindings, { key: "z", ctrlOrCmd: true, shift: true, alt: false })).toBe("edit.redo");
    expect(matchBinding(bindings, { key: "q", ctrlOrCmd: false, shift: false, alt: false })).toBeNull();
  });

  it("labels bindings for Mac and Windows", () => {
    const undo: Binding = { key: "z", ctrlOrCmd: true, shift: false, alt: false };
    const redo: Binding = { key: "z", ctrlOrCmd: true, shift: true, alt: false };
    expect(bindingToLabel(undo, false)).toBe("Ctrl+Z");
    expect(bindingToLabel(redo, false)).toBe("Ctrl+Shift+Z");
    expect(bindingToLabel(undo, true)).toBe("⌘Z");
    expect(bindingToLabel(redo, true)).toBe("⌘⇧Z");
    expect(bindingToLabel({ key: "m", ctrlOrCmd: false, shift: false, alt: false }, true)).toBe("M");
    expect(bindingToLabel({ key: "space", ctrlOrCmd: false, shift: false, alt: false }, false)).toBe("Space");
  });
});

describe("conflicts and Replace", () => {
  it("finds the action that already owns a key", () => {
    const bindings = resolveBindings(undefined);
    const conflicts = findConflicts(bindings, "tool.move", { key: "r", ctrlOrCmd: false, shift: false, alt: false });
    expect(conflicts).toEqual(["tool.rotate"]);
  });

  it("Replace unassigns the other action and assigns the new one", () => {
    const overrides = { "tool.rotate": null, "tool.move": { key: "r", ctrlOrCmd: false, shift: false, alt: false } };
    const bindings = resolveBindings(overrides);
    expect(bindings["tool.rotate"]).toBeNull();
    expect(bindings["tool.move"]).toEqual({ key: "r", ctrlOrCmd: false, shift: false, alt: false });
  });
});

describe("validateBinding — browser safety", () => {
  it("accepts plain letters", () => {
    for (const key of ["m", "r", "c", "t", "e", "p", "g", "x"]) {
      expect(validateBinding({ key, ctrlOrCmd: false, shift: false, alt: false }, false).ok).toBe(true);
    }
  });

  it("rejects every reserved browser binding", () => {
    for (const r of RESERVED_BROWSER_BINDINGS) {
      const res = validateBinding(r, false);
      expect(res.ok, `${JSON.stringify(r)} should be rejected`).toBe(false);
      expect(res.reason).toBe("browser");
    }
  });

  it("allows Ctrl/Cmd+letter when it is not reserved (e.g. Ctrl+C copy)", () => {
    expect(validateBinding({ key: "c", ctrlOrCmd: true, shift: false, alt: false }, false).ok).toBe(true);
    expect(validateBinding({ key: "i", ctrlOrCmd: true, shift: false, alt: false }, false).ok).toBe(true);
  });

  it("accepts Ctrl/Cmd+Shift+letter and Ctrl/Cmd+digit", () => {
    expect(validateBinding({ key: "u", ctrlOrCmd: true, shift: true, alt: false }, false).ok).toBe(true);
    expect(validateBinding({ key: "4", ctrlOrCmd: true, shift: false, alt: false }, false).ok).toBe(true);
  });

  it("rejects Alt+letter on macOS only", () => {
    const alt = { key: "m", ctrlOrCmd: false, shift: false, alt: true };
    expect(validateBinding(alt, true).reason).toBe("altMac");
    expect(validateBinding(alt, false).ok).toBe(true);
  });
});

describe("registry", () => {
  it("has no duplicate default bindings", () => {
    const seen = new Map<string, string>();
    for (const a of ACTIONS) {
      if (!a.defaultBinding) continue;
      const k = JSON.stringify(a.defaultBinding);
      expect(seen.has(k), `${a.id} collides with ${seen.get(k)}`).toBe(false);
      seen.set(k, a.id);
    }
  });

  it("keeps the owner's requested defaults", () => {
    expect(ACTION_BY_ID["tool.move"].defaultBinding?.key).toBe("m");
    expect(ACTION_BY_ID["tool.rotate"].defaultBinding?.key).toBe("r");
    expect(ACTION_BY_ID["tool.copy"].defaultBinding?.key).toBe("c");
    expect(ACTION_BY_ID["tool.tape"].defaultBinding?.key).toBe("t");
    expect(ACTION_BY_ID["tool.eraser"].defaultBinding?.key).toBe("e");
    expect(ACTION_BY_ID["tool.paint"].defaultBinding?.key).toBe("p");
    expect(ACTION_BY_ID["edit.group"].defaultBinding?.key).toBe("g");
  });

  it("has an available Paint action now that a material library exists", () => {
    expect(ACTION_BY_ID["tool.paint"].unavailable).toBeFalsy();
    expect(ACTION_BY_ID["tool.paint"].defaultBinding?.key).toBe("p");
  });
});

describe("parseShortcutStore", () => {
  it("returns empty on corrupt or unknown data", () => {
    expect(parseShortcutStore(null).bindings).toEqual({});
    expect(parseShortcutStore("{not json").bindings).toEqual({});
    expect(parseShortcutStore(JSON.stringify({ version: 2, bindings: {} })).bindings).toEqual({});
    expect(parseShortcutStore(JSON.stringify({ version: 1, bindings: { nope: { key: "x", ctrlOrCmd: false, shift: false, alt: false } } })).bindings).toEqual({});
  });

  it("keeps valid overrides and explicit clears", () => {
    const raw = JSON.stringify({
      version: 1,
      bindings: {
        "tool.move": { key: "x", ctrlOrCmd: false, shift: false, alt: false },
        "tool.rotate": null,
      },
    });
    const parsed = parseShortcutStore(raw);
    expect(parsed.bindings["tool.move"]).toEqual({ key: "x", ctrlOrCmd: false, shift: false, alt: false });
    expect(parsed.bindings["tool.rotate"]).toBeNull();
  });

  it("resolveBindings applies overrides over defaults", () => {
    const bindings = resolveBindings({ "tool.move": { key: "x", ctrlOrCmd: false, shift: false, alt: false } });
    expect(bindings["tool.move"]?.key).toBe("x");
    expect(bindings["tool.rotate"]?.key).toBe("r");
    expect(Object.keys(defaultBindings()).length).toBeGreaterThan(5);
  });
});
