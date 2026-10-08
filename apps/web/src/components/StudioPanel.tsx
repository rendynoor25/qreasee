import { useRef } from "react";
import {
  BUILDING_TYPES,
  makeTranslator,
  materialsByCategory,
  type BuildingType,
  type StudioKit,
} from "@qreasee/shared";
import { useApp } from "../state/store";
import { Button, Field, Panel, Select, TextInput } from "./ui";

const prettify = (s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function StudioPanel() {
  const lang = useApp((s) => s.lang);
  const tr = makeTranslator(lang);
  const kit = useApp((s) => s.studioKit);
  const setStudioKit = useApp((s) => s.setStudioKit);
  const applyStudioStandards = useApp((s) => s.applyStudioStandards);
  const fileRef = useRef<HTMLInputElement>(null);

  /** Clone-and-patch so the store's normalize step always sees a full kit. */
  const mutate = (fn: (k: StudioKit) => void) => {
    const next = JSON.parse(JSON.stringify(kit)) as StudioKit;
    fn(next);
    setStudioKit(next);
  };

  const onLogoFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => mutate((k) => (k.identity.logoUrl = String(reader.result)));
    reader.readAsDataURL(file);
  };

  const wallMats = materialsByCategory("wall");
  const floorMats = materialsByCategory("floor");
  const ceilingMats = materialsByCategory("ceiling");
  const roofMats = materialsByCategory("roof");

  const materialSelect = (
    label: string,
    value: string,
    options: { id: string; name: { en: string; id: string } }[],
    onChange: (id: string) => void,
  ) => (
    <Field label={label}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((m) => (
          <option key={m.id} value={m.id} className="bg-ink-900">
            {m.name[lang]}
          </option>
        ))}
      </Select>
    </Field>
  );

  return (
    <div className="space-y-3">
      <Panel title={tr("studio.title")}>
        <p className="mb-3 text-[11px] leading-relaxed text-ink-400">{tr("studio.intro")}</p>
        <Field label={tr("studio.name")}>
          <TextInput
            value={kit.name}
            onChange={(e) => mutate((k) => (k.name = e.target.value))}
          />
        </Field>
      </Panel>

      <Panel title={tr("studio.identity")}>
        <Field label={tr("studio.primaryColor")}>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={kit.identity.primaryColor}
              onChange={(e) => mutate((k) => (k.identity.primaryColor = e.target.value))}
              className="h-8 w-10 cursor-pointer rounded border border-ink-700 bg-ink-950"
            />
            <TextInput
              value={kit.identity.primaryColor}
              onChange={(e) => mutate((k) => (k.identity.primaryColor = e.target.value))}
            />
          </div>
        </Field>

        <Field label={tr("studio.logo")} hint={tr("studio.logoHint")}>
          <div className="flex items-center gap-2">
            {kit.identity.logoUrl ? (
              <img src={kit.identity.logoUrl} alt="" className="h-8 max-w-[80px] object-contain" />
            ) : (
              <span className="text-[10px] text-ink-600">—</span>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onLogoFile(e.target.files?.[0])}
            />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              {tr("studio.upload")}
            </Button>
            {kit.identity.logoUrl && (
              <Button size="sm" variant="ghost" onClick={() => mutate((k) => delete k.identity.logoUrl)}>
                {tr("common.clear")}
              </Button>
            )}
          </div>
        </Field>

        <div className="mb-1 text-[11px] text-ink-400">{tr("studio.palette")}</div>
        <div className="space-y-1.5">
          {kit.identity.palette.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="color"
                value={c.hex}
                onChange={(e) =>
                  mutate((k) => (k.identity.palette[i].hex = e.target.value))
                }
                className="h-7 w-8 cursor-pointer rounded border border-ink-700 bg-ink-950"
              />
              <TextInput
                value={c.name}
                onChange={(e) => mutate((k) => (k.identity.palette[i].name = e.target.value))}
              />
              <Button
                size="sm"
                variant="ghost"
                title={tr("common.remove")}
                onClick={() => mutate((k) => k.identity.palette.splice(i, 1))}
              >
                ✕
              </Button>
            </div>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="mt-2"
          onClick={() =>
            mutate((k) => k.identity.palette.push({ name: tr("studio.newColor"), hex: "#888888" }))
          }
        >
          + {tr("studio.addColor")}
        </Button>
      </Panel>

      <Panel title={tr("studio.titleBlock")}>
        <Field label={tr("studio.studioName")}>
          <TextInput
            value={kit.identity.titleBlock.studioName}
            onChange={(e) => mutate((k) => (k.identity.titleBlock.studioName = e.target.value))}
          />
        </Field>
        <Field label={tr("studio.address")}>
          <TextInput
            value={kit.identity.titleBlock.address ?? ""}
            onChange={(e) => mutate((k) => (k.identity.titleBlock.address = e.target.value))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={tr("studio.drawnBy")}>
            <TextInput
              value={kit.identity.titleBlock.drawnBy ?? ""}
              onChange={(e) => mutate((k) => (k.identity.titleBlock.drawnBy = e.target.value))}
            />
          </Field>
          <Field label={tr("studio.checkedBy")}>
            <TextInput
              value={kit.identity.titleBlock.checkedBy ?? ""}
              onChange={(e) => mutate((k) => (k.identity.titleBlock.checkedBy = e.target.value))}
            />
          </Field>
          <Field label={tr("studio.approvedBy")}>
            <TextInput
              value={kit.identity.titleBlock.approvedBy ?? ""}
              onChange={(e) => mutate((k) => (k.identity.titleBlock.approvedBy = e.target.value))}
            />
          </Field>
          <Field label={tr("studio.stageLabel")}>
            <TextInput
              value={kit.identity.titleBlock.stageLabel ?? ""}
              onChange={(e) => mutate((k) => (k.identity.titleBlock.stageLabel = e.target.value))}
            />
          </Field>
        </div>
        <Field label={tr("studio.sheetPrefix")}>
          <Select
            value={kit.identity.sheetPrefix}
            onChange={(e) =>
              mutate((k) => (k.identity.sheetPrefix = e.target.value === "A" ? "A" : "K"))
            }
          >
            <option value="K" className="bg-ink-900">
              K — Konstruksi
            </option>
            <option value="A" className="bg-ink-900">
              A — Architecture
            </option>
          </Select>
        </Field>
      </Panel>

      <Panel title={tr("studio.rates")}>
        <p className="mb-2 text-[11px] text-ink-500">{tr("studio.ratesHint")}</p>
        <div className="space-y-1.5">
          {BUILDING_TYPES.map((bt: BuildingType) => (
            <div key={bt} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-[11px] text-ink-400">{prettify(bt)}</span>
              <TextInput
                type="number"
                value={kit.standards.rates[bt]?.low ?? 0}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  mutate((k) => {
                    k.standards.rates[bt] = {
                      low: v,
                      high: k.standards.rates[bt]?.high ?? v,
                    };
                  });
                }}
              />
              <TextInput
                type="number"
                value={kit.standards.rates[bt]?.high ?? 0}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  mutate((k) => {
                    k.standards.rates[bt] = {
                      low: k.standards.rates[bt]?.low ?? v,
                      high: v,
                    };
                  });
                }}
              />
            </div>
          ))}
        </div>
      </Panel>

      <Panel title={tr("studio.materials")}>
        <p className="mb-2 text-[11px] text-ink-500">{tr("studio.materialsHint")}</p>
        {materialSelect(tr("studio.wall"), kit.standards.materials.wall, wallMats, (id) =>
          mutate((k) => (k.standards.materials.wall = id)),
        )}
        {materialSelect(tr("studio.partition"), kit.standards.materials.partition, wallMats, (id) =>
          mutate((k) => (k.standards.materials.partition = id)),
        )}
        {materialSelect(tr("studio.floor"), kit.standards.materials.floor, floorMats, (id) =>
          mutate((k) => (k.standards.materials.floor = id)),
        )}
        {materialSelect(tr("studio.ceiling"), kit.standards.materials.ceiling, ceilingMats, (id) =>
          mutate((k) => (k.standards.materials.ceiling = id)),
        )}
        {materialSelect(tr("studio.roof"), kit.standards.materials.roof, roofMats, (id) =>
          mutate((k) => (k.standards.materials.roof = id)),
        )}
      </Panel>

      <Panel title={tr("studio.pen")}>
        <p className="mb-2 text-[11px] text-ink-500">{tr("studio.penHint")}</p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["cut", "studio.penCut"],
              ["projection", "studio.penProjection"],
              ["annotation", "studio.penAnnotation"],
              ["grid", "studio.penGrid"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={tr(label)} hint="mm">
              <TextInput
                type="number"
                step="0.01"
                min="0"
                value={kit.standards.pen[key]}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  mutate((k) => (k.standards.pen[key] = v));
                }}
              />
            </Field>
          ))}
        </div>
      </Panel>

      <Panel title={tr("studio.apply")}>
        <p className="mb-2 text-[11px] text-ink-400">{tr("studio.applyHint")}</p>
        <Button variant="primary" size="sm" onClick={applyStudioStandards}>
          {tr("studio.applyButton")}
        </Button>
      </Panel>
    </div>
  );
}
