import { useMemo, useState } from "react";
import {
  formatArea,
  makeTranslator,
  newId,
  type Fidelity,
} from "@qreasee/shared";
import { siteAreaMm2, massAreaMm2 } from "../lib/derive";
import { useApp } from "../state/store";
import { Button, Field, Panel, Select, TextArea, TextInput, Toggle } from "./ui";
import { TrashIcon } from "./icons";
import { indicatorValueText } from "../lib/indicatorFormat";

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function useTr() {
  const lang = useApp((s) => s.lang);
  return { lang, tr: makeTranslator(lang) };
}

function LengthField({
  label,
  valueMm,
  onChange,
  hint,
}: {
  label: string;
  valueMm: number | undefined;
  onChange: (mm: number | undefined) => void;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint ?? "m"}>
      <TextInput
        type="number"
        step="0.1"
        value={valueMm === undefined ? "" : (valueMm / 1000).toString()}
        placeholder="—"
        onChange={(e) => onChange(e.target.value === "" ? undefined : num(e.target.value) * 1000)}
      />
    </Field>
  );
}

export function ContextPanel() {
  const { tr } = useTr();
  const [tab, setTab] = useState("site");
  const selectedMassId = useApp((s) => s.selectedMassId);
  const tabs = [
    ["site", tr("site.title")],
    ["rules", tr("rules.title")],
    ["budget", tr("budget.title")],
    ["brief", tr("brief.title")],
    ["mass", tr("mass.title")],
    ["levels", tr("levels.title")],
    ["grid", tr("grid.title")],
  ] as const;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex flex-wrap gap-1">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={
              "rounded-md px-2 py-1 text-[11px] transition-colors " +
              (tab === id ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:text-ink-100")
            }
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {tab === "site" && <SitePanel />}
        {tab === "rules" && <RulesPanel />}
        {tab === "budget" && <BudgetPanel />}
        {tab === "brief" && <BriefPanel />}
        {tab === "mass" && <MassPanel keyId={selectedMassId} />}
        {tab === "levels" && <LevelsPanel />}
        {tab === "grid" && <GridPanel />}
        <IndicatorTable />
      </div>
    </div>
  );
}

function SitePanel() {
  const { lang, tr } = useTr();
  const project = useApp((s) => s.project);
  const updateProject = useApp((s) => s.updateProject);
  const state = useApp((s) => s.docState);
  const dispatch = useApp((s) => s.dispatch);
  const setTool = useApp((s) => s.setTool);

  return (
    <>
      <Panel title={tr("site.title")}>
        <div className="mb-3 flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setTool("site")}>
            {tr("site.draw")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => dispatch({ type: "site.setBoundary", points: [] })}
          >
            {tr("common.delete")}
          </Button>
        </div>
        <div className="mb-2 rounded-md bg-ink-950/50 px-2 py-1.5 text-[11px] text-ink-400">
          {tr("site.area")}: <span className="font-mono text-ink-100">{formatArea(siteAreaMm2(state), lang)}</span>
        </div>
        <Field label={tr("site.latitude")}>
          <TextInput
            type="number"
            step="0.001"
            value={project.location.lat}
            onChange={(e) => updateProject({ location: { ...project.location, lat: num(e.target.value) } })}
          />
        </Field>
        <Field label={tr("site.longitude")}>
          <TextInput
            type="number"
            step="0.001"
            value={project.location.lng}
            onChange={(e) => updateProject({ location: { ...project.location, lng: num(e.target.value) } })}
          />
        </Field>
        <Field label={tr("site.northAngle")} hint="deg cw">
          <TextInput
            type="number"
            step="1"
            value={project.northAngle}
            onChange={(e) => updateProject({ northAngle: num(e.target.value) })}
          />
        </Field>
      </Panel>
      <Panel title={tr("site.roadEdges")}>
        <p className="mb-2 text-[11px] text-ink-500">{tr("site.roadEdgeHint")}</p>
        <div className="flex flex-wrap gap-1">
          {state.site.boundary.map((_, i) => {
            const active = state.site.roadEdges.some((r) => r.edgeIndex === i);
            return (
              <button
                key={i}
                onClick={() => {
                  const roadEdges = active
                    ? state.site.roadEdges.filter((r) => r.edgeIndex !== i)
                    : [...state.site.roadEdges, { edgeIndex: i }];
                  dispatch({ type: "site.setRoadEdges", roadEdges });
                }}
                className={
                  "rounded border px-2 py-1 text-[11px] " +
                  (active ? "border-lens-reflect/60 text-lens-reflect" : "border-ink-700 text-ink-400")
                }
              >
                {tr("rules.setbackEdge", { n: i + 1 })}
              </button>
            );
          })}
        </div>
      </Panel>
      <OsmContextPanel />
    </>
  );
}

function OsmContextPanel() {
  const { tr } = useTr();
  const contextBuildings = useApp((s) => s.contextBuildings);
  const showContext = useApp((s) => s.showContext);
  const status = useApp((s) => s.contextStatus);
  const error = useApp((s) => s.contextError);
  const fetchContext = useApp((s) => s.fetchContext);
  const setShowContext = useApp((s) => s.setShowContext);
  const clearContext = useApp((s) => s.clearContext);

  return (
    <Panel title={tr("context.title")}>
      <p className="mb-2 text-[11px] text-ink-500">{tr("context.hint")}</p>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" disabled={status === "loading"} onClick={fetchContext}>
          {status === "loading" ? tr("context.loading") : tr("context.fetch")}
        </Button>
        {contextBuildings.length > 0 && (
          <>
            <Button size="sm" variant="ghost" onClick={() => setShowContext(!showContext)}>
              {showContext ? tr("context.hide") : tr("context.show")}
            </Button>
            <Button size="sm" variant="ghost" onClick={clearContext}>
              {tr("common.delete")}
            </Button>
          </>
        )}
      </div>
      <div className="mt-2 text-[11px]">
        {status === "error" && (
          <span className="text-state-over">
            {tr("context.error")}: {error}
          </span>
        )}
        {status === "done" && contextBuildings.length === 0 && (
          <span className="text-ink-500">{tr("context.empty")}</span>
        )}
        {contextBuildings.length > 0 && (
          <span className="text-ink-400">{tr("context.count", { n: contextBuildings.length })}</span>
        )}
      </div>
    </Panel>
  );
}

function RulesPanel() {
  const { tr } = useTr();
  const state = useApp((s) => s.docState);
  const dispatch = useApp((s) => s.dispatch);
  const rules = state.rules;
  const patch = (p: Partial<typeof rules>) => dispatch({ type: "rules.set", patch: p });

  return (
    <>
      <Panel title={tr("rules.title")}>
        <p className="mb-2 text-[11px] text-ink-500">{tr("rules.optionalHint")}</p>
        <Field label={tr("rules.kdbMax")} hint="%">
          <TextInput type="number" value={rules.kdbMax ?? ""} onChange={(e) => patch({ kdbMax: e.target.value === "" ? undefined : num(e.target.value) })} />
        </Field>
        <Field label={tr("rules.klbMax")} hint="ratio">
          <TextInput type="number" step="0.1" value={rules.klbMax ?? ""} onChange={(e) => patch({ klbMax: e.target.value === "" ? undefined : num(e.target.value) })} />
        </Field>
        <Field label={tr("rules.kdhMin")} hint="%">
          <TextInput type="number" value={rules.kdhMin ?? ""} onChange={(e) => patch({ kdhMin: e.target.value === "" ? undefined : num(e.target.value) })} />
        </Field>
        <LengthField label={tr("rules.heightMax")} valueMm={rules.heightMax} onChange={(v) => patch({ heightMax: v })} />
        <Field label={tr("rules.floorsMax")} hint="n">
          <TextInput type="number" value={rules.floorsMax ?? ""} onChange={(e) => patch({ floorsMax: e.target.value === "" ? undefined : num(e.target.value) })} />
        </Field>
        <Field label={tr("rules.sourceNote")}>
          <TextInput value={rules.sourceNote ?? ""} onChange={(e) => patch({ sourceNote: e.target.value })} />
        </Field>
      </Panel>
      <Panel title={tr("site.setbacks")}>
        {state.site.boundary.map((_, i) => (
          <LengthField
            key={i}
            label={tr("rules.setbackEdge", { n: i + 1 })}
            valueMm={rules.setbacks[i] ?? 0}
            onChange={(v) => dispatch({ type: "rules.setSetback", edgeIndex: i, value: v ?? 0 })}
          />
        ))}
        {state.site.boundary.length === 0 && <p className="text-[11px] text-ink-500">{tr("empty.noSite")}</p>}
      </Panel>
    </>
  );
}

function BudgetPanel() {
  const { tr } = useTr();
  const state = useApp((s) => s.docState);
  const dispatch = useApp((s) => s.dispatch);
  const budget = state.budget;
  const patch = (p: Partial<typeof budget>) => dispatch({ type: "budget.set", patch: p });

  return (
    <Panel title={tr("budget.title")}>
      <Field label={tr("budget.ceiling")} hint="Rp">
        <TextInput type="number" value={budget.ceiling ?? ""} onChange={(e) => patch({ ceiling: e.target.value === "" ? undefined : num(e.target.value) })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={tr("budget.rateLow")} hint="Rp/m²">
          <TextInput type="number" value={budget.ratePerM2?.low ?? ""} onChange={(e) => patch({ ratePerM2: { low: num(e.target.value), high: budget.ratePerM2?.high ?? 0 } })} />
        </Field>
        <Field label={tr("budget.rateHigh")} hint="Rp/m²">
          <TextInput type="number" value={budget.ratePerM2?.high ?? ""} onChange={(e) => patch({ ratePerM2: { low: budget.ratePerM2?.low ?? 0, high: num(e.target.value) } })} />
        </Field>
      </div>
    </Panel>
  );
}

function BriefPanel() {
  const { tr } = useTr();
  const state = useApp((s) => s.docState);
  const dispatch = useApp((s) => s.dispatch);
  return (
    <Panel title={tr("brief.title")}>
      <Field label={tr("brief.text")}>
        <TextArea value={state.brief.text} onChange={(e) => dispatch({ type: "brief.setText", text: e.target.value })} />
      </Field>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] text-ink-400">{tr("brief.program")}</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            dispatch({
              type: "brief.addProgram",
              item: { id: newId("prog"), name: tr("brief.spaceName"), targetArea: 50 },
            })
          }
        >
          {tr("brief.addItem")}
        </Button>
      </div>
      <div className="space-y-1.5">
        {state.brief.program.map((p) => (
          <div key={p.id} className="flex items-center gap-1.5">
            <TextInput
              value={p.name}
              onChange={(e) => dispatch({ type: "brief.updateProgram", id: p.id, patch: { name: e.target.value } })}
            />
            <TextInput
              type="number"
              className="w-20"
              value={p.targetArea}
              onChange={(e) => dispatch({ type: "brief.updateProgram", id: p.id, patch: { targetArea: num(e.target.value) } })}
            />
            <button
              className="text-ink-500 hover:text-state-over"
              onClick={() => dispatch({ type: "brief.removeProgram", id: p.id })}
            >
              <TrashIcon width={14} height={14} />
            </button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function MassPanel({ keyId }: { keyId: string | null }) {
  const { lang, tr } = useTr();
  const state = useApp((s) => s.docState);
  const dispatch = useApp((s) => s.dispatch);
  const mass = state.masses.find((m) => m.id === keyId);
  const project = useApp((s) => s.project);
  const [height, setHeight] = useState<number | null>(null);

  if (!mass) {
    return (
      <Panel title={tr("mass.title")}>
        <p className="text-[11px] text-ink-500">{tr("viewport.hint.select")}</p>
      </Panel>
    );
  }

  const patch = (p: Partial<typeof mass>) => dispatch({ type: "mass.update", id: mass.id, patch: p });

  return (
    <Panel
      title={tr("mass.selected")}
      actions={
        <button className="text-ink-500 hover:text-state-over" onClick={() => dispatch({ type: "mass.remove", id: mass.id })}>
          <TrashIcon width={14} height={14} />
        </button>
      }
    >
      <Field label={tr("mass.use")} hint={tr("common.optional")}>
        <Select value={mass.use ?? ""} onChange={(e) => patch({ use: e.target.value || undefined })}>
          <option value="">—</option>
          {state.brief.program.map((p) => (
            <option key={p.id} value={p.name}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={tr("mass.height")} hint="m">
        <TextInput
          type="number"
          step="0.1"
          value={(height ?? mass.height) / 1000}
          onChange={(e) => {
            const n = num(e.target.value) * 1000;
            setHeight(n);
            dispatch({ type: "mass.update", id: mass.id, patch: { height: n } });
          }}
        />
      </Field>
      <Field label={tr("mass.fidelity")}>
        <Select value={mass.fidelity} onChange={(e) => patch({ fidelity: e.target.value as Fidelity })}>
          <option value="intent">{tr("fidelity.intent")}</option>
          <option value="massing">{tr("fidelity.massing")}</option>
        </Select>
      </Field>
      {mass.fidelity === "intent" && (
        <div className="grid grid-cols-2 gap-2">
          <Field label={tr("mass.heightLow")} hint="m">
            <TextInput
              type="number"
              value={(mass.intent?.height?.low ?? mass.height) / 1000}
              onChange={(e) => patch({ intent: { ...mass.intent, height: { low: num(e.target.value) * 1000, high: mass.intent?.height?.high ?? mass.height } } })}
            />
          </Field>
          <Field label={tr("mass.heightHigh")} hint="m">
            <TextInput
              type="number"
              value={(mass.intent?.height?.high ?? mass.height) / 1000}
              onChange={(e) => patch({ intent: { ...mass.intent, height: { low: mass.intent?.height?.low ?? mass.height, high: num(e.target.value) * 1000 } } })}
            />
          </Field>
        </div>
      )}
      <div className="mb-2">
        <div className="mb-1 text-[11px] text-ink-400">{tr("mass.levels")}</div>
        <div className="flex flex-wrap gap-1">
          {state.levels.map((l) => {
            const active = mass.levelIds.includes(l.id);
            return (
              <button
                key={l.id}
                onClick={() => {
                  const levelIds = active
                    ? mass.levelIds.filter((id) => id !== l.id)
                    : [...mass.levelIds, l.id];
                  if (levelIds.length > 0) patch({ levelIds });
                }}
                className={
                  "rounded border px-2 py-1 text-[11px] " +
                  (active ? "border-lens-rules/60 text-lens-rules" : "border-ink-700 text-ink-400")
                }
              >
                {l.name}
              </button>
            );
          })}
        </div>
      </div>
      <div className="rounded-md bg-ink-950/50 px-2 py-1.5 text-[11px] text-ink-400">
        {tr("indicator.coverage")}: <span className="font-mono text-ink-100">{formatArea(massAreaMm2(mass), lang)}</span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="mt-2 w-full"
        onClick={() => useApp.getState().addLevelFromMass()}
      >
        {tr("mass.addLevelAbove")}
      </Button>
      <p className="mt-2 text-[10px] text-ink-500">{project.name}</p>
    </Panel>
  );
}

function LevelsPanel() {
  const { tr } = useTr();
  const state = useApp((s) => s.docState);
  const dispatch = useApp((s) => s.dispatch);
  const activeLevelId = useApp((s) => s.activeLevelId);
  const setActiveLevel = useApp((s) => s.setActiveLevel);

  return (
    <Panel
      title={tr("levels.title")}
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const last = state.levels[state.levels.length - 1];
            dispatch({
              type: "level.add",
              level: {
                id: newId("lvl"),
                name: `Lt. ${state.levels.length + 1}`,
                elevation: (last?.elevation ?? 0) + (last?.floorToFloor ?? 3500),
                floorToFloor: 3500,
              },
            });
          }}
        >
          {tr("levels.add")}
        </Button>
      }
    >
      <div className="space-y-2">
        {state.levels.map((l) => (
          <div key={l.id} className="rounded-md border border-ink-800 p-2">
            <div className="flex items-center gap-2">
              <TextInput value={l.name} onChange={(e) => dispatch({ type: "level.update", id: l.id, patch: { name: e.target.value } })} />
              <button
                className={"rounded px-2 py-1 text-[10px] " + (activeLevelId === l.id ? "bg-lens-rules/20 text-lens-rules" : "text-ink-500")}
                onClick={() => setActiveLevel(l.id)}
              >
                {tr("levels.active")}
              </button>
              <button className="text-ink-500 hover:text-state-over" onClick={() => dispatch({ type: "level.remove", id: l.id })}>
                <TrashIcon width={14} height={14} />
              </button>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <Field label={tr("levels.elevation")} hint="m">
                <TextInput type="number" step="0.1" value={l.elevation / 1000} onChange={(e) => dispatch({ type: "level.update", id: l.id, patch: { elevation: num(e.target.value) * 1000 } })} />
              </Field>
              <Field label={tr("levels.floorToFloor")} hint="m">
                <TextInput type="number" step="0.1" value={l.floorToFloor / 1000} onChange={(e) => dispatch({ type: "level.update", id: l.id, patch: { floorToFloor: num(e.target.value) * 1000 } })} />
              </Field>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function GridPanel() {
  const { tr } = useTr();
  const state = useApp((s) => s.docState);
  const dispatch = useApp((s) => s.dispatch);
  const xs = useMemo(() => state.grids.filter((g) => g.axis === "x").map((g) => g.offset), [state.grids]);
  const ys = useMemo(() => state.grids.filter((g) => g.axis === "y").map((g) => g.offset), [state.grids]);
  const [xText, setXText] = useState(spacings(xs));
  const [yText, setYText] = useState(spacings(ys));

  const apply = (axis: "x" | "y", text: string) => {
    const spacingsList = text
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    const offsets: number[] = [0];
    for (const s of spacingsList) offsets.push(offsets[offsets.length - 1] + s);
    const other = state.grids.filter((g) => g.axis !== axis);
    const lines = offsets.map((offset, i) => ({
      id: `${axis}${i}_${offset}`,
      axis,
      label: axis === "x" ? String(i + 1) : String.fromCharCode(65 + i),
      offset,
    }));
    dispatch({ type: "grid.set", lines: [...other, ...lines] });
  };

  return (
    <Panel title={tr("grid.title")}>
      <Field label={tr("grid.spacingX")}>
        <TextInput value={xText} onChange={(e) => setXText(e.target.value)} onBlur={() => apply("x", xText)} />
      </Field>
      <Field label={tr("grid.spacingY")}>
        <TextInput value={yText} onChange={(e) => setYText(e.target.value)} onBlur={() => apply("y", yText)} />
      </Field>
      <div className="text-[11px] text-ink-500">X: {xText || "—"} · Y: {yText || "—"}</div>
    </Panel>
  );
}

function spacings(offsets: number[]): string {
  if (offsets.length < 2) return "";
  const out: number[] = [];
  for (let i = 1; i < offsets.length; i++) out.push(Math.round(offsets[i] - offsets[i - 1]));
  return out.join(",");
}

export function IndicatorTable() {
  const { lang, tr } = useTr();
  const indicators = useApp((s) => s.indicators);
  return (
    <Panel title={tr("indicator.bar")}>
      <table className="w-full text-[11px]">
        <tbody>
          {indicators.map((r) => (
            <tr key={r.key} className="border-b border-ink-800/60 last:border-0" title={`${r.detail ?? ""}\n${r.inputs ?? ""}`}>
              <td className="py-1 pr-2 text-ink-400">{tr(`indicator.${r.key}` as never)}</td>
              <td className="py-1 pr-2 text-right font-mono text-ink-100">{indicatorValueText(r, lang)}</td>
              <td
                className={
                  "py-1 text-right " +
                  (r.status === "over"
                    ? "text-state-over"
                    : r.status === "near" || r.status === "under"
                      ? "text-state-near"
                      : r.status === "ok"
                        ? "text-state-ok"
                        : "text-ink-500")
                }
              >
                {tr(`status.${r.status}` as never)}
              </td>
              <td className="py-1 pl-2 text-right text-ink-600">{tr(`fidelity.${r.fidelity}` as never)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-ink-600">
        {indicators[0]?.inputs ?? ""}
      </p>
    </Panel>
  );
}
