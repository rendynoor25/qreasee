// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { resolveBindings, type Binding } from "@qreasee/shared";
import { resolveShortcut } from "../shortcuts";

const VALUE_ENTRY_TOOLS = new Set(["site", "polygon", "green", "rectangle", "circle", "arc", "offset"]);
const bindings = resolveBindings(undefined);

const ev = (key: string, mods: Partial<{ ctrl: boolean; meta: boolean; shift: boolean; alt: boolean; composing: boolean }> = {}) => ({
  key,
  ctrlKey: !!mods.ctrl,
  metaKey: !!mods.meta,
  shiftKey: !!mods.shift,
  altKey: !!mods.alt,
  isComposing: !!mods.composing,
});

const ctx = (over: Partial<Parameters<typeof resolveShortcut>[1]> = {}) => ({
  screen: "workspace",
  typingValue: false,
  tool: "select",
  recording: false,
  bindings,
  valueEntryTools: VALUE_ENTRY_TOOLS,
  ...over,
});

describe("resolveShortcut (LG-04 handler rules)", () => {
  it("resolves plain tool keys", () => {
    expect(resolveShortcut(ev("m"), ctx())).toBe("tool.move");
    expect(resolveShortcut(ev("r"), ctx())).toBe("tool.rotate");
    expect(resolveShortcut(ev("g"), ctx())).toBe("edit.group");
    expect(resolveShortcut(ev("1"), ctx())).toBe("lens.visual");
  });

  it("ignores everything while a typed value is being entered", () => {
    expect(resolveShortcut(ev("m"), ctx({ typingValue: true }))).toBeNull();
    expect(resolveShortcut(ev("1"), ctx({ typingValue: true }))).toBeNull();
  });

  it("never triggers lens/tool keys for digits while drawing", () => {
    expect(resolveShortcut(ev("3"), ctx({ tool: "rectangle" }))).toBeNull();
    expect(resolveShortcut(ev("5"), ctx({ tool: "rectangle" }))).toBeNull();
    expect(resolveShortcut(ev("."), ctx({ tool: "rectangle" }))).toBeNull();
    // Letters still work while drawing.
    expect(resolveShortcut(ev("m"), ctx({ tool: "rectangle" }))).toBe("tool.move");
  });

  it("is inert outside the workspace and while recording", () => {
    expect(resolveShortcut(ev("m"), ctx({ screen: "home" }))).toBeNull();
    expect(resolveShortcut(ev("m"), ctx({ recording: true }))).toBeNull();
  });

  it("ignores IME composition; Paint resolves now that a material library exists", () => {
    expect(resolveShortcut(ev("m", { composing: true }), ctx())).toBeNull();
    expect(resolveShortcut(ev("p"), ctx())).toBe("tool.paint");
  });

  it("matches modified bindings", () => {
    const undo: Binding = { key: "z", ctrlOrCmd: true, shift: false, alt: false };
    expect(resolveShortcut(ev("z", { ctrl: true }), ctx())).toBe("edit.undo");
    expect(resolveShortcut(ev("z", { meta: true, shift: true }), ctx())).toBe("edit.redo");
    expect(undo.ctrlOrCmd).toBe(true);
  });
});
