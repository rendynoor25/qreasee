/**
 * BG-xx: types for the Block → Building Elements generator. Concept blocks (rooms)
 * are the source of intent; walls/slabs/ceilings/roofs/openings/stairs are derived
 * but editable document entities.
 */

import type { Id, Level, Opening, Point, Roof, Room, Slab, Stair, Wall } from "@qreasee/shared";

export interface BlockGenSettings {
  /** Exterior wall thickness, mm. */
  exteriorThickness: number;
  /** Shared/partition wall thickness, mm. */
  partitionThickness: number;
  /** Floor/ceiling slab thickness, mm. */
  slabThickness: number;
  /** Roof pitch for pitched roofs, degrees. */
  roofPitchDeg: number;
  /** Eaves overhang, mm. */
  roofOverhang: number;
  /** Default roof form for a rectangular region. */
  roofType: "hip" | "gable";
  doorWidth: number;
  bathDoorWidth: number;
  doorHeight: number;
  windowWidth: number;
  windowHeight: number;
  windowSill: number;
  highWindowSill: number;
  /** Minimum distance from a wall corner to an opening, mm. */
  cornerMargin: number;
  /** Wall height when a block has no explicit height, mm. */
  wallHeight: number;
  /** Where the wall sits relative to the block edge. */
  edgeLocation: "centerline" | "innerFace";
  /** Collinear overlap tolerance, mm. */
  snapTolerance: number;
  /** Per-level floor-to-floor heights (mm), keyed by level id. */
  levelHeights?: Record<string, number>;
}

export const DEFAULT_BLOCK_GEN_SETTINGS: BlockGenSettings = {
  exteriorThickness: 150,
  partitionThickness: 100,
  slabThickness: 150,
  roofPitchDeg: 30,
  roofOverhang: 600,
  roofType: "gable",
  doorWidth: 900,
  bathDoorWidth: 800,
  doorHeight: 2100,
  windowWidth: 1200,
  windowHeight: 1500,
  windowSill: 900,
  highWindowSill: 1500,
  cornerMargin: 150,
  wallHeight: 3000,
  edgeLocation: "centerline",
  snapTolerance: 50,
};

/** The operations the generator emits (a subset of the document `Operation`). */
export type BlockOp =
  | { type: "wall.add"; wall: Wall }
  | { type: "wall.update"; id: Id; patch: Partial<Wall> }
  | { type: "wall.remove"; id: Id }
  | { type: "slab.add"; slab: Slab }
  | { type: "slab.update"; id: Id; patch: Partial<Slab> }
  | { type: "slab.remove"; id: Id }
  | { type: "roof.add"; roof: Roof }
  | { type: "roof.update"; id: Id; patch: Partial<Roof> }
  | { type: "roof.remove"; id: Id }
  | { type: "opening.add"; opening: Opening }
  | { type: "opening.update"; id: Id; patch: Partial<Opening> }
  | { type: "opening.remove"; id: Id }
  | { type: "stair.add"; stair: Stair }
  | { type: "stair.update"; id: Id; patch: Partial<Stair> }
  | { type: "stair.remove"; id: Id };

export interface BlockWarning {
  code: string;
  message: string;
}

export interface BlockReport {
  wallsGenerated: number;
  sharedEdges: number;
  exteriorEdges: number;
  /** Edges that could not be classified (currently 0; reserved). */
  unassignedEdges: number;
  /** Net room area after insetting by half the wall thickness, mm². */
  netAreaByRoom: Record<string, number>;
  slabsGenerated: number;
  ceilingsGenerated: number;
  roofsGenerated: number;
  openingsGenerated: number;
  doorsGenerated: number;
  windowsGenerated: number;
  stairsGenerated: number;
}

export interface BlockGenInput {
  blocks: Room[];
  levels: Level[];
  /** Existing walls in the document, for the diff (manual ones are untouched). */
  existingWalls?: Wall[];
  /** Existing slabs in the document, for the diff (manual ones are untouched). */
  existingSlabs?: Slab[];
  /** Existing roofs in the document, for the diff (manual ones are untouched). */
  existingRoofs?: Roof[];
  /** Existing openings in the document, for the diff (manual ones are untouched). */
  existingOpenings?: Opening[];
  /** Existing stairs in the document, for the diff (manual ones are untouched). */
  existingStairs?: Stair[];
  /** Site boundary, so the main entrance can face the frontage. */
  siteBoundary?: Point[];
  /** BG-06: per stable id, keep the user's edited generated element as-is. */
  overrides?: Record<string, { locked?: boolean }>;
  settings?: Partial<BlockGenSettings>;
}

export interface BlockGenResult {
  ops: BlockOp[];
  warnings: BlockWarning[];
  report: BlockReport;
}
