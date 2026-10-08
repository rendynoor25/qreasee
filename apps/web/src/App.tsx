import { useEffect } from "react";
import {
  ACTION_BY_ID,
  bindingToLabel,
  makeTranslator,
  type ActionId,
  type Branch,
  type DocState,
  type Translator,
} from "@qreasee/shared";
import { Viewport } from "./scene/Viewport";
import { Topbar } from "./components/Topbar";
import { Toolbar } from "./components/Toolbar";
import { IndicatorBar } from "./components/IndicatorBar";
import { ContextPanel } from "./components/Panels";
import { DecisionsPanel } from "./components/DecisionsPanel";
import { ReflectPanel } from "./components/ReflectPanel";
import { ExportPanel } from "./components/ExportPanel";
import { MapPanel } from "./components/MapPanel";
import { SchematicPanel } from "./components/SchematicPanel";
import { DrawingsPanel } from "./components/DrawingsPanel";
import { BriefPanel } from "./components/BriefPanel";
import { StudioPanel } from "./components/StudioPanel";
import { LayersPanel } from "./components/LayersPanel";
import { SheetEditor } from "./components/SheetEditor";
import { ConceptPlanEditor } from "./components/ConceptPlanEditor";
import { ShortcutsPanel } from "./components/ShortcutsPanel";
import { AreaDashboard } from "./components/AreaDashboard";
import { ProjectBrowser } from "./components/ProjectBrowser";
import { HomeScreen } from "./components/HomeScreen";
import { SiteWizard } from "./components/SiteWizard";
import { Button, Panel } from "./components/ui";
import { useApp } from "./state/store";
import { runAction, resolveShortcut, useShortcuts } from "./state/shortcuts";

/** Tools that read the keyboard for typed values — digits go to the value box. */
const VALUE_ENTRY_TOOLS = new Set(["site", "polygon", "green", "rectangle", "circle", "arc", "offset"]);

export function App() {
  const screen = useApp((s) => s.screen);
  const mode = useApp((s) => s.mode);
  const panel = useApp((s) => s.panel);
  const lens = useApp((s) => s.lens);
  const lang = useApp((s) => s.lang);
  const tr = makeTranslator(lang);
  const statusMessage = useApp((s) => s.statusMessage);
  const setStatus = useApp((s) => s.setStatus);
  const compareBranchIds = useApp((s) => s.compareBranchIds);
  const overlayCompare = useApp((s) => s.overlayCompare);
  const setPanel = useApp((s) => s.setPanel);
  const cheatsheetOpen = useApp((s) => s.cheatsheetOpen);
  const setCheatsheetOpen = useApp((s) => s.setCheatsheetOpen);
  const shortcuts = useShortcuts((s) => s.bindings);

  // LG-04: one keyboard handler for every shortcut. It reads the action registry;
  // value entry (typed dimensions) and text fields keep the keyboard for themselves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (typing) return;
      const s = useApp.getState();
      const sc = useShortcuts.getState();
      const id = resolveShortcut(e, {
        screen: s.screen,
        typingValue: s.typingValue,
        tool: s.tool,
        recording: !!sc.recording,
        bindings: sc.bindings,
        valueEntryTools: VALUE_ENTRY_TOOLS,
      });
      if (!id) return;
      if (e.repeat && id.startsWith("tool.")) return;
      e.preventDefault();
      runAction(id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatus(null), 3200);
    return () => clearTimeout(timer);
  }, [statusMessage, setStatus]);

  const comparing = compareBranchIds.length >= 2 && !overlayCompare;

  // A-01: start on the "What are you designing?" screen, not on a sample.
  if (screen === "home") return <HomeScreen />;
  // A-03: a skippable site wizard runs once, before the canvas.
  if (screen === "wizard") return <SiteWizard />;

  return (
    <div className="flex h-screen flex-col">
      <Topbar />
      <div className="flex min-h-0 flex-1">
        <Toolbar />
        <ProjectBrowser />
        <main className="relative min-w-0 flex-1">
          {mode === "sheets" ? (
            <SheetEditor />
          ) : mode === "concept" ? (
            <ConceptPlanEditor />
          ) : (
            <>
              <Viewport />
              <IndicatorBar />
              {mode === "brief" && <AreaDashboard />}
              {comparing && <CompareStrip />}
            </>
          )}
        </main>
        {panel && (
          <aside
            className={
              "relative z-20 shrink-0 overflow-y-auto border-l border-ink-800 bg-ink-900/70 p-3 " +
              (panel === "brief" ? "w-[360px]" : "w-[288px]")
            }
          >
            <button
              onClick={() => setPanel(null)}
              title="Collapse panel"
              className="absolute right-2 top-2 z-30 rounded-md border border-ink-700 bg-ink-900/90 px-1.5 py-0.5 text-[11px] text-ink-400 hover:text-ink-100"
            >
              »
            </button>
            <PanelSwitcher panel={panel} tr={tr} />
          </aside>
        )}
      </div>
      {statusMessage && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-lens-visual/40 bg-ink-900/95 px-4 py-2 text-xs text-ink-100 shadow-panel qr-fade">
          {statusMessage}
        </div>
      )}
      {lens === "visual" && panel === null && (
        <div className="pointer-events-none fixed bottom-2 left-1/2 z-10 -translate-x-1/2 text-[10px] text-ink-600">
          Qreasee · 1 Visual · 2 Rules · 3 Reflect
        </div>
      )}
      {cheatsheetOpen && <CheatSheet tr={tr} onClose={() => setCheatsheetOpen(false)} />}
    </div>
  );
}

/** LG-04: read-only cheat sheet of the current bindings ("?"). */
function CheatSheet({ tr, onClose }: { tr: Translator; onClose: () => void }) {
  const bindings = useShortcuts((s) => s.bindings);
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const groups: Array<{ id: string; key: string }> = [
    { id: "tools", key: "shortcut.category.tools" },
    { id: "edit", key: "shortcut.category.edit" },
    { id: "lens", key: "shortcut.category.lens" },
    { id: "view", key: "shortcut.category.view" },
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-ink-700 bg-ink-900 p-5 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-100">{tr("shortcut.cheatsheet")}</h2>
          <Button size="sm" variant="ghost" onClick={onClose}>
            {tr("common.close")}
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g.id}>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                {tr(g.key as never)}
              </div>
              <ul className="space-y-0.5">
                {Object.entries(bindings)
                  .filter(([id, binding]) => binding && ACTION_BY_ID[id as ActionId]?.category === g.id)
                  .map(([id, binding]) => (
                    <li key={id} className="flex items-center justify-between gap-3 text-[11px]">
                      <span className="text-ink-300">{tr(ACTION_BY_ID[id as ActionId].labelKey as never)}</span>
                      <span className="rounded border border-ink-700 px-1.5 font-mono text-[10px] text-ink-200">
                        {bindingToLabel(binding, isMac)}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PanelSwitcher({ panel, tr }: { panel: string; tr: Translator }) {
  switch (panel) {
    case "context":
      return <ContextPanel />;
    case "decisions":
      return <DecisionsPanel />;
    case "reflect":
      return <ReflectPanel />;
    case "map":
      return <MapPanel />;
    case "schematic":
      return <SchematicPanel />;
    case "drawings":
      return <DrawingsPanel />;
    case "brief":
      return <BriefPanel />;
    case "export":
      return <ExportPanel />;
    case "studio":
      return <StudioPanel />;
    case "layers":
      return <LayersPanel />;
    case "shortcuts":
      return <ShortcutsPanel />;
    case "help":
      return <HelpPanel tr={tr} />;
    default:
      return null;
  }
}

function HelpPanel({ tr }: { tr: Translator }) {
  return (
    <div className="space-y-3">
      <Panel title={tr("help.repro.title")}>
        <p className="mb-2 text-[11px] leading-relaxed text-ink-400">{tr("help.repro.intro")}</p>
        <ol className="list-decimal space-y-1.5 pl-4 text-[11px] leading-relaxed text-ink-300">
          {(["s1", "s2", "s3", "s4", "s5", "s6", "s7"] as const).map((s) => (
            <li key={s}>{tr(`help.repro.${s}` as never)}</li>
          ))}
        </ol>
      </Panel>
      <Panel title={tr("toolbar.feedback")}>
        <ol className="list-decimal space-y-1.5 pl-4 text-[11px] leading-relaxed text-ink-300">
          <li>Set up the site, rules and budget in the Context panel.</li>
          <li>Draw a footprint (Rectangle or Polygon), then push it up.</li>
          <li>Watch the indicator chips and the red breach tint.</li>
          <li>Create a decision, add branches, and compare them.</li>
          <li>Adopt a branch with a reason and export to SketchUp/AutoCAD.</li>
        </ol>
      </Panel>
      <Panel title="Shortcuts">
        <ul className="space-y-1 text-[11px] text-ink-300">
          <li><b>1 / 2 / 3</b> — Visual / Rules / Reflect lens</li>
          <li><b>Ctrl+Z / Ctrl+Shift+Z</b> — Undo / redo</li>
          <li><b>Delete</b> — Remove selected mass</li>
          <li><b>Esc</b> — Cancel drawing / select tool</li>
          <li><b>Type + Enter</b> — e.g. 3500 or 3.5m while drawing</li>
          <li><b>Middle-drag</b> orbit · <b>Shift+middle</b> pan · <b>wheel</b> zoom</li>
        </ul>
      </Panel>
      <Panel title="Honest by fidelity">
        <p className="text-[11px] leading-relaxed text-ink-400">
          At Massing fidelity, cost is always a range and indicators state their fidelity. Missing budget shows
          “needs input”, never an error. Rules are deterministic functions with unit tests; no AI touches the model.
        </p>
      </Panel>
    </div>
  );
}

function CompareStrip() {
  const lang = useApp((s) => s.lang);
  const tr = makeTranslator(lang);
  const branches = useApp((s) => s.branches).filter((b) => !b.main);
  const compareIds = useApp((s) => s.compareBranchIds);
  const doc = useApp((s) => s.doc);
  const switchBranch = useApp((s) => s.switchBranch);

  const items = compareIds
    .map((id) => {
      const b = doc.getBranch(id);
      return b ? { branch: b.branch, state: b.state } : null;
    })
    .filter((x): x is { branch: Branch; state: DocState } => !!x);

  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 flex max-w-[90%] -translate-x-1/2 gap-2 overflow-x-auto rounded-xl border border-ink-800 bg-ink-900/85 p-2 backdrop-blur">
      {items.map(({ branch, state }) => (
        <button
          key={branch.id}
          onClick={() => switchBranch(branch.id)}
          className="w-40 shrink-0 rounded-lg border border-ink-800 bg-ink-950/50 p-1.5 text-left hover:border-ink-600"
        >
          <div className="mb-1 flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: branch.color }} />
            <span className="truncate text-[11px] text-ink-200">{branch.name}</span>
          </div>
          <PlanThumb state={state} color={branch.color} />
        </button>
      ))}
      {items.length === 0 && (
        <span className="px-2 py-4 text-[11px] text-ink-500">
          {tr("decisions.none")} ({branches.length})
        </span>
      )}
    </div>
  );
}

function PlanThumb({ state, color }: { state: DocState; color: string }) {
  const pts = state.masses.flatMap((m) => m.footprint.outer);
  if (pts.length === 0) return <div className="flex h-24 items-center justify-center text-[10px] text-ink-600">empty</div>;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const w = 150;
  const h = 90;
  const scale = Math.min(w / (maxX - minX || 1), h / (maxY - minY || 1)) * 0.85;
  const ox = w / 2 - ((minX + maxX) / 2) * scale;
  const oy = h / 2 + ((minY + maxY) / 2) * scale;
  const path = (ring: { x: number; y: number }[]) =>
    ring.map((p, i) => `${i === 0 ? "M" : "L"}${(ox + p.x * scale).toFixed(1)},${(oy - p.y * scale).toFixed(1)}`).join(" ") + " Z";
  return (
    <svg width={w} height={h} className="rounded bg-ink-950/60">
      {state.masses.map((m) => (
        <path key={m.id} d={path(m.footprint.outer) + m.footprint.holes.map((ho) => " " + path(ho)).join(" ")} fill={`${color}22`} stroke={color} strokeWidth={1.2} fillRule="evenodd" />
      ))}
    </svg>
  );
}
