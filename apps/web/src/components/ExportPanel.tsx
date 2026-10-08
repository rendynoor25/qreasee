import { useMemo } from "react";
import { makeTranslator } from "@qreasee/shared";
import { DocumentStore } from "@qreasee/document";
import { computeIndicators } from "@qreasee/indicators";
import {
  comparisonSheetSvg,
  decisionLogCsv,
  decisionLogMarkdown,
  exportCollada,
  exportDxf,
  exportQrs,
  importQrs,
  type ComparisonBranch,
} from "@qreasee/export";
import { useApp } from "../state/store";
import { Button, Panel } from "./ui";
import { exportGltf, exportObj } from "../scene/exportThree";
import { download, readFileAsBytes } from "../lib/utils";

export function ExportPanel() {
  const lang = useApp((s) => s.lang);
  const tr = makeTranslator(lang);
  const project = useApp((s) => s.project);
  const state = useApp((s) => s.docState);
  const branches = useApp((s) => s.branches);
  const compareBranchIds = useApp((s) => s.compareBranchIds);
  const replaceWorkspace = useApp((s) => s.replaceWorkspace);
  const setStatus = useApp((s) => s.setStatus);

  const safeName = project.name.replace(/[^A-Za-z0-9._-]+/g, "_") || "qreasee";

  const comparison = useMemo(() => {
    const ids = compareBranchIds.length >= 2 ? compareBranchIds : branches.filter((b) => !b.main).map((b) => b.id);
    const list: ComparisonBranch[] = [];
    for (const id of ids) {
      const b = useApp.getState().doc.getBranch(id);
      if (!b) continue;
      list.push({
        name: b.branch.name,
        color: b.branch.color,
        plan: b.state.masses.map((m) => ({ outer: m.footprint.outer, holes: m.footprint.holes })),
        indicators: computeIndicators(b.state, { branchId: id, version: b.version, lang }),
      });
    }
    return list;
  }, [compareBranchIds, branches, lang, state]);

  const bestByKey = useMemo(() => {
    const best: Record<string, string | undefined> = {};
    const keys = ["klb", "kdb", "kdh", "gfa", "cost"];
    for (const key of keys) {
      let name: string | undefined;
      let bestRank = -1;
      for (const b of comparison) {
        const r = b.indicators.find((x) => x.key === key);
        const rank = r?.status === "ok" ? 3 : r?.status === "near" ? 2 : 1;
        if (rank > bestRank) {
          bestRank = rank;
          name = b.name;
        }
      }
      best[key] = name;
    }
    return best;
  }, [comparison]);

  const items: Array<{ label: string; onClick: () => void | Promise<void> }> = [
    { label: tr("export.dxf"), onClick: () => download(`${safeName}.dxf`, exportDxf(state, project), "application/dxf") },
    { label: tr("export.collada"), onClick: () => download(`${safeName}.dae`, exportCollada(state, project), "model/vnd.collada+xml") },
    {
      label: tr("export.gltf"),
      onClick: async () => {
        const result = await exportGltf(state, project, true);
        download(`${safeName}.glb`, result instanceof ArrayBuffer ? new Uint8Array(result) : result, "model/gltf-binary");
      },
    },
    { label: tr("export.obj"), onClick: () => download(`${safeName}.obj`, exportObj(state, project), "text/plain") },
    {
      label: tr("export.sheet"),
      onClick: () => {
        const svg = comparisonSheetSvg(project.name, comparison, bestByKey);
        svgToPng(svg, `${safeName}_comparison.png`);
      },
    },
    { label: `${tr("export.log")} · MD`, onClick: () => download(`${safeName}_decisions.md`, decisionLogMarkdown(state), "text/markdown") },
    { label: `${tr("export.log")} · CSV`, onClick: () => download(`${safeName}_decisions.csv`, decisionLogCsv(state), "text/csv") },
    {
      label: tr("export.qrs"),
      onClick: () => {
        const bytes = exportQrs({
          format: "qreasee",
          formatVersion: 3,
          savedAt: new Date().toISOString(),
          project,
          docState: state,
          store: useApp.getState().doc.serialize(),
        });
        download(`${safeName}.qrs`, bytes, "application/zip");
      },
    },
  ];

  return (
    <div className="space-y-3">
      <Panel title={tr("export.title")}>
        <p className="mb-3 text-[11px] text-ink-500">
          Hand off the adopted massing to the studio's existing tools. DXF opens in AutoCAD; COLLADA opens in SketchUp with levels and grid.
        </p>
        <div className="grid grid-cols-1 gap-1.5">
          {items.map((item) => (
            <Button key={item.label} variant="outline" size="sm" className="justify-start" onClick={() => void item.onClick()}>
              {item.label}
            </Button>
          ))}
        </div>
      </Panel>

      <Panel title={tr("export.importQrs")}>
        <label className="block cursor-pointer rounded-md border border-dashed border-ink-700 px-3 py-4 text-center text-[11px] text-ink-400 hover:border-ink-500">
          <input
            type="file"
            accept=".qrs,.zip"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const bytes = await readFileAsBytes(file);
                const payload = importQrs(bytes);
                replaceWorkspace(payload.project, DocumentStore.deserialize(payload.store));
                setStatus(`Imported ${file.name}`);
              } catch (err) {
                setStatus(`Import failed: ${(err as Error).message}`);
              }
            }}
          />
          {tr("export.importQrs")}
        </label>
      </Panel>
    </div>
  );
}

function svgToPng(svg: string, filename: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = (img.width || 1600) * 2;
    canvas.height = (img.height || 1200) * 2;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#0b0d10";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((b) => {
        if (b) {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(b);
          a.download = filename;
          a.click();
        }
      }, "image/png");
    }
    URL.revokeObjectURL(url);
  };
  img.src = url;
}
