import { useState } from "react";
import { makeTranslator, formatArea, type Point } from "@qreasee/shared";
import { bounds } from "@qreasee/geometry";
import { getRecipe } from "@qreasee/concept";
import { useApp } from "../state/store";
import { searchPlaces, type PlaceResult } from "../lib/osm";
import { LogoMark } from "./Logo";
import { Button, Field, TextInput } from "./ui";

const m = 1000;

function rectPoints(wM: number, dM: number): Point[] {
  return [
    { x: 0, y: 0 },
    { x: wM * m, y: 0 },
    { x: wM * m, y: dM * m },
    { x: 0, y: dM * m },
  ];
}

function gridFor(widthM: number, depthM: number) {
  const lines = [] as Array<{ id: string; axis: "x" | "y"; label: string; offset: number }>;
  for (let x = 0; x <= widthM; x += 5) lines.push({ id: `gx${x}`, axis: "x", label: String(x / 5 + 1), offset: x * m });
  for (let y = 0; y <= depthM; y += 5) lines.push({ id: `gy${y}`, axis: "y", label: String.fromCharCode(65 + y / 5), offset: y * m });
  return lines;
}

const num = (v: string): number | undefined => {
  if (v.trim() === "") return undefined;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
};

export function SiteWizard() {
  const lang = useApp((s) => s.lang);
  const tr = makeTranslator(lang);
  const project = useApp((s) => s.project);
  const state = useApp((s) => s.docState);
  const dispatch = useApp((s) => s.dispatch);
  const updateProject = useApp((s) => s.updateProject);
  const finishWizard = useApp((s) => s.finishWizard);
  const setRecipeParam = useApp((s) => s.setRecipeParam);
  const setRecipeQuality = useApp((s) => s.setRecipeQuality);
  const toggleRecipeAddon = useApp((s) => s.toggleRecipeAddon);

  const binding = state.brief.settings?.recipeBinding;
  const recipe = binding ? getRecipe(binding.recipeId) : undefined;

  const b = state.site.boundary.length >= 3 ? bounds(state.site.boundary) : null;
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState<"search" | "draw" | "type">("search");
  const [width, setWidth] = useState(b ? Math.round(b.width / m) : 15);
  const [depth, setDepth] = useState(b ? Math.round(b.height / m) : 25);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const runSearch = async () => {
    if (query.trim().length < 3) return;
    setSearching(true);
    setSearchError(null);
    setSearched(true);
    try {
      setResults(await searchPlaces(query));
    } catch (err) {
      setSearchError((err as Error).message);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const applySize = () => {
    if (width <= 0 || depth <= 0) return;
    dispatch({ type: "site.setBoundary", points: rectPoints(width, depth) });
    dispatch({ type: "grid.set", lines: gridFor(width, depth) });
  };

  const recipeSteps = Boolean(recipe && binding);
  const stepTitles = recipeSteps
    ? [tr("wizard.size"), tr("wizard.special"), tr("wizard.where.title"), tr("wizard.budget.title")]
    : [tr("wizard.where.title"), tr("wizard.rules.title"), tr("wizard.budget.title")];
  const lastStep = stepTitles.length - 1;

  const renderSiteStep = () => (
    <div>
      <div className="mb-3 flex gap-1">
        {(["search", "draw", "type"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "rounded-md px-2.5 py-1 text-[11px] transition-colors " +
              (tab === t ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:text-ink-100")
            }
          >
            {tr(`wizard.where.tab.${t}` as never)}
          </button>
        ))}
      </div>
      {tab === "search" && (
        <div>
          <div className="flex gap-2">
            <TextInput
              value={query}
              placeholder={tr("wizard.where.placeholder")}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runSearch();
              }}
            />
            <Button variant="outline" onClick={() => void runSearch()} disabled={searching}>
              {searching ? tr("wizard.where.searching") : tr("wizard.where.search")}
            </Button>
          </div>
          <p className="mt-1 text-[10px] text-ink-600">{tr("wizard.where.attribution")}</p>
          {searchError && <p className="mt-2 text-[11px] text-state-over">{searchError}</p>}
          {searched && !searching && results.length === 0 && !searchError && (
            <p className="mt-2 text-[11px] text-ink-500">{tr("wizard.where.noResults")}</p>
          )}
          <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
            {results.map((r, i) => (
              <button
                key={`${r.lat}-${r.lng}-${i}`}
                onClick={() => updateProject({ location: { lat: r.lat, lng: r.lng } })}
                className="block w-full rounded-md border border-ink-800 px-2 py-1.5 text-left text-[11px] text-ink-200 hover:border-ink-600"
              >
                {r.displayName}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-500">
            lat {project.location.lat.toFixed(4)}, lng {project.location.lng.toFixed(4)}
          </p>
        </div>
      )}
      {tab === "draw" && (
        <div>
          <p className="mb-3 text-[11px] text-ink-400">{tr("wizard.where.drawHint")}</p>
          <Button variant="primary" onClick={() => finishWizard("map")}>
            {tr("wizard.where.tab.draw")}
          </Button>
        </div>
      )}
      {tab === "type" && (
        <div>
          <p className="mb-3 text-[11px] text-ink-400">{tr("wizard.where.typeHint")}</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label={tr("wizard.where.width")}>
              <TextInput type="number" value={width} onChange={(e) => setWidth(Number(e.target.value) || 0)} />
            </Field>
            <Field label={tr("wizard.where.depth")}>
              <TextInput type="number" value={depth} onChange={(e) => setDepth(Number(e.target.value) || 0)} />
            </Field>
          </div>
          <Button variant="primary" onClick={applySize} disabled={width <= 0 || depth <= 0}>
            {tr("wizard.where.useSize")}
          </Button>
          <p className="mt-2 text-[11px] text-ink-500">
            {formatArea(width * m * (depth * m), lang)} · {width} × {depth} m
          </p>
        </div>
      )}
      {b && (
        <p className="mt-3 text-[11px] text-ink-500">
          {tr("wizard.where.current", { w: Math.round(b.width / m), d: Math.round(b.height / m) })}
        </p>
      )}
    </div>
  );

  const renderSizeStep = () => {
    if (!recipe || !binding) return null;
    const drivers = recipe.params.filter((p) => p.basis === "user");
    const shown = drivers.length > 0 ? drivers : recipe.params;
    return (
      <div>
        <p className="mb-3 text-[11px] text-ink-400">{tr("wizard.cap.dorm")}</p>
        <div className="grid grid-cols-2 gap-2">
          {shown.map((p) => (
            <Field key={p.key} label={p.label[lang]} hint={p.unit}>
              <TextInput
                type="number"
                value={binding.paramValues[p.key] ?? p.default}
                onChange={(e) => setRecipeParam(p.key, Number(e.target.value.replace(",", ".")) || 0)}
              />
            </Field>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11px]">
          <span className="text-ink-400">{tr("wizard.quality")}</span>
          {(["economy", "standard", "premium"] as const).map((q) => (
            <button
              key={q}
              onClick={() => setRecipeQuality(q)}
              className={
                "rounded px-2 py-0.5 " +
                (binding.quality === q ? "bg-lens-visual/20 text-lens-visual" : "text-ink-400 hover:text-ink-100")
              }
            >
              {tr(`brief.${q}` as never)}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderSpecialStep = () => {
    if (!recipe || !binding) return null;
    return (
      <div>
        <p className="mb-3 text-[11px] text-ink-400">{tr("wizard.special")}</p>
        {recipe.addons.length > 0 && (
          <div className="mb-3 space-y-1 text-[11px]">
            {recipe.addons.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-ink-300">
                <input type="checkbox" checked={binding.addonIds.includes(a.id)} onChange={() => toggleRecipeAddon(a.id)} />
                {a.label[lang]}
              </label>
            ))}
          </div>
        )}
        <Field label={tr("brief.text")}>
          <TextInput
            value={state.brief.settings?.ownerBrief ?? state.brief.text}
            onChange={(e) => dispatch({ type: "brief.setOwnerBrief", text: e.target.value })}
          />
        </Field>
      </div>
    );
  };

  const renderRulesStep = () => (
    <div>
      <p className="mb-3 text-[11px] leading-relaxed text-ink-400">{tr("wizard.rules.hint")}</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label={tr("rules.kdbMax")} hint="%">
          <TextInput type="number" value={state.rules.kdbMax ?? ""} onChange={(e) => dispatch({ type: "rules.set", patch: { kdbMax: num(e.target.value) } })} />
        </Field>
        <Field label={tr("rules.klbMax")} hint="ratio">
          <TextInput type="number" step="0.1" value={state.rules.klbMax ?? ""} onChange={(e) => dispatch({ type: "rules.set", patch: { klbMax: num(e.target.value) } })} />
        </Field>
        <Field label={tr("rules.kdhMin")} hint="%">
          <TextInput type="number" value={state.rules.kdhMin ?? ""} onChange={(e) => dispatch({ type: "rules.set", patch: { kdhMin: num(e.target.value) } })} />
        </Field>
        <Field label={tr("rules.heightMax")} hint="m">
          <TextInput
            type="number"
            step="0.5"
            value={state.rules.heightMax === undefined ? "" : state.rules.heightMax / m}
            onChange={(e) => {
              const v = num(e.target.value);
              dispatch({ type: "rules.set", patch: { heightMax: v === undefined ? undefined : v * m } });
            }}
          />
        </Field>
        <Field label={tr("rules.floorsMax")} hint="n">
          <TextInput type="number" value={state.rules.floorsMax ?? ""} onChange={(e) => dispatch({ type: "rules.set", patch: { floorsMax: num(e.target.value) } })} />
        </Field>
      </div>
    </div>
  );

  const renderBudgetStep = () => (
    <div>
      <p className="mb-3 text-[11px] text-ink-400">{tr("wizard.budget.hint")}</p>
      <Field label={tr("budget.ceiling")} hint="Rp">
        <TextInput type="number" value={state.budget.ceiling ?? ""} onChange={(e) => dispatch({ type: "budget.set", patch: { ceiling: num(e.target.value) } })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={tr("budget.rateLow")} hint="Rp/m²">
          <TextInput type="number" value={state.budget.ratePerM2?.low ?? ""} onChange={(e) => dispatch({ type: "budget.set", patch: { ratePerM2: { low: Number(e.target.value) || 0, high: state.budget.ratePerM2?.high ?? 0 } } })} />
        </Field>
        <Field label={tr("budget.rateHigh")} hint="Rp/m²">
          <TextInput type="number" value={state.budget.ratePerM2?.high ?? ""} onChange={(e) => dispatch({ type: "budget.set", patch: { ratePerM2: { low: state.budget.ratePerM2?.low ?? 0, high: Number(e.target.value) || 0 } } })} />
        </Field>
      </div>
    </div>
  );

  const renderStep = () => {
    if (recipeSteps) {
      return [renderSizeStep, renderSpecialStep, renderSiteStep, renderBudgetStep][step]?.() ?? null;
    }
    return [renderSiteStep, renderRulesStep, renderBudgetStep][step]?.() ?? null;
  };

  return (
    <div className="min-h-screen overflow-y-auto bg-ink-950 px-6 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-6 flex items-center gap-3">
          <LogoMark className="h-9 w-9 text-ink-100" />
          <div className="mr-auto">
            <div className="text-lg font-bold tracking-tight text-brand-400">Qreasee</div>
            <div className="text-[11px] text-ink-400">{project.name}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => finishWizard()}>
            {tr("wizard.skip")}
          </Button>
        </header>

        <h1 className="text-xl font-semibold text-ink-100">{tr("wizard.title")}</h1>
        <p className="mb-4 mt-1 text-sm text-ink-400">{tr("wizard.subtitle")}</p>

        <div className="mb-4 flex items-center gap-2 text-[11px] text-ink-400">
          <span className="rounded-full border border-ink-700 px-2 py-0.5">
            {tr("wizard.step", { n: step + 1 })} / {stepTitles.length}
          </span>
          <span className="text-ink-300">{stepTitles[step]}</span>
        </div>

        <section className="rounded-xl border border-ink-800 bg-ink-900/70 p-4">{renderStep()}</section>

        <footer className="mt-4 flex items-center gap-2">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            {tr("wizard.back")}
          </Button>
          <div className="mr-auto" />
          {step < lastStep ? (
            <Button variant="outline" onClick={() => setStep((s) => Math.min(lastStep, s + 1))}>
              {tr("wizard.next")}
            </Button>
          ) : null}
          <Button variant="primary" onClick={() => finishWizard()}>
            {tr("wizard.finish")}
          </Button>
        </footer>
      </div>
    </div>
  );
}
