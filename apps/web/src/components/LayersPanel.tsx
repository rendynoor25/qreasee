import { useState } from "react";
import { makeTranslator, QREASEE_MATERIALS } from "@qreasee/shared";
import { useApp } from "../state/store";
import { Button, Field, Panel, Select, TextInput } from "./ui";
import { cn } from "../lib/utils";

/** Base URL so material textures resolve in dev and in a production build. */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/";

export function LayersPanel() {
  const lang = useApp((s) => s.lang);
  const tr = makeTranslator(lang);
  const layers = useApp((s) => s.docState.layers);
  const activeLayerId = useApp((s) => s.docState.activeLayerId);
  const masses = useApp((s) => s.docState.masses);
  const selectedMassId = useApp((s) => s.selectedMassId);
  const selectedMassIds = useApp((s) => s.selectedMassIds);
  const groups = useApp((s) => s.docState.groups);
  const addLayer = useApp((s) => s.addLayer);
  const updateLayer = useApp((s) => s.updateLayer);
  const removeLayer = useApp((s) => s.removeLayer);
  const setActiveLayer = useApp((s) => s.setActiveLayer);
  const setMassLayer = useApp((s) => s.setMassLayer);
  const renameMass = useApp((s) => s.renameMass);
  const groupSelected = useApp((s) => s.groupSelected);
  const ungroupSelected = useApp((s) => s.ungroupSelected);
  const renameGroup = useApp((s) => s.renameGroup);
  const selectGroup = useApp((s) => s.selectGroup);
  const underlays = useApp((s) => s.docState.underlays);
  const levels = useApp((s) => s.docState.levels);
  const importUnderlay = useApp((s) => s.importUnderlay);
  const updateUnderlay = useApp((s) => s.updateUnderlay);
  const removeUnderlay = useApp((s) => s.removeUnderlay);
  const setStatus = useApp((s) => s.setStatus);
  const activeMaterialId = useApp((s) => s.activeMaterialId);
  const setActiveMaterial = useApp((s) => s.setActiveMaterial);
  const [underlayLevelId, setUnderlayLevelId] = useState(levels[0]?.id ?? "");

  const onUnderlayFile = async (file: File | undefined) => {
    if (!file) return;
    const levelId = underlayLevelId || levels[0]?.id;
    if (!levelId) return;
    const name = file.name.replace(/\.[^.]+$/, "");
    try {
      const head = new Uint8Array(await file.slice(0, 6).arrayBuffer());
      const { dwgToDxf, looksLikeDwg } = await import("../lib/dwg");
      if (looksLikeDwg(head) || /\.dwg$/i.test(file.name)) {
        setStatus(`Converting ${file.name} with LibreDWG…`);
        const dxf = await dwgToDxf(await file.arrayBuffer());
        importUnderlay(dxf, name, levelId);
        return;
      }
      importUnderlay(await file.text(), name, levelId);
    } catch (err) {
      setStatus(`Underlay import failed: ${(err as Error).message}`);
    }
  };

  const fallbackLayerId = layers[0]?.id;
  const layerOf = (massLayerId: string | undefined) => massLayerId ?? fallbackLayerId;
  const selectedMass = masses.find((m) => m.id === selectedMassId);

  return (
    <div className="space-y-3">
      <Panel
        title={tr("layers.title")}
        actions={
          <Button size="sm" variant="outline" onClick={() => addLayer()}>
            + {tr("layers.add")}
          </Button>
        }
      >
        <p className="mb-2 text-[11px] leading-relaxed text-ink-500">{tr("layers.intro")}</p>
        <div className="space-y-1">
          {layers.map((l) => {
            const count = masses.filter((m) => layerOf(m.layerId) === l.id).length;
            const active = l.id === activeLayerId;
            return (
              <div
                key={l.id}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-1.5 py-1",
                  active ? "border-lens-visual/60 bg-ink-800/60" : "border-ink-800",
                )}
              >
                <button
                  title={tr("layers.visibility")}
                  onClick={() => updateLayer(l.id, { visible: !l.visible })}
                  className={cn(
                    "w-5 shrink-0 rounded text-center text-[12px] leading-none",
                    l.visible ? "text-ink-200" : "text-ink-600",
                  )}
                >
                  {l.visible ? "◉" : "○"}
                </button>
                <input
                  type="color"
                  value={l.color ?? "#8b9199"}
                  onChange={(e) => updateLayer(l.id, { color: e.target.value })}
                  title={tr("layers.makeActive")}
                  className="h-5 w-6 shrink-0 cursor-pointer rounded border border-ink-700 bg-ink-950"
                />
                <input
                  value={l.name}
                  onChange={(e) => updateLayer(l.id, { name: e.target.value })}
                  className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-[11px] text-ink-100 outline-none hover:border-ink-700 focus:border-lens-visual/60"
                />
                <span className="shrink-0 font-mono text-[10px] text-ink-500" title={tr("layers.objects")}>
                  {count}
                </span>
                <button
                  title={tr("layers.makeActive")}
                  onClick={() => setActiveLayer(l.id)}
                  className={cn(
                    "w-4 shrink-0 rounded text-center text-[10px]",
                    active ? "text-lens-visual" : "text-ink-600 hover:text-ink-200",
                  )}
                >
                  ●
                </button>
                <button
                  title={tr("common.delete")}
                  disabled={layers.length <= 1}
                  onClick={() => removeLayer(l.id)}
                  className="w-4 shrink-0 rounded text-center text-[11px] text-ink-600 hover:text-state-over disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title={tr("layers.selection")}>
        {selectedMass ? (
          <>
            <Field label={tr("layers.objectName")}>
              <TextInput
                value={selectedMass.name ?? ""}
                onChange={(e) => renameMass(selectedMass.id, e.target.value)}
              />
            </Field>
            <Field label={tr("layers.objectLayer")}>
              <Select
                value={layerOf(selectedMass.layerId)}
                onChange={(e) => setMassLayer([selectedMass.id], e.target.value)}
              >
                {layers.map((l) => (
                  <option key={l.id} value={l.id} className="bg-ink-900">
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : (
          <p className="text-[11px] text-ink-500">{tr("layers.noSelection")}</p>
        )}
      </Panel>

      <Panel
        title={tr("groups.title")}
        actions={
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={selectedMassIds.length === 0}
              onClick={groupSelected}
            >
              {tr("groups.group")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={selectedMassIds.length === 0}
              onClick={ungroupSelected}
            >
              {tr("groups.ungroup")}
            </Button>
          </div>
        }
      >
        <p className="mb-2 text-[11px] leading-relaxed text-ink-500">
          {tr("groups.hint", { n: selectedMassIds.length })}
        </p>
        {groups.length === 0 ? (
          <p className="text-[11px] text-ink-600">{tr("groups.none")}</p>
        ) : (
          <div className="space-y-1">
            {groups.map((g) => {
              const count = masses.filter((m) => m.groupId === g.id).length;
              return (
                <div
                  key={g.id}
                  className="flex items-center gap-1.5 rounded-md border border-ink-800 px-1.5 py-1"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full border border-ink-600"
                    style={{ background: g.color ?? "#8b9199" }}
                  />
                  <input
                    value={g.name}
                    onChange={(e) => renameGroup(g.id, e.target.value)}
                    className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-[11px] text-ink-100 outline-none hover:border-ink-700 focus:border-lens-visual/60"
                  />
                  <span className="shrink-0 font-mono text-[10px] text-ink-500">{count}</span>
                  <button
                    title={tr("groups.select")}
                    onClick={() => selectGroup(g.id)}
                    className="w-4 shrink-0 rounded text-center text-[10px] text-ink-600 hover:text-ink-200"
                  >
                    ●
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title={tr("underlay.title")}>
        <p className="mb-2 text-[11px] leading-relaxed text-ink-500">{tr("underlay.intro")}</p>
        <Field label={tr("underlay.level")}>
          <Select value={underlayLevelId} onChange={(e) => setUnderlayLevelId(e.target.value)}>
            {levels.map((l) => (
              <option key={l.id} value={l.id} className="bg-ink-900">
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-ink-700 px-3 py-1.5 text-[11px] text-ink-300 hover:border-ink-500">
          <input
            type="file"
            accept=".dxf,.dwg"
            className="hidden"
            onChange={(e) => void onUnderlayFile(e.target.files?.[0])}
          />
          {tr("underlay.import")}
        </label>
        <p className="mt-2 text-[10px] leading-relaxed text-ink-600">{tr("underlay.hint")}</p>
        {underlays.length === 0 ? (
          <p className="mt-2 text-[11px] text-ink-600">{tr("underlay.none")}</p>
        ) : (
          <div className="mt-2 space-y-1">
            {underlays.map((u) => {
              const lvl = levels.find((l) => l.id === u.levelId);
              return (
                <div
                  key={u.id}
                  className="flex items-center gap-1.5 rounded-md border border-ink-800 px-1.5 py-1"
                >
                  <button
                    title={tr("underlay.visibility")}
                    onClick={() => updateUnderlay(u.id, { visible: u.visible === false })}
                    className={cn(
                      "w-5 shrink-0 text-center text-[12px] leading-none",
                      u.visible === false ? "text-ink-600" : "text-ink-200",
                    )}
                  >
                    {u.visible === false ? "○" : "◉"}
                  </button>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-ink-100" title={u.name}>
                    {u.name}
                  </span>
                  <span className="shrink-0 text-[10px] text-ink-500">{lvl?.name ?? ""}</span>
                  <span className="shrink-0 font-mono text-[10px] text-ink-500">{u.lines.length}</span>
                  <button
                    title={tr("common.delete")}
                    onClick={() => removeUnderlay(u.id)}
                    className="w-4 shrink-0 text-center text-[11px] text-ink-600 hover:text-state-over"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title={tr("material.title")}>
        <p className="mb-2 text-[11px] leading-relaxed text-ink-500">{tr("material.intro")}</p>
        <div className="grid grid-cols-4 gap-1.5">
          {QREASEE_MATERIALS.map((m) => (
            <button
              key={m.id}
              title={m.name[lang]}
              onClick={() => setActiveMaterial(m.id)}
              className={cn(
                "relative h-12 overflow-hidden rounded border transition-colors",
                activeMaterialId === m.id
                  ? "border-lens-visual ring-1 ring-lens-visual"
                  : "border-ink-700 hover:border-ink-500",
              )}
              style={{
                backgroundColor: "#c9d2da",
                backgroundImage: m.texture ? `url(${BASE}${m.texture})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <span className="absolute inset-x-0 bottom-0 truncate bg-ink-950/70 px-1 text-[8px] text-ink-100">
                {m.name[lang]}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-2 text-[10px] text-ink-500">
          {tr("material.active")}:{" "}
          <span className="text-ink-200">
            {QREASEE_MATERIALS.find((m) => m.id === activeMaterialId)?.name[lang] ?? "—"}
          </span>
        </div>
      </Panel>
    </div>
  );
}
