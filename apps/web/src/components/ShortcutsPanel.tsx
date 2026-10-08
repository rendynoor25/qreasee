import { useEffect, useState } from "react";
import {
  ACTIONS,
  ACTION_BY_ID,
  bindingToLabel,
  makeTranslator,
  normalizeEvent,
  validateBinding,
  type ActionId,
} from "@qreasee/shared";
import { useApp } from "../state/store";
import { useShortcuts } from "../state/shortcuts";
import { Button, Panel } from "./ui";
import { cn } from "../lib/utils";

const CATEGORIES: Array<{ id: string; key: string }> = [
  { id: "tools", key: "shortcut.category.tools" },
  { id: "edit", key: "shortcut.category.edit" },
  { id: "lens", key: "shortcut.category.lens" },
  { id: "view", key: "shortcut.category.view" },
];

function isMacPlatform(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

export function ShortcutsPanel() {
  const lang = useApp((s) => s.lang);
  const tr = makeTranslator(lang);
  const setStatus = useApp((s) => s.setStatus);
  const bindings = useShortcuts((s) => s.bindings);
  const recording = useShortcuts((s) => s.recording);
  const conflict = useShortcuts((s) => s.conflict);
  const startRecording = useShortcuts((s) => s.startRecording);
  const tryAssign = useShortcuts((s) => s.tryAssign);
  const assignReplacing = useShortcuts((s) => s.assignReplacing);
  const clear = useShortcuts((s) => s.clear);
  const reset = useShortcuts((s) => s.reset);
  const resetAll = useShortcuts((s) => s.resetAll);
  const exportJson = useShortcuts((s) => s.exportJson);
  const importJson = useShortcuts((s) => s.importJson);
  const dismiss = useShortcuts((s) => s.dismiss);
  const [error, setError] = useState<string | null>(null);

  const isMac = isMacPlatform();

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        startRecording(null);
        setError(null);
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        clear(recording);
        startRecording(null);
        setError(null);
        return;
      }
      const binding = normalizeEvent(e);
      if (!binding) return;
      const result = validateBinding(binding, isMac);
      if (!result.ok) {
        setError(result.reasonKey ?? "shortcut.reason.browser");
        return;
      }
      setError(null);
      const others = tryAssign(recording, binding);
      if (others.length === 0) startRecording(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording, isMac, clear, startRecording, tryAssign]);

  const onExport = () => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qreasee-shortcuts.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    const ok = importJson(await file.text());
    setStatus(ok ? tr("shortcut.imported") : tr("shortcut.importFailed"));
  };

  return (
    <div className="space-y-3">
      <Panel
        title={tr("shortcut.title")}
        actions={
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={onExport}>
              {tr("shortcut.export")}
            </Button>
            <label className="inline-flex cursor-pointer items-center rounded px-2 py-1 text-[11px] text-ink-300 hover:bg-ink-800">
              {tr("shortcut.import")}
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => void onImport(e.target.files?.[0])}
              />
            </label>
            <Button size="sm" variant="ghost" onClick={resetAll}>
              {tr("shortcut.resetAll")}
            </Button>
          </div>
        }
      >
        <p className="mb-2 text-[11px] leading-relaxed text-ink-500">{tr("shortcut.intro")}</p>
        {error && (
          <div className="mb-2 rounded border border-state-over/50 bg-state-over/10 px-2 py-1 text-[11px] text-state-over">
            {tr(error as never)}
          </div>
        )}

        {conflict && (
          <div className="mb-3 rounded border border-state-near/50 bg-state-near/10 p-2 text-[11px] text-ink-200">
            <div className="mb-1">
              {tr("shortcut.conflict", {
                key: bindingToLabel(conflict.binding, isMac),
                other: tr(ACTION_BY_ID[conflict.others[0]].labelKey as never),
              })}
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  assignReplacing(conflict.id, conflict.binding, conflict.others);
                  startRecording(null);
                }}
              >
                {tr("shortcut.replace")}
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>
                {tr("common.cancel")}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {CATEGORIES.map((cat) => (
            <div key={cat.id}>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                {tr(cat.key as never)}
              </div>
              <div className="space-y-0.5">
                {ACTIONS.filter((a) => a.category === cat.id).map((a) => {
                  const binding = bindings[a.id];
                  const isRecording = recording === a.id;
                  return (
                    <div
                      key={a.id}
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-2 py-1",
                        isRecording ? "border-lens-visual/70 bg-ink-800/60" : "border-ink-800",
                        a.unavailable && "opacity-60",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate text-[11px] text-ink-200">
                        {tr(a.labelKey as never)}
                      </span>
                      {a.unavailable && (
                        <span className="shrink-0 text-[10px] text-ink-500">
                          {tr((a.unavailableReasonKey ?? "shortcut.reason.unavailable") as never)}
                        </span>
                      )}
                      <button
                        disabled={a.unavailable}
                        onClick={() => {
                          setError(null);
                          startRecording(isRecording ? null : (a.id as ActionId));
                        }}
                        className={cn(
                          "min-w-[68px] shrink-0 rounded border px-2 py-0.5 text-center font-mono text-[10px]",
                          isRecording
                            ? "border-lens-visual text-lens-visual"
                            : binding
                              ? "border-ink-600 text-ink-100"
                              : "border-dashed border-ink-700 text-ink-500",
                        )}
                      >
                        {isRecording
                          ? tr("shortcut.pressKey")
                          : binding
                            ? bindingToLabel(binding, isMac)
                            : tr("shortcut.unassigned")}
                      </button>
                      <button
                        title={tr("shortcut.reset")}
                        disabled={a.unavailable}
                        onClick={() => reset(a.id)}
                        className="w-4 shrink-0 text-center text-[11px] text-ink-600 hover:text-ink-200 disabled:opacity-30"
                      >
                        ↺
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
