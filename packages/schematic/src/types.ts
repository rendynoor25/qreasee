/**
 * Schematic phase: derive rooms from an adopted mass, then walls, floor,
 * ceiling, roof and openings. All pure functions over geometry, no UI imports.
 *
 * Thicknesses are the values commonly used in Indonesia:
 *   exterior wall 150 mm, interior partition 100 mm, slab 120 mm.
 */

import type { Point } from "@qreasee/shared";

export type RoofType = "hip" | "gable" | "shed";

export interface Room {
  id: string;
  name: string;
  polygon: Point[];
  areaMm2: number;
  material?: string;
}

export interface Partition {
  id: string;
  a: Point;
  b: Point;
}

export interface DerivedRooms {
  rooms: Room[];
  partitions: Partition[];
  /** The interior region rooms live in (footprint inset by the exterior wall). */
  interior: Point[];
}

export interface WallPanel {
  id: string;
  /** Logical wall element across its split panels; used for selection/materials. */
  elementId?: string;
  kind: "exterior" | "partition";
  /** Plan quad, 4 points, extruded from z0 to z1. */
  polygon: Point[];
  z0: number;
  z1: number;
  /** Which room this panel belongs to, when known. */
  roomId?: string;
  material?: string;
}

export interface Slab {
  id: string;
  kind: "floor" | "ceiling";
  polygon: Point[];
  z0: number;
  z1: number;
  material?: string;
}

export interface Opening {
  id: string;
  kind: "door" | "window";
  /** Centre offset along the wall segment, in mm from its start. */
  offset: number;
  width: number;
  /** Bottom of the opening above the floor. */
  sill: number;
  /** Height of the opening. */
  height: number;
}

export interface RoofFace {
  points: [number, number, number][];
}

export interface Roof {
  type: RoofType;
  faces: RoofFace[];
  /** Plan outline of the roof including overhang. */
  outline: Point[];
  eaveZ: number;
  ridgeZ: number;
  material?: string;
}

/** A user-placed section line in model plan coordinates. */
export interface SectionLine {
  a: Point;
  b: Point;
}

export interface SectionWallCut {
  id: string;
  /** Position of the cut centred on the line origin, along the line direction. */
  u: number;
  width: number;
  z0: number;
  z1: number;
  kind: "exterior" | "partition";
  material?: string;
}

export interface SectionSlabCut {
  id: string;
  u0: number;
  u1: number;
  z0: number;
  z1: number;
  kind: "floor" | "ceiling";
  material?: string;
}

/** Roof silhouette segments as [u0, z0, u1, z1]. */
export type SectionRoofSegment = [number, number, number, number];

/** W-02: a stair crossed by the section plane, drawn as a stepped profile. */
export interface SectionStairCut {
  id: string;
  u: number;
  halfWidth: number;
  z0: number;
  z1: number;
  risers: number;
}

export interface SectionCut {
  walls: SectionWallCut[];
  slabs: SectionSlabCut[];
  stairs: SectionStairCut[];
  roofSegments: SectionRoofSegment[];
  uRange: [number, number];
  groundZ: number;
  ridgeZ: number;
  eaveZ: number;
}

/**
 * VW-01: a View Range — the vertical rules that turn the model into a drawing.
 * All values are millimetres relative to the view's level. A plan cuts the model
 * at `cutPlane` (default 1200 mm, i.e. one metre above the floor): walls crossed
 * by the plane are cut (poché); openings entirely above the plane are dashed
 * (seen); openings entirely below it are solid with the opening in projection.
 */
export interface ViewRange {
  /** Top of the primary range above the level. */
  top: number;
  /** Cut-plane height above the level. */
  cutPlane: number;
  /** Bottom of the view above the level (usually 0). */
  bottom: number;
  /** How far below `bottom` the view still shows (projection). */
  viewDepth: number;
}

export const DEFAULT_VIEW_RANGE: ViewRange = { top: 2000, cutPlane: 1200, bottom: 0, viewDepth: 0 };

export function makeViewRange(over?: Partial<ViewRange>): ViewRange {
  return { ...DEFAULT_VIEW_RANGE, ...over };
}

/** Where an opening sits relative to the cut plane. */
export type CutState = "cut" | "above" | "below";

/** Classify an opening by its sill/height against a cut height above the floor. */
export function cutStateFor(sill: number, height: number, cutAbove: number): CutState {
  if (sill > cutAbove) return "above";
  if (sill + height <= cutAbove) return "below";
  return "cut";
}

export interface OpeningMark {
  id: string;
  kind: "door" | "window";
  wallKind: "exterior" | "partition";
  /** Plan rectangle of the opening (the hole), 4 points. */
  quad: Point[];
  width: number;
  sill: number;
  height: number;
  /** VW-02: how the cut plane meets this opening. Defaults to "cut". */
  cutState?: CutState;
}

/** A single flight of a stair (straight, or one run of an L). */
export interface StairRun {
  a: Point;
  b: Point;
  width: number;
}

/** W-02: derived stair geometry for plan/section rendering. */
export interface StairGeom {
  id: string;
  levelId: string;
  kind: "straight" | "L";
  runs: StairRun[];
  /** Plan outline (footprint) of the stair, including width. */
  outline: Point[];
  baseZ: number;
  topZ: number;
  /** Number of risers and the derived rise/run (starter values, not code). */
  risers: number;
  riserMm: number;
  treadMm: number;
  /** Part 4 §5.4: true when this stair is below the level and shown in projection. */
  projection?: boolean;
}

/** W-08: a railing run in the derived view model. */
export interface RailingGeom {
  id: string;
  a: Point;
  b: Point;
  height: number;
  z: number;
}

export interface Schematic {
  massId: string;
  baseZ: number;
  topZ: number;
  /** Set when the view model is filtered to one storey (plan views). */
  levelId?: string;
  rooms: Room[];
  partitions: Partition[];
  walls: WallPanel[];
  openingMarks: OpeningMark[];
  slabs: Slab[];
  roof: Roof;
  /** W-08: railing runs on this level. */
  railings: RailingGeom[];
  /** W-08: true when the plan's level is the level the roof sits on (roof plan). */
  roofOnLevel?: boolean;
  /** W-02 stairs drawn in plan and section. */
  stairs: StairGeom[];
  options: SchematicOptions;
  /** VW-01: the view range this drawing was derived with. */
  viewRange?: ViewRange;
}

export interface SchematicOptions {
  exteriorWallThickness: number;
  partitionThickness: number;
  slabThickness: number;
  roofType: RoofType;
  roofPitchDeg: number;
  roofOverhang: number;
  doorWidth: number;
  doorHeight: number;
  windowWidth: number;
  windowHeight: number;
  windowSill: number;
  /** Optional doors/windows the user placed, keyed by wall index. */
  openings?: Record<string, Opening[]>;
  /** Element id -> material id, assigned in the schematic phase. */
  materials?: Record<string, string>;
  /** Category defaults from the studio kit, used when an element has no explicit material. */
  defaults?: {
    wall: string;
    partition: string;
    floor: string;
    ceiling: string;
    roof: string;
  };
}

export const DEFAULT_SCHEMATIC_OPTIONS: SchematicOptions = {
  exteriorWallThickness: 150,
  partitionThickness: 100,
  slabThickness: 120,
  roofType: "hip",
  roofPitchDeg: 30,
  roofOverhang: 600,
  doorWidth: 900,
  doorHeight: 2100,
  windowWidth: 1200,
  windowHeight: 1500,
  windowSill: 900,
};
