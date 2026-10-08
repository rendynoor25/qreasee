/** Walls, floor/ceiling slabs and openings generated from rooms. */

import {
  DEFAULT_MATERIAL_FOR,
  newId,
  type DocState,
  type Mass,
  type Opening as DocOpening,
  type Point,
  type Polygon,
  type Roof as DocRoof,
  type Room as DocRoom,
  type Slab as DocSlab,
  type Wall as DocWall,
} from "@qreasee/shared";
import type {
  DerivedRooms,
  Opening,
  OpeningMark,
  Room as SchematicRoom,
  RailingGeom,
  Schematic,
  SchematicOptions,
  Slab,
  StairGeom,
  ViewRange,
  WallPanel,
} from "./types";
import { DEFAULT_VIEW_RANGE, cutStateFor } from "./types";
import { deriveRooms, type RoomPlan } from "./rooms";
import { buildRoof } from "./roof";
import { stairGeometry } from "./stairs";
import { wallGraph } from "./wallGraph";

interface WallBase {
  id: string;
  kind: "exterior" | "partition";
  a: Point;
  b: Point;
  dir: Point;
  normal: Point;
  off0: number;
  off1: number;
  z0: number;
  z1: number;
  length: number;
  roomId?: string;
  material?: string;
}

const norm = (v: Point): Point => {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
};

function wallBase(
  id: string,
  kind: "exterior" | "partition",
  a: Point,
  b: Point,
  off0: number,
  off1: number,
  z0: number,
  z1: number,
  material: string,
): WallBase {
  const dir = norm({ x: b.x - a.x, y: b.y - a.y });
  return {
    id,
    kind,
    a,
    b,
    dir,
    normal: { x: -dir.y, y: dir.x },
    off0,
    off1,
    z0,
    z1,
    length: Math.hypot(b.x - a.x, b.y - a.y),
    material,
  };
}

function panelQuad(base: WallBase, u0: number, u1: number): Point[] {
  const p = (u: number, off: number): Point => ({
    x: base.a.x + base.dir.x * u + base.normal.x * off,
    y: base.a.y + base.dir.y * u + base.normal.y * off,
  });
  return [p(u0, base.off0), p(u1, base.off0), p(u1, base.off1), p(u0, base.off1)];
}

function makePanel(base: WallBase, u0: number, u1: number, z0: number, z1: number): WallPanel {
  return {
    id: newId("panel"),
    elementId: base.id,
    kind: base.kind,
    polygon: panelQuad(base, u0, u1),
    z0,
    z1,
    roomId: base.roomId,
    material: base.material,
  };
}

/** Split a wall into solid panels around its door/window openings. */
function buildWallPanels(
  base: WallBase,
  openings: Opening[],
  marks: OpeningMark[],
  /** VW-02: absolute Z of the plan cut plane; openings not crossed are seen. */
  cutZ = Infinity,
): WallPanel[] {
  const panels: WallPanel[] = [];
  const sorted = [...openings].sort((a, b) => a.offset - b.offset);
  let cursor = 0;
  for (const op of sorted) {
    const s = Math.max(0, op.offset - op.width / 2);
    const e = Math.min(base.length, op.offset + op.width / 2);
    if (e <= s) continue;
    if (s > cursor) panels.push(makePanel(base, cursor, s, base.z0, base.z1));
    const sillZ = base.z0 + op.sill;
    const headZ = base.z0 + op.sill + op.height;
    if (op.sill > 0 && sillZ > base.z0) panels.push(makePanel(base, s, e, base.z0, sillZ));
    if (headZ < base.z1) panels.push(makePanel(base, s, e, headZ, base.z1));
    marks.push({
      id: op.id,
      kind: op.kind,
      wallKind: base.kind,
      quad: panelQuad(base, s, e),
      width: e - s,
      sill: op.sill,
      height: op.height,
      cutState: cutStateFor(op.sill, op.height, cutZ - base.z0),
    });
    cursor = e;
  }
  if (cursor < base.length) panels.push(makePanel(base, cursor, base.length, base.z0, base.z1));
  return panels;
}

export interface BuildSchematicInput {
  mass: Mass;
  derived: DerivedRooms;
  options: SchematicOptions;
  /** Absolute base elevation of the mass in mm. */
  baseZ: number;
  /** Mass height in mm. */
  height: number;
}

export function buildSchematic(input: BuildSchematicInput) {
  const { mass, derived, options, baseZ, height } = input;
  const z0 = baseZ;
  const z1 = baseZ + height;
  const footprint = mass.footprint;
  const assigned = options.materials ?? {};
  const defaults = options.defaults;
  const matFor = (id: string, fallback: string) => assigned[id] ?? fallback;

  // Slabs: floor below, ceiling above.
  const slabs: Slab[] = [
    {
      id: "slab-floor",
      kind: "floor",
      polygon: footprint.outer,
      z0: z0 - options.slabThickness,
      z1: z0,
      material: matFor("slab-floor", defaults?.floor ?? DEFAULT_MATERIAL_FOR.floor),
    },
    {
      id: "slab-ceiling",
      kind: "ceiling",
      polygon: footprint.outer,
      z0: z1,
      z1: z1 + options.slabThickness,
      material: matFor("slab-ceiling", defaults?.ceiling ?? DEFAULT_MATERIAL_FOR.ceiling),
    },
  ];

  // Exterior walls, one per footprint ring edge, with a centred window.
  const walls: WallPanel[] = [];
  const openingMarks: OpeningMark[] = [];
  const rings = [footprint.outer, ...footprint.holes];
  rings.forEach((ring, ri) => {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const id = `wall-ext-${ri}-${i}`;
      const base = wallBase(
        id,
        "exterior",
        a,
        b,
        0,
        options.exteriorWallThickness,
        z0,
        z1,
        matFor(id, defaults?.wall ?? DEFAULT_MATERIAL_FOR.wall),
      );
      if (base.length < 500) continue;
      const width = Math.min(options.windowWidth, base.length * 0.6);
      const openings: Opening[] = [
        {
          id: newId("win"),
          kind: "window",
          offset: base.length / 2,
          width,
          sill: options.windowSill,
          height: options.windowHeight,
        },
      ];
      walls.push(...buildWallPanels(base, openings, openingMarks, z0 + DEFAULT_VIEW_RANGE.cutPlane));
    }
  });

  // Partitions, one per derived partition, with a centred door.
  derived.partitions.forEach((part, pi) => {
    const id = `wall-part-${pi}`;
    const base = wallBase(
      id,
      "partition",
      part.a,
      part.b,
      -options.partitionThickness / 2,
      options.partitionThickness / 2,
      z0,
      z1,
      matFor(id, defaults?.partition ?? DEFAULT_MATERIAL_FOR.wall),
    );
    if (base.length < 400) return;
    const openings: Opening[] = [
      {
        id: newId("door"),
        kind: "door",
        offset: base.length / 2,
        width: Math.min(options.doorWidth, base.length * 0.8),
        sill: 0,
        height: options.doorHeight,
      },
    ];
    walls.push(...buildWallPanels(base, openings, openingMarks, z0 + DEFAULT_VIEW_RANGE.cutPlane));
  });

  const rooms = derived.rooms.map((r) => ({
    ...r,
    material: matFor(r.id, defaults?.floor ?? DEFAULT_MATERIAL_FOR.floor),
  }));

  const roof = buildRoof(
    footprint.outer,
    options.roofType,
    options.roofPitchDeg,
    options.roofOverhang,
    z1 + options.slabThickness,
  );
  roof.material = matFor("roof", defaults?.roof ?? DEFAULT_MATERIAL_FOR.roof);

  return {
    massId: mass.id,
    baseZ,
    topZ: z1,
    rooms,
    partitions: derived.partitions,
    walls,
    openingMarks,
    slabs,
    roof,
    railings: [],
    stairs: [],
    options,
    viewRange: DEFAULT_VIEW_RANGE,
  };
}

// --- W-01: document entities <-> derived view model ------------------------

export interface StarterEntities {
  walls: DocWall[];
  openings: DocOpening[];
  slabs: DocSlab[];
  roofs: DocRoof[];
  rooms: DocRoom[];
}

const copyRing = (ring: readonly Point[]): Point[] => ring.map((p) => ({ ...p }));

export interface StarterLevel {
  id: string;
  elevation: number;
  floorToFloor: number;
}

/**
 * W-01/W-02 "Generate starter from mass": emit first-class document entities for
 * every level the mass spans — walls and rooms per level, a floor per level, and
 * a ceiling + roof over the top level. Everything is tagged `origin: "generated"`.
 */
export function starterFromMass(
  mass: Mass,
  program: RoomPlan[],
  options: SchematicOptions,
  levels: StarterLevel[],
): StarterEntities {
  const levelIds = mass.levelIds.length ? mass.levelIds : levels.slice(0, 1).map((l) => l.id);
  const massLevels = levelIds
    .map((id) => levels.find((l) => l.id === id))
    .filter((l): l is StarterLevel => !!l);
  if (massLevels.length === 0) {
    return { walls: [], openings: [], slabs: [], roofs: [], rooms: [] };
  }

  const derived = deriveRooms(mass.footprint, program, options.exteriorWallThickness);
  const walls: DocWall[] = [];
  const openings: DocOpening[] = [];
  const rings = [mass.footprint.outer, ...mass.footprint.holes];

  massLevels.forEach((level) => {
    const height = level.floorToFloor || mass.height;
    rings.forEach((ring, ri) => {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len < 500) continue;
        const id = `wall-ext-${level.id}-${ri}-${i}`;
        walls.push({
          id,
          levelId: level.id,
          a: { ...a },
          b: { ...b },
          thickness: options.exteriorWallThickness,
          height,
          kind: "exterior",
          origin: "generated",
        });
        openings.push({
          id: `win-ext-${level.id}-${ri}-${i}`,
          wallId: id,
          kind: "window",
          offset: len / 2,
          width: Math.min(options.windowWidth, len * 0.6),
          sill: options.windowSill,
          height: options.windowHeight,
          origin: "generated",
        });
      }
    });
    derived.partitions.forEach((part, pi) => {
      const len = Math.hypot(part.b.x - part.a.x, part.b.y - part.a.y);
      if (len < 400) return;
      const id = `wall-part-${level.id}-${pi}`;
      walls.push({
        id,
        levelId: level.id,
        a: { ...part.a },
        b: { ...part.b },
        thickness: options.partitionThickness,
        height,
        kind: "partition",
        origin: "generated",
      });
      openings.push({
        id: `door-part-${level.id}-${pi}`,
        wallId: id,
        kind: "door",
        offset: len / 2,
        width: Math.min(options.doorWidth, len * 0.8),
        sill: 0,
        height: options.doorHeight,
        origin: "generated",
      });
    });
  });

  const slabPoly = (): Polygon => ({ outer: copyRing(mass.footprint.outer), holes: [] });
  const slabs: DocSlab[] = massLevels.map((level, li) => ({
    id: li === 0 ? "slab-floor" : `slab-${level.id}-floor`,
    levelId: level.id,
    kind: "floor",
    polygon: slabPoly(),
    z: level.elevation,
    thickness: options.slabThickness,
    origin: "generated",
  }));
  const top = massLevels[massLevels.length - 1];
  const topZ = top.elevation + (top.floorToFloor || mass.height);
  slabs.push({
    id: "slab-ceiling",
    levelId: top.id,
    kind: "ceiling",
    polygon: slabPoly(),
    z: topZ,
    thickness: options.slabThickness,
    origin: "generated",
  });

  const roofs: DocRoof[] = [
    {
      id: "roof",
      levelId: top.id,
      type: options.roofType,
      pitchDeg: options.roofPitchDeg,
      overhang: options.roofOverhang,
      polygon: slabPoly(),
      baseZ: topZ + options.slabThickness,
      origin: "generated",
    },
  ];

  const rooms: DocRoom[] = [];
  massLevels.forEach((level) => {
    derived.rooms.forEach((r, i) => {
      rooms.push({
        id: `room-${level.id}-${i}`,
        levelId: level.id,
        name: r.name,
        fidelity: "schematic",
        polygon: { outer: copyRing(r.polygon), holes: [] },
        areaMm2: r.areaMm2,
        origin: "generated",
      });
    });
  });

  return { walls, openings, slabs, roofs, rooms };
}

export interface SchematicFromDocInput {
  doc: DocState;
  options: SchematicOptions;
  massId?: string;
  /** When set, only this storey's elements are included (plan views). */
  levelId?: string;
  /** VW-01: the vertical rules for this view. Defaults to a 1200 mm cut plane. */
  viewRange?: ViewRange;
}

/**
 * Build the derived `Schematic` view model from the document entities. Drawings,
 * the 3D view and the section cut all consume this, so they read from `DocState`.
 * Pass `levelId` for a single-storey plan; omit it for the full model / section.
 */
export function schematicFromDoc({
  doc,
  options,
  massId = "",
  levelId,
  viewRange = DEFAULT_VIEW_RANGE,
}: SchematicFromDocInput): Schematic | null {
  const onLevel = (id: string) => !levelId || id === levelId;
  const docWalls = doc.walls.filter((w) => onLevel(w.levelId));
  const docSlabs = doc.slabs.filter((s) => onLevel(s.levelId));
  // Plans show every room on the level (imported rooms are `concept`, not just
  // `schematic`), so the plan carries room names.
  const docRooms = doc.rooms.filter((r) => onLevel(r.levelId));
  const elevOf = (id: string) => doc.levels.find((l) => l.id === id)?.elevation ?? 0;
  const docStairs = doc.stairs.filter((st) => {
    if (!levelId || st.levelId === levelId) return true;
    // Part 4 §5.4: a stair arriving at this level from below shows in projection.
    const base = elevOf(st.levelId);
    const here = elevOf(levelId);
    return base + st.floorToFloor <= here + 1 && base >= here - 5000;
  });

  if (docWalls.length === 0 && docSlabs.length === 0 && doc.roofs.length === 0) return null;
  const assigned = options.materials ?? {};
  const defaults = options.defaults;
  const matFor = (id: string, own: string | undefined, fallback: string) => assigned[id] ?? own ?? fallback;
  const levelZ = (id: string) => doc.levels.find((l) => l.id === id)?.elevation ?? 0;

  const walls: WallPanel[] = [];
  const openingMarks: OpeningMark[] = [];
  // Part 3 §1: join the walls — extend each end to meet the wall it joins.
  const graph = wallGraph(docWalls.map((w) => ({ id: w.id, a: w.a, b: w.b, thickness: w.thickness })));
  for (const w of docWalls) {
    const z0 = levelZ(w.levelId);
    const z1 = z0 + w.height;
    const exterior = w.kind === "exterior";
    const material = matFor(
      w.id,
      w.material,
      exterior ? defaults?.wall ?? DEFAULT_MATERIAL_FOR.wall : defaults?.partition ?? DEFAULT_MATERIAL_FOR.wall,
    );
    const ext = graph.ext[w.id] ?? { a: 0, b: 0 };
    const dx = w.b.x - w.a.x;
    const dy = w.b.y - w.a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const a = { x: w.a.x - ux * ext.a, y: w.a.y - uy * ext.a };
    const b = { x: w.b.x + ux * ext.b, y: w.b.y + uy * ext.b };
    const base = wallBase(
      w.id,
      w.kind,
      a,
      b,
      exterior ? 0 : -w.thickness / 2,
      exterior ? w.thickness : w.thickness / 2,
      z0,
      z1,
      material,
    );
    const ops: Opening[] = doc.openings
      .filter((o) => o.wallId === w.id)
      .map((o) => ({ id: o.id, kind: o.kind, offset: o.offset + ext.a, width: o.width, sill: o.sill, height: o.height }));
    walls.push(...buildWallPanels(base, ops, openingMarks, z0 + viewRange.cutPlane));
  }

  const slabs: Slab[] = docSlabs.map((s) => {
    const ceiling = s.kind === "ceiling";
    return {
      id: s.id,
      kind: ceiling ? "ceiling" : "floor",
      polygon: s.polygon.outer,
      z0: ceiling ? s.z : s.z - s.thickness,
      z1: ceiling ? s.z + s.thickness : s.z,
      material: matFor(
        s.id,
        s.material,
        ceiling ? defaults?.ceiling ?? DEFAULT_MATERIAL_FOR.ceiling : defaults?.floor ?? DEFAULT_MATERIAL_FOR.floor,
      ),
    };
  });

  // The roof belongs to the top level; a lower-level plan still shows the roof outline.
  const roofEntity = doc.roofs.find((r) => r.levelId === levelId) ?? doc.roofs[0];
  if (!roofEntity) return null;
  const roof = buildRoof(
    roofEntity.polygon.outer,
    roofEntity.type,
    roofEntity.pitchDeg,
    roofEntity.overhang,
    roofEntity.baseZ,
  );
  roof.material = matFor(roofEntity.id, roofEntity.material, defaults?.roof ?? DEFAULT_MATERIAL_FOR.roof);

  const rooms: SchematicRoom[] = docRooms.map((r) => ({
    id: r.id,
    name: r.name,
    polygon: r.polygon.outer,
    areaMm2: r.areaMm2,
    material: matFor(r.id, undefined, defaults?.floor ?? DEFAULT_MATERIAL_FOR.floor),
  }));

  const stairs: StairGeom[] = docStairs.map((st) => ({
    ...stairGeometry(st, levelZ(st.levelId)),
    projection: !!levelId && st.levelId !== levelId,
  }));
  const railings: RailingGeom[] = (doc.railings ?? [])
    .filter((r) => onLevel(r.levelId))
    .map((r) => ({ id: r.id, a: r.a, b: r.b, height: r.height, z: levelZ(r.levelId) }));

  const baseZ = Math.min(
    0,
    ...docWalls.map((w) => levelZ(w.levelId)),
    ...docSlabs.map((s) => s.z - s.thickness),
    roofEntity.baseZ,
  );
  const topZ = Math.max(
    ...docWalls.map((w) => levelZ(w.levelId) + w.height),
    ...docSlabs.map((s) => s.z + s.thickness),
    roofEntity.baseZ,
  );

  return {
    massId,
    baseZ,
    topZ,
    levelId,
    rooms,
    partitions: [],
    walls,
    openingMarks,
    slabs,
    roof,
    roofOnLevel: doc.roofs.some((r) => r.levelId === levelId),
    railings,
    stairs,
    options,
    viewRange,
  };
}
