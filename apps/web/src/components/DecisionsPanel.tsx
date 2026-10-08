import { useMemo, useState } from "react";
import {
  formatPercent,
  formatRupiahRange,
  makeTranslator,
  type Branch,
  type Decision,
  type DecisionScope,
  type Id,
  type IndicatorResult,
  type Translator,
} from "@qreasee/shared";
import { computeIndicators } from "@qreasee/indicators";
import { useApp } from "../state/store";
import { Button, Field, Modal, Panel, Select, TextArea, TextInput } from "./ui";
import { BranchIcon, CheckIcon, PlusIcon, TrashIcon } from "./icons";
import { indicatorValueText } from "../lib/indicatorFormat";

const STATUS_RANK: Record<string, number> = { over: 0, under: 1, "needs-input": 0, near: 2, ok: 3 };

export function DecisionsPanel() {
  const { lang, tr } = useTr();
  const decisions = useApp((s) => s.docState.decisions);
  const branches = useApp((s) => s.branches);
  const activeBranchId = useApp((s) => s.activeBranchId);
  const [selected, setSelected] = useState<Id | null>(decisions[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const scopeKind = "whole" as const;

  const activeDecision = decisions.find((d) => d.id === selected) ?? decisions[0] ?? null;
  const decisionBranches = useMemo(
    () => branches.filter((b) => b.decisionId === activeDecision?.id),
    [branches, activeDecision],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-300">{tr("decisions.title")}</h2>
        <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
          <PlusIcon width={13} height={13} /> {tr("decisions.new")}
        </Button>
      </div>

      <Button
        size="sm"
        variant="outline"
        className="mb-2 w-full"
        onClick={() => useApp.getState().suggestMassing()}
      >
        {tr("suggest.button")}
      </Button>

      <SuggestPanel />

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {decisions.length === 0 && <p className="text-[11px] text-ink-500">{tr("decisions.none")}</p>}

        <div className="flex flex-wrap gap-1">
          {decisions.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelected(d.id)}
              className={
                "rounded-md border px-2 py-1 text-[11px] " +
                (activeDecision?.id === d.id
                  ? "border-lens-reflect/60 text-lens-reflect"
                  : "border-ink-700 text-ink-400 hover:text-ink-100")
              }
            >
              {d.title}
              <span className="ml-1 text-ink-600">{d.status}</span>
            </button>
          ))}
        </div>

        {activeDecision && (
          <DecisionDetail decision={activeDecision} branches={decisionBranches} activeBranchId={activeBranchId} lang={lang} tr={tr} />
        )}

        <HistoryPanel />
      </div>

      <Modal open={creating} onOpenChange={setCreating} title={tr("decisions.new")}>
        <Field label={tr("decisions.title")}>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Massing direction" />
        </Field>
        <Field label={tr("decisions.question")}>
          <TextArea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Courtyard or compact?" />
        </Field>
        <Field label={tr("decisions.scope")} hint={tr("decisions.scope.whole")}>
          <Select value={scopeKind} disabled>
            <option value="whole">{tr("decisions.scope.whole")}</option>
          </Select>
        </Field>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setCreating(false)}>
            {tr("common.cancel")}
          </Button>
          <Button
            variant="primary"
            disabled={!title.trim()}
            onClick={() => {
              const scope: DecisionScope = { kind: "whole" };
              const id = useApp.getState().addDecision({ title: title.trim(), question: question.trim(), scope });
              setSelected(id);
              setTitle("");
              setQuestion("");
              setCreating(false);
            }}
          >
            {tr("common.add")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function DecisionDetail({
  decision,
  branches,
  activeBranchId,
  lang,
  tr,
}: {
  decision: Decision;
  branches: Branch[];
  activeBranchId: Id;
  lang: "en" | "id";
  tr: Translator;
}) {
  const state = useApp((s) => s.docState);
  const createBranch = useApp((s) => s.createBranch);
  const switchBranch = useApp((s) => s.switchBranch);
  const parkBranch = useApp((s) => s.parkBranch);
  const reviveBranch = useApp((s) => s.reviveBranch);
  const setCompare = useApp((s) => s.setCompare);
  const compareBranchIds = useApp((s) => s.compareBranchIds);
  const overlayCompare = useApp((s) => s.overlayCompare);
  const [newName, setNewName] = useState("");
  const [adoptTarget, setAdoptTarget] = useState<Id | null>(null);
  const [rationale, setRationale] = useState("");
  const [conflicts, setConflicts] = useState<Array<{ massId: Id }> | null>(null);
  const [resolutions, setResolutions] = useState<Record<Id, "main" | "branch">>({});

  const toggleCompare = (id: Id) => {
    const next = compareBranchIds.includes(id)
      ? compareBranchIds.filter((x) => x !== id)
      : [...compareBranchIds, id].slice(-4);
    setCompare(next, overlayCompare);
  };

  const compareStates = useMemo(() => {
    const ids = compareBranchIds.length >= 2 ? compareBranchIds : branches.slice(0, 4).map((b) => b.id);
    return ids
      .map((id) => {
        const b = useApp.getState().doc.getBranch(id);
        if (!b) return null;
        return {
          branch: b.branch,
          indicators: computeIndicators(b.state, { branchId: id, version: b.version, lang }),
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
  }, [compareBranchIds, branches, lang, state]);

  const runAdopt = (branchId: Id, withRationale: string, res?: Record<Id, "main" | "branch">) => {
    const result = useApp.getState().adoptBranch({ branchId, rationale: withRationale, resolutions: res });
    if (!result.ok) {
      setConflicts(result.conflicts);
      return false;
    }
    setAdoptTarget(null);
    setRationale("");
    setConflicts(null);
    setResolutions({});
    return true;
  };

  return (
    <Panel title={decision.title}>
      <p className="mb-2 text-[11px] italic text-ink-400">{decision.question}</p>

      <div className="space-y-1.5">
        {branches.map((b) => {
          const inCompare = compareBranchIds.includes(b.id);
          const isActive = b.id === activeBranchId;
          return (
            <div
              key={b.id}
              className={
                "rounded-md border p-2 " + (isActive ? "border-lens-visual/60 bg-lens-visual/5" : "border-ink-800")
              }
            >
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: b.color }} />
                <button className="flex-1 text-left text-xs text-ink-100" onClick={() => switchBranch(b.id)}>
                  {b.name}
                </button>
                <span className="rounded-full bg-ink-800 px-1.5 py-0.5 text-[9px] text-ink-400">
                  {tr(`branch.status.${b.status}` as never)}
                </span>
                {isActive && <span className="text-[9px] text-lens-visual">{tr("decisions.chosen")}</span>}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <Button size="sm" variant="outline" onClick={() => switchBranch(b.id)}>
                  {b.id === activeBranchId ? tr("common.edit") : "Open"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className={inCompare ? "text-lens-visual" : ""}
                  onClick={() => toggleCompare(b.id)}
                >
                  {inCompare ? "✓ " : ""}
                  {tr("decisions.compare")}
                </Button>
                {b.status !== "parked" && b.status !== "adopted" && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setAdoptTarget(b.id);
                      setConflicts(null);
                    }}
                  >
                    <CheckIcon width={12} height={12} /> {tr("decisions.adopt")}
                  </Button>
                )}
                {b.status === "parked" ? (
                  <Button size="sm" variant="outline" onClick={() => reviveBranch(b.id)}>
                    {tr("decisions.revive")}
                  </Button>
                ) : (
                  b.status !== "adopted" && (
                    <Button size="sm" variant="ghost" onClick={() => parkBranch(b.id)}>
                      {tr("decisions.park")}
                    </Button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex gap-2">
        <TextInput value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={tr("decisions.newBranch")} />
        <Button
          size="sm"
          variant="outline"
          disabled={!newName.trim()}
          onClick={() => {
            createBranch({ name: newName.trim(), decisionId: decision.id });
            setNewName("");
          }}
        >
          <BranchIcon width={13} height={13} />
        </Button>
      </div>

      {compareStates.length >= 2 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] text-ink-400">{tr("decisions.compare")}</span>
            <button
              className={"text-[10px] " + (overlayCompare ? "text-lens-visual" : "text-ink-500")}
              onClick={() => setCompare(compareBranchIds, !overlayCompare)}
            >
              {tr("decisions.overlay")}
            </button>
          </div>
          <CompareTable states={compareStates} lang={lang} tr={tr} />
        </div>
      )}

      <Modal
        open={!!adoptTarget}
        onOpenChange={(v) => {
          if (!v) {
            setAdoptTarget(null);
            setConflicts(null);
          }
        }}
        title={tr("decisions.adopt")}
        description={conflicts ? tr("decisions.conflictResolve") : tr("decisions.rationale")}
      >
        {!conflicts && (
          <Field label={tr("decisions.rationale")}>
            <TextArea value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="Meets KLB with margin and keeps the west facade short." />
          </Field>
        )}
        {conflicts && (
          <div className="space-y-2">
            {conflicts.map((c) => (
              <div key={c.massId} className="rounded-md border border-ink-700 p-2">
                <div className="mb-1 text-[11px] text-ink-300">{c.massId}</div>
                <div className="flex gap-1">
                  {(["main", "branch"] as const).map((side) => (
                    <button
                      key={side}
                      onClick={() => setResolutions((r) => ({ ...r, [c.massId]: side }))}
                      className={
                        "rounded px-2 py-1 text-[11px] " +
                        (resolutions[c.massId] === side ? "bg-lens-visual/20 text-lens-visual" : "text-ink-400")
                      }
                    >
                      {side === "main" ? tr("decisions.keepMain") : tr("decisions.takeBranch")}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setAdoptTarget(null)}>
            {tr("common.cancel")}
          </Button>
          <Button
            variant="primary"
            disabled={conflicts ? conflicts.some((c) => !resolutions[c.massId]) : rationale.trim().length < 3}
            onClick={() => adoptTarget && runAdopt(adoptTarget, rationale.trim() || "Adopted.", resolutions)}
          >
            {tr("decisions.adoptConfirm")}
          </Button>
        </div>
      </Modal>
    </Panel>
  );
}

function CompareTable({
  states,
  lang,
  tr,
}: {
  states: Array<{ branch: Branch; indicators: IndicatorResult[] }>;
  lang: "en" | "id";
  tr: Translator;
}) {
  const keys = ["klb", "kdb", "kdh", "setback", "height", "gfa", "cost", "sun"];
  const bestByKey: Record<string, string> = {};
  for (const key of keys) {
    let bestName = "";
    let bestRank = -1;
    for (const s of states) {
      const r = s.indicators.find((x) => x.key === key);
      const rank = r ? STATUS_RANK[r.status] ?? 0 : 0;
      if (rank > bestRank) {
        bestRank = rank;
        bestName = s.branch.name;
      }
    }
    bestByKey[key] = bestName;
  }
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="border-b border-ink-700">
          <th className="py-1 text-left font-medium text-ink-500">—</th>
          {states.map((s) => (
            <th key={s.branch.id} className="py-1 text-right font-medium" style={{ color: s.branch.color }}>
              {s.branch.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {keys.map((key) => (
          <tr key={key} className="border-b border-ink-800/60 last:border-0">
            <td className="py-1 text-ink-400">{tr(`indicator.${key}` as never)}</td>
            {states.map((s) => {
              const r = s.indicators.find((x) => x.key === key);
              const best = bestByKey[key] === s.branch.name;
              return (
                <td
                  key={s.branch.id}
                  className={"py-1 text-right font-mono " + (best ? "font-bold text-state-ok" : "text-ink-200")}
                >
                  {r ? indicatorValueText(r, lang) : "—"}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HistoryPanel() {
  const { tr } = useTr();
  const records = useApp((s) => s.docState.records);
  if (records.length === 0) return null;
  return (
    <Panel title={tr("decisions.history")}>
      <div className="space-y-2">
        {records
          .slice()
          .reverse()
          .map((r) => (
            <div key={r.id} className="rounded-md border border-ink-800 p-2">
              <div className="text-[11px] text-ink-200">“{r.rationale}”</div>
              <div className="mt-0.5 text-[10px] text-ink-500">
                {r.by} · {new Date(r.at).toLocaleString()}
              </div>
              {r.rejected.length > 0 && (
                <div className="mt-1 text-[10px] text-ink-500">
                  {tr("decisions.rejected")}: {r.rejected.map((x) => x.name).join(", ")}
                </div>
              )}
            </div>
          ))}
      </div>
    </Panel>
  );
}

function useTr() {
  const lang = useApp((s) => s.lang);
  return { lang, tr: makeTranslator(lang) };
}

function SuggestPanel() {
  const lang = useApp((s) => s.lang);
  const tr = makeTranslator(lang);
  const suggestions = useApp((s) => s.massingSuggestions);
  const weights = useApp((s) => s.massingWeights);
  const setWeight = useApp((s) => s.setMassingWeight);
  if (suggestions.length === 0) return null;

  const keys: Array<keyof typeof weights> = ["cost", "rules", "sun", "green", "compactness"];
  return (
    <Panel title={tr("suggest.title")}>
      <p className="mb-2 text-[11px] leading-snug text-ink-500">{tr("suggest.hint")}</p>
      <div className="mb-2">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-ink-500">{tr("suggest.weights")}</div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
          {keys.map((k) => (
            <label key={k} className="flex items-center gap-1 text-ink-400">
              <span className="flex-1 truncate">{tr(`suggest.${k}` as never)}</span>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={weights[k]}
                onChange={(e) => setWeight(k, Number(e.target.value) || 0)}
                className="h-5 w-14 rounded border border-ink-700 bg-ink-950 px-1 text-right text-[11px] text-ink-100"
              />
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        {suggestions.map((o) => (
          <div
            key={o.id}
            className="rounded-md border border-ink-800 p-2 text-[11px]"
            title={keys
              .map((k) => `${tr(`suggest.${k}` as never)}: ${(o.breakdown[k] * 100).toFixed(0)}%`)
              .join("\n")}
          >
            <div className="flex items-center justify-between">
              <span className="text-ink-100">{o.name}</span>
              <span className="font-mono text-state-ok">{formatPercent(o.score, lang, 0)}</span>
            </div>
            <div className="mt-0.5 text-[10px] text-ink-400">
              {o.floors} floor{o.floors > 1 ? "s" : ""} · KDB {o.kdb.toFixed(0)}% · KLB {o.klb.toFixed(2)}
            </div>
            <div className="text-[10px] text-ink-500">
              {o.costLow !== null && o.costHigh !== null ? formatRupiahRange(o.costLow, o.costHigh) : "—"}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
