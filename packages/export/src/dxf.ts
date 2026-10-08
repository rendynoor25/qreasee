/**
 * EX-01: Export DXF for AutoCAD — site boundary, setback lines, grid, and
 * footprints per level on separate layers (Q-SITE, Q-SETBACK, Q-GRID, Q-LT1…).
 */

import Drawing from "dxf-writer";
import type { DocState, Project } from "@qreasee/shared";
import { bounds, setbackLines } from "@qreasee/geometry";

type Pt = [number, number];

function ringPoints(ring: readonly { x: number; y: number }[]): Pt[] {
  return ring.map((p) => [p.x, p.y] as Pt);
}

function levelLayerName(levelName: string, index: number): string {
  const digits = levelName.match(/\d+/g)?.join("") ?? String(index + 1);
  return `Q-LT${digits}`;
}

/** Object layer → DXF layer name, sanitised for AutoCAD's allowed characters. */
function objectLayerName(name: string): string {
  const safe = (name || "Layer").replace(/[^A-Za-z0-9 _-]/g, "_").trim().slice(0, 60);
  return `Q-${safe || "Layer"}`;
}

/** Map a 0xRRGGBB hex to the nearest AutoCAD Color Index (1-255). */
function aciFor(hex: string | undefined): number {
  if (!hex) return Drawing.ACI.WHITE;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return Drawing.ACI.WHITE;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 24) return Drawing.ACI.WHITE;
  if (r === max && g === max) return Drawing.ACI.YELLOW;
  if (r === max && b === max) return Drawing.ACI.MAGENTA;
  if (g === max && b === max) return Drawing.ACI.CYAN;
  if (r === max) return Drawing.ACI.RED;
  if (g === max) return Drawing.ACI.GREEN;
  return Drawing.ACI.BLUE;
}

export function exportDxf(state: DocState, project: Project): string {
  const d = new Drawing();
  d.setUnits("Millimeters");
  d.addLineType("DASHED", "_ _ _ _", [6, -4]);
  d.addLayer("Q-SITE", Drawing.ACI.GREEN, "CONTINUOUS");
  d.addLayer("Q-SETBACK", Drawing.ACI.YELLOW, "DASHED");
  d.addLayer("Q-GRID", Drawing.ACI.CYAN, "CONTINUOUS");
  // W-08 handoff: studio layers so AutoCAD users keep sensible linework.
  d.addLayer("A-WALL", Drawing.ACI.WHITE, "CONTINUOUS");
  d.addLayer("A-DOOR", Drawing.ACI.CYAN, "CONTINUOUS");
  d.addLayer("A-GLAZ", Drawing.ACI.BLUE, "CONTINUOUS");
  d.addLayer("A-GRID", Drawing.ACI.CYAN, "CONTINUOUS");
  d.addLayer("A-ANNO", Drawing.ACI.GREEN, "CONTINUOUS");
  const levelLayers = state.levels.map((l, i) => ({
    level: l,
    layer: levelLayerName(l.name, i),
  }));
  for (const { layer } of levelLayers) d.addLayer(layer, Drawing.ACI.WHITE, "CONTINUOUS");

  // Object layers (MVP Feature Guide §2): the studio's own organisation is what
  // survives the handoff, so a mass is drawn on its layer rather than a generic
  // per-level layer. Masses with no layer fall back to the level layer.
  const objectLayers = new Map<string, string>();
  for (const layer of state.layers ?? []) {
    const name = objectLayerName(layer.name);
    if (!objectLayers.has(layer.id)) {
      d.addLayer(name, aciFor(layer.color), "CONTINUOUS");
      objectLayers.set(layer.id, name);
    }
  }

  const siteBounds = state.site.boundary.length
    ? bounds(state.site.boundary)
    : { min: { x: 0, y: 0 }, max: { x: 0, y: 0 }, width: 0, height: 0, center: { x: 0, y: 0 } };

  // Site boundary and road edges.
  if (state.site.boundary.length >= 3) {
    d.setActiveLayer("Q-SITE");
    d.drawPolyline(ringPoints(state.site.boundary), true);
    for (const road of state.site.roadEdges) {
      const a = state.site.boundary[road.edgeIndex];
      const b = state.site.boundary[(road.edgeIndex + 1) % state.site.boundary.length];
      if (a && b) d.drawLine(a.x, a.y, b.x, b.y);
    }
    for (const g of state.site.greenPolygons) d.drawPolyline(ringPoints(g.points), true);
  }

  // Setback lines.
  d.setActiveLayer("Q-SETBACK");
  for (const seg of setbackLines(state.site.boundary, state.rules.setbacks)) {
    d.drawLine(seg.a.x, seg.a.y, seg.b.x, seg.b.y);
  }

  // Grid, extended past the site by 5 m.
  d.setActiveLayer("Q-GRID");
  const pad = 5000;
  for (const g of state.grids) {
    if (g.axis === "x") {
      d.drawLine(g.offset, siteBounds.min.y - pad, g.offset, siteBounds.max.y + pad);
      d.drawText(g.offset, siteBounds.min.y - pad - 800, 400, 0, g.label, "center", "top");
    } else {
      d.drawLine(siteBounds.min.x - pad, g.offset, siteBounds.max.x + pad, g.offset);
      d.drawText(siteBounds.min.x - pad - 800, g.offset, 400, 0, g.label, "right", "middle");
    }
  }

  // W-08 handoff: schematic linework on studio layers.
  d.setActiveLayer("A-GRID");
  for (const g of state.grids) {
    if (g.axis === "x") d.drawLine(g.offset, siteBounds.min.y - pad, g.offset, siteBounds.max.y + pad);
    else d.drawLine(siteBounds.min.x - pad, g.offset, siteBounds.max.x + pad, g.offset);
  }

  d.setActiveLayer("A-WALL");
  for (const w of state.walls) d.drawLine(w.a.x, w.a.y, w.b.x, w.b.y);

  for (const o of state.openings) {
    const wall = state.walls.find((x) => x.id === o.wallId);
    if (!wall) continue;
    const dx = wall.b.x - wall.a.x;
    const dy = wall.b.y - wall.a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const cx = wall.a.x + ux * o.offset;
    const cy = wall.a.y + uy * o.offset;
    const nx = -uy;
    const ny = ux;
    d.setActiveLayer(o.kind === "door" ? "A-DOOR" : "A-GLAZ");
    d.drawLine(cx - nx * (o.width / 2), cy - ny * (o.width / 2), cx + nx * (o.width / 2), cy + ny * (o.width / 2));
  }

  d.setActiveLayer("A-ANNO");
  for (const r of state.rooms) {
    if (r.polygon.outer.length < 3) continue;
    const cx = r.polygon.outer.reduce((sum, p) => sum + p.x, 0) / r.polygon.outer.length;
    const cy = r.polygon.outer.reduce((sum, p) => sum + p.y, 0) / r.polygon.outer.length;
    d.drawText(cx, cy, 300, 0, r.name, "center", "middle");
  }

  // Footprints: one pass, on each mass's object layer (falling back to its level).
  for (const m of state.masses) {
    const objectLayer = m.layerId ? objectLayers.get(m.layerId) : undefined;
    const fallback = levelLayers.find(({ level }) => m.levelIds.includes(level.id))?.layer;
    d.setActiveLayer(objectLayer ?? fallback ?? "Q-SITE");
    d.drawPolyline(ringPoints(m.footprint.outer), true);
    for (const hole of m.footprint.holes) d.drawPolyline(ringPoints(hole), true);
  }

  // A small title block note carrying scale and north (EX-01 handoff).
  d.setActiveLayer("Q-SITE");
  d.drawText(
    siteBounds.min.x,
    siteBounds.max.y + 2000,
    500,
    0,
    `${project.name} — 1 unit = 1 mm — north ${Math.round(project.northAngle)}deg`,
  );

  return d.toDxfString();
}
