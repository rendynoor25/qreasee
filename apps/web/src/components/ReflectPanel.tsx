import { makeTranslator, formatArea } from "@qreasee/shared";
import { programFit } from "@qreasee/indicators";
import { useApp } from "../state/store";
import { Panel } from "./ui";

export function ReflectPanel() {
  const lang = useApp((s) => s.lang);
  const tr = makeTranslator(lang);
  const state = useApp((s) => s.docState);
  const decisions = state.decisions;
  const records = state.records;
  const fits = programFit(state);

  return (
    <div className="space-y-3">
      <Panel title={tr("brief.title")}>
        <p className="whitespace-pre-wrap text-xs text-ink-300">
          {state.brief.text || tr("brief.text")}
        </p>
      </Panel>

      <Panel title={tr("brief.program")}>
        {fits.length === 0 && <p className="text-[11px] text-ink-500">{tr("decisions.none")}</p>}
        <table className="w-full text-[11px]">
          <tbody>
            {fits.map((f) => (
              <tr key={f.id} className="border-b border-ink-800/60 last:border-0">
                <td className="py-1 text-ink-300">{f.name}</td>
                <td className="py-1 text-right font-mono text-ink-100">
                  {formatArea(f.actualAreaMm2, lang, 0)}
                </td>
                <td className="py-1 text-right text-ink-500">/ {formatArea(f.targetAreaMm2, lang, 0)}</td>
                <td
                  className={
                    "py-1 text-right " +
                    (f.status === "ok" ? "text-state-ok" : f.status === "near" ? "text-state-near" : "text-state-over")
                  }
                >
                  {tr(`status.${f.status}` as never)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title={tr("decisions.title")}>
        {decisions.length === 0 && <p className="text-[11px] text-ink-500">{tr("decisions.none")}</p>}
        <div className="space-y-1.5">
          {decisions.map((d) => (
            <div key={d.id} className="rounded-md border border-ink-800 p-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-ink-200">{d.title}</span>
                <span className="rounded-full bg-ink-800 px-1.5 py-0.5 text-[9px] text-ink-400">{d.status}</span>
              </div>
              {d.question && <div className="mt-0.5 text-[10px] italic text-ink-500">{d.question}</div>}
            </div>
          ))}
        </div>
      </Panel>

      {records.length > 0 && (
        <Panel title={tr("decisions.history")}>
          <div className="space-y-1.5">
            {records
              .slice()
              .reverse()
              .map((r) => (
                <div key={r.id} className="rounded-md border border-ink-800 p-2">
                  <div className="text-[11px] text-ink-200">“{r.rationale}”</div>
                  {r.rejected.length > 0 && (
                    <div className="mt-0.5 text-[10px] text-ink-500">
                      {tr("decisions.rejected")}: {r.rejected.map((x) => x.name).join(", ")}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
