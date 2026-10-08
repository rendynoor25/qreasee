import { describe, it } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { DocState, GridLine, Point, Polygon, Sheet, SheetItem, Wall } from "@qreasee/shared";
import { ifcToDocState, parseIfc } from "../ifc";
import { parseDxf } from "../dxfImport";
import { wallsFromDxf } from "../dwgWalls";

/**
 * Regenerates the "Sample house" fixture from the source IFC, applies a material
 * scheme, and lays out the sheet set (cover + drawings). Not a test — it is
 * skipped unless you opt in:
 *
 *   $env:QREASEE_IFC="<path to source .ifc>"; $env:QREASEE_GENERATE=1; pnpm --filter @qreasee/export test -- src/__tests__/generateSample.test.ts
 */
const REAL_IFC = process.env.QREASEE_IFC ?? "";
const REAL_DXF = process.env.QREASEE_DXF ?? "D:\\Qreasee\\alfia-a101.dxf";
const OUT = "D:\\Qreasee\\qreasee\\apps\\web\\src\\fixtures\\sampleHouseDoc.json";

const GRIDS: GridLine[] = [
  { id: "gx1", axis: "x", label: "1", offset: 0 },
  { id: "gx2", axis: "x", label: "2", offset: 5200 },
  { id: "gx3", axis: "x", label: "3", offset: 9000 },
  { id: "gyA", axis: "y", label: "A", offset: 0 },
  { id: "gyB", axis: "y", label: "B", offset: 5100 },
  { id: "gyC", axis: "y", label: "C", offset: 8100 },
  { id: "gyD", axis: "y", label: "D", offset: 14200 },
  { id: "gyE", axis: "y", label: "E", offset: 19500 },
  { id: "gyF", axis: "y", label: "F", offset: 22900 },
];

const shiftPt = (p: Point, dx: number, dy: number): Point => ({ x: p.x + dx, y: p.y + dy });
const shiftPoly = (poly: Polygon, dx: number, dy: number): Polygon => ({
  outer: poly.outer.map((p) => shiftPt(p, dx, dy)),
  holes: (poly.holes ?? []).map((h) => h.map((p) => shiftPt(p, dx, dy))),
});

/**
 * Part 2 §2: the source IFC keeps its own origin, so the imported geometry is
 * offset from the reference grid (grid x 0..9000 / y 0..22900 but the walls at
 * x -1314 / y -7694). Shift every layer so the structural wall bounding box meets
 * the grid origin — walls, rooms, slabs, roofs, stairs and site in one frame.
 */
function alignToGrids(state: DocState): void {
  const xs = state.walls.flatMap((w) => [w.a.x, w.b.x]);
  const ys = state.walls.flatMap((w) => [w.a.y, w.b.y]);
  const gx = state.grids.filter((g) => g.axis === "x").map((g) => g.offset);
  const gy = state.grids.filter((g) => g.axis === "y").map((g) => g.offset);
  if (!xs.length || !gx.length || !gy.length) return;
  const dx = Math.min(...gx) - Math.min(...xs);
  const dy = Math.min(...gy) - Math.min(...ys);
  for (const m of state.masses) m.footprint = shiftPoly(m.footprint, dx, dy);
  for (const r of state.rooms) r.polygon = shiftPoly(r.polygon, dx, dy);
  for (const w of state.walls) {
    w.a = shiftPt(w.a, dx, dy);
    w.b = shiftPt(w.b, dx, dy);
  }
  for (const s of state.slabs) s.polygon = shiftPoly(s.polygon, dx, dy);
  for (const r of state.roofs) r.polygon = shiftPoly(r.polygon, dx, dy);
  for (const st of state.stairs) {
    st.from = shiftPt(st.from, dx, dy);
    st.to = shiftPt(st.to, dx, dy);
  }
  for (const rl of state.railings ?? []) {
    rl.a = shiftPt(rl.a, dx, dy);
    rl.b = shiftPt(rl.b, dx, dy);
  }
  // The site too — the 3D camera frames the model from the site boundary, so a
  // stale site would point the camera away from the model.
  state.site.boundary = state.site.boundary.map((p) => shiftPt(p, dx, dy));
}

/** A stylised axonometric of the building volume, as an SVG data URL (cover). */
function axonCover(state: DocState): string {
  const mass = state.masses[0];
  if (!mass || mass.footprint.outer.length < 3) return "";
  const pts = mass.footprint.outer;
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const h = mass.height;
  const c = Math.cos(Math.PI / 6);
  const s = Math.sin(Math.PI / 6);
  const proj = (x: number, y: number, z: number) => ({ X: (x - y) * c, Y: (x + y) * s - z });
  const corner = (x: number, y: number, z: number) => proj(x, y, z);
  const P = {
    a: corner(minX, minY, 0),
    b: corner(maxX, minY, 0),
    cc: corner(maxX, maxY, 0),
    d: corner(minX, maxY, 0),
    at: corner(minX, minY, h),
    bt: corner(maxX, minY, h),
    ct: corner(maxX, maxY, h),
    dt: corner(minX, maxY, h),
  };
  const all = Object.values(P);
  const pad = 20;
  const vx = Math.min(...all.map((p) => p.X)) - pad;
  const vy = Math.min(...all.map((p) => p.Y)) - pad;
  const vw = Math.max(...all.map((p) => p.X)) - vx + pad;
  const vh = Math.max(...all.map((p) => p.Y)) - vy + pad;
  const poly = (arr: Array<{ X: number; Y: number }>, fill: string) =>
    `<polygon points="${arr.map((p) => `${p.X.toFixed(1)},${p.Y.toFixed(1)}`).join(" ")}" fill="${fill}" stroke="#1f2937" stroke-width="2"/>`;
  const faces = [
    { depth: maxY + maxX, svg: poly([P.b, P.cc, P.ct, P.bt], "#c3bcb0") },
    { depth: maxY + minX, svg: poly([P.d, P.cc, P.ct, P.dt], "#d3ccc0") },
    { depth: minY + maxX, svg: poly([P.a, P.b, P.bt, P.at], "#b8b1a5") },
    { depth: minY + minX, svg: poly([P.a, P.d, P.dt, P.at], "#c9c2b6") },
  ].sort((f1, f2) => f2.depth - f1.depth);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}">` +
    `<rect x="${vx.toFixed(1)}" y="${vy.toFixed(1)}" width="${vw.toFixed(1)}" height="${vh.toFixed(1)}" fill="#eef1f4"/>` +
    faces.map((f) => f.svg).join("") +
    poly([P.at, P.bt, P.ct, P.dt], "#e8e4dc") +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function viewItem(id: string, viewId: string, x: number, y: number, w: number, h: number, scale = 100): SheetItem {
  return { id, kind: "view", viewId, x, y, w, h, scale };
}

function sheet(id: string, name: string, number: string, items: SheetItem[]): Sheet {
  return { id, name, number, size: "A3", items, createdAt: 0 };
}

/** A Program + Area Summary table as an SVG data URL (concept sheet). */
function programTableSvg(state: DocState): string {
  const byName = new Map<string, { count: number; area: number }>();
  for (const r of state.rooms) {
    const name = (r.name || "Room").trim() || "Room";
    const row = byName.get(name) ?? { count: 0, area: 0 };
    row.count += 1;
    row.area += r.areaMm2 / 1_000_000;
    byName.set(name, row);
  }
  const rows = [...byName.entries()].sort((a, b) => b[1].area - a[1].area || a[0].localeCompare(b[0]));
  const total = rows.reduce((s, [, v]) => s + v.area, 0);
  const w = 340;
  const rowH = 22;
  const h = 46 + (rows.length + 1) * rowH;
  const parts: string[] = [`<rect x="0" y="0" width="${w}" height="${h}" fill="#ffffff"/>`];
  parts.push(`<text x="10" y="22" font-size="14" font-weight="700" fill="#111">Program + Area Summary</text>`);
  let y = 32;
  const cell = (x: number, yy: number, width: number, text: string, align = "left", bold = false) =>
    `<text x="${align === "right" ? x + width - 6 : align === "center" ? x + width / 2 : x + 6}" y="${yy + 15}" font-size="10" text-anchor="${align}" font-weight="${bold ? 700 : 400}" fill="#111">${text}</text>`;
  parts.push(`<rect x="10" y="${y}" width="${w - 20}" height="${rowH}" fill="#eef2f7" stroke="#94a3b8"/>`);
  parts.push(cell(10, y, 200, "Room Type", "left", true), cell(210, y, 50, "Count", "center", true), cell(260, y, 70, "Total A", "right", true));
  y += rowH;
  for (const [name, v] of rows) {
    parts.push(`<rect x="10" y="${y}" width="${w - 20}" height="${rowH}" fill="none" stroke="#cbd5e1"/>`);
    parts.push(cell(10, y, 200, name), cell(210, y, 50, String(v.count), "center"), cell(260, y, 70, `${v.area.toFixed(1)} m²`, "right"));
    y += rowH;
  }
  parts.push(`<rect x="10" y="${y}" width="${w - 20}" height="${rowH}" fill="#f8fafc" stroke="#94a3b8"/>`);
  parts.push(cell(10, y, 200, "Total", "left", true), cell(210, y, 50, String(state.rooms.length), "center", true), cell(260, y, 70, `${total.toFixed(1)} m²`, "right", true));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${parts.join("")}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function buildSheets(state: DocState): Sheet[] {
  const cover = axonCover(state);
  const table = programTableSvg(state);
  const coverItems: SheetItem[] = [
    { id: "cover-img", kind: "image", src: cover, x: 60, y: 40, w: 240, h: 180, label: "3D" },
    {
      id: "cover-title",
      kind: "text",
      x: 60,
      y: 250,
      text: "SAMPLE HOUSE",
      sizeMm: 12,
      bold: true,
    },
    { id: "cover-sub", kind: "text", x: 60, y: 264, text: "Dokumen Gambar — Concept Design", sizeMm: 6 },
  ];
  const conceptItems: SheetItem[] = [
    { id: "a100-mass", kind: "image", src: cover, x: 20, y: 30, w: 180, h: 140, label: "Massa" },
    { id: "a100-table", kind: "image", src: table, x: 215, y: 24, w: 175, h: 210, label: "Program" },
    {
      id: "a100-title",
      kind: "text",
      x: 20,
      y: 200,
      text: "Konsep Massa & Program Ruang",
      sizeMm: 8,
      bold: true,
    },
    { id: "a100-note", kind: "text", x: 20, y: 214, text: "Skala 1:200", sizeMm: 5 },
  ];
  return [
    sheet("s-cover", "Cover", "A000", coverItems),
    sheet("s-a100", "Konsep Massa & Program", "A100", conceptItems),
    sheet("s-a101", "Denah Lantai 1 & 2", "A101", [
      viewItem("i-a101", "sys:plan:ifc-L1", 14, 8, 160, 262, 100),
      viewItem("i-a101b", "sys:plan:ifc-L2", 182, 8, 160, 262, 100),
    ]),
    sheet("s-a102", "Denah Atap", "A102", [viewItem("i-a102", "sys:plan:ifc-L3", 90, 8, 200, 262, 100)]),
    sheet("s-a103", "Tampak Depan & Belakang", "A103", [
      viewItem("i-a103-n", "sys:elev:N", 20, 24, 160, 220, 100),
      viewItem("i-a103-s", "sys:elev:S", 200, 24, 160, 220, 100),
    ]),
    sheet("s-a104", "Tampak Samping Kanan & Kiri", "A104", [
      viewItem("i-a104-e", "sys:elev:E", 20, 24, 160, 220, 100),
      viewItem("i-a104-w", "sys:elev:W", 200, 24, 160, 220, 100),
    ]),
    sheet("s-a105", "Potongan A-A", "A105", [viewItem("i-a105", "sys:section:A", 70, 20, 240, 230, 100)]),
  ];
}

describe.skipIf(process.env.QREASEE_GENERATE !== "1" || !existsSync(REAL_IFC))(
  "generate sample house from IFC",
  () => {
    it("writes sampleHouseDoc.json with materials and sheets", () => {
      const model = parseIfc(readFileSync(REAL_IFC, "utf8"));
      const state = ifcToDocState(model);

      // Part 3 §6.5: replace the approximate IFC walls with the real Revit DWG
      // walls (A-WALL face pairs), re-hosting the doors/windows onto the nearest
      // new wall. Opt-in: the face-pairing is not yet complete enough to be the
      // default (it drops some walls), so the IFC walls stay by default.
      if (process.env.QREASEE_DWG_WALLS === "1" && existsSync(REAL_DXF)) {
        const dxf = parseDxf(readFileSync(REAL_DXF, "utf8"));
        const minX = (ws: { a: Point; b: Point }[]) => Math.min(...ws.flatMap((w) => [w.a.x, w.b.x]));
        const l1 = wallsFromDxf(dxf, { region: { minX: -20000, maxX: 12000 } });
        const l2raw = wallsFromDxf(dxf, { region: { minX: 12000, maxX: 40000 } });
        const shift = minX(l2raw) - minX(l1);
        const l2 = l2raw.map((w) => ({ ...w, a: { x: w.a.x - shift, y: w.a.y }, b: { x: w.b.x - shift, y: w.b.y } }));

        const levelH = (id: string) => state.levels.find((l) => l.id === id)?.floorToFloor ?? 3600;
        const mk = (w: { a: Point; b: Point; thickness: number }, levelId: string, i: number): Wall => ({
          id: `dwg-wall-${levelId}-${i}`,
          levelId,
          a: { ...w.a },
          b: { ...w.b },
          thickness: w.thickness,
          height: levelH(levelId),
          kind: w.thickness >= 140 ? "exterior" : "partition",
          origin: "generated",
        });
        const newWalls: Wall[] = [
          ...l1.map((w, i) => mk(w, "ifc-L1", i)),
          ...l2.map((w, i) => mk(w, "ifc-L2", i)),
        ];

        const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
        const unit = (v: Point): Point => {
          const l = Math.hypot(v.x, v.y) || 1;
          return { x: v.x / l, y: v.y / l };
        };
        const distSeg = (p: Point, a: Point, b: Point) => {
          const d = sub(b, a);
          const len = Math.hypot(d.x, d.y) || 1;
          const t = Math.max(0, Math.min(len, (sub(p, a).x * d.x + sub(p, a).y * d.y) / len));
          return Math.hypot(p.x - (a.x + (d.x / len) * t), p.y - (a.y + (d.y / len) * t));
        };
        const oldWalls = state.walls;
        const rehosted: typeof state.openings = [];
        for (const op of state.openings) {
          const ow = oldWalls.find((w) => w.id === op.wallId);
          if (!ow) continue;
          const d = unit(sub(ow.b, ow.a));
          const p = { x: ow.a.x + d.x * op.offset, y: ow.a.y + d.y * op.offset };
          let best: Wall | null = null;
          let bestD = Infinity;
          for (const w of newWalls) {
            if (w.levelId !== ow.levelId) continue;
            const dd = distSeg(p, w.a, w.b);
            if (dd < bestD) {
              bestD = dd;
              best = w;
            }
          }
          if (!best || bestD > 700) continue;
          const dw = unit(sub(best.b, best.a));
          const len = Math.hypot(sub(best.b, best.a).x, sub(best.b, best.a).y);
          const t = Math.max(60, Math.min(len - 60, sub(p, best.a).x * dw.x + sub(p, best.a).y * dw.y));
          rehosted.push({ ...op, wallId: best.id, offset: Math.round(t) });
        }
        state.walls = newWalls;
        state.openings = rehosted;
      }

      state.grids = GRIDS;
      // Part 2 §2: put the imported geometry in the grid's frame.
      alignToGrids(state);
      // Material scheme (entity material wins over the schematic defaults).
      for (const w of state.walls) w.material = w.kind === "exterior" ? "qr-brick-brown" : "wall-paint-white";
      for (const s of state.slabs) s.material = s.kind === "ceiling" ? "ceiling-gypsum" : "qr-concrete-screed";
      for (const r of state.roofs) r.material = "qr-roof-concrete";
      for (const st of state.stairs) st.material = "structure-concrete";
      state.sheets = buildSheets(state);
      writeFileSync(OUT, JSON.stringify(state));
    });
  },
);
