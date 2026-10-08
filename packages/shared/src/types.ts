/**
 * Qreasee core domain types (PRD section 7, Data model).
 *
 * Internal units: millimetres for all lengths, square metres for areas,
 * Indonesian Rupiah for money. Display units are configurable at the edge.
 * R2+ entities are reserved: the type exists now, the feature is built later.
 */

export type Id = string;

/** A 2D point on the ground plane, in millimetres. */
export interface Point {
  x: number;
  y: number;
}

/** A simple polygon with optional holes (courtyards). Outer ring implicitly closed. */
export interface Polygon {
  outer: Point[];
  holes: Point[][];
}

/** A closed open-space polygon tagged by surface. CX-08. */
export interface SurfacePolygon {
  id: Id;
  kind: "green" | "paved";
  points: Point[];
}

export type Fidelity = "intent" | "massing" | "schematic" | "detailed";

export type Lens = "visual" | "rules" | "reflect";

export type BuildingType =
  | "house"
  | "shophouse"
  | "cafe"
  | "small-office"
  | "retail-fitout"
  | "renovation";

export interface ProjectLocation {
  lat: number;
  lng: number;
}

export interface Project {
  id: Id;
  studioId: Id;
  name: string;
  location: ProjectLocation;
  /** Degrees, clockwise from +Y (north) to true north. VP-03, CX-02. */
  northAngle: number;
  units: "mm";
  buildingType: BuildingType;
}

/** CX-01: an edge of the site boundary marked as facing a road. */
export interface RoadEdge {
  edgeIndex: number;
  name?: string;
}

/** CX-01, CX-06, CX-08. */
export interface Site {
  /** Open ring of the site boundary; the closing edge is implicit. */
  boundary: Point[];
  roadEdges: RoadEdge[];
  /** Open space tagged green; used for KDH. */
  greenPolygons: SurfacePolygon[];
  /** Open space tagged paved; reserved for later indicators. */
  pavedPolygons: SurfacePolygon[];
}

/** Per-site-edge setback widths in millimetres, keyed by edge index. CX-03. */
export type Setbacks = Record<number, number>;

/** CX-03. Values are optional so a sketch never blocks on missing rules (IN-06). */
export interface Rules {
  kdbMax?: number;
  klbMax?: number;
  kdhMin?: number;
  /** Millimetres. */
  heightMax?: number;
  floorsMax?: number;
  setbacks: Setbacks;
  sourceNote?: string;
}

/** CX-04. All money in Rupiah. */
export interface Budget {
  ceiling?: number;
  low?: number;
  high?: number;
  /** Cost rate range per square metre. */
  ratePerM2?: { low: number; high: number };
}

/** CX-05. */
/** v4.1 K-01: program needs, used later for layout/circulation suggestions. */
export interface ProgramNeeds {
  daylight?: boolean;
  ventilation?: boolean;
  view?: boolean;
  privacy?: "low" | "med" | "high";
  wet?: boolean;
  outdoor?: boolean;
}

export type ProgramLevelPref = "ground" | "upper" | "any" | number;

export type ProgramSource = "manual" | "recipe" | "ai" | "imported" | "studio";

/** CX-05 / K-01. Extended additively so pre-v4.1 projects keep loading. */
export interface ProgramItem {
  id: Id;
  /** Display name (fallback when the bilingual names are absent). */
  name: string;
  /** Total area for this row in m². Kept for compatibility. */
  targetArea: number;
  level?: Id;
  nameId?: string;
  nameEn?: string;
  group?: string;
  /** Instances of this room. Default 1. */
  qty?: number;
  /** Area per instance in m². */
  areaEach?: number;
  areaMin?: number;
  areaMax?: number;
  levelPref?: ProgramLevelPref;
  /** ProgramItem ids that should sit next to this one. */
  adjacentTo?: Id[];
  needs?: ProgramNeeds;
  color?: string;
  notes?: string;
  source?: ProgramSource;
  recipeId?: string;
  /** Human-readable provenance, e.g. "typical, review me". */
  basis?: string;
  /** True once a human edits a recipe-generated row (never overwritten). */
  edited?: boolean;
}

export type ProgramQuality = "economy" | "standard" | "premium";

export interface RecipeBinding {
  recipeId: string;
  version: number;
  paramValues: Record<string, number>;
  addonIds: string[];
  quality: ProgramQuality;
}

/** K-01: program-level settings (circulation allowance, display unit, recipe). */
export interface ProgramSettings {
  /** Circulation allowance as a percentage of net area. Default 20. */
  circulationPct: number;
  areaUnit: "m2" | "sqft";
  efficiencyNote?: string;
  recipeBinding?: RecipeBinding;
  /** Free text from the start wizard ("anything special?"). */
  ownerBrief?: string;
}

export interface Brief {
  text: string;
  program: ProgramItem[];
  settings?: ProgramSettings;
}

export const DEFAULT_CIRCULATION_PCT = 20;

export function defaultProgramSettings(): ProgramSettings {
  return { circulationPct: DEFAULT_CIRCULATION_PCT, areaUnit: "m2" };
}

export function programSettingsOf(brief: Brief): ProgramSettings {
  return brief.settings ?? defaultProgramSettings();
}

/** Total area of a program row in m²: qty × areaEach (falls back to targetArea). */
export function programItemTotalM2(item: ProgramItem): number {
  const qty = item.qty ?? 1;
  const each = item.areaEach ?? item.targetArea;
  return qty * each;
}

export function programNetAreaM2(program: readonly ProgramItem[]): number {
  return program.reduce((sum, item) => sum + programItemTotalM2(item), 0);
}

/** LG-01. */
export interface Level {
  id: Id;
  name: string;
  /** Millimetres above project datum. */
  elevation: number;
  /** Millimetres. */
  floorToFloor: number;
}

/** LG-02. */
export interface GridLine {
  id: Id;
  axis: "x" | "y";
  label: string;
  /** Millimetres; an offset from the project origin along the axis. */
  offset: number;
}

/**
 * MVP Feature Guide §2 "Layer & Object Naming": every authored object belongs to
 * a flat layer, and the layer name is what survives the DXF/DWG handoff.
 * Layers are branchable document state, so an adopted option carries its
 * organisation. Schematic elements (walls/slabs) are derived today and will join
 * layers when the schematic moves into `DocState`.
 */
export interface Layer {
  id: Id;
  name: string;
  /** Hex colour, used for the layer chip and the DXF layer colour. */
  color?: string;
  visible: boolean;
  locked?: boolean;
}

export const DEFAULT_LAYER_ID = "layer-0";

export function defaultLayer(): Layer {
  return { id: DEFAULT_LAYER_ID, name: "Layer 0", visible: true };
}

/** FD-02: range values for an Intent mass. */
export interface IntentRange {
  height?: { low: number; high: number };
  area?: { low: number; high: number };
}

export type RoomFidelity = "concept" | "schematic";

export type Zone = "public" | "semi-private" | "private" | "service" | "outdoor" | "circulation";

/**
 * K-04 / B-01 (partial): a room block. At concept fidelity it carries an explicit
 * polygon (area-true block); at schematic fidelity it derives from wall loops.
 */
export interface Room {
  id: Id;
  levelId: Id;
  name: string;
  programItemId?: Id;
  instanceIndex?: number;
  fidelity: RoomFidelity;
  polygon: Polygon;
  areaMm2: number;
  /** Concept-block height in mm (a "balok"); schematic rooms derive their own. */
  height?: number;
  /** Concept-block base elevation in mm; defaults to the level's elevation. Set
   *  when a block is stacked on top of another. */
  elevationMm?: number;
  color?: string;
  group?: string;
  zone?: Zone;
  /** W-01 provenance: schematic rooms generated from a mass are "generated". */
  origin?: ElementOrigin;
}

/** The MVP's main object: an extruded footprint on one or more levels. MD-01..MD-08. */
export interface Mass {
  id: Id;
  /** Levels the mass occupies; a mass spanning levels 1-3 lists all three. */
  levelIds: Id[];
  /** Footprint in millimetres, with holes. */
  footprint: Polygon;
  /** Extrusion height in millimetres. */
  height: number;
  /** Optional program use, never required. MD-07. */
  use?: string;
  fidelity: Fidelity;
  intent?: IntentRange;
  name?: string;
  color?: string;
  /** Object layer (MVP Feature Guide §2); resolved to the default layer if absent. */
  layerId?: Id;
  /** Group/component membership (MVP Feature Guide §3.2.2); moves as a unit. */
  groupId?: Id;
  /** Marks a mass drawn as an open-space / landscape element. Reserved. */
  kind?: "building" | "landscape";
}

/**
 * MVP Feature Guide §3.2.2 "Group/Component": a flat grouping of masses that
 * behaves as one object for selection, move and rotate. Membership is stored on
 * the masses (`Mass.groupId`) so the operation log stays simple; a group is a
 * name + colour. Nested groups are out of scope for now.
 */
export interface Group {
  id: Id;
  name: string;
  color?: string;
  createdAt?: number;
}

/** W-01: who authored an element. Regeneration only replaces "generated". */
export type ElementOrigin = "generated" | "user";

export type RoofForm = "hip" | "gable" | "shed";

/**
 * W-01 (B-01): schematic elements are first-class document entities, so they are
 * undoable and branchable and an architect can author them. Coordinates are
 * plan millimetres unless noted. Rendering (panels, section cuts, SVG) is derived
 * from these by `schematicFromDoc`; nothing UI-side mutates a derived model.
 */
export interface Wall {
  id: Id;
  levelId: Id;
  /** Centreline end points in mm. */
  a: Point;
  b: Point;
  /** Thickness mm (exterior 150, partition 100 by default). */
  thickness: number;
  /** Height mm. */
  height: number;
  kind: "exterior" | "partition";
  material?: string;
  origin?: ElementOrigin;
  /** BG-xx: the concept block(s) this generated element came from. */
  sourceBlockIds?: string[];
}

export interface Opening {
  id: Id;
  wallId: Id;
  kind: "door" | "window";
  /** Centre offset along the wall from `a`, mm. */
  offset: number;
  width: number;
  sill: number;
  height: number;
  /** Mirror the swing for doors. */
  flip?: boolean;
  origin?: ElementOrigin;
  /** BG-xx: the concept block(s) this generated element came from. */
  sourceBlockIds?: string[];
}

export interface Slab {
  id: Id;
  levelId: Id;
  kind: "floor" | "ceiling" | "canopy";
  polygon: Polygon;
  /** Elevation of the slab's datum in mm. */
  z: number;
  thickness: number;
  material?: string;
  origin?: ElementOrigin;
  /** BG-xx: the concept block(s) this generated element came from. */
  sourceBlockIds?: string[];
}

export interface Roof {
  id: Id;
  levelId: Id;
  type: RoofForm;
  pitchDeg: number;
  overhang: number;
  /** Footprint the roof covers. */
  polygon: Polygon;
  baseZ: number;
  material?: string;
  origin?: ElementOrigin;
  /** BG-xx: the concept block(s) this generated element came from. */
  sourceBlockIds?: string[];
}

export interface Stair {
  id: Id;
  levelId: Id;
  kind: "straight" | "L";
  from: Point;
  to: Point;
  /** Corner point for an L-shaped stair. */
  mid?: Point;
  width: number;
  /** Floor-to-floor height the stair climbs, mm. */
  floorToFloor: number;
  material?: string;
  origin?: ElementOrigin;
  /** BG-xx: the concept block(s) this generated element came from. */
  sourceBlockIds?: string[];
}

export type RailingKind = "balustrade" | "handrail";

/** W-08: a railing run (balcony, stair, terrace). */
export interface Railing {
  id: Id;
  levelId: Id;
  a: Point;
  b: Point;
  /** Height above the level datum, mm. */
  height: number;
  kind: RailingKind;
  material?: string;
  origin?: ElementOrigin;
}

export type DecisionStatus = "open" | "deferred" | "decided";

export type DecisionScope =
  | { kind: "whole" }
  | { kind: "level"; levelId: Id }
  | { kind: "masses"; massIds: Id[] };

/** 8.8 Decision Branches. */
export interface Decision {
  id: Id;
  title: string;
  question: string;
  scope: DecisionScope;
  status: DecisionStatus;
  revisitNote?: string;
  createdAt: number;
}

export type BranchStatus = "exploring" | "proposed" | "adopted" | "parked";

export interface Branch {
  id: Id;
  /** Absent for the implicit main branch. */
  decisionId?: Id;
  name: string;
  color: string;
  parentBranchId?: Id;
  /** Version of main the branch was forked from. */
  baseVersion: number;
  owner: string;
  status: BranchStatus;
  /** Main is itself a branch (PRD section 7). */
  main: boolean;
}

export interface RejectedBranch {
  branchId: Id;
  name: string;
  color: string;
  thumbnail?: string;
  indicators: IndicatorResult[];
}

/** DB-06: immutable; corrections are new records. */
export interface DecisionRecord {
  id: Id;
  decisionId: Id;
  chosenBranchId: Id;
  rationale: string;
  rejected: RejectedBranch[];
  rulesSnapshot: Rules;
  budgetSnapshot: Budget;
  by: string;
  at: number;
}

export type IndicatorStatus = "ok" | "near" | "over" | "under" | "needs-input";

export type IndicatorKey =
  | "kdb"
  | "klb"
  | "kdh"
  | "height"
  | "floors"
  | "setback"
  | "gfa"
  | "coverage"
  | "cost"
  | "program"
  | "programGross"
  | "programVsAllowed"
  | "programCost"
  | "sun";

/** 9: computed, cached; never edited. */
export interface IndicatorResult {
  branchId: Id;
  version: number;
  key: IndicatorKey;
  label: string;
  value?: number;
  range?: { low: number; high: number };
  unit?: string;
  status: IndicatorStatus;
  fidelity: Fidelity;
  limit?: number;
  /** Human-readable provenance shown on hover (IN-05). */
  inputs?: string;
  detail?: string;
}

/** 9.4 per-face sun exposure. */
export interface FaceSun {
  massId: Id;
  /** Index into the extruded vertical faces, matching geometry package order. */
  faceIndex: number;
  /** Average direct-sun hours across the three sample days. */
  hours: number;
  /** Degrees clockwise from +Y. */
  normalAngle: number;
}

export interface SunResult {
  faces: FaceSun[];
  lowArea: number;
  mediumArea: number;
  highArea: number;
  highShareOnEastWest: number;
}

/** v4.2 §4.3: the single source of truth for plans, elevations, sections, scenes. */
export type ViewKind = "plan" | "elevation" | "section" | "3d" | "render" | "schedule";

export type ViewDirection = "N" | "E" | "S" | "W";

export type ViewStyle = "sketch" | "clean" | "clay" | "material";

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
  zoom?: number;
}

export interface View {
  id: Id;
  kind: ViewKind;
  name: string;
  /** System views are derived from levels/directions and cannot be deleted. */
  system?: boolean;
  levelId?: Id;
  direction?: ViewDirection;
  line?: { a: Point; b: Point; depth?: number };
  scale?: number;
  /** Plan view: cut height above the level in mm. `null` = no cut (roof plan). */
  cutPlane?: number | null;
  style?: ViewStyle;
  layers?: Record<string, boolean>;
  camera?: CameraState;
  crop?: Polygon;
  createdAt: number;
  by?: string;
}

/** Sheet paper sizes, landscape, in millimetres (width × height). */
export type SheetSize = "A4" | "A3" | "A2";

export const SHEET_SIZES: Record<SheetSize, { w: number; h: number }> = {
  A4: { w: 297, h: 210 },
  A3: { w: 420, h: 297 },
  A2: { w: 594, h: 420 },
};

/** A drawing placed on a sheet: an id from `allViews` plus its frame in mm. */
export interface SheetViewItem {
  id: Id;
  kind: "view";
  viewId: Id;
  x: number;
  y: number;
  w: number;
  h: number;
  /** W-06: print scale denominator (50, 100, 200). Default 100. */
  scale?: number;
  label?: string;
}

/** W-06: a captured raster (the 3D cover) placed on a sheet. */
export interface SheetImageItem {
  id: Id;
  kind: "image";
  x: number;
  y: number;
  w: number;
  h: number;
  /** Data URL of the captured image. */
  src: string;
  label?: string;
}

export interface SheetTextItem {
  id: Id;
  kind: "text";
  x: number;
  y: number;
  text: string;
  sizeMm: number;
  bold?: boolean;
}

export interface SheetDimensionItem {
  id: Id;
  kind: "dimension";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type SheetItem = SheetViewItem | SheetTextItem | SheetDimensionItem | SheetImageItem;

/** D-02: an editable sheet (a "slide") holding placed views and annotations. */
export interface Sheet {
  id: Id;
  name: string;
  number: string;
  size: SheetSize;
  items: SheetItem[];
  createdAt?: number;
}

/** Everything that makes up one branch's editable state. */
/** I-03: a line of imported CAD linework (an underlay), in model mm. */
export interface UnderlayLine {
  a: Point;
  b: Point;
  /** Source CAD layer name. */
  layer?: string;
}

/**
 * I-03: imported CAD linework used as a tracing underlay on one level. It is a
 * document entity (undoable, branchable, deletable) but never part of the
 * building — deleting it removes only the underlay.
 */
export interface Underlay {
  id: Id;
  name: string;
  levelId: Id;
  /** Elevation offset from the level datum, mm. */
  elevationMm?: number;
  lines: UnderlayLine[];
  /** Whole-underlay visibility. Missing means visible. */
  visible?: boolean;
  /** Source CAD layer -> visible. Missing means visible. */
  layerVisibility?: Record<string, boolean>;
  color?: string;
  origin?: ElementOrigin;
}

export interface DocState {
  site: Site;
  rules: Rules;
  budget: Budget;
  brief: Brief;
  levels: Level[];
  grids: GridLine[];
  /** Flat object layers (MVP Feature Guide §2). Always at least one. */
  layers: Layer[];
  activeLayerId?: Id;
  masses: Mass[];
  /** Flat groups of masses (MVP Feature Guide §3.2.2). */
  groups: Group[];
  rooms: Room[];
  /** W-01 schematic elements (authored, undoable, branchable). */
  walls: Wall[];
  openings: Opening[];
  slabs: Slab[];
  roofs: Roof[];
  stairs: Stair[];
  /** W-08: railing runs. */
  railings: Railing[];
  /** I-03: imported CAD underlays, one or more per level. */
  underlays: Underlay[];
  /** Custom views and saved 3D scenes (system views are derived). */
  views: View[];
  /** Per-view customisations of system views, keyed by system view id. */
  viewOverrides: Record<string, Partial<View>>;
  /** Editable sheets (D-02); placed views + annotations. */
  sheets: Sheet[];
  decisions: Decision[];
  records: DecisionRecord[];
}

export const BUILDING_TYPES: BuildingType[] = [
  "house",
  "shophouse",
  "cafe",
  "small-office",
  "retail-fitout",
  "renovation",
];

/** Default cost rate ranges per m² in Rupiah, editable by the user. */
export const DEFAULT_RATES: Record<BuildingType, { low: number; high: number }> = {
  house: { low: 4_500_000, high: 7_500_000 },
  shophouse: { low: 4_000_000, high: 6_500_000 },
  cafe: { low: 5_000_000, high: 9_000_000 },
  "small-office": { low: 5_000_000, high: 8_500_000 },
  "retail-fitout": { low: 3_500_000, high: 7_000_000 },
  renovation: { low: 3_000_000, high: 6_000_000 },
};

export function emptySite(): Site {
  return { boundary: [], roadEdges: [], greenPolygons: [], pavedPolygons: [] };
}

export function emptyRules(): Rules {
  return { setbacks: {} };
}

export function emptyBrief(): Brief {
  return { text: "", program: [], settings: defaultProgramSettings() };
}

export function emptyDocState(): DocState {
  return {
    site: emptySite(),
    rules: emptyRules(),
    budget: {},
    brief: emptyBrief(),
    levels: [],
    grids: [],
    layers: [defaultLayer()],
    activeLayerId: DEFAULT_LAYER_ID,
    masses: [],
    groups: [],
    rooms: [],
    walls: [],
    openings: [],
    slabs: [],
    roofs: [],
    stairs: [],
    railings: [],
    underlays: [],
    views: [],
    viewOverrides: {},
    sheets: [],
    decisions: [],
    records: [],
  };
}

/**
 * Fill fields added after a project was saved (K-01 rooms/settings, V-01 views).
 * Applied on load so old `.qrs` files and `localStorage` keep working.
 */
export function normalizeDocState(state: DocState): DocState {
  const brief = state.brief ?? emptyBrief();
  const layers = state.layers && state.layers.length ? state.layers : [defaultLayer()];
  const activeLayerId = layers.some((l) => l.id === state.activeLayerId)
    ? state.activeLayerId
    : layers[0].id;
  return {
    ...state,
    site: state.site ?? emptySite(),
    rules: state.rules ?? emptyRules(),
    budget: state.budget ?? {},
    brief: { ...brief, settings: brief.settings ?? defaultProgramSettings() },
    levels: state.levels ?? [],
    grids: state.grids ?? [],
    layers,
    activeLayerId,
    masses: state.masses ?? [],
    groups: state.groups ?? [],
    rooms: state.rooms ?? [],
    walls: state.walls ?? [],
    openings: state.openings ?? [],
    slabs: state.slabs ?? [],
    roofs: state.roofs ?? [],
    stairs: state.stairs ?? [],
    railings: state.railings ?? [],
    underlays: state.underlays ?? [],
    views: state.views ?? [],
    viewOverrides: state.viewOverrides ?? {},
    sheets: state.sheets ?? [],
    decisions: state.decisions ?? [],
    records: state.records ?? [],
  };
}
