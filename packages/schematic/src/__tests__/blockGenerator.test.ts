import { describe, expect, it } from "vitest";
import type { Level, Room, Wall } from "@qreasee/shared";
import { generateFromBlocks, type BlockGenResult, type BlockOp } from "../blockGenerator";

const lvl: Level = { id: "L1", name: "Lantai 1", elevation: 0, floorToFloor: 3000 };
const lvl2: Level = { id: "L2", name: "Lantai 2", elevation: 3000, floorToFloor: 3000 };

function rect(id: string, x: number, y: number, w: number, h: number, levelId = "L1", name?: string): Room {
  return {
    id,
    levelId,
    name: name ?? id,
    fidelity: "concept",
    polygon: {
      outer: [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ],
      holes: [],
    },
    areaMm2: w * h,
    height: 3000,
  };
}

type Add<K extends BlockOp["type"]> = Extract<BlockOp, { type: K }>;
const added = <K extends BlockOp["type"]>(res: BlockGenResult, type: K): Add<K>[] =>
  res.ops.filter((o): o is Add<K> => o.type === type);
const addedWalls = (res: BlockGenResult) => added(res, "wall.add").map((o) => o.wall);
const addedSlabs = (res: BlockGenResult) => added(res, "slab.add").map((o) => o.slab);
const addedRoofs = (res: BlockGenResult) => added(res, "roof.add").map((o) => o.roof);
const addedOpenings = (res: BlockGenResult) => added(res, "opening.add").map((o) => o.opening);
const addedStairs = (res: BlockGenResult) => added(res, "stair.add").map((o) => o.stair);
/** Pass one run's output back as the existing set for an idempotency check. */
const existing = (res: BlockGenResult) => ({
  existingWalls: addedWalls(res),
  existingSlabs: addedSlabs(res),
  existingRoofs: addedRoofs(res),
  existingOpenings: addedOpenings(res),
  existingStairs: addedStairs(res),
});

describe("BG-01 generate walls from blocks", () => {
  it("two adjacent rectangles → 1 shared partition, 6 exterior, no duplicates", () => {
    const res = generateFromBlocks({
      blocks: [rect("a", 0, 0, 5000, 4000), rect("b", 5000, 0, 5000, 4000)],
      levels: [lvl],
    });
    const walls = addedWalls(res);
    expect(walls.length).toBe(7);
    expect(res.report.sharedEdges).toBe(1);
    expect(res.report.exteriorEdges).toBe(6);
    expect(new Set(walls.map((w) => w.id)).size).toBe(walls.length);
    const shared = walls.find((w) => w.kind === "partition")!;
    expect(shared.sourceBlockIds).toEqual(["a", "b"]);
    expect(shared.thickness).toBe(100);
  });

  it("L-shaped union of 3 blocks → no duplicate ids", () => {
    const res = generateFromBlocks({
      blocks: [rect("a", 0, 0, 6000, 4000), rect("b", 0, 4000, 3000, 3000), rect("c", 6000, 0, 2000, 2000)],
      levels: [lvl],
    });
    const ids = addedWalls(res).map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(res.report.sharedEdges).toBeGreaterThanOrEqual(1);
  });

  it("regenerate twice → zero ops (stable ids, idempotent)", () => {
    const blocks = [rect("a", 0, 0, 5000, 4000), rect("b", 5000, 0, 5000, 4000)];
    const first = generateFromBlocks({ blocks, levels: [lvl] });
    const second = generateFromBlocks({ blocks, levels: [lvl], ...existing(first) });
    expect(second.ops.length).toBe(0);
  });

  it("moving one block only changes affected walls", () => {
    const before = [rect("a", 0, 0, 5000, 4000), rect("b", 5000, 0, 5000, 4000)];
    const first = generateFromBlocks({ blocks: before, levels: [lvl] });
    const left = addedWalls(first).find((w) => w.a.x === 0 && w.b.x === 0)!;
    const after = [rect("a", 0, 0, 5000, 4000), rect("b", 7000, 0, 5000, 4000)];
    const res = generateFromBlocks({ blocks: after, levels: [lvl], ...existing(first) });
    expect(res.ops.length).toBeGreaterThan(0);
    expect(res.ops.find((o) => "id" in o && o.id === left.id)).toBeUndefined();
  });

  it("a manual wall survives regeneration", () => {
    const blocks = [rect("a", 0, 0, 5000, 4000), rect("b", 5000, 0, 5000, 4000)];
    const first = generateFromBlocks({ blocks, levels: [lvl] });
    const manual: Wall = {
      id: "manual-1",
      levelId: "L1",
      a: { x: 0, y: 0 },
      b: { x: 0, y: 500 },
      thickness: 200,
      height: 3000,
      kind: "exterior",
      origin: "user",
    };
    const res = generateFromBlocks({
      blocks,
      levels: [lvl],
      ...existing(first),
      existingWalls: [...existing(first).existingWalls, manual],
    });
    expect(res.ops.length).toBe(0);
  });

  it("BG-06 a locked generated wall is kept when a block moves", () => {
    const before = [rect("a", 0, 0, 5000, 4000), rect("b", 5000, 0, 5000, 4000)];
    const first = generateFromBlocks({ blocks: before, levels: [lvl] });
    const shared = addedWalls(first).find((w) => w.kind === "partition")!;
    // Moving b changes the shared edge's coords → a new id; the old one would be
    // removed unless it is locked.
    const after = [rect("a", 0, 0, 5000, 4000), rect("b", 8000, 0, 5000, 4000)];
    const res = generateFromBlocks({
      blocks: after,
      levels: [lvl],
      existingWalls: addedWalls(first),
      overrides: { [shared.id]: { locked: true } },
    });
    expect(res.ops.some((o) => o.type === "wall.remove" && o.id === shared.id)).toBe(false);
    expect(res.ops.some((o) => o.type === "wall.update" && o.id === shared.id)).toBe(false);
  });
});

describe("BG-02 floors + ceilings", () => {
  it("one block → 1 floor slab at the level elevation + 1 ceiling", () => {
    const res = generateFromBlocks({ blocks: [rect("a", 0, 0, 4000, 3000)], levels: [lvl] });
    const floor = addedSlabs(res).find((s) => s.kind === "floor")!;
    expect(floor.z).toBe(0);
    expect(floor.thickness).toBe(150);
    expect(res.report.slabsGenerated).toBe(1);
    expect(res.report.ceilingsGenerated).toBe(1);
  });

  it("two adjacent blocks → one union floor slab, two ceilings", () => {
    const res = generateFromBlocks({
      blocks: [rect("a", 0, 0, 5000, 4000), rect("b", 5000, 0, 5000, 4000)],
      levels: [lvl],
    });
    expect(res.report.slabsGenerated).toBe(1);
    expect(res.report.ceilingsGenerated).toBe(2);
  });

  it("a block stacked above skips the lower ceiling", () => {
    const lower = rect("l", 0, 0, 4000, 4000);
    const upper: Room = { ...rect("u", 0, 0, 4000, 4000, "L2"), elevationMm: 3000 };
    const res = generateFromBlocks({ blocks: [lower, upper], levels: [lvl, lvl2] });
    expect(res.report.ceilingsGenerated).toBe(1);
    expect(res.report.slabsGenerated).toBe(2);
  });
});

describe("BG-03 roofs", () => {
  it("a single block → one gable roof at the block top", () => {
    const res = generateFromBlocks({ blocks: [rect("a", 0, 0, 6000, 4000)], levels: [lvl] });
    const roofs = addedRoofs(res);
    expect(roofs.length).toBe(1);
    expect(roofs[0].type).toBe("gable");
    expect(roofs[0].baseZ).toBe(3000);
    expect(roofs[0].overhang).toBe(600);
    expect(res.report.roofsGenerated).toBe(1);
  });

  it("a carport block → single-slope roof", () => {
    const res = generateFromBlocks({ blocks: [rect("c", 0, 0, 3000, 5000, "L1", "carport")], levels: [lvl] });
    expect(addedRoofs(res)[0].type).toBe("shed");
  });

  it("a stacked block: the exposed top is the lower footprint minus the upper", () => {
    const lower = rect("l", 0, 0, 6000, 4000);
    const upper: Room = { ...rect("u", 0, 0, 3000, 4000, "L2"), elevationMm: 3000 };
    const res = generateFromBlocks({ blocks: [lower, upper], levels: [lvl, lvl2] });
    const roofs = addedRoofs(res);
    expect(roofs.length).toBe(2); // lower storey (3000×4000) + upper storey (3000×4000)
    const lowerRoof = roofs.find((r) => r.baseZ === 3000 && r.sourceBlockIds?.includes("l"))!;
    expect(lowerRoof).toBeDefined();
  });

  it("roofs are idempotent", () => {
    const blocks = [rect("a", 0, 0, 6000, 4000), rect("b", 6000, 0, 3000, 4000)];
    const first = generateFromBlocks({ blocks, levels: [lvl] });
    const second = generateFromBlocks({ blocks, levels: [lvl], ...existing(first) });
    expect(second.ops.length).toBe(0);
  });
});

describe("BG-04 openings", () => {
  it("a door on the shared wall between a living room and a bedroom", () => {
    const res = generateFromBlocks({
      blocks: [
        rect("a", 0, 0, 5000, 4000, "L1", "R. Keluarga"),
        rect("b", 5000, 0, 5000, 4000, "L1", "KT. Anak"),
      ],
      levels: [lvl],
    });
    const shared = addedOpenings(res).find((o) => o.kind === "door" && o.sourceBlockIds?.length === 2);
    expect(shared).toBeDefined();
    expect(shared!.width).toBe(900);
  });

  it("a window (sill 900) on an exterior wall of a habitable room", () => {
    const res = generateFromBlocks({ blocks: [rect("a", 0, 0, 6000, 4000, "L1", "KT. Anak")], levels: [lvl] });
    const win = addedOpenings(res).find((o) => o.kind === "window");
    expect(win).toBeDefined();
    expect(win!.sill).toBe(900);
    expect(win!.width).toBe(1200);
  });

  it("a bathroom gets a high window (sill 1500)", () => {
    const res = generateFromBlocks({ blocks: [rect("a", 0, 0, 4000, 3000, "L1", "KM/WC")], levels: [lvl] });
    const win = addedOpenings(res).find((o) => o.kind === "window");
    expect(win!.sill).toBe(1500);
  });

  it("no opening on a wall too short for it", () => {
    // 500 mm wall: a 900 door cannot fit with 150 margins.
    const res = generateFromBlocks({ blocks: [rect("a", 0, 0, 500, 500)], levels: [lvl] });
    expect(addedOpenings(res).length).toBe(0);
  });

  it("openings are idempotent", () => {
    const blocks = [rect("a", 0, 0, 6000, 4000, "L1", "R. Keluarga"), rect("b", 6000, 0, 4000, 4000, "L1", "KM/WC")];
    const first = generateFromBlocks({ blocks, levels: [lvl] });
    const second = generateFromBlocks({ blocks, levels: [lvl], ...existing(first) });
    expect(second.ops.length).toBe(0);
  });
});

describe("BG-05 stairs", () => {
  const area = (ring: { x: number; y: number }[]) => {
    let a = 0;
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i];
      const q = ring[(i + 1) % ring.length];
      a += p.x * q.y - q.x * p.y;
    }
    return Math.abs(a) / 2;
  };

  it("a stair block generates one run with the level floor-to-floor", () => {
    const res = generateFromBlocks({ blocks: [rect("s", 0, 0, 2000, 4000, "L1", "Tangga")], levels: [lvl] });
    const stairs = addedStairs(res);
    expect(stairs.length).toBe(1);
    expect(stairs[0].floorToFloor).toBe(3000);
    expect(stairs[0].width).toBeLessThanOrEqual(1200);
    expect(res.report.stairsGenerated).toBe(1);
  });

  it("the floor above has a void over the stair", () => {
    const res = generateFromBlocks({
      blocks: [
        rect("s", 0, 0, 2000, 4000, "L1", "Tangga"),
        rect("k", 2000, 0, 4000, 4000, "L1", "KT. Anak"),
        { ...rect("u", 0, 0, 6000, 4000, "L2", "KT. Utama"), elevationMm: 3000 },
      ],
      levels: [lvl, lvl2],
    });
    const upperFloors = addedSlabs(res).filter((s) => s.kind === "floor" && s.z === 3000);
    const total = upperFloors.reduce((sum, s) => sum + area(s.polygon.outer), 0);
    expect(total).toBe(4000 * 4000); // 6000×4000 minus the 2000×4000 stair void
  });

  it("stairs are idempotent", () => {
    const blocks = [rect("s", 0, 0, 2000, 4000, "L1", "Tangga"), rect("k", 2000, 0, 4000, 4000, "L1", "KT. Anak")];
    const first = generateFromBlocks({ blocks, levels: [lvl] });
    const second = generateFromBlocks({ blocks, levels: [lvl], ...existing(first) });
    expect(second.ops.length).toBe(0);
  });
});
