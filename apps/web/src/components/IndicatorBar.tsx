import { useEffect, useState } from "react";
import { makeTranslator } from "@qreasee/shared";
import { useApp } from "../state/store";
import { indicatorValueText } from "../lib/indicatorFormat";
import { Chip } from "./ui";

const BAR_KEYS = ["kdb", "klb", "kdh", "setback", "height", "floors", "gfa", "cost", "sun"];

export function IndicatorBar() {
  const lang = useApp((s) => s.lang);
  const tr = makeTranslator(lang);
  const indicators = useApp((s) => s.indicators);
  const pending = useApp((s) => s.indicatorsPending);
  const lens = useApp((s) => s.lens);
  const showIndicators = useApp((s) => s.showIndicators);
  const toggleIndicators = useApp((s) => s.toggleIndicators);
  const setPanel = useApp((s) => s.setPanel);
  const [expanded, setExpanded] = useState(lens !== "visual");

  useEffect(() => {
    setExpanded(lens !== "visual");
  }, [lens]);

  if (!showIndicators) {
    return (
      <div className="pointer-events-auto absolute left-1/2 top-3 -translate-x-1/2">
        <Chip label={tr("indicator.show")} onClick={toggleIndicators} />
      </div>
    );
  }

  const byKey = new Map(indicators.map((r) => [r.key, r]));
  const keys = expanded ? BAR_KEYS : BAR_KEYS.slice(0, 4);

  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 flex max-w-[min(1000px,90vw)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-xl border border-ink-800 bg-ink-900/80 px-2 py-1.5 backdrop-blur">
      {keys.map((key) => {
        const r = byKey.get(key as never);
        if (!r) return null;
        return (
          <Chip
            key={key}
            label={tr(`indicator.${key}` as never)}
            value={indicatorValueText(r, lang)}
            status={tr(`status.${r.status}` as never)}
            title={`${r.label}: ${r.detail ?? ""}\n${r.inputs ?? ""}\n${tr(`fidelity.${r.fidelity}` as never)}`}
            onClick={() => setPanel("context")}
          />
        );
      })}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="rounded-full border border-ink-700 px-2 py-1 text-[11px] text-ink-400 hover:text-ink-100"
        title={expanded ? tr("indicator.hide") : tr("indicator.show")}
      >
        {expanded ? "−" : "+"}
      </button>
      <button
        onClick={toggleIndicators}
        className="rounded-full border border-ink-700 px-2 py-1 text-[11px] text-ink-400 hover:text-ink-100"
      >
        ✕
      </button>
      {pending && <span className="ml-1 h-1.5 w-1.5 animate-pulse rounded-full bg-lens-visual" />}
    </div>
  );
}
