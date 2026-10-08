/**
 * I-01: import an IFC file (IFC2X3 / IFC4 STEP) into Qreasee.
 *
 * Pure and deterministic — no DOM, no network. We read the parts that map to
 * our object model: storeys (IfcBuildingStorey), rooms (IfcSpace) and walls
 * (IfcWall*), using each element's placement plus its swept profile / Axis
 * centreline. Anything we cannot map is counted and reported, never invented.
 */

import {
  emptyDocState,
  type DocState,
  type Level,
  type Opening,
  type Point,
  type Railing,
  type Room,
  type Roof,
  type Slab,
  type Stair,
  type Wall,
} from "@qreasee/shared";

export interface IfcLevel {
  name: string;
  elevation: number;
}

export interface IfcRoom {
  name: string;
  number?: string;
  level: string;
  outer: Point[];
  heightMm?: number;
}

export interface IfcWall {
  a: Point;
  b: Point;
  thickness: number;
  height: number;
  level: string;
}

export interface IfcOpening {
  kind: "door" | "window";
  /** Index into `IfcModel.walls` for the host wall. */
  wallIndex: number;
  /** Centre distance from the wall's `a` end, mm. */
  offset: number;
  width: number;
  sill: number;
  height: number;
}

export interface IfcSlab {
  level: string;
  polygon: Point[];
  z: number;
  thickness: number;
  kind: "floor" | "ceiling";
}

export interface IfcStair {
  level: string;
  from: Point;
  to: Point;
  width: number;
  heightMm: number;
}

export interface IfcRoof {
  level: string;
  polygon: Point[];
  baseZ: number;
}

export interface IfcRailing {
  level: string;
  a: Point;
  b: Point;
  height: number;
}

export interface IfcModel {
  levels: IfcLevel[];
  rooms: IfcRoom[];
  walls: IfcWall[];
  openings: IfcOpening[];
  slabs: IfcSlab[];
  stairs: IfcStair[];
  roofs: IfcRoof[];
  railings: IfcRailing[];
  /** Counts of entities seen but not (yet) mapped. */
  skipped: { doors: number; windows: number; slabs: number; roofs: number; stairs: number; unmapped: number };
}

type Entity = { type: string; args: string };

interface Point3 {
  x: number;
  y: number;
  z: number;
}

function parseEntities(text: string): Map<number, Entity> {
  const out = new Map<number, Entity>();
  const re = /#(\d+)\s*=\s*([A-Z0-9_]+)\s*\(([\s\S]*?)\)\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.set(Number(m[1]), { type: m[2], args: m[3] });
  }
  return out;
}

/** Split a STEP argument list on top-level commas (respecting quotes/parens). */
function splitArgs(a: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  let quoted = false;
  for (const ch of a) {
    if (ch === "'") {
      quoted = !quoted;
      cur += ch;
    } else if (quoted) {
      cur += ch;
    } else if (ch === "(") {
      depth++;
      cur += ch;
    } else if (ch === ")") {
      depth--;
      cur += ch;
    } else if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim() !== "" || out.length > 0) out.push(cur.trim());
  return out;
}

const unq = (v: string): string => {
  const t = (v ?? "").trim();
  return t.startsWith("'") && t.endsWith("'") ? t.slice(1, -1) : t;
};
const refs = (a: string): number[] => [...(a ?? "").matchAll(/#(\d+)/g)].map((m) => Number(m[1]));
const nums = (a: string): number[] =>
  [...(a ?? "").matchAll(/-?\d+\.?\d*(?:[eE][-+]?\d+)?/g)].map((m) => Number(m[0]));

interface Frame {
  x: number;
  y: number;
  z: number;
  angle: number;
}

const IDENTITY: Frame = { x: 0, y: 0, z: 0, angle: 0 };

function frameOf(ent: Map<number, Entity>, id: number | undefined): Frame {
  if (!id) return IDENTITY;
  const e = ent.get(id);
  if (!e || e.type !== "IFCAXIS2PLACEMENT3D") return IDENTITY;
  const p = splitArgs(e.args);
  const loc = refs(p[0])[0];
  let x = 0;
  let y = 0;
  let z = 0;
  if (loc) {
    const lp = ent.get(loc);
    if (lp?.type === "IFCCARTESIANPOINT") {
      const n = nums(lp.args);
      x = n[0] ?? 0;
      y = n[1] ?? 0;
      z = n[2] ?? 0;
    }
  }
  let angle = 0;
  const dir = p[2] ? refs(p[2])[0] : undefined;
  if (dir) {
    const de = ent.get(dir);
    if (de?.type === "IFCDIRECTION") {
      const n = nums(de.args);
      angle = Math.atan2(n[1] ?? 0, n[0] ?? 1);
    }
  }
  return { x, y, z, angle };
}

/** Accumulate an IfcLocalPlacement chain (translation + last rotation). */
function placementFrame(ent: Map<number, Entity>, id: number | undefined): Frame {
  let x = 0;
  let y = 0;
  let z = 0;
  let angle = 0;
  let cur = id;
  const seen = new Set<number>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const e = ent.get(cur);
    if (!e || e.type !== "IFCLOCALPLACEMENT") break;
    const p = splitArgs(e.args);
    const rel = refs(p[1])[0];
    const f = frameOf(ent, rel);
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    x += f.x * c - f.y * s;
    y += f.x * s + f.y * c;
    z += f.z;
    if (f.angle) angle = f.angle;
    cur = refs(p[0])[0];
  }
  return { x, y, z, angle };
}

function applyFrame(p: Point, f: Frame): Point {
  const c = Math.cos(f.angle);
  const s = Math.sin(f.angle);
  return { x: f.x + p.x * c - p.y * s, y: f.y + p.x * s + p.y * c };
}

function a2p2Point(ent: Map<number, Entity>, id: number | undefined): Point {
  if (!id) return { x: 0, y: 0 };
  const e = ent.get(id);
  if (!e || e.type !== "IFCAXIS2PLACEMENT2D") return { x: 0, y: 0 };
  const loc = refs(splitArgs(e.args)[0])[0];
  const lp = loc ? ent.get(loc) : undefined;
  if (lp?.type === "IFCCARTESIANPOINT") {
    const n = nums(lp.args);
    return { x: n[0] ?? 0, y: n[1] ?? 0 };
  }
  return { x: 0, y: 0 };
}

function polylinePoints(ent: Map<number, Entity>, id: number | undefined): Point[] {
  if (!id) return [];
  const e = ent.get(id);
  if (!e || e.type !== "IFCPOLYLINE") return [];
  const out: Point[] = [];
  for (const pid of refs(e.args)) {
    const p = ent.get(pid);
    if (p?.type === "IFCCARTESIANPOINT") {
      const n = nums(p.args);
      out.push({ x: n[0] ?? 0, y: n[1] ?? 0 });
    }
  }
  return out;
}

function profilePoints(ent: Map<number, Entity>, id: number | undefined): Point[] | null {
  if (!id) return null;
  const e = ent.get(id);
  if (!e) return null;
  const p = splitArgs(e.args);
  if (e.type === "IFCRECTANGLEPROFILEDEF") {
    const c = a2p2Point(ent, refs(p[2])[0]);
    const xd = nums(p[3])[0] ?? 0;
    const yd = nums(p[4])[0] ?? 0;
    return [
      { x: c.x - xd / 2, y: c.y - yd / 2 },
      { x: c.x + xd / 2, y: c.y - yd / 2 },
      { x: c.x + xd / 2, y: c.y + yd / 2 },
      { x: c.x - xd / 2, y: c.y + yd / 2 },
    ];
  }
  if (e.type === "IFCARBITRARYCLOSEDPROFILEDEF") {
    const pts = polylinePoints(ent, refs(p[2])[0]);
    if (pts.length < 3) return null;
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (Math.abs(first.x - last.x) < 1e-6 && Math.abs(first.y - last.y) < 1e-6) pts.pop();
    return pts;
  }
  return null;
}

interface Solid {
  profile: Point[] | null;
  frame: Frame;
  depth: number;
  axisPoints: Point[] | null;
}

function solidOf(ent: Map<number, Entity>, shapeRepId: number): Solid | null {
  const rep = ent.get(shapeRepId);
  if (!rep || rep.type !== "IFCSHAPEREPRESENTATION") return null;
  const items = refs(splitArgs(rep.args).slice(-1)[0] ?? "");
  for (const it of items) {
    const e = ent.get(it);
    if (!e) continue;
    if (e.type === "IFCEXTRUDEDAREASOLID") {
      const p = splitArgs(e.args);
      return {
        profile: profilePoints(ent, refs(p[0])[0]),
        frame: frameOf(ent, refs(p[1])[0]),
        depth: nums(p[3])[0] ?? 3000,
        axisPoints: null,
      };
    }
  }
  return null;
}

/** A wall/space representation set: Body (solid) + Axis (centreline). */
function representations(ent: Map<number, Entity>, productShapeId: number | undefined) {
  const result: { body: Solid | null; axis: Point[] | null } = { body: null, axis: null };
  if (!productShapeId) return result;
  const pds = ent.get(productShapeId);
  if (!pds || pds.type !== "IFCPRODUCTDEFINITIONSHAPE") return result;
  for (const sid of refs(splitArgs(pds.args).slice(-1)[0] ?? "")) {
    const rep = ent.get(sid);
    if (!rep || rep.type !== "IFCSHAPEREPRESENTATION") continue;
    const rp = splitArgs(rep.args);
    const identifier = unq(rp[1] ?? "");
    const items = refs(rp.slice(-1)[0] ?? "");
    if (identifier === "Axis") {
      for (const it of items) {
        const pts = polylinePoints(ent, it);
        if (pts.length >= 2) result.axis = pts;
      }
    } else {
      for (const it of items) {
        const e = ent.get(it);
        if (e?.type === "IFCEXTRUDEDAREASOLID") result.body = solidOf(ent, sid);
      }
    }
  }
  return result;
}

/** World polygon + base elevation + extrusion depth for a product's Body solid. */
function productGeometry(
  ent: Map<number, Entity>,
  pdsId: number | undefined,
  placementId: number | undefined,
): { outer: Point[]; z: number; depth: number } | null {
  const rep = representations(ent, pdsId);
  const profile = rep.body?.profile;
  if (!profile || profile.length < 3) return null;
  const placement = placementFrame(ent, placementId);
  const solidFrame = rep.body?.frame ?? IDENTITY;
  const outer = profile.map((pt) => {
    const local = { x: pt.x + solidFrame.x, y: pt.y + solidFrame.y };
    return applyFrame(local, { x: placement.x, y: placement.y, z: 0, angle: placement.angle });
  });
  return { outer, z: placement.z + solidFrame.z, depth: rep.body?.depth ?? 3000 };
}

/** Cartesian points of an IfcFacetedBrep (walked through shells → faces → loops). */
function brepPoints(ent: Map<number, Entity>, pdsId: number | undefined): Point3[] {
  const out: Point3[] = [];
  if (!pdsId) return out;
  const pds = ent.get(pdsId);
  if (!pds || pds.type !== "IFCPRODUCTDEFINITIONSHAPE") return out;
  for (const sid of refs(splitArgs(pds.args).slice(-1)[0] ?? "")) {
    const rep = ent.get(sid);
    if (!rep || rep.type !== "IFCSHAPEREPRESENTATION") continue;
    for (const it of refs(splitArgs(rep.args).slice(-1)[0] ?? "")) {
      const e = ent.get(it);
      if (!e || e.type !== "IFCFACETEDBREP") continue;
      for (const shell of refs(splitArgs(e.args)[0] ?? "")) {
        const sh = ent.get(shell);
        if (!sh || sh.type !== "IFCCLOSEDSHELL") continue;
        for (const face of refs(splitArgs(sh.args)[0] ?? "")) {
          const fa = ent.get(face);
          if (!fa) continue;
          for (const bound of refs(splitArgs(fa.args)[0] ?? "")) {
            const bd = ent.get(bound);
            if (!bd) continue;
            const loop = refs(splitArgs(bd.args)[0] ?? "")[0];
            const lp = loop ? ent.get(loop) : undefined;
            if (lp?.type !== "IFCPOLYLOOP") continue;
            for (const pid of refs(splitArgs(lp.args)[0] ?? "")) {
              const pe = ent.get(pid);
              if (pe?.type !== "IFCCARTESIANPOINT") continue;
              const n = nums(pe.args);
              out.push({ x: n[0] ?? 0, y: n[1] ?? 0, z: n[2] ?? 0 });
            }
          }
        }
      }
    }
  }
  return out;
}

/**
 * World polygon + base elevation + depth, from an extruded solid or (fallback) a
 * faceted BREP's bounding box — stairs and roofs usually arrive as BREPs.
 */
function elementGeometry(
  ent: Map<number, Entity>,
  pdsId: number | undefined,
  placementId: number | undefined,
): { outer: Point[]; z: number; depth: number } | null {
  const solid = productGeometry(ent, pdsId, placementId);
  if (solid) return solid;
  const pts = brepPoints(ent, pdsId);
  if (pts.length < 3) return null;
  const placement = placementFrame(ent, placementId);
  const c = Math.cos(placement.angle);
  const s = Math.sin(placement.angle);
  const world = pts.map((p) => ({
    x: placement.x + p.x * c - p.y * s,
    y: placement.y + p.x * s + p.y * c,
    z: placement.z + p.z,
  }));
  const b = boundsOf(world);
  const zMin = Math.min(...world.map((p) => p.z));
  const zMax = Math.max(...world.map((p) => p.z));
  return {
    outer: [
      { x: b.minX, y: b.minY },
      { x: b.maxX, y: b.minY },
      { x: b.maxX, y: b.maxY },
      { x: b.minX, y: b.maxY },
    ],
    z: Math.round(zMin),
    depth: Math.round(Math.max(0, zMax - zMin)),
  };
}

function boundsOf(pts: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

export function parseIfc(text: string): IfcModel {
  const ent = parseEntities(text);

  // Storeys.
  const levels: IfcLevel[] = [];
  const storeyName = new Map<number, string>();
  for (const [id, e] of ent) {
    if (e.type === "IFCBUILDINGSTOREY") {
      const p = splitArgs(e.args);
      const name = unq(p[2]) || `Level ${levels.length + 1}`;
      const elev = nums(p[p.length - 1])[0] ?? 0;
      levels.push({ name, elevation: elev });
      storeyName.set(id, name);
    }
  }
  levels.sort((a, b) => a.elevation - b.elevation);

  // Which storey contains each element.
  const storeyOf = new Map<number, string>();
  for (const e of ent.values()) {
    if (e.type !== "IFCRELCONTAINEDINSPATIALSTRUCTURE") continue;
    const p = splitArgs(e.args);
    const elements = refs(p[4] ?? "");
    const structure = refs(p[5] ?? "")[0];
    const name = structure ? storeyName.get(structure) : undefined;
    if (!name) continue;
    for (const el of elements) storeyOf.set(el, name);
  }
  // Spaces aggregate to a storey via IfcRelAggregates.
  for (const e of ent.values()) {
    if (e.type !== "IFCRELAGGREGATES") continue;
    const p = splitArgs(e.args);
    const relating = refs(p[4] ?? "")[0];
    const name = relating ? storeyName.get(relating) : undefined;
    if (!name) continue;
    for (const r of refs(p[5] ?? "")) storeyOf.set(r, name);
  }

  const rooms: IfcRoom[] = [];
  const walls: IfcWall[] = [];
  const slabs: IfcSlab[] = [];
  const stairs: IfcStair[] = [];
  const roofs: IfcRoof[] = [];
  const railings: IfcRailing[] = [];
  const wallIndexById = new Map<number, number>();
  const skipped = { doors: 0, windows: 0, slabs: 0, roofs: 0, stairs: 0, unmapped: 0 };

  // Roofs are often aggregations of roof slabs — collect their parts.
  const roofParts = new Map<number, number[]>();
  for (const e of ent.values()) {
    if (e.type !== "IFCRELAGGREGATES") continue;
    const p = splitArgs(e.args);
    const relating = refs(p[4] ?? "")[0];
    if (relating && ent.get(relating)?.type === "IFCROOF") {
      roofParts.set(relating, refs(p[5] ?? ""));
    }
  }

  for (const [id, e] of ent) {
    if (e.type === "IFCSPACE") {
      const p = splitArgs(e.args);
      const g = productGeometry(ent, refs(p[6] ?? "")[0], refs(p[5] ?? "")[0]);
      if (!g) {
        skipped.unmapped++;
        continue;
      }
      rooms.push({
        name: unq(p[7]) || unq(p[2]),
        number: unq(p[2]),
        level: storeyOf.get(id) ?? levels[0]?.name ?? "",
        outer: g.outer,
        heightMm: g.depth,
      });
    } else if (e.type === "IFCWALLSTANDARDCASE" || e.type === "IFCWALL") {
      const p = splitArgs(e.args);
      const placement = placementFrame(ent, refs(p[5] ?? "")[0]);
      const rep = representations(ent, refs(p[6] ?? "")[0]);
      const axis = rep.axis;
      if (!axis || axis.length < 2) {
        skipped.unmapped++;
        continue;
      }
      const a = applyFrame(axis[0], placement);
      const b = applyFrame(axis[axis.length - 1], placement);
      const prof = rep.body?.profile;
      let thickness = 150;
      if (prof && prof.length === 4) {
        const w = Math.abs(prof[1].x - prof[0].x);
        const d = Math.abs(prof[2].y - prof[1].y);
        thickness = Math.round(Math.max(60, Math.min(w, d)));
      }
      wallIndexById.set(id, walls.length);
      walls.push({
        a,
        b,
        thickness,
        height: Math.round(rep.body?.depth ?? 3000),
        level: storeyOf.get(id) ?? levels[0]?.name ?? "",
      });
    } else if (e.type === "IFCSLAB") {
      const p = splitArgs(e.args);
      const g = productGeometry(ent, refs(p[6] ?? "")[0], refs(p[5] ?? "")[0]);
      if (!g) {
        skipped.slabs++;
        continue;
      }
      slabs.push({
        level: storeyOf.get(id) ?? levels[0]?.name ?? "",
        polygon: g.outer,
        z: Math.round(g.z),
        thickness: Math.round(g.depth),
        kind: "floor",
      });
    } else if (e.type === "IFCSTAIRFLIGHT") {
      const p = splitArgs(e.args);
      const g = elementGeometry(ent, refs(p[6] ?? "")[0], refs(p[5] ?? "")[0]);
      if (!g) {
        skipped.stairs++;
        continue;
      }
      const b = boundsOf(g.outer);
      const w = b.maxX - b.minX;
      const d = b.maxY - b.minY;
      const level = storeyOf.get(id) ?? levels[0]?.name ?? "";
      if (w >= d) {
        stairs.push({
          level,
          from: { x: b.minX, y: (b.minY + b.maxY) / 2 },
          to: { x: b.maxX, y: (b.minY + b.maxY) / 2 },
          width: Math.round(d),
          heightMm: Math.round(g.depth),
        });
      } else {
        stairs.push({
          level,
          from: { x: (b.minX + b.maxX) / 2, y: b.minY },
          to: { x: (b.minX + b.maxX) / 2, y: b.maxY },
          width: Math.round(w),
          heightMm: Math.round(g.depth),
        });
      }
    } else if (e.type === "IFCROOF") {
      const p = splitArgs(e.args);
      let g = elementGeometry(ent, refs(p[6] ?? "")[0], refs(p[5] ?? "")[0]);
      if (!g) {
        const pts: Point[] = [];
        for (const part of roofParts.get(id) ?? []) {
          const pe = ent.get(part);
          if (!pe) continue;
          const pp = splitArgs(pe.args);
          const pg = elementGeometry(ent, refs(pp[6] ?? "")[0], refs(pp[5] ?? "")[0]);
          if (pg) pts.push(...pg.outer);
        }
        if (pts.length >= 3) {
          const bb = boundsOf(pts);
          g = {
            outer: [
              { x: bb.minX, y: bb.minY },
              { x: bb.maxX, y: bb.minY },
              { x: bb.maxX, y: bb.maxY },
              { x: bb.minX, y: bb.maxY },
            ],
            z: 0,
            depth: 0,
          };
        }
      }
      if (!g) {
        skipped.roofs++;
        continue;
      }
      const b = boundsOf(g.outer);
      roofs.push({
        level: storeyOf.get(id) ?? levels[0]?.name ?? "",
        polygon: [
          { x: b.minX, y: b.minY },
          { x: b.maxX, y: b.minY },
          { x: b.maxX, y: b.maxY },
          { x: b.minX, y: b.maxY },
        ],
        baseZ: Math.round(g.z),
      });
    } else if (e.type === "IFCRAILING") {
      const p = splitArgs(e.args);
      const g = elementGeometry(ent, refs(p[6] ?? "")[0], refs(p[5] ?? "")[0]);
      if (!g) {
        skipped.unmapped++;
        continue;
      }
      const b = boundsOf(g.outer);
      const w = b.maxX - b.minX;
      const d = b.maxY - b.minY;
      const level = storeyOf.get(id) ?? levels[0]?.name ?? "";
      const height = Math.max(900, Math.min(1300, Math.round(g.depth || 1000)));
      if (w >= d) {
        railings.push({
          level,
          a: { x: b.minX, y: (b.minY + b.maxY) / 2 },
          b: { x: b.maxX, y: (b.minY + b.maxY) / 2 },
          height,
        });
      } else {
        railings.push({
          level,
          a: { x: (b.minX + b.maxX) / 2, y: b.minY },
          b: { x: (b.minX + b.maxX) / 2, y: b.maxY },
          height,
        });
      }
    } else if (e.type === "IFCSTAIR") {
      // A container for stair flights; the flights carry the geometry.
    }
  }

  // Doors/windows: a filler (IfcDoor/IfcWindow) fills an opening, and the
  // opening voids a wall — that chain gives us the host wall and the position.
  const openingWall = new Map<number, number>();
  for (const e of ent.values()) {
    if (e.type !== "IFCRELVOIDSELEMENT") continue;
    const p = splitArgs(e.args);
    const wall = refs(p[4] ?? "")[0];
    const opening = refs(p[5] ?? "")[0];
    if (wall && opening) openingWall.set(opening, wall);
  }
  const openings: IfcOpening[] = [];
  for (const e of ent.values()) {
    if (e.type !== "IFCRELFILLSELEMENT") continue;
    const p = splitArgs(e.args);
    const openingId = refs(p[4] ?? "")[0];
    const fillerId = refs(p[5] ?? "")[0];
    if (!openingId || !fillerId) continue;
    const filler = ent.get(fillerId);
    const kind =
      filler?.type === "IFCDOOR" ? "door" : filler?.type === "IFCWINDOW" ? "window" : null;
    if (!kind) continue;
    const wallEntity = openingWall.get(openingId);
    const wallIndex = wallEntity !== undefined ? wallIndexById.get(wallEntity) : undefined;
    const opening = ent.get(openingId);
    const op = opening ? splitArgs(opening.args) : null;
    const g = op ? productGeometry(ent, refs(op[6] ?? "")[0], refs(op[5] ?? "")[0]) : null;
    if (wallIndex === undefined || !g) {
      skipped.unmapped++;
      if (kind === "door") skipped.doors++;
      else skipped.windows++;
      continue;
    }
    const wall = walls[wallIndex];
    const dx = wall.b.x - wall.a.x;
    const dy = wall.b.y - wall.a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    let minProj = Infinity;
    let maxProj = -Infinity;
    for (const pt of g.outer) {
      const proj = (pt.x - wall.a.x) * ux + (pt.y - wall.a.y) * uy;
      minProj = Math.min(minProj, proj);
      maxProj = Math.max(maxProj, proj);
    }
    // Part 3 §2: the opening body is extruded along the wall normal, so its
    // extrusion depth is the wall thickness — not the opening height. Use the
    // opening's own vertical extent when the body gives one, else typical values.
    // Sill is measured above the host level, not in world Z.
    const floorZ = levels.find((l) => l.name === wall.level)?.elevation ?? 0;
    const sill = kind === "door" ? 0 : Math.max(0, Math.round(g.z - floorZ));
    const fallback = kind === "door" ? 2100 : 1500;
    const measured = g.depth > 400 ? Math.round(g.depth) : 0;
    const height = Math.max(
      600,
      Math.min(measured || fallback, Math.max(600, Math.round(wall.height) - sill - 50)),
    );
    openings.push({
      kind,
      wallIndex,
      width: Math.round(Math.max(300, maxProj - minProj)),
      offset: Math.round(Math.max(0, Math.min(len, (minProj + maxProj) / 2))),
      sill,
      height,
    });
  }

  return { levels, rooms, walls, openings, slabs, stairs, roofs, railings, skipped };
}

const PALETTE = ["#f7ea8b", "#e5e7eb", "#bcd9ea", "#d9d2e9", "#f4b6a6", "#c8e6c9", "#ffe0b2"];

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function ringAreaMm2(pts: Point[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

/** Build a Qreasee document from a parsed IFC model. */
export function ifcToDocState(model: IfcModel): DocState {
  const state = emptyDocState();
  const levels: Level[] = model.levels.map((l, i) => ({
    id: `ifc-L${i + 1}`,
    name: l.name,
    elevation: Math.round(l.elevation),
    floorToFloor: 3000,
  }));
  if (levels.length === 0) levels.push({ id: "ifc-L1", name: "Level 1", elevation: 0, floorToFloor: 3000 });
  // Floor-to-floor from the next storey's elevation.
  for (let i = 0; i < levels.length - 1; i++) {
    levels[i].floorToFloor = Math.max(2400, levels[i + 1].elevation - levels[i].elevation);
  }
  state.levels = levels;
  const levelId = new Map(model.levels.map((l, i) => [l.name, `ifc-L${i + 1}`] as const));
  const fallback = levels[0].id;

  state.rooms = model.rooms.map(
    (r, i): Room => ({
      id: `ifc-room-${i + 1}`,
      levelId: levelId.get(r.level) ?? fallback,
      name: r.name || `Room ${i + 1}`,
      fidelity: "concept",
      polygon: { outer: r.outer.map((p) => ({ x: p.x, y: p.y })), holes: [] },
      areaMm2: ringAreaMm2(r.outer),
      height: Math.round(r.heightMm ?? 3000),
      color: colorFor(r.name),
      origin: "generated",
    }),
  );

  state.walls = model.walls.map(
    (w, i): Wall => ({
      id: `ifc-wall-${i + 1}`,
      levelId: levelId.get(w.level) ?? fallback,
      a: { x: w.a.x, y: w.a.y },
      b: { x: w.b.x, y: w.b.y },
      thickness: w.thickness,
      height: w.height,
      kind: w.thickness >= 150 ? "exterior" : "partition",
      origin: "generated",
    }),
  );

  state.openings = model.openings.map(
    (o, i): Opening => ({
      id: `ifc-open-${i + 1}`,
      wallId: `ifc-wall-${o.wallIndex + 1}`,
      kind: o.kind,
      offset: o.offset,
      width: o.width,
      sill: o.sill,
      height: o.height,
      origin: "generated",
    }),
  );

  state.slabs = model.slabs.map(
    (s, i): Slab => ({
      id: `ifc-slab-${i + 1}`,
      levelId: levelId.get(s.level) ?? fallback,
      kind: s.kind,
      polygon: { outer: s.polygon.map((p) => ({ x: p.x, y: p.y })), holes: [] },
      z: s.z,
      thickness: s.thickness,
      origin: "generated",
    }),
  );

  state.roofs = model.roofs.map(
    (r, i): Roof => ({
      id: `ifc-roof-${i + 1}`,
      levelId: levelId.get(r.level) ?? fallback,
      type: "hip",
      pitchDeg: 30,
      overhang: 600,
      polygon: { outer: r.polygon.map((p) => ({ x: p.x, y: p.y })), holes: [] },
      baseZ: r.baseZ,
      origin: "generated",
    }),
  );

  const floorToFloor = (name: string): number => {
    const idx = model.levels.findIndex((l) => l.name === name);
    const cur = idx >= 0 ? model.levels[idx] : model.levels[0];
    const next = idx >= 0 ? model.levels[idx + 1] : undefined;
    if (cur && next) return Math.max(2400, Math.round(next.elevation - cur.elevation));
    return 3600;
  };
  state.stairs = model.stairs.map(
    (s, i): Stair => ({
      id: `ifc-stair-${i + 1}`,
      levelId: levelId.get(s.level) ?? fallback,
      kind: "straight",
      from: { x: s.from.x, y: s.from.y },
      to: { x: s.to.x, y: s.to.y },
      width: Math.max(700, s.width),
      floorToFloor: floorToFloor(s.level),
      origin: "generated",
    }),
  );

  state.railings = model.railings.map(
    (r, i): Railing => ({
      id: `ifc-railing-${i + 1}`,
      levelId: levelId.get(r.level) ?? fallback,
      a: { x: r.a.x, y: r.a.y },
      b: { x: r.b.x, y: r.b.y },
      height: r.height,
      kind: "balustrade",
      material: "metal-steel",
      origin: "generated",
    }),
  );

  // Site + mass from the ground-floor room extent.
  const ground = state.rooms.filter((r) => r.levelId === fallback);
  const pts = (ground.length ? ground : state.rooms).flatMap((r) => r.polygon.outer);
  if (pts.length >= 3) {
    const minX = Math.min(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y));
    const maxX = Math.max(...pts.map((p) => p.x));
    const maxY = Math.max(...pts.map((p) => p.y));
    const pad = 2000;
    state.site.boundary = [
      { x: minX - pad, y: minY - pad },
      { x: maxX + pad, y: minY - pad },
      { x: maxX + pad, y: maxY + pad },
      { x: minX - pad, y: maxY + pad },
    ];
    state.masses = [
      {
        id: "ifc-mass",
        levelIds: levels.map((l) => l.id),
        footprint: {
          outer: [
            { x: minX, y: minY },
            { x: maxX, y: minY },
            { x: maxX, y: maxY },
            { x: minX, y: maxY },
          ],
          holes: [],
        },
        height: levels[levels.length - 1].elevation + 3400,
        fidelity: "massing",
        name: "Imported building",
        layerId: state.activeLayerId,
      },
    ];
  }
  return state;
}
