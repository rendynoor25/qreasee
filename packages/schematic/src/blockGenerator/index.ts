/**
 * BG-01/02: generate walls, floor slabs and ceilings from concept blocks. Pure —
 * returns operations to apply, warnings and a report; nothing is mutated here.
 *
 *  - Blocks are the source of intent; elements are derived (origin "generated")
 *    with stable ids and `sourceBlockIds`.
 *  - Shared edges become one partition; exterior edges become exterior walls.
 *  - Floors: one slab per storey = the union of that storey's block footprints.
 *  - Ceilings: per room at elevation + height, skipped when a block sits above.
 *  - Manual elements are never touched; regeneration diffs the generated set
 *    (same input → no ops).
 */

import type { Id, Opening, Point, Roof, Room, Slab, Stair, Wall } from "@qreasee/shared";
import { analyseEdges, type BlockEdge } from "./edges";
import { segmentCoords, stableId } from "./stableId";
import { pointInPolygon, subtractPolygons, unionPolygons } from "./union";
import {
  DEFAULT_BLOCK_GEN_SETTINGS,
  type BlockGenInput,
  type BlockGenResult,
  type BlockGenSettings,
  type BlockOp,
  type BlockWarning,
} from "./types";

export * from "./types";
export { analyseEdges } from "./edges";
export { unionPolygons, pointInPolygon } from "./union";
export { stableId, quantise, segmentCoords } from "./stableId";

const polys = (r: Room) => r.polygon.outer;

function polygonArea(ring: Point[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

function polygonPerimeter(ring: Point[]): number {
  let p = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    p += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return p;
}

function centroid(ring: Point[]): Point {
  const n = ring.length || 1;
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p.x;
    y += p.y;
  }
  return { x: x / n, y: y / n };
}

const edgeCoords = (e: BlockEdge): number[] => segmentCoords(e.a, e.b);

function wallChanged(a: Wall, b: Wall): boolean {
  return (
    a.a.x !== b.a.x ||
    a.a.y !== b.a.y ||
    a.b.x !== b.b.x ||
    a.b.y !== b.b.y ||
    a.thickness !== b.thickness ||
    a.height !== b.height ||
    a.kind !== b.kind
  );
}

function ringEq(a: Point[], b: Point[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i].x !== b[i].x || a[i].y !== b[i].y) return false;
  return true;
}

function slabChanged(a: Slab, b: Slab): boolean {
  return a.z !== b.z || a.thickness !== b.thickness || a.kind !== b.kind || !ringEq(a.polygon.outer, b.polygon.outer);
}

function roofChanged(a: Roof, b: Roof): boolean {
  return (
    a.type !== b.type ||
    a.pitchDeg !== b.pitchDeg ||
    a.overhang !== b.overhang ||
    a.baseZ !== b.baseZ ||
    !ringEq(a.polygon.outer, b.polygon.outer)
  );
}

function openingChanged(a: Opening, b: Opening): boolean {
  return (
    a.wallId !== b.wallId ||
    a.kind !== b.kind ||
    a.offset !== b.offset ||
    a.width !== b.width ||
    a.sill !== b.sill ||
    a.height !== b.height
  );
}

type RoomClass = "outdoor" | "wet" | "circulation" | "living" | "private" | "service" | "other";

/** BG-04: classify a room from its name/zone for the door + window rules. */
export function classifyRoom(name: string, zone?: string): RoomClass {
  const n = `${name} ${zone ?? ""}`.toLowerCase();
  if (/teras|terrace|carport|taman|garden|balkon|balcony|paving|jalan/.test(n)) return "outdoor";
  if (/wc|km\b|kamar mandi|mandi|bath|shower|cuci|laundry|jemur|dapur|kitchen|pantry/.test(n)) return "wet";
  if (/tangga|stair|koridor|hall|selasar|lobby|foyer|entrance|masuk|void/.test(n)) return "circulation";
  if (/keluarga|living|tamu|family|makan|dining|ruang|tengah/.test(n)) return "living";
  if (/tidur|bed|utama|anak|art|wardrobe|master|kamar/.test(n)) return "private";
  if (/gudang|garasi|service|mep|pompa/.test(n)) return "service";
  return "other";
}

export function generateFromBlocks(input: BlockGenInput): BlockGenResult {
  const settings: BlockGenSettings = { ...DEFAULT_BLOCK_GEN_SETTINGS, ...input.settings };
  const warnings: BlockWarning[] = [];
  const blocks = input.blocks.filter((b) => b.fidelity === "concept" && polys(b).length >= 3);
  const levelElev = (id: Id) => input.levels.find((l) => l.id === id)?.elevation ?? 0;
  const storeyZ = (b: Room) => b.elevationMm ?? levelElev(b.levelId);
  const heightOf = (b: Room) => b.height ?? input.settings?.wallHeight ?? settings.wallHeight;

  // -------------------------------------------------------------- walls (BG-01)
  const { edges } = analyseEdges(blocks, settings.snapTolerance);
  const wallById = new Map<string, Wall>();
  for (const e of edges) {
    const thickness = e.kind === "shared" ? settings.partitionThickness : settings.exteriorThickness;
    const id = stableId("wall", e.blockIds, edgeCoords(e));
    if (wallById.has(id)) continue;
    let a = e.a;
    let b = e.b;
    if (settings.edgeLocation === "innerFace" && e.kind === "exterior") {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      let nx = -dy / len;
      let ny = dx / len;
      const c = centroid(polys(blocks.find((x) => x.id === e.blockIds[0])!));
      if (nx * (c.x - a.x) + ny * (c.y - a.y) > 0) {
        nx = -nx;
        ny = -ny;
      }
      const off = thickness / 2;
      a = { x: a.x + nx * off, y: a.y + ny * off };
      b = { x: b.x + nx * off, y: b.y + ny * off };
    }
    // Extend wall height to the storey's floor-to-floor if the level defines one.
    const blk = blocks.find((x) => x.id === e.blockIds[0])!;
    wallById.set(id, {
      id,
      levelId: blk.levelId,
      a,
      b,
      thickness,
      height: heightOf(blk),
      kind: e.kind === "shared" ? "partition" : "exterior",
      origin: "generated",
      sourceBlockIds: e.blockIds,
    });
  }
  const generatedWalls = [...wallById.values()];

  // ---------------------------------------------------------------- stairs (BG-05)
  const stairBlocks = blocks.filter((b) => /stair|tangga|stairs/i.test(`${b.name} ${b.zone ?? ""}`));
  const generatedStairs: Stair[] = [];
  for (const b of stairBlocks) {
    const ring = polys(b);
    const xs = ring.map((p) => p.x);
    const ys = ring.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const w = maxX - minX;
    const h = maxY - minY;
    const ftf =
      input.settings?.levelHeights?.[b.levelId] ??
      input.levels.find((l) => l.id === b.levelId)?.floorToFloor ??
      settings.wallHeight;
    const longY = h >= w;
    const stairW = Math.min(longY ? w : h, 1200);
    const inset = Math.max(50, stairW * 0.1);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const from = longY ? { x: cx, y: minY + inset } : { x: minX + inset, y: cy };
    const to = longY ? { x: cx, y: maxY - inset } : { x: maxX - inset, y: cy };
    generatedStairs.push({
      id: stableId("stair", [b.id], [from.x, from.y, to.x, to.y]),
      levelId: b.levelId,
      kind: "straight",
      from,
      to,
      width: Math.round(stairW),
      floorToFloor: Math.round(ftf),
      origin: "generated",
      sourceBlockIds: [b.id],
    });
  }

  // -------------------------------------------------- floors + ceilings (BG-02)
  const storeys = new Map<number, Room[]>();
  for (const b of blocks) {
    const z = Math.round(storeyZ(b) / 10) * 10;
    const arr = storeys.get(z) ?? [];
    arr.push(b);
    storeys.set(z, arr);
  }
  const generatedSlabs: Slab[] = [];
  for (const [z, group] of storeys) {
    // BG-05: cut the stair void into the floor of the storey above.
    const voids = stairBlocks.filter((b) => Math.round(storeyZ(b) / 10) * 10 < z).map((b) => polys(b));
    const rects = voids.length
      ? subtractPolygons(group.map((b) => polys(b)), voids)
      : unionPolygons(group.map((b) => polys(b)));
    for (const rect of rects) {
      const outer = rect;
      const c = centroid(outer);
      const owners = group.filter((b) => pointInPolygon(c, polys(b))).map((b) => b.id).sort();
      generatedSlabs.push({
        id: stableId("floor", [`z${z}`], outer.flatMap((p) => [p.x, p.y])),
        levelId: group[0].levelId,
        kind: "floor",
        polygon: { outer, holes: [] },
        z,
        thickness: settings.slabThickness,
        origin: "generated",
        sourceBlockIds: owners,
      });
    }
  }
  for (const b of blocks) {
    const ring = polys(b);
    const c = centroid(ring);
    const top = Math.round((storeyZ(b) + heightOf(b)) / 10) * 10;
    // Skip the ceiling when another block sits directly above (its floor is the ceiling).
    const covered = blocks.some(
      (o) =>
        o.id !== b.id &&
        storeyZ(o) > storeyZ(b) + 1 &&
        (pointInPolygon(c, polys(o)) || pointInPolygon(centroid(polys(o)), ring)),
    );
    if (covered) continue;
    generatedSlabs.push({
      id: stableId("ceiling", [b.id], [...segmentCoords(c, c)]),
      levelId: b.levelId,
      kind: "ceiling",
      polygon: { outer: ring.map((p) => ({ ...p })), holes: [] },
      z: top,
      thickness: settings.slabThickness,
      origin: "generated",
      sourceBlockIds: [b.id],
    });
  }

  // ---------------------------------------------------------------- roofs (BG-03)
  const generatedRoofs: Roof[] = [];
  for (const [z, group] of storeys) {
    // Exposed top = the storey's footprints minus the footprints of blocks above.
    const above = blocks.filter((b) => Math.round(storeyZ(b) / 10) * 10 > z).map((b) => polys(b));
    const exposed = subtractPolygons(group.map((b) => polys(b)), above);
    const roofZ = Math.round((z + Math.max(...group.map(heightOf))) / 10) * 10;
    for (const rect of exposed) {
      const c = centroid(rect);
      const owners = group.filter((b) => pointInPolygon(c, polys(b)));
      const shed = owners.some((b) =>
        /carport|terrace|teras|canopy|kanopi|porch|balcony|balkon/i.test(`${b.name} ${b.zone ?? ""}`),
      );
      generatedRoofs.push({
        id: stableId("roof", [`z${z}`], rect.flatMap((p) => [p.x, p.y])),
        levelId: group[0].levelId,
        type: shed ? "shed" : settings.roofType,
        pitchDeg: settings.roofPitchDeg,
        overhang: settings.roofOverhang,
        polygon: { outer: rect, holes: [] },
        baseZ: roofZ,
        origin: "generated",
        sourceBlockIds: owners.map((b) => b.id).sort(),
      });
    }
  }

  // -------------------------------------------------------------- openings (BG-04)
  const generatedOpenings: Opening[] = [];
  const blockById = new Map(blocks.map((b) => [b.id, b]));
  const wallLen = (w: Wall) => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
  const canFit = (w: Wall, width: number) => wallLen(w) >= width + 2 * settings.cornerMargin;

  // Doors on shared partitions the adjacency rule connects.
  for (const w of generatedWalls) {
    if (w.kind !== "partition" || !w.sourceBlockIds || w.sourceBlockIds.length < 2) continue;
    const A = blockById.get(w.sourceBlockIds[0]);
    const B = blockById.get(w.sourceBlockIds[1]);
    if (!A || !B) continue;
    const ca = classifyRoom(A.name, A.zone);
    const cb = classifyRoom(B.name, B.zone);
    const isCirc = (c: RoomClass) => c === "circulation";
    const isLiving = (c: RoomClass) => c === "living";
    const isWet = (c: RoomClass) => c === "wet";
    const isPrivate = (c: RoomClass) => c === "private";
    const connect =
      isCirc(ca) ||
      isCirc(cb) ||
      isLiving(ca) ||
      isLiving(cb) ||
      (isWet(ca) && (isPrivate(cb) || isCirc(cb))) ||
      (isWet(cb) && (isPrivate(ca) || isCirc(ca)));
    if (!connect) continue;
    const width = ca === "wet" || cb === "wet" ? settings.bathDoorWidth : settings.doorWidth;
    if (!canFit(w, width)) continue;
    const offset = wallLen(w) / 2;
    generatedOpenings.push({
      id: stableId("door", [w.id, ...w.sourceBlockIds], [offset]),
      wallId: w.id,
      kind: "door",
      offset,
      width,
      sill: 0,
      height: settings.doorHeight,
      origin: "generated",
      sourceBlockIds: w.sourceBlockIds,
    });
  }

  // Main entrance: the living/entrance room's exterior wall nearest the frontage.
  const frontageY =
    input.siteBoundary && input.siteBoundary.length ? Math.min(...input.siteBoundary.map((p) => p.y)) : -Infinity;
  const entranceRooms = blocks.filter((b) => /entrance|foyer|masuk|living|keluarga|tamu|tengah/i.test(b.name));
  if (entranceRooms.length) {
    let best: { w: Wall; d: number } | null = null;
    for (const w of generatedWalls) {
      if (w.kind !== "exterior" || !w.sourceBlockIds || w.sourceBlockIds.length !== 1) continue;
      if (!entranceRooms.some((r) => r.id === w.sourceBlockIds![0])) continue;
      if (!canFit(w, settings.doorWidth)) continue;
      const d = Math.abs((w.a.y + w.b.y) / 2 - frontageY);
      if (!best || d < best.d) best = { w, d };
    }
    if (best) {
      const offset = wallLen(best.w) / 2;
      generatedOpenings.push({
        id: stableId("door", [best.w.id, "entrance"], [offset]),
        wallId: best.w.id,
        kind: "door",
        offset,
        width: settings.doorWidth,
        sill: 0,
        height: settings.doorHeight,
        origin: "generated",
        sourceBlockIds: best.w.sourceBlockIds,
      });
    }
  }

  // Windows on exterior walls of habitable rooms (not the entrance wall, no outdoor).
  const entranceWallIds = new Set(
    generatedOpenings.filter((o) => o.kind === "door" && o.sourceBlockIds?.length === 1).map((o) => o.wallId),
  );
  for (const w of generatedWalls) {
    if (w.kind !== "exterior" || !w.sourceBlockIds || w.sourceBlockIds.length !== 1) continue;
    const room = blockById.get(w.sourceBlockIds[0]);
    if (!room) continue;
    const c = classifyRoom(room.name, room.zone);
    if (c === "outdoor" || c === "circulation") continue;
    if (entranceWallIds.has(w.id)) continue;
    const wet = c === "wet";
    if (!canFit(w, settings.windowWidth)) continue;
    const offset = wallLen(w) / 2;
    generatedOpenings.push({
      id: stableId("win", [w.id], [offset]),
      wallId: w.id,
      kind: "window",
      offset,
      width: settings.windowWidth,
      sill: wet ? settings.highWindowSill : settings.windowSill,
      height: wet ? 600 : settings.windowHeight,
      origin: "generated",
      sourceBlockIds: w.sourceBlockIds,
    });
  }

  // ------------------------------------------------------------------- diff
  const ops: BlockOp[] = [];
  // BG-06: ids the user has edited are kept as-is (locked).
  const locked = (id: string) => !!input.overrides?.[id]?.locked;
  const prevWalls = (input.existingWalls ?? []).filter((w) => w.origin === "generated");
  const prevWallsById = new Map(prevWalls.map((w) => [w.id, w]));
  const nextWallsById = new Map(generatedWalls.map((w) => [w.id, w]));
  for (const w of generatedWalls) {
    if (locked(w.id)) continue;
    const p = prevWallsById.get(w.id);
    if (!p) ops.push({ type: "wall.add", wall: w });
    else if (wallChanged(p, w)) ops.push({ type: "wall.update", id: w.id, patch: w });
  }
  for (const p of prevWalls) if (!nextWallsById.has(p.id) && !locked(p.id)) ops.push({ type: "wall.remove", id: p.id });

  const prevSlabs = (input.existingSlabs ?? []).filter((s) => s.origin === "generated");
  const prevSlabsById = new Map(prevSlabs.map((s) => [s.id, s]));
  const nextSlabsById = new Map(generatedSlabs.map((s) => [s.id, s]));
  for (const s of generatedSlabs) {
    if (locked(s.id)) continue;
    const p = prevSlabsById.get(s.id);
    if (!p) ops.push({ type: "slab.add", slab: s });
    else if (slabChanged(p, s)) ops.push({ type: "slab.update", id: s.id, patch: s });
  }
  for (const p of prevSlabs) if (!nextSlabsById.has(p.id) && !locked(p.id)) ops.push({ type: "slab.remove", id: p.id });

  const prevRoofs = (input.existingRoofs ?? []).filter((r) => r.origin === "generated");
  const prevRoofsById = new Map(prevRoofs.map((r) => [r.id, r]));
  const nextRoofsById = new Map(generatedRoofs.map((r) => [r.id, r]));
  for (const r of generatedRoofs) {
    if (locked(r.id)) continue;
    const p = prevRoofsById.get(r.id);
    if (!p) ops.push({ type: "roof.add", roof: r });
    else if (roofChanged(p, r)) ops.push({ type: "roof.update", id: r.id, patch: r });
  }
  for (const p of prevRoofs) if (!nextRoofsById.has(p.id) && !locked(p.id)) ops.push({ type: "roof.remove", id: p.id });

  const prevOpenings = (input.existingOpenings ?? []).filter((o) => o.origin === "generated");
  const prevOpeningsById = new Map(prevOpenings.map((o) => [o.id, o]));
  const nextOpeningsById = new Map(generatedOpenings.map((o) => [o.id, o]));
  for (const o of generatedOpenings) {
    if (locked(o.id)) continue;
    const p = prevOpeningsById.get(o.id);
    if (!p) ops.push({ type: "opening.add", opening: o });
    else if (openingChanged(p, o)) ops.push({ type: "opening.update", id: o.id, patch: o });
  }
  for (const p of prevOpenings) if (!nextOpeningsById.has(p.id) && !locked(p.id)) ops.push({ type: "opening.remove", id: p.id });

  const prevStairs = (input.existingStairs ?? []).filter((s) => s.origin === "generated");
  const prevStairsById = new Map(prevStairs.map((s) => [s.id, s]));
  const nextStairsById = new Map(generatedStairs.map((s) => [s.id, s]));
  for (const s of generatedStairs) {
    if (locked(s.id)) continue;
    const p = prevStairsById.get(s.id);
    if (!p) ops.push({ type: "stair.add", stair: s });
    else if (
      p.from.x !== s.from.x ||
      p.from.y !== s.from.y ||
      p.to.x !== s.to.x ||
      p.to.y !== s.to.y ||
      p.width !== s.width ||
      p.floorToFloor !== s.floorToFloor
    )
      ops.push({ type: "stair.update", id: s.id, patch: s });
  }
  for (const p of prevStairs) if (!nextStairsById.has(p.id) && !locked(p.id)) ops.push({ type: "stair.remove", id: p.id });

  // ------------------------------------------------------------------- report
  const netAreaByRoom: Record<string, number> = {};
  for (const b of blocks) {
    const ring = polys(b);
    const t = settings.exteriorThickness / 2;
    netAreaByRoom[b.id] = Math.max(0, Math.round(polygonArea(ring) - polygonPerimeter(ring) * t));
  }
  return {
    ops,
    warnings,
    report: {
      wallsGenerated: generatedWalls.length,
      sharedEdges: generatedWalls.filter((w) => w.kind === "partition").length,
      exteriorEdges: generatedWalls.filter((w) => w.kind === "exterior").length,
      unassignedEdges: 0,
      netAreaByRoom,
      slabsGenerated: generatedSlabs.filter((s) => s.kind === "floor").length,
      ceilingsGenerated: generatedSlabs.filter((s) => s.kind === "ceiling").length,
      roofsGenerated: generatedRoofs.length,
      openingsGenerated: generatedOpenings.length,
      doorsGenerated: generatedOpenings.filter((o) => o.kind === "door").length,
      windowsGenerated: generatedOpenings.filter((o) => o.kind === "window").length,
      stairsGenerated: generatedStairs.length,
    },
  };
}
