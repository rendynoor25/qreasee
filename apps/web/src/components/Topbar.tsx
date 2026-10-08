import { useState } from "react";
import { makeTranslator, type Lens } from "@qreasee/shared";
import { useApp } from "../state/store";
import { Button, IconButton } from "./ui";
import { LogoMark } from "./Logo";
import {
  DecisionIcon,
  ExportIcon,
  GlobeIcon,
  GridIcon,
  InfoIcon,
  LayersIcon,
  MapIcon,
  MoonIcon,
  RedoIcon,
  StackIcon,
  SunIcon,
  UndoIcon,
} from "./icons";

export function Topbar() {
  const lang = useApp((s) => s.lang);
  const tr = makeTranslator(lang);
  const lens = useApp((s) => s.lens);
  const setLens = useApp((s) => s.setLens);
  const panel = useApp((s) => s.panel);
  const setPanel = useApp((s) => s.setPanel);
  const project = useApp((s) => s.project);
  const updateProject = useApp((s) => s.updateProject);
  const sunView = useApp((s) => s.sunView);
  const toggleSunView = useApp((s) => s.toggleSunView);
  const showGrid = useApp((s) => s.showGrid);
  const toggleGrid = useApp((s) => s.toggleGrid);
  const undo = useApp((s) => s.undo);
  const redo = useApp((s) => s.redo);
  const loadSample = useApp((s) => s.loadSample);
  const setLang = useApp((s) => s.setLang);
  const theme = useApp((s) => s.theme);
  const toggleTheme = useApp((s) => s.toggleTheme);
  const setScreen = useApp((s) => s.setScreen);
  const studioKit = useApp((s) => s.studioKit);
  const branches = useApp((s) => s.branches);
  const activeBranchId = useApp((s) => s.activeBranchId);
  const switchBranch = useApp((s) => s.switchBranch);
  const forkBranch = useApp((s) => s.forkBranch);
  const activeBranchName =
    branches.find((b) => b.id === activeBranchId)?.name ?? tr("branch.main");
  const [menu, setMenu] = useState(false);

  const lenses: Array<{ id: Lens; key: string }> = [
    { id: "visual", key: "1" },
    { id: "rules", key: "2" },
    { id: "reflect", key: "3" },
  ];

  return (
    <header className="relative z-30 flex flex-wrap items-center gap-2 border-b border-ink-800 bg-ink-900/90 px-3 py-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setScreen("home")}
          title={tr("app.title")}
          className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-ink-800"
        >
          <LogoMark className="text-ink-100" />
          <span className="text-sm font-bold tracking-tight text-brand-400">Qreasee</span>
        </button>
        {studioKit.identity.logoUrl && (
          <img
            src={studioKit.identity.logoUrl}
            alt={studioKit.name}
            title={studioKit.name}
            className="h-6 max-w-[96px] object-contain"
          />
        )}
        <input
          value={project.name}
          onChange={(e) => updateProject({ name: e.target.value })}
          className="w-52 rounded-md border border-transparent bg-transparent px-2 py-1 text-xs text-ink-200 outline-none hover:border-ink-700 focus:border-lens-visual/60"
        />
      </div>

      <div className="ml-2 flex rounded-lg border border-ink-800 bg-ink-950/60 p-0.5">
        {lenses.map((l) => (
          <button
            key={l.id}
            onClick={() => setLens(l.id)}
            title={`${tr(`lens.${l.id}` as never)} (${l.key})`}
            className={
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] transition-colors " +
              (lens === l.id
                ? l.id === "visual"
                  ? "bg-lens-visual/15 text-lens-visual"
                  : l.id === "rules"
                    ? "bg-lens-rules/15 text-lens-rules"
                    : "bg-lens-reflect/15 text-lens-reflect"
                : "text-ink-400 hover:text-ink-100")
            }
          >
            {tr(`lens.${l.id}` as never)}
            <span className="text-[9px] text-ink-500">{l.key}</span>
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <IconButton title={tr("toolbar.undo")} onClick={undo}>
          <UndoIcon />
        </IconButton>
        <IconButton title={tr("toolbar.redo")} onClick={redo}>
          <RedoIcon />
        </IconButton>
        <span className="mx-1 h-5 w-px bg-ink-800" />
        <IconButton title={tr("toolbar.sun")} active={sunView} onClick={toggleSunView}>
          <SunIcon />
        </IconButton>
        <IconButton title={tr("toolbar.grid")} active={showGrid} onClick={toggleGrid}>
          <GridIcon />
        </IconButton>
        <span className="mx-1 h-5 w-px bg-ink-800" />
        <IconButton title={tr("site.title")} active={panel === "context"} onClick={() => setPanel("context")}>
          <LayersIcon />
        </IconButton>
        <IconButton title={tr("map.title")} active={panel === "map"} onClick={() => setPanel("map")}>
          <MapIcon />
        </IconButton>
        <IconButton title={tr("decisions.title")} active={panel === "decisions"} onClick={() => setPanel("decisions")}>
          <DecisionIcon />
        </IconButton>
        <IconButton title={tr("layers.title")} active={panel === "layers"} onClick={() => setPanel("layers")}>
          <StackIcon />
        </IconButton>
        <IconButton title={tr("export.title")} active={panel === "export"} onClick={() => setPanel("export")}>
          <ExportIcon />
        </IconButton>
        <IconButton title={tr("help.button")} active={panel === "help"} onClick={() => setPanel("help")}>
          <InfoIcon />
        </IconButton>
        <IconButton
          title={tr("shortcut.title")}
          active={panel === "shortcuts"}
          onClick={() => setPanel("shortcuts")}
        >
          <span className="text-[11px] font-semibold">⌘</span>
        </IconButton>
        <span className="mx-1 h-5 w-px bg-ink-800" />
        <div className="flex items-center gap-1.5 rounded-md border border-ink-800 bg-ink-950/50 px-2 py-1">
          <span className="text-[10px] uppercase tracking-wide text-ink-500">{tr("branch.label")}</span>
          <select
            value={activeBranchId}
            onChange={(e) => switchBranch(e.target.value)}
            className="max-w-[130px] bg-transparent text-[11px] text-ink-200 outline-none"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id} className="bg-ink-900">
                {b.name}
              </option>
            ))}
          </select>
          <button
            onClick={forkBranch}
            title={tr("branch.fork")}
            className="rounded border border-brand-400/50 px-1.5 py-0.5 text-[10px] font-medium text-brand-400 hover:bg-brand-400/10"
          >
            {tr("branch.fork")}
          </button>
        </div>
        <span className="mx-1 h-5 w-px bg-ink-800" />
        <IconButton title={tr("theme.toggle")} onClick={toggleTheme}>
          {theme === "dark" ? <MoonIcon /> : <SunIcon />}
        </IconButton>
        <span className="mx-1 h-5 w-px bg-ink-800" />
        <IconButton
          title={tr("common.language")}
          onClick={() => setLang(lang === "en" ? "id" : "en")}
        >
          <span className="flex items-center gap-1 text-[10px] font-semibold">
            <GlobeIcon width={14} height={14} />
            {lang.toUpperCase()}
          </span>
        </IconButton>

        <div className="relative">
          <Button variant="outline" size="sm" onClick={() => setMenu((v) => !v)}>
            {tr("project.title")} ▾
          </Button>
          {menu && (
            <div className="absolute right-0 top-9 z-40 w-44 rounded-lg border border-ink-700 bg-ink-900 p-1 shadow-panel qr-fade">
              <button
                className="block w-full rounded px-2 py-1.5 text-left text-xs text-ink-200 hover:bg-ink-800"
                onClick={() => {
                  setMenu(false);
                  setScreen("home");
                }}
              >
                {tr("project.new")}
              </button>
              <button
                className="block w-full rounded px-2 py-1.5 text-left text-xs text-ink-200 hover:bg-ink-800"
                onClick={() => {
                  setMenu(false);
                  loadSample();
                }}
              >
                {tr("common.trySample")}
              </button>
              <div className="my-1 h-px bg-ink-800" />
              <button
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-ink-200 hover:bg-ink-800"
                onClick={() => {
                  setMenu(false);
                  setPanel("studio");
                }}
              >
                <span
                  className="h-3 w-3 rounded-full border border-ink-600"
                  style={{ background: studioKit.identity.primaryColor }}
                />
                {tr("studio.menu")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
