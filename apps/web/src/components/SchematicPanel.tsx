import { useState } from "react";
import {
  makeTranslator,
  materialById,
  materialGroups,
  materialsByCategory,
  searchMaterialLibrary,
  type MaterialCategory,
} from "@qreasee/shared";
import type { RoofType } from "@qreasee/schematic";
import { useApp } from "../state/store";
import { MATERIAL_DND_TYPE } from "../scene/controller";
import { Button, Field, Panel, Select, TextInput } from "./ui";

function categoryFor(kind: string, slabKind: "floor" | "ceiling" | undefined): MaterialCategory {
  if (kind === "wall") return "wall";
  if (kind === "roof") return "roof";
  if (kind === "slab") return slabKind === "ceiling" ? "ceiling" : "floor";
  if (kind === "room") return "floor";
  return "wall";
}

export function SchematicPanel() {
  const lang = useApp((s) => s.lang);
  const tr = makeTranslator(lang);
  const schematic = useApp((s) => s.schematic);
  const selectedMassId = useApp((s) => s.selectedMassId);
  const selectedElement = useApp((s) => s.selectedElement);
  const elementMaterials = useApp((s) => s.elementMaterials);
  const setElementMaterial = useApp((s) => s.setElementMaterial);
  const roofType = useApp((s) => s.roofType);
  const roofPitch = useApp((s) => s.roofPitch);
  const showSchematic = useApp((s) => s.showSchematic);
  const generate = useApp((s) => s.generateSelectedSchematic);
  const clear = useApp((s) => s.clearSchematic);
  const setRoofType = useApp((s) => s.setRoofType);
  const setRoofPitch = useApp((s) => s.setRoofPitch);
  const generateRoof = useApp((s) => s.generateRoof);
  const toggle = useApp((s) => s.toggleSchematic);
  const wallKind = useApp((s) => s.wallKind);
  const setWallKind = useApp((s) => s.setWallKind);
  const setTool = useApp((s) => s.setTool);
  const docState = useApp((s) => s.docState);
  const detachElement = useApp((s) => s.detachElement);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const groups = materialGroups();
  const library = searchMaterialLibrary(query, group || undefined, 240);
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  const slabKind =
    selectedElement?.kind === "slab"
      ? schematic?.slabs.find((x) => x.id === selectedElement.id)?.kind
      : undefined;
  const category = selectedElement ? categoryFor(selectedElement.kind, slabKind) : "wall";
  const selEntity =
    selectedElement?.kind === "wall"
      ? docState.walls.find((x) => x.id === selectedElement.id)
      : selectedElement?.kind === "slab"
        ? docState.slabs.find((x) => x.id === selectedElement.id)
        : selectedElement?.kind === "roof"
          ? docState.roofs.find((x) => x.id === selectedElement.id)
          : selectedElement?.kind === "stair"
            ? docState.stairs.find((x) => x.id === selectedElement.id)
            : undefined;
  const sourceNames = (selEntity?.sourceBlockIds ?? []).map(
    (id) => docState.rooms.find((r) => r.id === id)?.name ?? id,
  );
  const isGenerated = selEntity?.origin === "generated";

  return (
    <div className="space-y-3">
      <Panel title={tr("schematic.title")}>
        <p className="mb-2 text-[11px] leading-relaxed text-ink-500">{tr("schematic.hint")}</p>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="primary" onClick={generate}>
            {schematic ? tr("schematic.regenerate") : tr("schematic.generate")}
          </Button>
          {schematic && (
            <Button size="sm" variant="ghost" onClick={toggle}>
              {showSchematic ? tr("context.hide") : tr("context.show")}
            </Button>
          )}
          {schematic && (
            <Button size="sm" variant="ghost" onClick={clear}>
              {tr("schematic.clear")}
            </Button>
          )}
        </div>
        {!selectedMassId && <p className="mt-2 text-[11px] text-ink-500">{tr("schematic.selectMass")}</p>}
      </Panel>

      <Panel title={tr("schematic.wallTools")}>
        <p className="mb-2 text-[11px] leading-relaxed text-ink-500">{tr("schematic.wallHint")}</p>
        <div className="flex gap-1">
          {(["exterior", "partition"] as const).map((k) => (
            <button
              key={k}
              onClick={() => {
                setWallKind(k);
                setTool("wall");
              }}
              className={
                "flex-1 rounded-md border px-2 py-1 text-[11px] transition-colors " +
                (wallKind === k
                  ? "border-lens-visual/70 bg-lens-visual/10 text-lens-visual"
                  : "border-ink-800 text-ink-300 hover:border-ink-600")
              }
            >
              {tr(`schematic.${k}` as never)} · {k === "exterior" ? 150 : 100} mm
            </button>
          ))}
        </div>
      </Panel>

      {schematic && (
        <>
          <Panel title={tr("element.title")}>
            {!selectedElement ? (
              <p className="text-[11px] text-ink-500">{tr("element.none")}</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-ink-100">
                    {tr(`element.${selectedElement.kind}` as never)}
                    {slabKind ? ` · ${tr(`element.${slabKind}` as never)}` : ""}
                  </span>
                  <span className="font-mono text-ink-500">{selectedElement.id}</span>
                </div>
                <div className="text-[11px] text-ink-400">
                  {tr("element.material")}:{" "}
                  <span className="text-ink-200">
                    {materialById(elementMaterials[selectedElement.id] ?? defaultFor(category))?.name[lang] ?? "—"}
                  </span>
                </div>
                {isGenerated && (
                  <div className="space-y-1 border-t border-ink-800 pt-2 text-[10px] text-ink-400">
                    <div>
                      {tr("gen.from" as never)}:{" "}
                      <span className="text-ink-200">{sourceNames.join(", ") || "—"}</span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => detachElement(selectedElement)}>
                      {tr("gen.detach" as never)}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Panel>

          <Panel title={tr("materials.title")}>
            <p className="mb-2 text-[11px] text-ink-500">{tr("materials.hint")}</p>
            <div className="mb-1 text-[10px] uppercase tracking-wide text-ink-500">
              {tr(`materials.category.${category}` as never)}
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {materialsByCategory(category).map((m) => {
                const active = selectedElement
                  ? (elementMaterials[selectedElement.id] ?? defaultFor(category)) === m.id
                  : false;
                return (
                  <button
                    key={m.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(MATERIAL_DND_TYPE, m.id);
                      e.dataTransfer.setData("text/plain", m.id);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    disabled={!selectedElement}
                    onClick={() => selectedElement && setElementMaterial(selectedElement.id, m.id)}
                    className={
                      "flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors disabled:opacity-40 " +
                      (active ? "border-lens-visual/70 bg-lens-visual/10" : "border-ink-800 hover:border-ink-600")
                    }
                  >
                    <span className="h-4 w-4 shrink-0 rounded-sm border border-black/30" style={{ background: m.color }} />
                    <span className="text-ink-200">{m.name[lang]}</span>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title={tr("materials.library")}>
            <p className="mb-2 text-[11px] leading-relaxed text-ink-500">{tr("materials.libraryHint")}</p>
            <TextInput
              className="mb-1.5"
              placeholder={tr("materials.search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Select className="mb-2" value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="" className="bg-ink-900">
                {tr("materials.allGroups")}
              </option>
              {groups.map((g) => (
                <option key={g.group} value={g.group} className="bg-ink-900">
                  {g.group} ({g.count})
                </option>
              ))}
            </Select>
            {library.length === 0 ? (
              <p className="text-[10px] text-ink-600">{tr("materials.none")}</p>
            ) : (
              <div className="grid max-h-80 grid-cols-3 gap-1.5 overflow-y-auto pr-1">
                {library.map((m) => {
                  const active = selectedElement
                    ? (elementMaterials[selectedElement.id] ?? defaultFor(category)) === m.id
                    : false;
                  return (
                    <button
                      key={m.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(MATERIAL_DND_TYPE, m.id);
                        e.dataTransfer.setData("text/plain", m.id);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      disabled={!selectedElement}
                      onClick={() => selectedElement && setElementMaterial(selectedElement.id, m.id)}
                      title={`${m.name[lang]} · ${m.group}`}
                      className={
                        "overflow-hidden rounded-md border text-left transition-colors disabled:opacity-40 " +
                        (active ? "border-lens-visual/70" : "border-ink-800 hover:border-ink-600")
                      }
                    >
                      <img
                        src={`${base}/${m.texture}`}
                        alt=""
                        loading="lazy"
                        className="h-12 w-full object-cover"
                      />
                      <span className="block truncate px-1 py-0.5 text-[9px] text-ink-300">
                        {m.name[lang]}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-2 text-[10px] text-ink-600">{tr("materials.dragHint")}</p>
          </Panel>

          <Panel title={tr("schematic.roof")}>
            <Field label={tr("schematic.roofType")}>
              <Select value={roofType} onChange={(e) => setRoofType(e.target.value as RoofType)}>
                <option value="hip">{tr("schematic.hip")}</option>
                <option value="gable">{tr("schematic.gable")}</option>
                <option value="shed">{tr("schematic.shed")}</option>
              </Select>
            </Field>
            <Field label={tr("schematic.pitch")} hint="deg">
              <TextInput type="number" step="5" value={roofPitch} onChange={(e) => setRoofPitch(Number(e.target.value) || 0)} />
            </Field>
            <input
              type="range"
              min={0}
              max={60}
              step={5}
              value={roofPitch}
              onChange={(e) => setRoofPitch(Number(e.target.value))}
              className="mb-2 w-full"
              aria-label={tr("schematic.pitch")}
            />
            <Button size="sm" variant="outline" onClick={generateRoof}>
              {tr("schematic.generateRoof")}
            </Button>
            <div className="mt-1 text-[10px] text-ink-500">{tr("schematic.generateRoofHint")}</div>
            <div className="text-[11px] text-ink-400">
              {tr("schematic.overhang")}: {schematic.options.roofOverhang} mm · {tr("schematic.walls")}: {schematic.walls.length}
            </div>
          </Panel>

          <Panel title={tr("schematic.rooms")}>
            <div className="mb-1 text-[11px] text-ink-400">
              {tr("schematic.roomCount", { n: schematic.rooms.length })}
            </div>
            <div className="space-y-1">
              {schematic.rooms.map((r) => (
                <button
                  key={r.id}
                  onClick={() => useApp.getState().selectElement({ kind: "room", id: r.id })}
                  className="flex w-full justify-between rounded px-1 py-0.5 text-left text-[11px] hover:bg-ink-800"
                >
                  <span className="text-ink-200">{r.name}</span>
                  <span className="font-mono text-ink-400">{(r.areaMm2 / 1e6).toFixed(1)} m²</span>
                </button>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

function defaultFor(category: MaterialCategory): string {
  switch (category) {
    case "floor":
      return "floor-ceramic";
    case "ceiling":
      return "ceiling-gypsum";
    case "roof":
      return "roof-concrete-tile";
    default:
      return "wall-brick-paint";
  }
}
