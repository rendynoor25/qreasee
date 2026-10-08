import { useMemo, useState } from "react";
import {
  allViews,
  DEFAULT_VIEW_ID,
  makeTranslator,
  type DocState,
  type View,
  type ViewKind,
} from "@qreasee/shared";
import { useApp } from "../state/store";
import { cn } from "../lib/utils";

function Thumb({ view, state }: { view: View; state: DocState }) {
  const pts = [
    ...state.rooms.flatMap((r) => r.polygon.outer),
    ...state.masses.flatMap((m) => m.footprint.outer),
    ...state.site.boundary,
  ];
  const glyph = () => {
    if (view.kind === "3d") {
      return (
        <path
          d="M28 8l14 8v12l-14 8-14-8V16z M28 8v12 M14 16l14 8 14-8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      );
    }
    if (view.kind === "section") {
      return <path d="M10 12h36M18 12v14h20V12M14 30h28" fill="none" stroke="currentColor" strokeWidth="1.4" />;
    }
    if (view.kind === "elevation") {
      return <path d="M12 28V16l16-8 16 8v12" fill="none" stroke="currentColor" strokeWidth="1.4" />;
    }
    // plan: draw site + rooms + masses, normalised
    if (pts.length < 3) return null;
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
    const s = Math.min(48 / (maxX - minX || 1), 28 / (maxY - minY || 1));
    const ox = 4 - minX * s;
    const oy = 32 + minY * s;
    const path = (ring: { x: number; y: number }[]) =>
      ring.map((p, i) => `${i === 0 ? "M" : "L"}${(ox + p.x * s).toFixed(1)},${(oy - p.y * s).toFixed(1)}`).join(" ") + " Z";
    return (
      <>
        {state.rooms.map((r) => (
          <path key={r.id} d={path(r.polygon.outer)} fill={r.color ?? "#9aa4b2"} fillOpacity="0.5" stroke="none" />
        ))}
        {state.site.boundary.length >= 3 && (
          <path d={path(state.site.boundary)} fill="none" stroke="currentColor" strokeWidth="1" />
        )}
      </>
    );
  };
  return (
    <svg width="22" height="14" viewBox="0 0 56 36" className="shrink-0 text-ink-400">
      {glyph()}
    </svg>
  );
}

const SECTIONS: Array<{ key: string; kinds: ViewKind[]; add?: ViewKind }> = [
  { key: "browser.plans", kinds: ["plan"], add: "plan" },
  { key: "browser.elevations", kinds: ["elevation"], add: "elevation" },
  { key: "browser.sections", kinds: ["section"], add: "section" },
  { key: "browser.3d", kinds: ["3d"], add: "3d" },
  { key: "browser.renders", kinds: ["render"] },
];

export function ProjectBrowser() {
  const lang = useApp((s) => s.lang);
  const tr = makeTranslator(lang);
  const project = useApp((s) => s.project);
  const state = useApp((s) => s.docState);
  const sectionLine = useApp((s) => s.sectionLine);
  const activeViewId = useApp((s) => s.activeViewId);
  const setActiveView = useApp((s) => s.setActiveView);
  const addView = useApp((s) => s.addView);
  const duplicateView = useApp((s) => s.duplicateView);
  const removeView = useApp((s) => s.removeView);
  const renameView = useApp((s) => s.renameView);
  const setViewLayer = useApp((s) => s.setViewLayer);
  const activeLevelId = useApp((s) => s.activeLevelId);
  const setActiveLevel = useApp((s) => s.setActiveLevel);
  const dispatch = useApp((s) => s.dispatch);

  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"views" | "stories">("views");
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const views = useMemo(
    () =>
      allViews({
        levels: state.levels.map((l) => ({ id: l.id, name: l.name })),
        siteBoundaryLength: state.site.boundary.length,
        hasSection: !!sectionLine,
        views: state.views,
        viewOverrides: state.viewOverrides,
      }),
    [state.levels, state.site.boundary.length, state.views, state.viewOverrides, sectionLine],
  );
  const activeView = views.find((v) => v.id === activeViewId) ?? views.find((v) => v.id === DEFAULT_VIEW_ID);

  if (!open) {
    return (
      <aside className="z-20 flex w-9 flex-col items-center border-r border-ink-800 bg-ink-900/80 py-2">
        <button
          onClick={() => setOpen(true)}
          title={tr("browser.views")}
          className="rounded-md border border-ink-700 px-1.5 py-1 text-ink-300 hover:border-ink-500"
        >
          »
        </button>
      </aside>
    );
  }

  return (
    <aside className="z-20 flex w-[176px] shrink-0 flex-col border-r border-ink-800 bg-ink-900/80">
      <div className="flex items-center gap-1 border-b border-ink-800 px-2 py-2">
        <span className="mr-auto truncate text-xs font-semibold text-ink-100" title={project.name}>
          {project.name}
        </span>
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          title={tr("browser.layers")}
          className="rounded px-1 text-ink-400 hover:text-ink-100"
        >
          ⚙
        </button>
        <button
          onClick={() => setOpen(false)}
          title={tr("browser.views")}
          className="rounded px-1 text-ink-400 hover:text-ink-100"
        >
          «
        </button>
      </div>

      {settingsOpen && activeView && (
        <div className="border-b border-ink-800 px-3 py-2 text-[11px]">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-ink-500">{tr("browser.layers")}</div>
          {(["grid", "context"] as const).map((key) => (
            <label key={key} className="flex items-center gap-2 text-ink-300">
              <input
                type="checkbox"
                checked={activeView.layers?.[key] ?? true}
                onChange={(e) => setViewLayer(activeView.id, key, e.target.checked)}
              />
              {tr(`browser.${key}` as never)}
            </label>
          ))}
        </div>
      )}

      <div className="flex gap-1 border-b border-ink-800 p-2">
        {(["views", "stories"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-md px-2 py-1 text-[11px]",
              tab === t ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:text-ink-100",
            )}
          >
            {tr(`browser.${t}` as never)}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {tab === "views" &&
          SECTIONS.map((section) => {
            const items = views.filter((v) => section.kinds.includes(v.kind));
            return (
              <div key={section.key} className="mb-2">
                <div className="mb-1 flex items-center gap-1">
                  <span className="mr-auto text-[10px] uppercase tracking-wide text-ink-500">
                    {tr(section.key as never)}
                  </span>
                  {section.add && (
                    <button
                      onClick={() => addView(section.add as ViewKind)}
                      title={tr("browser.add")}
                      className="rounded px-1 text-ink-500 hover:text-ink-100"
                    >
                      +
                    </button>
                  )}
                </div>
                {items.length === 0 && section.key === "browser.renders" && (
                  <p className="px-1 text-[10px] leading-snug text-ink-600">{tr("browser.noRenders")}</p>
                )}
                {items.map((v) => (
                  <div
                    key={v.id}
                    className={cn(
                      "group mb-0.5 flex items-center gap-1.5 rounded-md border px-1.5 py-1",
                      v.id === activeViewId ? "border-lens-visual/60 bg-lens-visual/10" : "border-transparent hover:border-ink-700",
                    )}
                  >
                    <button className="flex min-w-0 flex-1 items-center gap-1.5 text-left" onClick={() => setActiveView(v.id)}>
                      <Thumb view={v} state={state} />
                      {editing === v.id ? (
                        <input
                          autoFocus
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          onBlur={() => {
                            if (draftName.trim()) renameView(v.id, draftName.trim());
                            setEditing(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              if (draftName.trim()) renameView(v.id, draftName.trim());
                              setEditing(null);
                            }
                            if (e.key === "Escape") setEditing(null);
                          }}
                          className="min-w-0 flex-1 rounded border border-ink-600 bg-ink-950 px-1 text-[11px] text-ink-100 outline-none"
                        />
                      ) : (
                        <span className="truncate text-[11px] text-ink-200">{v.name}</span>
                      )}
                    </button>
                    {!v.system && editing !== v.id && (
                      <>
                        <button
                          title={tr("browser.rename")}
                          className="hidden px-0.5 text-ink-500 hover:text-ink-100 group-hover:block"
                          onClick={() => {
                            setEditing(v.id);
                            setDraftName(v.name);
                          }}
                        >
                          ✎
                        </button>
                        <button
                          title={tr("browser.delete")}
                          className="hidden px-0.5 text-ink-500 hover:text-state-over group-hover:block"
                          onClick={() => removeView(v.id)}
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            );
          })}

        {tab === "stories" && (
          <div>
            <div className="mb-1 flex items-center">
              <span className="mr-auto text-[10px] uppercase tracking-wide text-ink-500">{tr("browser.stories")}</span>
              <button
                title={tr("browser.add")}
                className="rounded px-1 text-ink-500 hover:text-ink-100"
                onClick={() => {
                  const last = state.levels[state.levels.length - 1];
                  dispatch({
                    type: "level.add",
                    level: {
                      id: `lvl_${Math.random().toString(36).slice(2, 8)}`,
                      name: `Lt. ${state.levels.length + 1}`,
                      elevation: (last?.elevation ?? 0) + (last?.floorToFloor ?? 3500),
                      floorToFloor: last?.floorToFloor ?? 3500,
                    },
                  });
                }}
              >
                +
              </button>
            </div>
            {state.levels.map((l) => (
              <button
                key={l.id}
                onClick={() => {
                  setActiveLevel(l.id);
                  const plan = views.find((v) => v.kind === "plan" && v.levelId === l.id);
                  if (plan) setActiveView(plan.id);
                }}
                className={cn(
                  "mb-0.5 flex w-full items-center justify-between rounded-md border px-2 py-1 text-left text-[11px]",
                  l.id === activeLevelId ? "border-lens-rules/60 bg-lens-rules/10" : "border-transparent hover:border-ink-700",
                )}
              >
                <span className="text-ink-200">{l.name}</span>
                <span className="font-mono text-[10px] text-ink-500">+{(l.elevation / 1000).toFixed(2)} m</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
