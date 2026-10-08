import { useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  allViews,
  findView,
  makeTranslator,
  newId,
  SHEET_SIZES,
  type Sheet,
  type SheetDimensionItem,
  type SheetImageItem,
  type SheetItem,
  type SheetSize,
  type SheetTextItem,
  type SheetViewItem,
} from "@qreasee/shared";
import { drawingSvgFor } from "../lib/drawings";
import { useApp } from "../state/store";
import { Button, Field, Panel, Select, TextInput } from "./ui";
import { cn } from "../lib/utils";
import { sheetSvgString } from "../lib/sheetSvg";
import { exportSheetsPdf } from "../lib/sheetPdf";

type SheetTool = "select" | "text" | "dimension";

function applyOffset(item: SheetItem, dx: number, dy: number): SheetItem {
  if (item.kind === "dimension") {
    return { ...item, x1: item.x1 + dx, y1: item.y1 + dy, x2: item.x2 + dx, y2: item.y2 + dy };
  }
  return { ...item, x: item.x + dx, y: item.y + dy };
}

export function SheetEditor() {
  const lang = useApp((s) => s.lang);
  const tr = makeTranslator(lang);
  const sheets = useApp((s) => s.docState.sheets);
  const levels = useApp((s) => s.docState.levels);
  const grids = useApp((s) => s.docState.grids);
  const siteBoundaryLength = useApp((s) => s.docState.site.boundary.length);
  const views = useApp((s) => s.docState.views);
  const viewOverrides = useApp((s) => s.docState.viewOverrides);
  const activeSheetId = useApp((s) => s.activeSheetId);
  const setActiveSheet = useApp((s) => s.setActiveSheet);
  const addSheet = useApp((s) => s.addSheet);
  const updateSheet = useApp((s) => s.updateSheet);
  const removeSheet = useApp((s) => s.removeSheet);
  const setSheetItems = useApp((s) => s.setSheetItems);
  const placeViewOnSheet = useApp((s) => s.placeViewOnSheet);
  const capture = useApp((s) => s.capture);
  const placeCaptureOnSheet = useApp((s) => s.placeCaptureOnSheet);
  const schematic = useApp((s) => s.schematic);
  const setActiveView = useApp((s) => s.setActiveView);
  const sectionLine = useApp((s) => s.sectionLine);
  const project = useApp((s) => s.project);
  const studioKit = useApp((s) => s.studioKit);

  const [tool, setTool] = useState<SheetTool>("select");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [dimDraft, setDimDraft] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(
    null,
  );
  const dragRef = useRef<{ id: string; grabX: number; grabY: number; orig: SheetItem } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const allViewsList = useMemo(
    () =>
      allViews({
        levels: levels.map((l) => ({ id: l.id, name: l.name })),
        siteBoundaryLength,
        hasSection: !!sectionLine,
        views,
        viewOverrides,
      }),
    [levels, siteBoundaryLength, sectionLine, views, viewOverrides],
  );

  const sheet: Sheet | undefined =
    sheets.find((s) => s.id === activeSheetId) ?? sheets[0] ?? undefined;
  const size = sheet ? SHEET_SIZES[sheet.size] : SHEET_SIZES.A3;

  const commit = (items: SheetItem[]) => {
    if (sheet) setSheetItems(sheet.id, items);
  };

  const toMm = (e: ReactPointerEvent) => {
    const svg = wrapRef.current?.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const onDown = (e: ReactPointerEvent) => {
    if (!sheet) return;
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      // Synthetic/edge pointer ids may not be capturable; not fatal.
    }
    const p = toMm(e);
    if (tool === "text") {
      const item: SheetTextItem = {
        id: newId("stxt"),
        kind: "text",
        x: p.x,
        y: p.y,
        text: tr("sheets.newText"),
        sizeMm: 6,
      };
      commit([...sheet.items, item]);
      setSelectedItemId(item.id);
      setTool("select");
      return;
    }
    if (tool === "dimension") {
      setDimDraft({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
      return;
    }
    const target = (e.target as Element).closest("[data-item-id]");
    const id = target?.getAttribute("data-item-id") ?? null;
    setSelectedItemId(id);
    if (id) {
      const item = sheet.items.find((i) => i.id === id);
      if (item) dragRef.current = { id, grabX: p.x, grabY: p.y, orig: JSON.parse(JSON.stringify(item)) };
    } else {
      dragRef.current = null;
    }
  };

  /** Part 4: double-click a viewport to enter the view and edit it. */
  const onEnterView = (e: ReactMouseEvent) => {
    const id = (e.target as Element).closest("[data-item-id]")?.getAttribute("data-item-id");
    if (!id || !sheet) return;
    const item = sheet.items.find((i) => i.id === id);
    if (item?.kind === "view") setActiveView(item.viewId);
  };

  const onMove = (e: ReactPointerEvent) => {
    if (dimDraft) {
      const p = toMm(e);
      setDimDraft({ ...dimDraft, x2: p.x, y2: p.y });
      return;
    }
    const d = dragRef.current;
    if (d) {
      const p = toMm(e);
      setDrag({ id: d.id, dx: p.x - d.grabX, dy: p.y - d.grabY });
    }
  };

  const onUp = (e: ReactPointerEvent) => {
    if (!sheet) return;
    if (dimDraft) {
      const p = toMm(e);
      const len = Math.hypot(p.x - dimDraft.x1, p.y - dimDraft.y1);
      if (len > 5) {
        const item: SheetDimensionItem = {
          id: newId("sdim"),
          kind: "dimension",
          x1: dimDraft.x1,
          y1: dimDraft.y1,
          x2: p.x,
          y2: p.y,
        };
        commit([...sheet.items, item]);
      }
      setDimDraft(null);
      return;
    }
    const d = dragRef.current;
    if (d && drag) {
      const moved = applyOffset(d.orig, drag.dx, drag.dy);
      commit(sheet.items.map((i) => (i.id === d.id ? moved : i)));
    }
    dragRef.current = null;
    setDrag(null);
  };

  const deleteItem = (id: string) => {
    if (!sheet) return;
    commit(sheet.items.filter((i) => i.id !== id));
    if (selectedItemId === id) setSelectedItemId(null);
  };

  const patchItem = (
    id: string,
    patch:
      | Partial<SheetViewItem>
      | Partial<SheetTextItem>
      | Partial<SheetImageItem>
      | Partial<SheetDimensionItem>,
  ) => {
    if (!sheet) return;
    commit(sheet.items.map((i) => (i.id === id ? ({ ...i, ...patch } as SheetItem) : i)));
  };

  const selectedItem = sheet?.items.find((i) => i.id === selectedItemId) ?? null;

  const drawableViews = allViewsList.filter((v) =>
    ["plan", "elevation", "section"].includes(v.kind),
  );

  const buildDrawings = (s: Sheet): Record<string, string | null> => {
    const map: Record<string, string | null> = {};
    for (const item of s.items) {
      if (item.kind === "view") {
        const v = findView(allViewsList, item.viewId);
        map[item.viewId] = v ? drawingSvgFor(v.kind, sectionLine, { grids, levels }, v.levelId) : null;
      }
    }
    return map;
  };

  const titleFor = (s: Sheet) => {
    const tb = studioKit.identity.titleBlock;
    return {
      studio: tb.studioName || studioKit.name,
      projectName: project.name,
      sheetPrefix: studioKit.identity.sheetPrefix,
      stageLabel: tb.stageLabel,
      address: tb.address,
      client: tb.client,
      consultant: tb.consultant,
      drawnBy: tb.drawnBy,
      checkedBy: tb.checkedBy,
      approvedBy: tb.approvedBy,
      scaleLabel: tr("sheets.scaleLabel"),
    };
  };

  const sheetIndex = sheet ? sheets.findIndex((s) => s.id === sheet.id) + 1 : 1;

  const viewsMeta = () => Object.fromEntries(allViewsList.map((v) => [v.id, { name: v.name }]));

  const svgString = sheet
    ? sheetSvgString(sheet, {
        drawings: buildDrawings(sheet),
        title: titleFor(sheet),
        selectedItemId,
        drag,
        dimDraft,
        sheetIndex,
        sheetCount: sheets.length,
        views: viewsMeta(),
      })
    : "";

  const onExportPdf = async () => {
    if (sheets.length === 0) return;
    try {
      await exportSheetsPdf(
        sheets,
        (s) => ({ drawings: buildDrawings(s), title: titleFor(s), views: viewsMeta() }),
        `${project.name || "qreasee"}-sheets.pdf`,
      );
    } catch (err) {
      useApp.getState().setStatus(`PDF export failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="flex h-full min-h-0">
      {/* Filmstrip */}
      <div className="flex w-[128px] shrink-0 flex-col gap-2 overflow-y-auto border-r border-ink-800 bg-ink-900/80 p-2">
        {sheets.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setActiveSheet(s.id);
              setSelectedItemId(null);
            }}
            className={cn(
              "rounded-md border p-1 text-left transition-colors",
              s.id === sheet?.id ? "border-lens-visual/70 bg-ink-800/60" : "border-ink-800 hover:border-ink-600",
            )}
          >
            <SheetThumb sheet={s} />
            <div className="mt-1 truncate text-[10px] font-semibold text-ink-200">{s.number}</div>
            <div className="truncate text-[9px] text-ink-500">{s.name}</div>
          </button>
        ))}
        <Button size="sm" variant="outline" onClick={addSheet}>
          + {tr("sheets.add")}
        </Button>
      </div>

      {/* Canvas */}
      <div className="relative flex min-w-0 flex-1 flex-col bg-ink-950">
        <div className="flex items-center gap-1 border-b border-ink-800 bg-ink-900/80 px-2 py-1.5">
          <SheetToolButton active={tool === "select"} onClick={() => setTool("select")}>
            {tr("sheets.select")}
          </SheetToolButton>
          <SheetToolButton active={tool === "text"} onClick={() => setTool("text")}>
            {tr("sheets.text")}
          </SheetToolButton>
          <SheetToolButton active={tool === "dimension"} onClick={() => setTool("dimension")}>
            {tr("sheets.dimension")}
          </SheetToolButton>
          <span className="mx-1 h-4 w-px bg-ink-800" />
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) placeViewOnSheet(e.target.value);
              e.target.value = "";
            }}
            className="rounded-md border border-ink-700 bg-ink-950/70 px-2 py-1 text-[11px] text-ink-200 outline-none"
          >
            <option value="">{tr("sheets.addView")}</option>
            {drawableViews.map((v) => (
              <option key={v.id} value={v.id} className="bg-ink-900">
                {v.name}
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={() => placeCaptureOnSheet()} disabled={!capture}>
            {tr("sheets.placeCapture")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void onExportPdf()} disabled={sheets.length === 0}>
            {tr("sheets.exportPdf")}
          </Button>
          <span className="ml-auto text-[10px] text-ink-500">
            {tool === "text"
              ? tr("sheets.hintText")
              : tool === "dimension"
                ? tr("sheets.hintDimension")
                : tr("sheets.hintSelect")}
          </span>
        </div>

        {!sheet ? (
          <div className="flex flex-1 items-center justify-center">
            <Panel title={tr("sheets.title")}>
              <p className="mb-2 text-[11px] text-ink-500">{tr("sheets.empty")}</p>
              <Button variant="primary" size="sm" onClick={addSheet}>
                + {tr("sheets.add")}
              </Button>
            </Panel>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
            <div
              ref={wrapRef}
              className="h-full w-full rounded shadow-panel [&>svg]:h-full [&>svg]:w-full"
              style={{ background: "white" }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onDoubleClick={onEnterView}
              dangerouslySetInnerHTML={{ __html: svgString }}
            />
          </div>
        )}
      </div>

      {/* Properties */}
      <div className="w-[230px] shrink-0 overflow-y-auto border-l border-ink-800 bg-ink-900/70 p-3">
        {sheet && (
          <div className="space-y-3">
            <Panel title={tr("sheets.sheet")}>
              <Field label={tr("sheets.name")}>
                <TextInput value={sheet.name} onChange={(e) => updateSheet(sheet.id, { name: e.target.value })} />
              </Field>
              <Field label={tr("sheets.number")}>
                <TextInput
                  value={sheet.number}
                  onChange={(e) => updateSheet(sheet.id, { number: e.target.value })}
                />
              </Field>
              <Field label={tr("sheets.size")}>
                <Select
                  value={sheet.size}
                  onChange={(e) => updateSheet(sheet.id, { size: e.target.value as SheetSize })}
                >
                  {(["A4", "A3", "A2"] as const).map((s) => (
                    <option key={s} value={s} className="bg-ink-900">
                      {s} · {SHEET_SIZES[s].w}×{SHEET_SIZES[s].h} mm
                    </option>
                  ))}
                </Select>
              </Field>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeSheet(sheet.id)}
                disabled={sheets.length <= 1}
              >
                {tr("sheets.deleteSheet")}
              </Button>
            </Panel>

            <Panel title={tr("sheets.properties")}>
              {!selectedItem ? (
                <p className="text-[11px] text-ink-500">{tr("sheets.noneSelected")}</p>
              ) : selectedItem.kind === "view" ? (
                <ViewProps item={selectedItem} tr={tr} onPatch={(p) => patchItem(selectedItem.id, p)} onDelete={() => deleteItem(selectedItem.id)} />
              ) : selectedItem.kind === "text" ? (
                <TextProps item={selectedItem} tr={tr} onPatch={(p) => patchItem(selectedItem.id, p)} onDelete={() => deleteItem(selectedItem.id)} />
              ) : selectedItem.kind === "image" ? (
                <ImageProps item={selectedItem} tr={tr} onPatch={(p) => patchItem(selectedItem.id, p)} onDelete={() => deleteItem(selectedItem.id)} />
              ) : (
                <div className="space-y-2">
                  <div className="text-[11px] text-ink-400">
                    {tr("sheets.dimension")} ·{" "}
                    {(Math.hypot(selectedItem.x2 - selectedItem.x1, selectedItem.y2 - selectedItem.y1) / 1000).toFixed(2)} m
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => deleteItem(selectedItem.id)}>
                    {tr("common.delete")}
                  </Button>
                </div>
              )}
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}

function SheetToolButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md px-2 py-1 text-[11px] transition-colors",
        active ? "bg-lens-visual/20 text-lens-visual" : "text-ink-400 hover:text-ink-100",
      )}
    >
      {children}
    </button>
  );
}

function ViewProps({
  item,
  tr,
  onPatch,
  onDelete,
}: {
  item: SheetViewItem;
  tr: ReturnType<typeof makeTranslator>;
  onPatch: (p: Partial<SheetViewItem>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-2">
      <Field label={tr("sheets.label")}>
        <TextInput value={item.label ?? ""} onChange={(e) => onPatch({ label: e.target.value })} />
      </Field>
      <Field label={tr("sheets.scale")}>
        <Select value={String(item.scale ?? 100)} onChange={(e) => onPatch({ scale: Number(e.target.value) })}>
          {[50, 100, 200].map((n) => (
            <option key={n} value={n} className="bg-ink-900">
              1:{n}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={tr("sheets.width")} hint="mm">
          <TextInput type="number" value={Math.round(item.w)} onChange={(e) => onPatch({ w: Number(e.target.value) || 10 })} />
        </Field>
        <Field label={tr("sheets.height")} hint="mm">
          <TextInput type="number" value={Math.round(item.h)} onChange={(e) => onPatch({ h: Number(e.target.value) || 10 })} />
        </Field>
      </div>
      <Button size="sm" variant="ghost" onClick={onDelete}>
        {tr("common.delete")}
      </Button>
    </div>
  );
}

function TextProps({
  item,
  tr,
  onPatch,
  onDelete,
}: {
  item: SheetTextItem;
  tr: ReturnType<typeof makeTranslator>;
  onPatch: (p: Partial<SheetTextItem>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-2">
      <Field label={tr("sheets.content")}>
        <TextInput value={item.text} onChange={(e) => onPatch({ text: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={tr("sheets.textSize")} hint="mm">
          <TextInput type="number" step="0.5" value={item.sizeMm} onChange={(e) => onPatch({ sizeMm: Number(e.target.value) || 3 })} />
        </Field>
        <label className="flex items-end gap-1 pb-2 text-[11px] text-ink-400">
          <input type="checkbox" checked={!!item.bold} onChange={(e) => onPatch({ bold: e.target.checked })} />
          {tr("sheets.bold")}
        </label>
      </div>
      <Button size="sm" variant="ghost" onClick={onDelete}>
        {tr("common.delete")}
      </Button>
    </div>
  );
}

function ImageProps({
  item,
  tr,
  onPatch,
  onDelete,
}: {
  item: SheetImageItem;
  tr: ReturnType<typeof makeTranslator>;
  onPatch: (p: Partial<SheetImageItem>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-2">
      <Field label={tr("sheets.label")}>
        <TextInput value={item.label ?? ""} onChange={(e) => onPatch({ label: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={tr("sheets.width")} hint="mm">
          <TextInput type="number" value={Math.round(item.w)} onChange={(e) => onPatch({ w: Number(e.target.value) || 10 })} />
        </Field>
        <Field label={tr("sheets.height")} hint="mm">
          <TextInput type="number" value={Math.round(item.h)} onChange={(e) => onPatch({ h: Number(e.target.value) || 10 })} />
        </Field>
      </div>
      <Button size="sm" variant="ghost" onClick={onDelete}>
        {tr("common.delete")}
      </Button>
    </div>
  );
}

function SheetThumb({ sheet }: { sheet: Sheet }) {
  const size = SHEET_SIZES[sheet.size];
  return (
    <svg viewBox={`0 0 ${size.w} ${size.h}`} className="w-full rounded-sm bg-white" style={{ aspectRatio: `${size.w} / ${size.h}` }}>
      <rect x={0} y={0} width={size.w} height={size.h} fill="#fff" />
      {sheet.items.map((i) =>
        i.kind === "view" || i.kind === "image" ? (
          <rect key={i.id} x={i.x} y={i.y} width={i.w} height={i.h} fill="#dbe3ee" stroke="#94a3b8" strokeWidth={1} />
        ) : i.kind === "dimension" ? (
          <line key={i.id} x1={i.x1} y1={i.y1} x2={i.x2} y2={i.y2} stroke="#94a3b8" strokeWidth={1} />
        ) : (
          <rect key={i.id} x={i.x} y={i.y - i.sizeMm} width={i.text.length * i.sizeMm * 0.6} height={i.sizeMm} fill="#94a3b8" />
        ),
      )}
    </svg>
  );
}
