import { makeTranslator } from "@qreasee/shared";
import { useApp } from "../state/store";
import { drawingSvgFor } from "../lib/drawings";
import { Button, Panel } from "./ui";
import { download } from "../lib/utils";

export function DrawingsPanel() {
  const lang = useApp((s) => s.lang);
  const tr = makeTranslator(lang);
  const schematic = useApp((s) => s.schematic);
  const sectionLine = useApp((s) => s.sectionLine);
  const grids = useApp((s) => s.docState.grids);
  const levels = useApp((s) => s.docState.levels);
  const activeLevelId = useApp((s) => s.activeLevelId);
  const annotations = useApp((s) => s.annotations);
  const toggleAnnotation = useApp((s) => s.toggleAnnotation);
  const dimTextMm = useApp((s) => s.dimTextMm);
  const setDimTextMm = useApp((s) => s.setDimTextMm);
  const tab = useApp((s) => s.drawingsTab);
  const setTab = useApp((s) => s.setDrawingsTab);
  const activeViewId = useApp((s) => s.activeViewId);
  const viewOverrides = useApp((s) => s.docState.viewOverrides);
  const setViewCutPlane = useApp((s) => s.setViewCutPlane);
  const blockGenDiff = useApp((s) => s.blockGenDiff);
  const previewBlockGen = useApp((s) => s.previewBlockGen);
  const applyBlockGen = useApp((s) => s.applyBlockGen);
  const autoRegenBlocks = useApp((s) => s.autoRegenBlocks);
  const setAutoRegenBlocks = useApp((s) => s.setAutoRegenBlocks);
  const cutOverride = viewOverrides[activeViewId]?.cutPlane;
  const cut = cutOverride === undefined ? 1200 : cutOverride;
  const setSectionLine = useApp((s) => s.setSectionLine);
  const setTool = useApp((s) => s.setTool);
  const setMode = useApp((s) => s.setMode);

  if (!schematic) {
    return (
      <Panel title={tr("drawings.title")}>
        <p className="text-[11px] text-ink-500">{tr("drawings.empty")}</p>
      </Panel>
    );
  }

  const svg =
    drawingSvgFor(tab, sectionLine, { grids, levels }, activeLevelId) ?? "";

  return (
    <div className="space-y-3">
      <Panel
        title={tr("drawings.title")}
        actions={
          <Button size="sm" variant="outline" onClick={() => download(`drawing-${tab}.svg`, svg, "image/svg+xml")}>
            {tr("drawings.download")}
          </Button>
        }
      >
        <div className="mb-2 flex gap-1">
          {(["plan", "section", "elevation"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                "rounded px-2 py-1 text-[11px] transition-colors " +
                (tab === t ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:text-ink-100")
              }
            >
              {tr(`drawings.${t}` as never)}
            </button>
          ))}
        </div>
        {tab === "plan" && (
          <div className="mb-2 flex flex-wrap gap-1">
            {(["dimensions", "tags", "north", "scaleBar", "sections"] as const).map((k) => (
              <button
                key={k}
                onClick={() => toggleAnnotation(k)}
                className={
                  "rounded border px-2 py-0.5 text-[10px] transition-colors " +
                  (annotations[k]
                    ? "border-lens-visual/60 bg-lens-visual/10 text-lens-visual"
                    : "border-ink-700 text-ink-500 hover:text-ink-300")
                }
              >
                {tr(`drawings.ann.${k}` as never)}
              </button>
            ))}
          </div>
        )}
        {tab === "plan" && (
          <div className="mb-2 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-ink-400">
              <span>{tr("drawings.cutPlane" as never)}</span>
              <input
                type="number"
                step={100}
                min={0}
                value={cut === null ? 0 : cut}
                onChange={(e) => setViewCutPlane(activeViewId, Math.max(0, Number(e.target.value) || 0))}
                className="w-16 rounded border border-ink-700 bg-ink-900 px-1 py-0.5 text-[10px] text-ink-100"
              />
              <span>mm</span>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={cut === null}
                  onChange={(e) => setViewCutPlane(activeViewId, e.target.checked ? null : 1200)}
                />
                {tr("drawings.noCut" as never)}
              </label>
            </div>
            <label className="flex items-center gap-2 text-[10px] text-ink-400">
              {tr("drawings.dimText" as never)}
              <input
                type="number"
                min={1}
                max={6}
                step={0.5}
                value={dimTextMm}
                onChange={(e) => setDimTextMm(parseFloat(e.target.value) || 2.5)}
                className="w-14 rounded border border-ink-700 bg-ink-900 px-1 py-0.5 text-[10px] text-ink-100"
              />
              mm
            </label>
          </div>
        )}
        <div
          className="overflow-hidden rounded-md border border-ink-800 bg-white p-1"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p className="mt-1 text-[10px] text-ink-500">{tr("drawings.scale")}</p>
      </Panel>

      <Panel title={tr("gen.title" as never)}>
        <label className="mb-2 flex items-center gap-2 text-[11px] text-ink-400">
          <input
            type="checkbox"
            checked={autoRegenBlocks}
            onChange={(e) => setAutoRegenBlocks(e.target.checked)}
          />
          {tr("gen.auto" as never)}
        </label>
        <Button size="sm" variant="outline" onClick={previewBlockGen}>
          {tr("gen.button" as never)}
        </Button>
        {blockGenDiff && (
          <div className="mt-2 text-[11px] text-ink-300">
            <div>
              <span className="text-state-ok">+{blockGenDiff.adds}</span> ·{" "}
              <span className="text-lens-rules">~{blockGenDiff.updates}</span> ·{" "}
              <span className="text-state-over">−{blockGenDiff.removes}</span>
            </div>
            <div className="mt-1 flex gap-1">
              <Button size="sm" variant="primary" onClick={applyBlockGen}>
                {tr("gen.apply" as never)}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => useApp.setState({ blockGenDiff: null })}>
                {tr("gen.cancel" as never)}
              </Button>
            </div>
          </div>
        )}
      </Panel>

      <Panel title={tr("drawings.section")}>
        <p className="mb-2 text-[11px] text-ink-500">{tr("drawings.sectionHint")}</p>
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setMode("drawings");
              setTool("section");
            }}
          >
            {tr("drawings.drawSection")}
          </Button>
          {sectionLine && (
            <Button size="sm" variant="ghost" onClick={() => setSectionLine(null)}>
              {tr("drawings.clearSection")}
            </Button>
          )}
        </div>
        <div className="mt-1 text-[11px] text-ink-400">
          {sectionLine
            ? `${(sectionLine.a.x / 1000).toFixed(2)},${(sectionLine.a.y / 1000).toFixed(2)} → ${(sectionLine.b.x / 1000).toFixed(2)},${(sectionLine.b.y / 1000).toFixed(2)} m`
            : "A–A"}
        </div>
      </Panel>
    </div>
  );
}
