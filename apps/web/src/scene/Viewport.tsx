import { useEffect, useRef, useState } from "react";
import { t } from "@qreasee/shared";
import { allViews, DEFAULT_VIEW_ID, findView } from "@qreasee/shared";
import type { Operation } from "@qreasee/document";
import { ViewportController } from "./controller";
import type { OverlayState, SnapMarkerView, Snapshot } from "./types";
import { useApp } from "../state/store";

function buildSnapshot(): Snapshot {
  const s = useApp.getState();
  const compareBranches = s.compareBranchIds
    .map((id) => {
      const b = s.doc.getBranch(id);
      return b ? { id, name: b.branch.name, color: b.branch.color, state: b.state } : null;
    })
    .filter((b): b is NonNullable<typeof b> => !!b);
  const views = allViews({
    levels: s.docState.levels.map((l) => ({ id: l.id, name: l.name })),
    siteBoundaryLength: s.docState.site.boundary.length,
    hasSection: !!s.sectionLine,
    views: s.docState.views,
    viewOverrides: s.docState.viewOverrides,
  });
  const activeView = findView(views, s.activeViewId) ?? findView(views, DEFAULT_VIEW_ID);
  return {
    project: s.project,
    state: s.docState,
    activeBranchId: s.activeBranchId,
    lens: s.lens,
    tool: s.tool,
    selectedMassId: s.selectedMassId,
    selectedMassIds: s.selectedMassIds,
    activeLevelId: s.activeLevelId,
    sunView: s.sunView,
    showGrid: activeView?.layers?.grid ?? s.showGrid,
    sunFaces: s.sunFaces,
    compareBranches,
    overlayCompare: s.overlayCompare,
    contextBuildings: s.contextBuildings,
    showContext: activeView?.layers?.context ?? s.showContext,
    schematic: s.schematic,
    showSchematic: s.showSchematic,
    mode: s.mode,
    projection: s.projection,
    selectedElement: s.selectedElement,
    selectedRoomId: s.selectedRoomId,
    sectionLine: s.sectionLine,
    activeView,
    theme: s.theme,
    lang: s.lang,
    brandColor: s.studioKit.identity.primaryColor,
  };
}

export function Viewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<ViewportController | null>(null);
  const [overlay, setOverlay] = useState<OverlayState>({
    hint: null,
    snapLabel: null,
    typed: "",
    coords: null,
    breachCount: 0,
    markers: [],
    debug: null,
    tape: null,
  });

  const lang = useApp((s) => s.lang);
  const revision = useApp((s) => s.revision);
  const lens = useApp((s) => s.lens);
  const tool = useApp((s) => s.tool);
  const selectedMassId = useApp((s) => s.selectedMassId);
  const activeLevelId = useApp((s) => s.activeLevelId);
  const sunView = useApp((s) => s.sunView);
  const showGrid = useApp((s) => s.showGrid);
  const overlayCompare = useApp((s) => s.overlayCompare);
  const compareKey = useApp((s) => s.compareBranchIds.join(","));
  const sunKey = useApp((s) => s.sunFaces?.length ?? 0);
  const contextKey = useApp((s) => s.contextBuildings.length);
  const showContext = useApp((s) => s.showContext);
  const schematicKey = useApp((s) => (s.schematic ? s.schematic.rooms.length * 1000 + s.schematic.walls.length : 0));
  const showSchematic = useApp((s) => s.showSchematic);
  const mode = useApp((s) => s.mode);
  const projection = useApp((s) => s.projection);
  const setProjection = useApp((s) => s.setProjection);
  const selectedElementKey = useApp((s) => (s.selectedElement ? `${s.selectedElement.kind}:${s.selectedElement.id}` : ""));
  const selectedRoomKey = useApp((s) => s.selectedRoomId ?? "");
  const activeViewId = useApp((s) => s.activeViewId);
  const sectionKey = useApp((s) => (s.sectionLine ? `${s.sectionLine.a.x},${s.sectionLine.a.y},${s.sectionLine.b.x},${s.sectionLine.b.y}` : ""));
  const theme = useApp((s) => s.theme);
  const project = useApp((s) => s.project);
  const panel = useApp((s) => s.panel);

  // The right panel opening/closing changes the canvas size. rAF and
  // ResizeObserver are paused in a background tab, so also nudge the renderer
  // on the state change itself (timers still fire when hidden).
  useEffect(() => {
    const t1 = setTimeout(() => controllerRef.current?.resize(), 60);
    const t2 = setTimeout(() => controllerRef.current?.resize(), 280);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [panel, mode]);

  useEffect(() => {
    if (!containerRef.current) return;
    const controller = new ViewportController(containerRef.current, {
      getSnapshot: buildSnapshot,
      dispatch: (op) => useApp.getState().dispatch(op as Operation),
      onSelect: (id, additive) => useApp.getState().selectMass(id, additive),
      onSelectElement: (ref) => useApp.getState().selectElement(ref),
      onElementMaterial: (ref, materialId) => {
        useApp.getState().selectElement(ref);
        useApp.getState().setElementMaterial(ref.id, materialId);
      },
      onSelectRoom: (id) => useApp.getState().selectRoom(id),
      onSectionLine: (line) => useApp.getState().setSectionLine(line),
      onOverlay: setOverlay,
      onAddWall: (a, b) => useApp.getState().addWall(a, b),
      onPlaceOpening: (point, kind) => useApp.getState().placeOpening(point, kind),
      onAddRoom: (points) => useApp.getState().addRoomPolygon(points),
      onAddStair: (a, b) => useApp.getState().addStair(a, b),
      onAddRoof: (polygon) => useApp.getState().addRoof(polygon),
      onAddRailing: (a, b) => useApp.getState().addRailing(a, b),
    });
    controllerRef.current = controller;
    controller.refresh();
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.refresh();
  }, [revision, lens, tool, selectedMassId, activeLevelId, sunView, showGrid, overlayCompare, compareKey, sunKey, contextKey, showContext, theme, schematicKey, showSchematic, mode, projection, selectedElementKey, selectedRoomKey, activeViewId, sectionKey, project.northAngle, project.location.lat, project.location.lng]);

  const hint = overlay.hint ? t(lang, overlay.hint as never) : null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={containerRef} data-qreasee-viewport="" className="absolute inset-0" />

      {hint && lens !== "reflect" && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-ink-700 bg-ink-900/85 px-4 py-1.5 text-xs text-ink-300 qr-fade">
          {hint}
        </div>
      )}

      {(overlay.snapLabel || overlay.coords || overlay.tape) && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-ink-700 bg-ink-900/85 px-3 py-1.5 font-mono text-[11px] text-ink-300 qr-fade">
          {overlay.snapLabel && <span className="mr-2 text-lens-visual">{overlay.snapLabel}</span>}
          {overlay.tape && <span className="mr-2 text-lens-rules">{overlay.tape}</span>}
          {overlay.coords}
        </div>
      )}

      {/* LG-03: snap markers — distinct shape per kind, constant pixel size. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {overlay.markers.map((m, i) => (
          <SnapMarker key={`${m.kind}-${Math.round(m.x)}-${Math.round(m.y)}-${i}`} marker={m} />
        ))}
      </div>

      {overlay.debug && (
        <div className="pointer-events-none absolute bottom-14 left-3 rounded border border-amber-500/50 bg-ink-900/90 px-2 py-1 font-mono text-[10px] text-amber-300">
          snap: {overlay.debug}
        </div>
      )}

      {overlay.typed && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 rounded-md border border-lens-visual/60 bg-ink-900/95 px-3 py-2 text-center qr-fade">
          <div className="font-mono text-lg text-lens-visual">{overlay.typed}</div>
          <div className="text-[10px] text-ink-400">{t(lang, "overlay.pressEnter")}</div>
        </div>
      )}

      <div className="absolute bottom-4 right-4 flex gap-1.5">
        <button
          onClick={() => setProjection(projection === "perspective" ? "orthographic" : "perspective")}
          title={projection === "perspective" ? "Switch to orthographic" : "Switch to perspective"}
          className="rounded-md border border-lens-visual/60 bg-lens-visual/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-lens-visual hover:border-lens-visual"
        >
          {projection === "perspective" ? "Persp" : "Ortho"}
        </button>
        {(["top", "front", "iso", "fit"] as const).map((kind) => (
          <button
            key={kind}
            onClick={() => controllerRef.current?.focusView(kind)}
            className="rounded-md border border-ink-700 bg-ink-900/80 px-2.5 py-1 text-[11px] uppercase tracking-wide text-ink-300 hover:border-ink-500 hover:text-ink-100"
          >
            {kind}
          </button>
        ))}
        <button
          onClick={() => useApp.getState().captureViewport()}
          title="Capture this view for a sheet cover"
          className="rounded-md border border-ink-700 bg-ink-900/80 px-2.5 py-1 text-[11px] uppercase tracking-wide text-ink-300 hover:border-ink-500 hover:text-ink-100"
        >
          Capture
        </button>
      </div>

      {sunView && (
        <SunLegend />
      )}
    </div>
  );
}

const SNAP_COLOR: Record<string, string> = {
  endpoint: "#f97316",
  midpoint: "#facc15",
  intersection: "#60a5fa",
  edge: "#22d3ee",
  close: "#f0913b",
  grid: "#9ca3af",
  axis: "#a78bfa",
  parallel: "#34d399",
  perpendicular: "#fb7185",
};

/** LG-03: one snap marker. Shape differs per kind, so it never relies on colour. */
function SnapMarker({ marker }: { marker: SnapMarkerView }) {
  const color = SNAP_COLOR[marker.kind] ?? "#e5e7eb";
  const size = marker.active ? 17 : 12;
  return (
    <div className="absolute" style={{ left: marker.x, top: marker.y, transform: "translate(-50%, -50%)" }}>
      <svg width={size} height={size} viewBox="0 0 20 20" role="img" aria-label={marker.label}>
        <SnapShape kind={marker.kind} color={color} />
      </svg>
      {marker.active && (
        <span
          className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-ink-900/90 px-1.5 py-0.5 text-[10px] text-ink-100"
          style={{ border: `1px solid ${color}` }}
        >
          {marker.label}
        </span>
      )}
    </div>
  );
}

function SnapShape({ kind, color }: { kind: string; color: string }) {
  const common = { fill: color, stroke: "#0b0d10", strokeWidth: 1.5 };
  switch (kind) {
    case "endpoint":
      return <rect x="3" y="3" width="14" height="14" rx="1.5" {...common} />;
    case "midpoint":
      return <polygon points="10,2 18,17 2,17" {...common} />;
    case "intersection":
      return (
        <g stroke={color} strokeWidth="3" strokeLinecap="round">
          <line x1="4" y1="4" x2="16" y2="16" />
          <line x1="16" y1="4" x2="4" y2="16" />
        </g>
      );
    case "edge":
      return <polygon points="10,2 18,10 10,18 2,10" {...common} />;
    case "close":
      return <circle cx="10" cy="10" r="7" fill="none" stroke={color} strokeWidth="3" />;
    default:
      return <circle cx="10" cy="10" r="5" {...common} />;
  }
}

function SunLegend() {
  const lang = useApp((s) => s.lang);
  const summary = useApp((s) => s.sunSummary);
  return (
    <div className="absolute bottom-4 left-4 rounded-lg border border-ink-700 bg-ink-900/85 px-3 py-2 qr-fade">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-ink-400">
        {t(lang, "indicator.sun")}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-ink-400">0h</span>
        <div
          className="h-2 w-32 rounded-full"
          style={{ background: "linear-gradient(90deg,#3b82f6,#fbbf24,#ef4444)" }}
        />
        <span className="text-[10px] text-ink-400">8h</span>
      </div>
      {summary && (
        <div className="mt-1 text-[10px] text-ink-400">
          {t(lang, "indicator.highExposure")}: {(summary.highShareOnEastWest * 100).toFixed(0)}%
        </div>
      )}
    </div>
  );
}
