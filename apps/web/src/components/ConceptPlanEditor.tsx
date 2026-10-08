import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { makeTranslator, type Point, type Polygon, type Room } from "@qreasee/shared";
import { areaSummary } from "@qreasee/concept";
import { useApp } from "../state/store";
import { Button, Field, TextInput } from "./ui";
import { cn } from "../lib/utils";

/**
 * C-01: the 2D concept plan. Rooms are colored, area-true rectangles/polygons
 * that you can rename and drag; the "Program + Area Summary" beside it updates
 * live from `DocState.rooms`. Snapping is visible: orange at corners, yellow at
 * edge midpoints.
 */

const PALETTE = ["#f7ea8b", "#e5e7eb", "#bcd9ea", "#d9d2e9", "#f4b6a6", "#c8e6c9", "#ffe0b2"];
const PAD = 0.16; // fraction of the larger span

interface RoomBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function boundsOf(rooms: readonly Room[]): RoomBounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const room of rooms) {
    for (const p of room.polygon.outer) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

function uniqueSorted(values: number[]): number[] {
  const out: number[] = [];
  for (const v of [...values].sort((a, b) => a - b)) {
    if (out.length === 0 || Math.abs(out[out.length - 1] - v) > 1) out.push(v);
  }
  return out;
}

function translate(poly: Polygon, dx: number, dy: number): Polygon {
  return {
    outer: poly.outer.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    holes: poly.holes.map((h) => h.map((p) => ({ x: p.x + dx, y: p.y + dy }))),
  };
}

interface Candidate {
  p: Point;
  kind: "corner" | "mid";
}

/** Corners (orange) and edge midpoints (yellow) of every room. */
function snapCandidates(rooms: readonly Room[]): Candidate[] {
  const out: Candidate[] = [];
  for (const room of rooms) {
    const ring = room.polygon.outer;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      out.push({ p: a, kind: "corner" });
      out.push({ p: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, kind: "mid" });
    }
  }
  return out;
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ConceptPlanEditor() {
  const lang = useApp((s) => s.lang);
  const tr = makeTranslator(lang);
  const rooms = useApp((s) => s.docState.rooms);
  const project = useApp((s) => s.project);
  const selectedRoomId = useApp((s) => s.selectedRoomId);
  const selectRoom = useApp((s) => s.selectRoom);
  const updateRoom = useApp((s) => s.updateRoom);
  const addConceptRoom = useApp((s) => s.addConceptRoom);
  const removeRoom = useApp((s) => s.removeRoom);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ id: string; start: Point; original: Polygon } | null>(null);
  const liveRef = useRef<{ id: string; polygon: Polygon } | null>(null);
  const [live, setLive] = useState<{ id: string; polygon: Polygon } | null>(null);
  const [markers, setMarkers] = useState<Candidate[]>([]);
  const [hover, setHover] = useState<Point | null>(null);
  const [hoverRoomId, setHoverRoomId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<{ id: string; value: string } | null>(null);

  const summary = useMemo(() => areaSummary(rooms), [rooms]);

  const b = boundsOf(rooms);
  const spanX = b ? b.maxX - b.minX : 10000;
  const spanY = b ? b.maxY - b.minY : 10000;
  const span = Math.max(spanX, spanY, 4000);
  const pad = span * PAD;
  const maxY = b ? b.maxY : 0;
  const fontRoom = span * 0.032;
  const fontArea = span * 0.024;
  const fontDim = span * 0.026;
  const hair = span * 0.006;
  const tick = span * 0.02;
  const viewBox = `${(b?.minX ?? 0) - pad} ${-pad} ${spanX + pad * 2} ${spanY + pad * 2}`;

  const toModel = (e: ReactPointerEvent): Point | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: maxY - p.y };
  };

  const pixelsPerMm = (): number => {
    const svg = svgRef.current;
    if (!svg) return 1;
    const rect = svg.getBoundingClientRect();
    return rect.width / Math.max(1, spanX + pad * 2);
  };

  const candidates = useMemo(() => snapCandidates(rooms), [rooms]);

  const onPointerDown = (e: ReactPointerEvent) => {
    const target = (e.target as Element).closest("[data-room-id]");
    const id = target?.getAttribute("data-room-id") ?? null;
    selectRoom(id);
    if (!id) return;
    const room = rooms.find((r) => r.id === id);
    const start = toModel(e);
    if (!room || !start) return;
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointer ids may not be capturable */
    }
    dragRef.current = { id, start, original: JSON.parse(JSON.stringify(room.polygon)) as Polygon };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const point = toModel(e);
    if (!point) return;
    setHover(point);
    setHoverRoomId((e.target as Element).closest("[data-room-id]")?.getAttribute("data-room-id") ?? null);

    const range = 30 / pixelsPerMm();
    setMarkers(candidates.filter((c) => Math.hypot(c.p.x - point.x, c.p.y - point.y) <= range));

    const d = dragRef.current;
    if (!d) return;
    let dx = point.x - d.start.x;
    let dy = point.y - d.start.y;
    let moved = translate(d.original, dx, dy);

    // Snap the nearest dragged corner onto a candidate (excluding the room itself).
    const others = candidates.filter((c) => {
      const r = rooms.find((rr) => rr.id === d.id);
      return !r || !r.polygon.outer.some((p) => Math.abs(p.x - c.p.x) < 1 && Math.abs(p.y - c.p.y) < 1);
    });
    const threshold = 12 / pixelsPerMm();
    let best: { d: number; dx: number; dy: number } | null = null;
    for (const corner of moved.outer) {
      for (const c of others) {
        const dist = Math.hypot(c.p.x - corner.x, c.p.y - corner.y);
        if (dist <= threshold && (!best || dist < best.d)) {
          best = { d: dist, dx: c.p.x - corner.x, dy: c.p.y - corner.y };
        }
      }
    }
    if (best) {
      dx += best.dx;
      dy += best.dy;
      moved = translate(d.original, dx, dy);
    }
    liveRef.current = { id: d.id, polygon: moved };
    setLive(liveRef.current);
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    const l = liveRef.current;
    if (d && l) updateRoom(d.id, { polygon: l.polygon });
    dragRef.current = null;
    liveRef.current = null;
    setLive(null);
    setMarkers([]);
  };

  const onPointerLeave = () => {
    setMarkers([]);
    setHover(null);
  };

  const selected = rooms.find((r) => r.id === selectedRoomId) ?? null;

  const exportCsv = () => {
    const lines = ["Room Type,Count,Total A (m2)"];
    for (const row of summary.rows) lines.push(`"${row.name}",${row.count},${row.totalM2.toFixed(2)}`);
    lines.push(`Total,${summary.roomCount},${summary.totalM2.toFixed(2)}`);
    download(`${project.name || "concept"}-area-summary.csv`, lines.join("\n"), "text/csv");
  };

  const exportSvg = () => {
    const svg = svgRef.current;
    if (!svg) return;
    download(`${project.name || "concept"}-plan.svg`, svg.outerHTML, "image/svg+xml");
  };

  const svgOf = (p: Point) => ({ x: p.x, y: maxY - p.y });
  const pointsAttr = (poly: Polygon) =>
    poly.outer.map((p) => `${p.x},${maxY - p.y}`).join(" ");

  const xs = uniqueSorted(rooms.flatMap((r) => r.polygon.outer.map((p) => p.x)));
  const ys = uniqueSorted(rooms.flatMap((r) => r.polygon.outer.map((p) => p.y)));
  const yDim = spanY + pad * 0.55;
  const xDim = (b?.minX ?? 0) - pad * 0.55;

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col bg-ink-950">
        <div className="flex items-center gap-2 border-b border-ink-800 bg-ink-900/80 px-2 py-1.5">
          <Button variant="outline" size="sm" onClick={addConceptRoom}>
            + {tr("concept.addRoom")}
          </Button>
          <span className="ml-auto flex gap-1">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              {tr("concept.exportCsv")}
            </Button>
            <Button variant="outline" size="sm" onClick={exportSvg} disabled={rooms.length === 0}>
              {tr("concept.exportSvg")}
            </Button>
          </span>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3">
          {rooms.length === 0 ? (
            <div className="max-w-xs text-center">
              <p className="mb-3 text-[12px] text-ink-400">{tr("concept.empty")}</p>
              <Button variant="primary" size="sm" onClick={addConceptRoom}>
                + {tr("concept.addRoom")}
              </Button>
            </div>
          ) : (
            <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" style={{ background: "white" }}>
              <svg
                ref={svgRef}
                viewBox={viewBox}
                preserveAspectRatio="xMidYMid meet"
                className="touch-none select-none"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerLeave}
              >
                {/* dimension chains */}
                {ys.slice(0, -1).map((a, i) => {
                  const c = ys[i + 1];
                  const ya = maxY - a;
                  const yc = maxY - c;
                  return (
                    <g key={`dy-${a}`} stroke="#334155" strokeWidth={hair}>
                      <line x1={xDim} y1={ya} x2={xDim} y2={yc} />
                      <line x1={xDim - tick} y1={ya} x2={xDim + tick} y2={ya} />
                      <line x1={xDim - tick} y1={yc} x2={xDim + tick} y2={yc} />
                      <text
                        x={xDim - tick}
                        y={(ya + yc) / 2}
                        fill="#334155"
                        stroke="none"
                        fontSize={fontDim}
                        textAnchor="end"
                        dominantBaseline="middle"
                      >
                        {((c - a) / 1000).toFixed(2)}
                      </text>
                    </g>
                  );
                })}
                {xs.slice(0, -1).map((a, i) => {
                  const c = xs[i + 1];
                  return (
                    <g key={`dx-${a}`} stroke="#334155" strokeWidth={hair}>
                      <line x1={a} y1={yDim} x2={c} y2={yDim} />
                      <line x1={a} y1={yDim - tick} x2={a} y2={yDim + tick} />
                      <line x1={c} y1={yDim - tick} x2={c} y2={yDim + tick} />
                      <text
                        x={(a + c) / 2}
                        y={yDim - tick * 0.8}
                        fill="#334155"
                        stroke="none"
                        fontSize={fontDim}
                        textAnchor="middle"
                      >
                        {((c - a) / 1000).toFixed(2)} m
                      </text>
                    </g>
                  );
                })}

                {/* rooms */}
                {rooms.map((room, i) => {
                  const poly = live && live.id === room.id ? live.polygon : room.polygon;
                  const center = svgOf({
                    x: poly.outer.reduce((s, p) => s + p.x, 0) / poly.outer.length,
                    y: poly.outer.reduce((s, p) => s + p.y, 0) / poly.outer.length,
                  });
                  const selectedThis = room.id === selectedRoomId;
                  // C-03: a room boundary is invisible unless its title is
                  // highlighted (selected or hovered) — the fill still reads.
                  const highlighted = selectedThis || hoverRoomId === room.id;
                  return (
                    <g
                      key={room.id}
                      data-room-id={room.id}
                      style={{ cursor: "grab" }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingName({ id: room.id, value: room.name });
                      }}
                    >
                      <polygon
                        points={pointsAttr(poly)}
                        fill={room.color ?? PALETTE[i % PALETTE.length]}
                        stroke={highlighted ? "#f0913b" : "none"}
                        strokeWidth={selectedThis ? hair * 2.2 : hair * 1.6}
                        strokeLinejoin="round"
                      />
                      <text
                        x={center.x}
                        y={center.y}
                        textAnchor="middle"
                        fontSize={fontRoom}
                        fontWeight={600}
                        fill="#1f2937"
                        pointerEvents="none"
                      >
                        {room.name}
                      </text>
                      <text
                        x={center.x}
                        y={center.y + fontArea * 1.5}
                        textAnchor="middle"
                        fontSize={fontArea}
                        fill="#475569"
                        pointerEvents="none"
                      >
                        {(room.areaMm2 / 1_000_000).toFixed(1)} m²
                      </text>
                      {editingName?.id === room.id && (
                        <foreignObject
                          x={center.x - fontRoom * 5}
                          y={center.y - fontRoom * 1.1}
                          width={fontRoom * 10}
                          height={fontRoom * 2.2}
                        >
                          <input
                            autoFocus
                            value={editingName.value}
                            onChange={(e) => setEditingName({ id: room.id, value: e.target.value })}
                            onBlur={() => {
                              updateRoom(room.id, { name: editingName.value });
                              setEditingName(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                updateRoom(room.id, { name: editingName.value });
                                setEditingName(null);
                              } else if (e.key === "Escape") {
                                setEditingName(null);
                              }
                            }}
                            style={{
                              width: "100%",
                              height: "100%",
                              fontSize: fontRoom,
                              textAlign: "center",
                              border: "1px solid #f0913b",
                              background: "#fff",
                              color: "#111",
                            }}
                          />
                        </foreignObject>
                      )}
                    </g>
                  );
                })}

                {/* snap markers: orange corners, yellow midpoints */}
                {markers.map((m, i) => {
                  const p = svgOf(m.p);
                  return (
                    <circle
                      key={`m-${i}`}
                      cx={p.x}
                      cy={p.y}
                      r={tick * (m.kind === "corner" ? 0.9 : 0.7)}
                      fill={m.kind === "corner" ? "#f97316" : "#facc15"}
                      stroke="#ffffff"
                      strokeWidth={hair}
                      pointerEvents="none"
                    />
                  );
                })}
                {hover && (
                  <circle
                    cx={svgOf(hover).x}
                    cy={svgOf(hover).y}
                    r={tick * 0.4}
                    fill="#f0913b"
                    pointerEvents="none"
                  />
                )}
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Program + Area Summary */}
      <aside className="w-[300px] shrink-0 overflow-y-auto border-l border-ink-800 bg-ink-900/70 p-3">
        <h2 className="mb-2 text-[13px] font-semibold text-ink-100">{tr("concept.summary")}</h2>
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border border-ink-700 bg-ink-950/50 text-ink-300">
              <th className="border border-ink-700 px-2 py-1 text-left font-medium">{tr("concept.roomType")}</th>
              <th className="border border-ink-700 px-2 py-1 text-center font-medium">{tr("concept.count")}</th>
              <th className="border border-ink-700 px-2 py-1 text-right font-medium">{tr("concept.totalA")}</th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.map((row) => (
              <tr
                key={row.name}
                className={cn(
                  "cursor-pointer text-ink-200 hover:bg-ink-800/50",
                  selected?.name === row.name && "bg-ink-800/60",
                )}
                onClick={() => {
                  const first = rooms.find((r) => (r.name || "Room").trim() === row.name);
                  selectRoom(first ? first.id : null);
                }}
              >
                <td className="border border-ink-700 px-2 py-1">{row.name}</td>
                <td className="border border-ink-700 px-2 py-1 text-center font-mono">{row.count}</td>
                <td className="border border-ink-700 px-2 py-1 text-right font-mono">{row.totalM2.toFixed(1)} m²</td>
              </tr>
            ))}
            {summary.rows.length === 0 && (
              <tr>
                <td className="border border-ink-700 px-2 py-2 text-center text-ink-500" colSpan={3}>
                  —
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border border-ink-700 text-ink-100">
              <td className="border border-ink-700 px-2 py-1 font-medium">{tr("concept.total")}</td>
              <td className="border border-ink-700 px-2 py-1 text-center font-mono">{summary.roomCount}</td>
              <td className="border border-ink-700 px-2 py-1 text-right font-mono">{summary.totalM2.toFixed(1)} m²</td>
            </tr>
          </tfoot>
        </table>

        {selected && (
          <div className="mt-4 border-t border-ink-800 pt-3">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-ink-500">{tr("concept.selected")}</div>
            <Field label={tr("concept.name")}>
              <TextInput
                value={selected.name}
                onChange={(e) => updateRoom(selected.id, { name: e.target.value })}
              />
            </Field>
            <div className="mt-2">
              <div className="mb-1 text-[11px] text-ink-400">{tr("concept.color")}</div>
              <div className="flex flex-wrap gap-1.5">
                {PALETTE.map((color) => (
                  <button
                    key={color}
                    onClick={() => updateRoom(selected.id, { color })}
                    className={cn(
                      "h-6 w-6 rounded border",
                      selected.color === color ? "border-lens-visual" : "border-ink-600",
                    )}
                    style={{ background: color }}
                    aria-label={color}
                  />
                ))}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-ink-400">
              <span>
                {tr("concept.area")}:{" "}
                <span className="font-mono text-ink-100">{(selected.areaMm2 / 1_000_000).toFixed(1)} m²</span>
              </span>
              <Button size="sm" variant="ghost" onClick={() => removeRoom(selected.id)}>
                {tr("concept.delete")}
              </Button>
            </div>
          </div>
        )}

        <p className="mt-4 text-[10px] leading-relaxed text-ink-600">{tr("concept.hint")}</p>
      </aside>
    </div>
  );
}
