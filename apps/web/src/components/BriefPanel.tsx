import { useState } from "react";
import {
  formatArea,
  formatRupiahRange,
  makeTranslator,
  programItemTotalM2,
  type ProgramItem,
  type ProgramQuality,
  type Room,
  type Translator,
} from "@qreasee/shared";
import { ringArea, bounds } from "@qreasee/geometry";
import { getRecipe, rollupProgram } from "@qreasee/concept";
import { useApp } from "../state/store";
import { Button, Field, Panel, Select, TextInput } from "./ui";
import { download } from "../lib/utils";

const m = 1000;

function num(s: string): number {
  const v = Number(s.trim().replace(",", "."));
  return Number.isFinite(v) ? v : 0;
}

/** Parse pasted TSV/CSV text into program rows. Lenient about columns. */
function parseRows(text: string): ProgramItem[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  const out: ProgramItem[] = [];
  lines.forEach((line, i) => {
    const cells = line.split(/\t|;/).map((c) => c.trim());
    let group = "Public";
    let name = "Room";
    let qty = 1;
    let area = 10;
    if (cells.length >= 4) {
      group = cells[0] || "Public";
      name = cells[1] || "Room";
      qty = Math.max(1, Math.round(num(cells[2])));
      area = num(cells[3]) || 10;
    } else if (cells.length === 3) {
      name = cells[0] || "Room";
      qty = Math.max(1, Math.round(num(cells[1])));
      area = num(cells[2]) || 10;
    } else if (cells.length === 2) {
      name = cells[0] || "Room";
      area = num(cells[1]) || 10;
    } else {
      name = cells[0] || "Room";
    }
    out.push({
      id: `paste-${Date.now().toString(36)}-${i}`,
      name,
      group,
      qty,
      areaEach: area,
      targetArea: qty * area,
      source: "imported",
    });
  });
  return out;
}

/** Minimal CSV parser (handles quoted fields with commas). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      }
      if (c === "\r" && text[i + 1] === "\n") i++;
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const HEADER = {
  name: /^(room|space|nama|ruang)/i,
  qty: /^(qty|count|jumlah|jml)/i,
  area: /^(area|luas)/i,
  group: /^(group|kelompok|department|grup)/i,
};

function mapCsv(rows: string[][]): ProgramItem[] {
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  const idx = { name: -1, qty: -1, area: -1, group: -1 };
  header.forEach((h, i) => {
    if (idx.name < 0 && HEADER.name.test(h)) idx.name = i;
    if (idx.qty < 0 && HEADER.qty.test(h)) idx.qty = i;
    if (idx.area < 0 && HEADER.area.test(h)) idx.area = i;
    if (idx.group < 0 && HEADER.group.test(h)) idx.group = i;
  });
  const hasHeader = idx.name >= 0 || idx.qty >= 0 || idx.area >= 0;
  const body = hasHeader ? rows.slice(1) : rows;
  const pick = (r: string[], i: number) => (i >= 0 && i < r.length ? r[i] : "");
  return body
    .filter((r) => r.some((c) => c.trim().length > 0))
    .map((r, i) => {
      const name = hasHeader ? pick(r, idx.name) : r[0];
      const qty = hasHeader ? num(pick(r, idx.qty)) : num(r[1]);
      const area = hasHeader ? num(pick(r, idx.area)) : num(r[2]);
      const group = hasHeader ? pick(r, idx.group) : r[3];
      const q = Math.max(1, Math.round(qty || 1));
      const a = area || 10;
      return {
        id: `csv-${Date.now().toString(36)}-${i}`,
        name: name || "Room",
        group: group || "Public",
        qty: q,
        areaEach: a,
        targetArea: q * a,
        source: "imported" as const,
      };
    });
}

function BlockEditor({
  room,
  levels,
  baseElevationMm,
  targetAreaM2,
  lang,
  tr,
  onUpdate,
  onStack,
}: {
  room: Room;
  levels: { id: string; name: string }[];
  baseElevationMm: number;
  targetAreaM2: number | null;
  lang: "en" | "id";
  tr: Translator;
  onUpdate: (id: string, patch: Partial<Room>) => void;
  onStack: () => void;
}) {
  const b = bounds(room.polygon.outer);
  const [w, setW] = useState(Math.round(b.width / 100) / 10);
  const [d, setD] = useState(Math.round(b.height / 100) / 10);
  const [h, setH] = useState(Math.round((room.height ?? 3000) / 100) / 10);
  const [lock, setLock] = useState(true);
  const areaM2 = room.areaMm2 / 1_000_000;
  const delta = targetAreaM2 != null ? areaM2 - targetAreaM2 : null;

  const commit = (nw: number, nd: number) => {
    if (!(nw > 0) || !(nd > 0)) return;
    const cx = b.center.x;
    const cy = b.center.y;
    const wmm = nw * 1000;
    const dmm = nd * 1000;
    onUpdate(room.id, {
      polygon: {
        outer: [
          { x: cx - wmm / 2, y: cy - dmm / 2 },
          { x: cx + wmm / 2, y: cy - dmm / 2 },
          { x: cx + wmm / 2, y: cy + dmm / 2 },
          { x: cx - wmm / 2, y: cy + dmm / 2 },
        ],
        holes: [],
      },
      areaMm2: wmm * dmm,
    });
  };

  const onWidth = (v: number) => {
    const nd = lock && v > 0 ? areaM2 / v : d;
    setW(v);
    setD(nd);
    commit(v, nd);
  };
  const onDepth = (v: number) => {
    const nw = lock && v > 0 ? areaM2 / v : w;
    setD(v);
    setW(nw);
    commit(nw, v);
  };
  const onHeight = (v: number) => {
    if (!(v > 0)) return;
    setH(v);
    onUpdate(room.id, { height: v * 1000 });
  };

  return (
    <Panel title={tr("element.room")}>
      <div className="mb-1 text-[11px] text-ink-300">
        {room.name} · {areaM2.toFixed(1)} m² · {(areaM2 * h).toFixed(1)} m³
      </div>
      {delta != null && (
        <div className="mb-1 text-[10px] text-ink-500">
          {tr("brief.target")}: {targetAreaM2!.toFixed(1)} m² ({delta >= 0 ? "+" : ""}
          {delta.toFixed(1)} m²)
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <Field label={tr("wizard.where.width")}>
          <TextInput type="number" step="0.1" value={w} onChange={(e) => onWidth(Number(e.target.value) || 0)} />
        </Field>
        <Field label={tr("wizard.where.depth")}>
          <TextInput type="number" step="0.1" value={d} onChange={(e) => onDepth(Number(e.target.value) || 0)} />
        </Field>
        <Field label={tr("brief.height")} hint="m">
          <TextInput type="number" step="0.1" value={h} onChange={(e) => onHeight(Number(e.target.value) || 0)} />
        </Field>
      </div>
      <label className="mt-1 flex items-center gap-1 text-[11px] text-ink-400">
        <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} />
        {tr("brief.areaLock")}
      </label>
      <Field label={tr("brief.level")}>
        <Select value={room.levelId} onChange={(e) => onUpdate(room.id, { levelId: e.target.value })}>
          {levels.map((l) => (
            <option key={l.id} value={l.id} className="bg-ink-900">
              {l.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-400">
        <span>
          {tr("brief.elevation")}: <span className="font-mono text-ink-200">{(baseElevationMm / 1000).toFixed(2)} m</span>
        </span>
        <Button size="sm" variant="outline" className="ml-auto" onClick={onStack}>
          {tr("brief.stack")}
        </Button>
      </div>
      <div className="mt-1 text-[10px] text-ink-600">
        {lang === "id"
          ? "Geser blok ke atas blok lain untuk menumpuk, atau pilih level."
          : "Drag a block over another to stack it, or pick a level."}
      </div>
    </Panel>
  );
}

export function BriefPanel() {
  const lang = useApp((s) => s.lang);
  const tr = makeTranslator(lang);
  const state = useApp((s) => s.docState);
  const dispatch = useApp((s) => s.dispatch);
  const setRecipeParam = useApp((s) => s.setRecipeParam);
  const setRecipeQuality = useApp((s) => s.setRecipeQuality);
  const toggleRecipeAddon = useApp((s) => s.toggleRecipeAddon);
  const addProgramRow = useApp((s) => s.addProgramRow);
  const importProgramRows = useApp((s) => s.importProgramRows);
  const selectedRoomId = useApp((s) => s.selectedRoomId);
  const selectRoom = useApp((s) => s.selectRoom);
  const updateRoom = useApp((s) => s.updateRoom);
  const stackRoom = useApp((s) => s.stackRoom);

  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const program = state.brief.program;
  const settings = state.brief.settings;
  const binding = settings?.recipeBinding;
  const recipe = binding ? getRecipe(binding.recipeId) : undefined;
  const siteAreaM2 = state.site.boundary.length >= 3 ? ringArea(state.site.boundary) / 1_000_000 : 0;

  const rollup = rollupProgram({
    program,
    settings,
    siteAreaM2,
    rules: { klbMax: state.rules.klbMax },
    budget: { ratePerM2: state.budget.ratePerM2 },
  });

  const selectedRoom = state.rooms.find((r) => r.id === selectedRoomId) ?? null;
  const selectedItemId = selectedRoom?.programItemId;

  const patch = (id: string, p: Partial<ProgramItem>) =>
    dispatch({ type: "brief.updateProgram", id, patch: { ...p, edited: true } });

  const groups: Array<{ group: string; items: ProgramItem[] }> = [];
  program.forEach((item) => {
    const g = item.group ?? "Ungrouped";
    let bucket = groups.find((x) => x.group === g);
    if (!bucket) {
      bucket = { group: g, items: [] };
      groups.push(bucket);
    }
    bucket.items.push(item);
  });

  const exportCsv = () => {
    const lines = ["Group,Room,Qty,AreaEach,Total"];
    for (const item of program) {
      lines.push(
        [item.group ?? "", item.name, item.qty ?? 1, item.areaEach ?? item.targetArea, programItemTotalM2(item)]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      );
    }
    download("program.csv", lines.join("\n"), "text/csv");
  };

  const onCsvFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const rows = mapCsv(parseCsv(text));
    if (rows.length > 0) importProgramRows(rows);
  };

  return (
    <div className="space-y-3">
      <Panel title={tr("brief.summary")}>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <span className="text-ink-400">{tr("brief.net")}</span>
          <span className="text-right font-mono text-ink-100">{formatArea(rollup.netM2 * 1e6, lang, 1)}</span>
          <span className="text-ink-400">{tr("brief.circulation")}</span>
          <span className="flex items-center justify-end gap-1">
            <TextInput
              type="number"
              className="h-6 w-14 px-1 py-0 text-right"
              value={settings?.circulationPct ?? 20}
              onChange={(e) =>
                dispatch({ type: "brief.setSettings", patch: { circulationPct: num(e.target.value) } })
              }
            />
            <span className="text-ink-500">%</span>
          </span>
          <span className="text-ink-400">{tr("brief.gross")}</span>
          <span className="text-right font-mono text-ink-100">{formatArea(rollup.grossM2 * 1e6, lang, 1)}</span>
          <span className="text-ink-400">{tr("brief.allowed")}</span>
          <span className="text-right font-mono text-ink-300">
            {rollup.allowedGfaM2 === null ? "—" : formatArea(rollup.allowedGfaM2 * 1e6, lang, 1)}
          </span>
          <span className="text-ink-400">{tr("brief.cost")}</span>
          <span className="text-right font-mono text-ink-300">
            {rollup.costLow !== null && rollup.costHigh !== null
              ? formatRupiahRange(rollup.costLow, rollup.costHigh)
              : "—"}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3 text-[11px]">
          <span className={rollup.status === "over" ? "text-state-over" : rollup.status === "near" ? "text-state-near" : rollup.status === "ok" ? "text-state-ok" : "text-ink-500"}>
            {tr(`status.${rollup.status}` as never)}
          </span>
          <span className="text-ink-500">
            {rollup.roomCount} {tr("brief.rooms")} · {rollup.groupCount} {tr("brief.groups")}
          </span>
        </div>
      </Panel>

      {recipe && binding && (
        <Panel title={tr("brief.assumptions")}>
          <p className="mb-2 text-[11px] leading-relaxed text-ink-500">{tr("brief.recipeHint")}</p>
          <div className="space-y-1.5">
            {recipe.params.map((p) => (
              <div key={p.key} className="flex items-center gap-2 text-[11px]">
                <span className="flex-1 text-ink-300">{p.label[lang]}</span>
                <TextInput
                  type="number"
                  className="h-6 w-16 px-1 py-0 text-right"
                  value={binding.paramValues[p.key] ?? p.default}
                  onChange={(e) => setRecipeParam(p.key, num(e.target.value))}
                />
                <span className="w-10 text-ink-500">{p.unit ?? ""}</span>
                <span className={"w-16 text-right " + (p.basis === "typical" ? "text-state-near" : "text-ink-500")}>
                  {tr(`basis.${p.basis}` as never)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px]">
            <span className="text-ink-400">{tr("brief.quality")}</span>
            {(["economy", "standard", "premium"] as ProgramQuality[]).map((q) => (
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
          {recipe.addons.length > 0 && (
            <div className="mt-2 text-[11px]">
              <span className="text-ink-400">{tr("brief.addons")}: </span>
              {recipe.addons.map((a) => (
                <label key={a.id} className="mr-3 inline-flex items-center gap-1 text-ink-300">
                  <input
                    type="checkbox"
                    checked={binding.addonIds.includes(a.id)}
                    onChange={() => toggleRecipeAddon(a.id)}
                  />
                  {a.label[lang]}
                </label>
              ))}
            </div>
          )}
        </Panel>
      )}

      {selectedRoom && (
        <BlockEditor
          key={selectedRoom.id}
          room={selectedRoom}
          levels={state.levels.map((l) => ({ id: l.id, name: l.name }))}
          baseElevationMm={
            selectedRoom.elevationMm ??
            state.levels.find((l) => l.id === selectedRoom.levelId)?.elevation ??
            0
          }
          targetAreaM2={
            (() => {
              const item = state.brief.program.find((p) => p.id === selectedRoom.programItemId);
              return item ? programItemTotalM2(item) : null;
            })()
          }
          lang={lang}
          tr={tr}
          onUpdate={updateRoom}
          onStack={() => stackRoom(selectedRoom.id)}
        />
      )}

      <Panel
        title={tr("brief.requirement")}
        actions={
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setPasteOpen((v) => !v)}>
              {tr("brief.paste")}
            </Button>
            <label className="inline-flex cursor-pointer items-center rounded px-2 py-1 text-[11px] text-ink-300 hover:bg-ink-800">
              {tr("brief.importCsv")}
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void onCsvFile(e.target.files?.[0])} />
            </label>
            <Button size="sm" variant="ghost" onClick={exportCsv}>
              {tr("brief.exportCsv")}
            </Button>
          </div>
        }
      >
        {pasteOpen && (
          <div className="mb-2">
            <textarea
              className="h-20 w-full rounded-md border border-ink-700 bg-ink-950/70 p-2 font-mono text-[11px] text-ink-100 outline-none"
              placeholder={"Group\tRoom\tQty\tArea\nPublic\tLiving\t1\t20"}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              className="mt-1"
              onClick={() => {
                const rows = parseRows(pasteText);
                if (rows.length) importProgramRows(rows);
                setPasteText("");
                setPasteOpen(false);
              }}
            >
              {tr("brief.addRow")}
            </Button>
          </div>
        )}

        {program.length === 0 ? (
          <p className="text-[11px] text-ink-500">{tr("brief.empty")}</p>
        ) : (
          <div className="max-h-[46vh] overflow-y-auto pr-1">
            <table className="w-full text-[11px]">
              <thead className="text-ink-500">
                <tr>
                  <th className="py-1 text-left font-medium">{tr("brief.room")}</th>
                  <th className="py-1 text-right font-medium">{tr("brief.qty")}</th>
                  <th className="py-1 text-right font-medium">{tr("brief.areaEach")}</th>
                  <th className="py-1 text-right font-medium">{tr("brief.total")}</th>
                  <th />
                </tr>
              </thead>
              {groups.map((g) => {
                const subtotal = g.items.reduce((s, it) => s + programItemTotalM2(it), 0);
                return (
                  <tbody key={g.group}>
                    <tr>
                      <td colSpan={5} className="pt-2 text-[10px] uppercase tracking-wide text-ink-500">
                        {g.group} · {formatArea(subtotal * 1e6, lang, 1)}
                      </td>
                    </tr>
                    {g.items.map((item) => {
                      const index = program.indexOf(item);
                      return (
                        <tr key={item.id} className="border-b border-ink-800/50">
                          <td className="py-0.5">
                            <TextInput
                              className="h-6 px-1 py-0"
                              value={item.name}
                              onChange={(e) => patch(item.id, { name: e.target.value })}
                              onFocus={() => {
                                const first = state.rooms.find((r) => r.programItemId === item.id);
                                selectRoom(first ? first.id : null);
                              }}
                            />
                          </td>
                          <td className="py-0.5">
                            <TextInput
                              type="number"
                              className="h-6 w-12 px-1 py-0 text-right"
                              value={item.qty ?? 1}
                              onChange={(e) => {
                                const qty = Math.max(1, Math.round(num(e.target.value)));
                                patch(item.id, { qty, targetArea: qty * (item.areaEach ?? item.targetArea) });
                              }}
                            />
                          </td>
                          <td className="py-0.5">
                            <TextInput
                              type="number"
                              className="h-6 w-14 px-1 py-0 text-right"
                              value={item.areaEach ?? item.targetArea}
                              onChange={(e) => {
                                const areaEach = num(e.target.value);
                                patch(item.id, { areaEach, targetArea: (item.qty ?? 1) * areaEach });
                              }}
                            />
                          </td>
                          <td className="py-0.5 text-right font-mono text-ink-300">
                            {programItemTotalM2(item).toFixed(1)}
                          </td>
                          <td className="py-0.5 text-right">
                            <button className="px-1 text-ink-500 hover:text-ink-100" onClick={() => dispatch({ type: "brief.reorderProgram", from: index, to: Math.max(0, index - 1) })}>
                              ↑
                            </button>
                            <button className="px-1 text-ink-500 hover:text-ink-100" onClick={() => dispatch({ type: "brief.reorderProgram", from: index, to: Math.min(program.length - 1, index + 1) })}>
                              ↓
                            </button>
                            <button className="px-1 text-ink-500 hover:text-state-over" onClick={() => dispatch({ type: "brief.removeProgram", id: item.id })}>
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
            </table>
          </div>
        )}
        <Button size="sm" variant="outline" className="mt-2 w-full" onClick={addProgramRow}>
          {tr("brief.addRow")}
        </Button>
      </Panel>
    </div>
  );
}
