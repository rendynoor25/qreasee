import { create } from "zustand";
import {
  allViews,
  DEFAULT_VIEW_ID,
  defaultStudioKit,
  emptyDocState,
  findView,
  newId,
  normalizeStudioKit,
  programItemTotalM2,
  type Branch,
  type DecisionRecord,
  type DecisionScope,
  type DocState,
  type Id,
  type IndicatorResult,
  type Lang,
  type Layer,
  type Lens,
  type Mass,
  type ProgramItem,
  type ProgramQuality,
  type Project,
  type Point,
  type RecipeBinding,
  type RejectedBranch,
  type Room,
  type Sheet,
  type SheetItem,
  type SheetSize,
  type StudioKit,
  type Underlay,
  type View,
  type ViewKind,
} from "@qreasee/shared";
import { BRANCH_COLORS, DocumentStore, type AdoptResult, type Operation } from "@qreasee/document";
import { dxfToUnderlay, parseDxf, roomsFromWalls } from "@qreasee/export";
import { computeIndicators, massBaseElevation, type FaceSunExposure, type SunSummary } from "@qreasee/indicators";
import {
  blocksFromProgram,
  DEFAULT_MASSING_WEIGHTS,
  getRecipe,
  massingGrossDefault,
  recipeItemsToProgramItems,
  resolveRecipe,
  stackElevationFor,
  suggestMassings,
  type MassingOption,
  type MassingWeights,
  type StackBox,
} from "@qreasee/concept";
import {
  DEFAULT_SCHEMATIC_OPTIONS,
  generateFromBlocks,
  schematicFromDoc,
  starterFromMass,
  type BlockOp,
  type RoofType,
  type Schematic,
  type SectionLine,
} from "@qreasee/schematic";
import {
  blankState,
  createBlankProject,
  createProjectFromTemplate,
  createSampleProject,
  defaultProject,
  gridForSize,
  siteBoundary,
} from "../lib/sampleProject";
import { buildSampleHouse } from "../fixtures/sampleHouse";
import { fetchOsmBuildings, type ContextBuilding } from "../lib/osm";
import { computeIndicatorsAsync, computeSunAsync } from "./indicatorsClient";
import type { TemplateId } from "@qreasee/shared";

export type Tool =
  | "select"
  | "site"
  | "rectangle"
  | "polygon"
  | "circle"
  | "ellipse"
  | "arc"
  | "pushpull"
  | "vertex"
  | "pan"
  | "rotate"
  | "offset"
  | "section"
  | "road"
  | "green"
  | "wall"
  | "door"
  | "window"
  | "room"
  | "stair"
  | "roof"
  | "railing"
  | "move"
  | "copy"
  | "tape"
  | "eraser"
  | "paint";

export type Mode = "brief" | "massing" | "schematic" | "drawings" | "sheets" | "concept";

/** A-01: the app opens on a start screen, not on someone else's project.
 *  A-03: after choosing a starter, a skippable site wizard runs before the canvas. */
export type Screen = "home" | "wizard" | "workspace";

export type Projection = "perspective" | "orthographic";

export interface ElementRef {
  kind: "wall" | "slab" | "roof" | "room" | "stair" | "railing";
  id: string;
}

export type PanelId = "context" | "decisions" | "reflect" | "map" | "drawings" | "schematic" | "brief" | "export" | "help" | "studio" | "layers" | "shortcuts" | null;

export type Theme = "dark" | "light";

const STORAGE_KEY = "qreasee.workspace.v1"; // legacy single-workspace key (migrated on first load)
const LIBRARY_KEY = "qreasee.projects.v1";
const STUDIO_KEY = "qreasee.studio.v1";

interface Persisted {
  project: Project;
  store: ReturnType<DocumentStore["serialize"]>;
  contextBuildings?: ContextBuilding[];
  showContext?: boolean;
  theme?: Theme;
  savedAt?: number;
}

interface Library {
  version: number;
  projects: Record<string, Persisted>;
  lastOpenedId?: Id;
}

interface Workspace {
  project: Project;
  doc: DocumentStore;
  contextBuildings: ContextBuilding[];
  showContext: boolean;
  theme: Theme;
}

/** A lightweight row for the landing page's project list. */
export interface ProjectSummary {
  id: Id;
  name: string;
  buildingType: Project["buildingType"];
  savedAt: number;
}

function readPersisted(): Persisted | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Persisted;
  } catch {
    return null;
  }
}

function readLibrary(): Library {
  if (typeof localStorage === "undefined") return { version: 1, projects: {} };
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (raw) {
      const lib = JSON.parse(raw) as Library;
      if (lib && lib.projects && typeof lib.projects === "object") {
        return { version: 1, projects: lib.projects, lastOpenedId: lib.lastOpenedId };
      }
    }
    // One-time migration from the old single-workspace key.
    const legacy = readPersisted();
    if (legacy?.project?.id) {
      const lib: Library = {
        version: 1,
        projects: { [legacy.project.id]: legacy },
        lastOpenedId: legacy.project.id,
      };
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib));
      return lib;
    }
  } catch {
    // Corrupt library: start empty rather than crash.
  }
  return { version: 1, projects: {} };
}

function summaries(lib: Library): ProjectSummary[] {
  return Object.values(lib.projects)
    .filter((p): p is Persisted => !!p?.project?.id)
    .map((p) => ({
      id: p.project.id,
      name: p.project.name ?? "Untitled",
      buildingType: p.project.buildingType,
      savedAt: p.savedAt ?? 0,
    }))
    .sort((a, b) => b.savedAt - a.savedAt);
}

function deserializeWorkspace(data: Persisted): Workspace {
  return {
    project: data.project,
    doc: DocumentStore.deserialize(data.store),
    contextBuildings: data.contextBuildings ?? [],
    showContext: data.showContext ?? true,
    theme: data.theme ?? "dark",
  };
}

function readStudioKit(): StudioKit {
  if (typeof localStorage === "undefined") return defaultStudioKit();
  try {
    const raw = localStorage.getItem(STUDIO_KEY);
    if (!raw) return defaultStudioKit();
    return normalizeStudioKit(JSON.parse(raw) as Partial<StudioKit>);
  } catch {
    return defaultStudioKit();
  }
}

function saveStudioKit(kit: StudioKit): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STUDIO_KEY, JSON.stringify(kit));
  } catch {
    // Storage full: the kit just won't persist this session.
  }
}

function hexToRgbTriplet(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!m) return "240 145 59";
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Push the studio's primary colour into the CSS variable the UI accent reads. */
function applyBrandColor(hex: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--brand", hexToRgbTriplet(hex));
}

function bootWorkspace(): {
  workspace: Workspace;
  fromStorage: boolean;
  projects: ProjectSummary[];
} {
  const lib = readLibrary();
  const entries = summaries(lib);
  const pick =
    (lib.lastOpenedId ? lib.projects[lib.lastOpenedId] : undefined) ??
    (entries.length ? lib.projects[entries[0].id] : undefined);
  if (pick) {
    try {
      return { workspace: deserializeWorkspace(pick), fromStorage: true, projects: entries };
    } catch {
      // Corrupt payload: fall through to the sample so the app still opens.
    }
  }
  const sample = createSampleProject();
  return {
    workspace: {
      project: sample.project,
      doc: sample.store,
      contextBuildings: [],
      showContext: true,
      theme: "dark",
    },
    fromStorage: false,
    projects: entries,
  };
}

const boot = bootWorkspace();
const workspace = boot.workspace;
const bootStudioKit = readStudioKit();
applyBrandColor(bootStudioKit.identity.primaryColor);

export interface AppState {
  project: Project;
  doc: DocumentStore;
  docState: DocState;
  branches: Branch[];
  activeBranchId: Id;
  revision: number;
  screen: Screen;
  projects: ProjectSummary[];
  studioKit: StudioKit;

  indicators: IndicatorResult[];
  indicatorsPending: boolean;
  sunFaces: FaceSunExposure[] | null;
  sunSummary: SunSummary | null;

  contextBuildings: ContextBuilding[];
  showContext: boolean;
  contextStatus: "idle" | "loading" | "done" | "error";
  contextError: string | null;

  schematic: Schematic | null;
  schematicMassId: Id | null;
  showSchematic: boolean;
  roofType: RoofType;
  roofPitch: number;
  mode: Mode;
  projection: Projection;
  selectedElement: ElementRef | null;
  elementMaterials: Record<string, string>;
  sectionLine: SectionLine | null;

  lang: Lang;
  lens: Lens;
  tool: Tool;
  panel: PanelId;
  theme: Theme;
  activeLevelId: Id | null;
  selectedMassId: Id | null;
  /** Multi-selection (shift+click); a grouped mass selects its whole group. */
  selectedMassIds: Id[];
  sunView: boolean;
  showIndicators: boolean;
  showGrid: boolean;
  /** LG-04: the material the Paint tool applies. */
  activeMaterialId: string;
  setActiveMaterial: (id: string) => void;
  /** LG-04: true while the user is typing a value (suppresses shortcuts). */
  typingValue: boolean;
  setTypingValue: (v: boolean) => void;
  /** LG-04: the "?" cheat sheet overlay. */
  cheatsheetOpen: boolean;
  setCheatsheetOpen: (v: boolean) => void;
  /** W-05: which plan annotations are drawn. */
  annotations: { dimensions: boolean; tags: boolean; north: boolean; scaleBar: boolean; sections: boolean };
  toggleAnnotation: (key: "dimensions" | "tags" | "north" | "scaleBar" | "sections") => void;
  /** Part 4: dimension text height in paper mm. */
  dimTextMm: number;
  setDimTextMm: (mm: number) => void;
  /** Which drawing the Drawings panel shows; driven by the Project Browser. */
  drawingsTab: "plan" | "section" | "elevation";
  setDrawingsTab: (t: "plan" | "section" | "elevation") => void;
  /** BG-06: the pending Block→Elements diff, and its apply/preview. */
  blockGenDiff: { adds: number; updates: number; removes: number; ops: BlockOp[] } | null;
  previewBlockGen: () => void;
  applyBlockGen: () => void;
  autoRegenBlocks: boolean;
  setAutoRegenBlocks: (v: boolean) => void;
  /** BG-06: detach a generated element (origin → "user") so regeneration keeps it. */
  detachElement: (ref: ElementRef | null) => void;
  compareBranchIds: Id[];
  overlayCompare: boolean;
  statusMessage: string | null;

  // actions
  dispatch: (op: Operation) => void;
  undo: () => void;
  redo: () => void;
  switchBranch: (id: Id) => void;
  setTool: (tool: Tool) => void;
  setLens: (lens: Lens) => void;
  setPanel: (panel: PanelId) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setLang: (lang: Lang) => void;
  selectMass: (id: Id | null, additive?: boolean) => void;
  setActiveLevel: (id: Id) => void;
  toggleSunView: () => void;
  toggleIndicators: () => void;
  toggleGrid: () => void;
  fetchContext: () => void;
  setShowContext: (show: boolean) => void;
  clearContext: () => void;
  generateSelectedSchematic: () => void;
  clearSchematic: () => void;
  toggleSchematic: () => void;
  setRoofType: (t: RoofType) => void;
  setRoofPitch: (p: number) => void;
  setMode: (m: Mode) => void;
  setProjection: (p: Projection) => void;
  selectElement: (ref: ElementRef | null) => void;
  selectedRoomId: Id | null;
  selectRoom: (id: Id | null) => void;
  updateRoom: (id: Id, patch: Partial<Room>) => void;
  stackRoom: (id: Id) => void;
  setRoomElevation: (id: Id, elevationMm: number | undefined) => void;
  /** W-03 plan authoring. */
  wallKind: "exterior" | "partition";
  setWallKind: (kind: "exterior" | "partition") => void;
  addWall: (a: Point, b: Point) => void;
  placeOpening: (point: Point, kind: "door" | "window") => void;
  addRoomPolygon: (points: Point[]) => void;
  /** C-01: add a concept-fidelity room block (no walls) next to the others. */
  addConceptRoom: () => void;
  removeRoom: (id: Id) => void;
  /** R-01: author a straight stair (two plan points) on the active level. */
  addStair: (a: Point, b: Point) => void;
  /** R-01: author a hip roof over a footprint on the active level. */
  addRoof: (polygon: Point[]) => void;
  /** W-08: generate a roof over the highest level's footprint. */
  generateRoof: () => void;
  /** W-08: author a railing run (two plan points). */
  addRailing: (a: Point, b: Point) => void;
  /** I-03: import DXF linework as a deletable underlay on a level. */
  importUnderlay: (text: string, name: string, levelId: Id, color?: string) => {
    lines: number;
    truncated: boolean;
    layers: string[];
    counts: Record<string, number>;
    units: string;
    bbox: { minX: number; minY: number; maxX: number; maxY: number } | null;
  } | null;
  updateUnderlay: (id: Id, patch: Partial<Underlay>) => void;
  removeUnderlay: (id: Id) => void;

  activeViewId: Id;
  setActiveView: (id: Id) => void;
  activeSheetId: Id | null;
  setActiveSheet: (id: Id) => void;
  addSheet: () => void;
  updateSheet: (id: Id, patch: Partial<Pick<Sheet, "name" | "number" | "size">>) => void;
  removeSheet: (id: Id) => void;
  setSheetItems: (id: Id, items: SheetItem[]) => void;
  placeViewOnSheet: (viewId: Id) => void;
  /** W-06: the last 3D viewport capture (data URL), placed as a sheet image. */
  capture: string | null;
  captureViewport: () => void;
  placeCaptureOnSheet: () => void;
  addView: (kind: ViewKind) => void;
  duplicateView: (id: Id) => void;
  removeView: (id: Id) => void;
  renameView: (id: Id, name: string) => void;
  setViewLayer: (id: Id, key: string, value: boolean) => void;
  /** Part 4: the plan view cut height above its level (mm); `null` = no cut. */
  setViewCutPlane: (id: Id, mm: number | null) => void;
  setElementMaterial: (elementId: string, materialId: string) => void;
  setSectionLine: (line: SectionLine | null) => void;
  addLevelFromMass: () => void;
  setStatus: (message: string | null) => void;

  updateProject: (patch: Partial<Project>) => void;
  newProject: () => void;
  loadSample: () => void;
  loadSampleHouse: () => void;
  /** Load a document built elsewhere (e.g. from a DWG) and refresh. */
  loadDocState: (state: DocState) => void;
  /** BG: read DWG floor plans, derive room blocks from the wall centrelines, load. */
  buildFromDwg: (
    plans: Array<{ url: string; levelId: string; name: string; elevation: number; floorToFloor: number; height: number }>,
  ) => Promise<void>;
  replaceWorkspace: (project: Project, doc: DocumentStore) => void;
  setScreen: (screen: Screen) => void;
  finishWizard: (panel?: PanelId) => void;
  openTemplate: (id: TemplateId) => void;
  bindRecipe: (recipeId: TemplateId) => void;
  setRecipeParam: (key: string, value: number) => void;
  setRecipeQuality: (quality: ProgramQuality) => void;
  toggleRecipeAddon: (id: string) => void;
  regenerateRecipe: () => void;
  addProgramRow: () => void;
  importProgramRows: (rows: ProgramItem[]) => void;
  openBlank: () => void;
  openSavedWorkspace: () => void;
  openProject: (id: Id) => void;
  deleteProject: (id: Id) => void;
  setStudioKit: (kit: StudioKit) => void;
  applyStudioStandards: () => void;
  addLayer: (name?: string) => void;
  updateLayer: (id: Id, patch: Partial<Layer>) => void;
  removeLayer: (id: Id) => void;
  setActiveLayer: (id: Id) => void;
  setMassLayer: (ids: Id[], layerId: Id) => void;
  renameMass: (id: Id, name: string) => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  renameGroup: (id: Id, name: string) => void;
  selectGroup: (id: Id) => void;
  forkBranch: () => void;

  addDecision: (input: { title: string; question: string; scope: DecisionScope }) => Id;
  createBranch: (input: { name: string; decisionId: Id; color?: string }) => Branch;
  adoptBranch: (input: {
    branchId: Id;
    rationale: string;
    resolutions?: Record<Id, "main" | "branch">;
  }) => AdoptResult;
  parkBranch: (id: Id) => void;
  reviveBranch: (id: Id) => void;
  setCompare: (ids: Id[], overlay: boolean) => void;
  massingSuggestions: MassingOption[];
  massingWeights: MassingWeights;
  suggestMassing: () => void;
  setMassingWeight: (key: keyof MassingWeights, value: number) => void;
  refreshIndicators: () => void;
}

let indicatorSeq = 0;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

if (typeof document !== "undefined") {
  document.documentElement.dataset.theme = workspace.theme ?? "dark";
}

/** Shoelace area of a ring, in mm². */
function ringAreaMm2(points: Point[]): number {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s / 2);
}

/** Closest point on segment a–b to p, with the normalised position t along it. */
function projectOnSegment(p: Point, a: Point, b: Point): { x: number; y: number; t: number } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby || 1;
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + abx * t, y: a.y + aby * t, t };
}

/** Schematic options from the current UI state + studio kit standards. */
function schematicOptions(s: AppState) {
  return {
    ...DEFAULT_SCHEMATIC_OPTIONS,
    roofType: s.roofType,
    roofPitchDeg: s.roofPitch,
    materials: s.elementMaterials,
    defaults: s.studioKit.standards.materials,
  };
}

/** W-01: the derived view model is built from the document entities. */
function deriveSchematic(s: AppState): Schematic | null {
  return schematicFromDoc({
    doc: s.docState,
    options: schematicOptions(s),
    massId: s.schematicMassId ?? "",
  });
}

/** Re-resolve the bound recipe and regenerate program rows + concept blocks. */
function regenerateRecipeFromBinding(get: () => AppState): void {
  const s = get();
  const binding = s.docState.brief.settings?.recipeBinding;
  if (!binding) return;
  const recipe = getRecipe(binding.recipeId);
  if (!recipe) return;
  const resolved = resolveRecipe(recipe, binding.paramValues, binding.addonIds, binding.quality);
  const rows = recipeItemsToProgramItems(resolved.items);
  s.dispatch({ type: "brief.applyRecipe", rows, binding });

  const boundary = s.docState.site.boundary;
  let w = 20;
  let d = 30;
  if (boundary.length >= 3) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of boundary) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    w = Math.max(1, (maxX - minX) / 1000);
    d = Math.max(1, (maxY - minY) / 1000);
  }
  const blocks = blocksFromProgram(rows, {
    levels: s.docState.levels,
    siteWidthM: w,
    siteDepthM: d,
    defaultHeightMm: 3000,
  });
  s.dispatch({ type: "rooms.setConcept", rooms: blocks });
}

/** System views + custom views for the current document. */
function viewsOf(s: AppState): View[] {
  return allViews({
    levels: s.docState.levels.map((l) => ({ id: l.id, name: l.name })),
    siteBoundaryLength: s.docState.site.boundary.length,
    hasSection: !!s.sectionLine,
    views: s.docState.views,
    viewOverrides: s.docState.viewOverrides,
  });
}

/** C-01: soft fills for concept room blocks (mirrors the reference diagram). */
const CONCEPT_ROOM_COLORS = ["#f7ea8b", "#e5e7eb", "#bcd9ea", "#d9d2e9", "#f4b6a6", "#c8e6c9", "#ffe0b2"];

export const useApp = create<AppState>((set, get) => {
  const refresh = () => {
    const doc = get().doc;
    const state = doc.getState();
    set({
      docState: state,
      branches: doc.listBranches(),
      activeBranchId: doc.activeBranchId,
      revision: get().revision + 1,
    });
    const levelStillExists = state.levels.some((l) => l.id === get().activeLevelId);
    if (!levelStillExists) set({ activeLevelId: state.levels[0]?.id ?? null });
    // W-01: the schematic view model is derived from the document entities, so
    // it stays in sync with edits, undo/redo and branch switches.
    set({ schematic: deriveSchematic(get()) });
    get().refreshIndicators();
    schedulePersist(get);
  };

  const schedulePersist = (getState: typeof get) => {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      if (typeof localStorage === "undefined") return;
      const savedAt = Date.now();
      try {
        const lib = readLibrary();
        const entry: Persisted = {
          project: getState().project,
          store: getState().doc.serialize(),
          contextBuildings: getState().contextBuildings,
          showContext: getState().showContext,
          theme: getState().theme,
          savedAt,
        };
        lib.projects[entry.project.id] = entry;
        lib.lastOpenedId = entry.project.id;
        localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib));
        set({ projects: summaries(lib) });
      } catch {
        // B-03: surface quota failure instead of losing work silently.
        set({
          statusMessage:
            "Autosave failed (browser storage full). Export a .qrs file to keep your work.",
        });
      }
    }, 400);
  };

  const sunContext = () => {
    const { project, doc } = get();
    const state = doc.getState();
    const ctx = { lat: project.location.lat, lng: project.location.lng, northAngle: project.northAngle };
    return { state, ctx };
  };

  return {
    project: workspace.project,
    doc: workspace.doc,
    docState: workspace.doc.getState(),
    branches: workspace.doc.listBranches(),
    activeBranchId: workspace.doc.activeBranchId,
    revision: 0,
    screen: "home",
    projects: boot.projects,
    studioKit: bootStudioKit,

    indicators: computeIndicators(workspace.doc.getState(), {
      branchId: workspace.doc.activeBranchId,
      version: 1,
      lang: "en",
      sun: {
        lat: workspace.project.location.lat,
        lng: workspace.project.location.lng,
        northAngle: workspace.project.northAngle,
      },
    }),
    indicatorsPending: false,
    sunFaces: null,
    sunSummary: null,

    contextBuildings: workspace.contextBuildings,
    showContext: workspace.showContext,
    contextStatus: "idle",
    contextError: null,

    schematic: null,
    schematicMassId: null,
    showSchematic: false,
    roofType: "hip",
    roofPitch: 30,
    mode: "massing",
    projection: "perspective",
    selectedElement: null,
    selectedRoomId: null,
    activeViewId: DEFAULT_VIEW_ID,
    activeSheetId: null,
    capture: null,
    elementMaterials: {},
    wallKind: "exterior",
    sectionLine: null,

    lang: "en",
    lens: "visual",
    tool: "select",
    panel: null,
    theme: workspace.theme,
    activeLevelId: workspace.doc.getState().levels[0]?.id ?? null,
    selectedMassId: null,
    selectedMassIds: [],
    sunView: false,
    showIndicators: true,
    showGrid: true,
    activeMaterialId: "qr-brick-brown",
    typingValue: false,
    cheatsheetOpen: false,
    annotations: { dimensions: true, tags: true, north: true, scaleBar: false, sections: true },
    dimTextMm: 2.5,
    drawingsTab: "plan",
    blockGenDiff: null,
    autoRegenBlocks: false,
    compareBranchIds: [],
    overlayCompare: false,
    statusMessage: null,
    massingSuggestions: [],
    massingWeights: { ...DEFAULT_MASSING_WEIGHTS },

    dispatch: (op) => {
      // MVP Feature Guide §2: every authored object gets a layer and a default
      // name. Doing it here covers every caller (controller, suggest massing,
      // add-level) in one place.
      let next = op;
      if (op.type === "mass.add" && !op.mass.layerId) {
        const { layers, activeLayerId, masses } = get().docState;
        const layerId = layers.some((l) => l.id === activeLayerId)
          ? activeLayerId
          : layers[0]?.id;
        const count = masses.length + 1;
        next = {
          ...op,
          mass: {
            ...op.mass,
            layerId,
            name: op.mass.name ?? `Mass ${String(count).padStart(2, "0")}`,
          },
        };
      }
      get().doc.dispatch(next);
      // W-01: schematic entities live in the document, so a geometry edit does
      // not wipe the schematic; refresh() re-derives it from DocState.
      refresh();
    },
    undo: () => {
      get().doc.undo();
      refresh();
    },
    redo: () => {
      get().doc.redo();
      refresh();
    },
    switchBranch: (id) => {
      get().doc.switchBranch(id);
      const state = get().doc.getState();
      set({
        activeBranchId: id,
        docState: state,
        selectedMassId: null,
        selectedMassIds: [],
        activeLevelId: state.levels.some((l) => l.id === get().activeLevelId)
          ? get().activeLevelId
          : state.levels[0]?.id ?? null,
      });
      refresh();
    },
    setTool: (tool) => set({ tool, statusMessage: null }),
    setLens: (lens) =>
      set({
        lens,
        panel: lens === "rules" ? "context" : lens === "reflect" ? "reflect" : null,
      }),
    setPanel: (panel) => set({ panel: get().panel === panel ? null : panel }),
    setTheme: (theme) => {
      if (typeof document !== "undefined") document.documentElement.dataset.theme = theme;
      set({ theme });
      schedulePersist(get);
    },
    toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
    setLang: (lang) => {
      set({ lang });
      get().refreshIndicators();
    },
    selectMass: (id, additive = false) => {
      const s = get();
      if (!id) {
        set({ selectedMassId: null, selectedMassIds: [] });
        return;
      }
      const mass = s.docState.masses.find((m) => m.id === id);
      const members =
        mass?.groupId != null
          ? s.docState.masses.filter((m) => m.groupId === mass.groupId).map((m) => m.id)
          : [id];
      let next: Id[];
      if (additive) {
        const already = members.every((m) => s.selectedMassIds.includes(m));
        next = already
          ? s.selectedMassIds.filter((x) => !members.includes(x))
          : [...new Set([...s.selectedMassIds, ...members])];
      } else {
        next = members;
      }
      set({ selectedMassId: next[next.length - 1] ?? null, selectedMassIds: next });
    },
    setActiveLevel: (id) => set({ activeLevelId: id }),
    toggleSunView: () => {
      const next = !get().sunView;
      set({ sunView: next });
      if (next) {
        const { state, ctx } = sunContext();
        void computeSunAsync(state, ctx).then((summary) =>
          set({ sunFaces: summary.faces, sunSummary: summary }),
        );
      } else {
        set({ sunFaces: null });
      }
    },
    toggleIndicators: () => set({ showIndicators: !get().showIndicators }),
    toggleGrid: () => set({ showGrid: !get().showGrid }),
    setActiveMaterial: (activeMaterialId) => set({ activeMaterialId }),
    setTypingValue: (typingValue) => set({ typingValue }),
    setCheatsheetOpen: (cheatsheetOpen) => set({ cheatsheetOpen }),
    toggleAnnotation: (key) =>
      set({ annotations: { ...get().annotations, [key]: !get().annotations[key] } }),
    setDimTextMm: (mm) => set({ dimTextMm: Math.max(1, Math.min(6, mm)) }),
    setDrawingsTab: (t) => set({ drawingsTab: t }),
    previewBlockGen: () => {
      const s = get();
      const res = generateFromBlocks({
        blocks: s.docState.rooms,
        levels: s.docState.levels,
        existingWalls: s.docState.walls,
        existingSlabs: s.docState.slabs,
        existingRoofs: s.docState.roofs,
        existingOpenings: s.docState.openings,
        existingStairs: s.docState.stairs,
        siteBoundary: s.docState.site.boundary,
      });
      const count = (suffix: string) => res.ops.filter((o) => o.type.endsWith(suffix)).length;
      set({
        blockGenDiff: { adds: count(".add"), updates: count(".update"), removes: count(".remove"), ops: res.ops },
        statusMessage: `Generate from blocks: +${count(".add")} · ~${count(".update")} · −${count(".remove")}`,
      });
    },
    applyBlockGen: () => {
      const s = get();
      const ops = s.blockGenDiff?.ops ?? [];
      for (const op of ops) s.dispatch(op);
      set({ blockGenDiff: null, statusMessage: `Applied ${ops.length} generated elements.` });
      refresh();
    },
    setAutoRegenBlocks: (v) => set({ autoRegenBlocks: v }),
    detachElement: (ref) => {
      if (!ref) return;
      const s = get();
      const patch = { origin: "user" as const };
      if (ref.kind === "wall") s.dispatch({ type: "wall.update", id: ref.id, patch });
      else if (ref.kind === "slab") s.dispatch({ type: "slab.update", id: ref.id, patch });
      else if (ref.kind === "roof") s.dispatch({ type: "roof.update", id: ref.id, patch });
      else if (ref.kind === "stair") s.dispatch({ type: "stair.update", id: ref.id, patch });
      refresh();
    },
    fetchContext: () => {
      const { project } = get();
      set({ contextStatus: "loading", contextError: null });
      void fetchOsmBuildings({
        lat: project.location.lat,
        lng: project.location.lng,
        northAngle: project.northAngle,
      })
        .then((contextBuildings) => {
          set({ contextBuildings, contextStatus: "done", showContext: true });
          schedulePersist(get);
        })
        .catch((err: unknown) => {
          set({ contextStatus: "error", contextError: err instanceof Error ? err.message : "Failed" });
        });
    },
    setShowContext: (show) => {
      set({ showContext: show });
      schedulePersist(get);
    },
    clearContext: () => {
      set({ contextBuildings: [], contextStatus: "idle", contextError: null });
      schedulePersist(get);
    },
    generateSelectedSchematic: () => {
      const s = get();
      const id = s.selectedMassId ?? s.docState.masses[0]?.id;
      if (!id) {
        set({ statusMessage: "Select a massing first." });
        return;
      }
      const mass = s.docState.masses.find((m) => m.id === id);
      if (!mass) return;
      const program = s.docState.brief.program.map((p) => ({
        name: p.name,
        targetAreaM2: programItemTotalM2(p),
      }));
      // W-01/W-02: one pass per level the mass spans.
      const entities = starterFromMass(mass, program, schematicOptions(s), s.docState.levels);
      set({ schematicMassId: id, showSchematic: true, panel: "schematic" });
      s.dispatch({ type: "schematic.setGenerated", ...entities });
    },
    clearSchematic: () => {
      get().dispatch({
        type: "schematic.setGenerated",
        walls: [],
        openings: [],
        slabs: [],
        roofs: [],
        rooms: [],
      });
      set({ schematicMassId: null, showSchematic: false });
    },
    toggleSchematic: () => set({ showSchematic: !get().showSchematic }),
    setRoofType: (roofType) => {
      set({ roofType });
      const roof = get().docState.roofs[0];
      if (roof) {
        get().dispatch({ type: "roof.update", id: roof.id, patch: { type: roofType, origin: "user" } });
      } else {
        refresh();
      }
    },
    setRoofPitch: (roofPitch) => {
      set({ roofPitch });
      const roof = get().docState.roofs[0];
      if (roof) {
        get().dispatch({ type: "roof.update", id: roof.id, patch: { pitchDeg: roofPitch, origin: "user" } });
      } else {
        refresh();
      }
    },
    setMode: (mode) => {
      set({ mode, tool: "select", selectedElement: null });
      if ((mode === "schematic" || mode === "drawings" || mode === "sheets") && !get().schematic) {
        get().generateSelectedSchematic();
      }
      set({
        panel:
          mode === "brief"
            ? "brief"
            : mode === "massing" || mode === "sheets" || mode === "concept"
              ? null
              : mode === "drawings"
                ? "drawings"
                : "schematic",
      });
    },
    selectElement: (selectedElement) => {
      set({ selectedElement });
      if (selectedElement) set({ mode: "schematic", panel: "schematic" });
    },
    selectRoom: (selectedRoomId) => set({ selectedRoomId }),
    updateRoom: (id, patch) => get().dispatch({ type: "room.update", id, patch }),
    stackRoom: (id) => {
      const s = get();
      const room = s.docState.rooms.find((r) => r.id === id);
      if (!room) return;
      const boxes: StackBox[] = [];
      for (const r of s.docState.rooms) {
        if (r.id === id || r.fidelity !== "concept") continue;
        const lvl = s.docState.levels.find((l) => l.id === r.levelId);
        boxes.push({
          polygon: r.polygon,
          baseMm: r.elevationMm ?? lvl?.elevation ?? 0,
          heightMm: r.height ?? 3000,
        });
      }
      const elevationMm = stackElevationFor(boxes, room.polygon);
      get().dispatch({ type: "room.update", id, patch: { elevationMm } });
      set({
        statusMessage:
          elevationMm != null
            ? `Stacked at +${(elevationMm / 1000).toFixed(2)} m.`
            : "Nothing below to stack on.",
      });
    },
    setRoomElevation: (id, elevationMm) =>
      get().dispatch({ type: "room.update", id, patch: { elevationMm } }),
    setWallKind: (wallKind) => set({ wallKind }),
    addWall: (a, b) => {
      const s = get();
      const levelId = s.activeLevelId ?? s.docState.levels[0]?.id ?? "L1";
      const level = s.docState.levels.find((l) => l.id === levelId);
      const exterior = s.wallKind === "exterior";
      s.dispatch({
        type: "wall.add",
        wall: {
          id: newId("wall"),
          levelId,
          a: { ...a },
          b: { ...b },
          thickness: exterior ? 150 : 100,
          height: level?.floorToFloor ?? 3500,
          kind: s.wallKind,
        },
      });
    },
    placeOpening: (point, kind) => {
      const s = get();
      let best: { wallId: Id; dist: number; offset: number } | null = null;
      for (const w of s.docState.walls) {
        const proj = projectOnSegment(point, w.a, w.b);
        const dist = Math.hypot(proj.x - point.x, proj.y - point.y);
        const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
        const offset = proj.t * len;
        if (offset < 250 || offset > len - 250) continue;
        if (!best || dist < best.dist) best = { wallId: w.id, dist, offset };
      }
      if (!best || best.dist > 1500) {
        set({ statusMessage: `Click on a wall to place a ${kind}.` });
        return;
      }
      s.dispatch({
        type: "opening.add",
        opening: {
          id: newId(kind),
          wallId: best.wallId,
          kind,
          offset: best.offset,
          width: kind === "door" ? 900 : 1200,
          sill: kind === "door" ? 0 : 900,
          height: kind === "door" ? 2100 : 1500,
        },
      });
    },
    addRoomPolygon: (points) => {
      const s = get();
      if (points.length < 3) return;
      const levelId = s.activeLevelId ?? s.docState.levels[0]?.id ?? "L1";
      const level = s.docState.levels.find((l) => l.id === levelId);
      const exterior = s.wallKind === "exterior";
      const thickness = exterior ? 150 : 100;
      const height = level?.floorToFloor ?? 3500;
      s.dispatch({
        type: "room.add",
        room: {
          id: newId("room"),
          levelId,
          name: "Room",
          fidelity: "schematic",
          polygon: { outer: points.map((p) => ({ ...p })), holes: [] },
          areaMm2: ringAreaMm2(points),
          origin: "user",
        },
      });
      // W-03: a room's bounding walls are generated with it.
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        if (Math.hypot(b.x - a.x, b.y - a.y) < 200) continue;
        s.dispatch({
          type: "wall.add",
          wall: {
            id: newId("wall"),
            levelId,
            a: { ...a },
            b: { ...b },
            thickness,
            height,
            kind: s.wallKind,
          },
        });
      }
    },
    addConceptRoom: () => {
      const s = get();
      const levelId = s.activeLevelId ?? s.docState.levels[0]?.id ?? "L1";
      const W = 4000;
      const D = 4000;
      const GAP = 1200;
      const existing = s.docState.rooms;
      let x = 0;
      let y = 0;
      if (existing.length > 0) {
        let maxX = -Infinity;
        let minY = Infinity;
        for (const r of existing) {
          for (const p of r.polygon.outer) {
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
          }
        }
        x = maxX + GAP;
        y = minY;
      }
      const id = newId("room");
      s.dispatch({
        type: "room.add",
        room: {
          id,
          levelId,
          name: "Room",
          fidelity: "concept",
          polygon: {
            outer: [
              { x, y },
              { x: x + W, y },
              { x: x + W, y: y + D },
              { x, y: y + D },
            ],
            holes: [],
          },
          areaMm2: W * D,
          height: 3000,
          color: CONCEPT_ROOM_COLORS[existing.length % CONCEPT_ROOM_COLORS.length],
          origin: "user",
        },
      });
      set({ selectedRoomId: id, mode: "concept" });
    },
    removeRoom: (id) => {
      get().dispatch({ type: "room.remove", id });
      if (get().selectedRoomId === id) set({ selectedRoomId: null });
    },
    importUnderlay: (text, name, levelId, color) => {
      const model = parseDxf(text);
      if (model.lines.length === 0) {
        set({ statusMessage: "No linework found in that DXF." });
        return null;
      }
      const id = newId("underlay");
      get().dispatch({
        type: "underlay.add",
        underlay: dxfToUnderlay(model, { id, name, levelId, color }),
      });
      const levelName = get().docState.levels.find((l) => l.id === levelId)?.name ?? levelId;
      set({
        statusMessage: `Underlay "${name}": ${model.lines.length} lines onto ${levelName}${model.truncated ? " (truncated)" : ""}.`,
      });
      refresh();
      // Part 3 §6: return the inventory so a dev tool can report it.
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const l of model.lines) {
        for (const p of [l.a, l.b]) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
      }
      return {
        lines: model.lines.length,
        truncated: model.truncated,
        layers: model.layers,
        counts: model.counts,
        units: model.units,
        bbox: model.lines.length ? { minX, minY, maxX, maxY } : null,
      };
    },
    updateUnderlay: (id, patch) => get().dispatch({ type: "underlay.update", id, patch }),
    removeUnderlay: (id) => get().dispatch({ type: "underlay.remove", id }),
    addStair: (a, b) => {
      const s = get();
      const levelId = s.activeLevelId ?? s.docState.levels[0]?.id ?? "L1";
      const level = s.docState.levels.find((l) => l.id === levelId);
      if (Math.hypot(b.x - a.x, b.y - a.y) < 300) return;
      s.dispatch({
        type: "stair.add",
        stair: {
          id: newId("stair"),
          levelId,
          kind: "straight",
          from: { ...a },
          to: { ...b },
          width: 1000,
          floorToFloor: level?.floorToFloor ?? 3600,
          origin: "user",
        },
      });
      set({ statusMessage: "Stair added." });
    },
    addRoof: (polygon) => {
      if (polygon.length < 3) return;
      const s = get();
      const levelId = s.activeLevelId ?? s.docState.levels[0]?.id ?? "L1";
      const level = s.docState.levels.find((l) => l.id === levelId);
      const baseZ = (level?.elevation ?? 0) + (level?.floorToFloor ?? 3600);
      s.dispatch({
        type: "roof.add",
        roof: {
          id: newId("roof"),
          levelId,
          type: "hip",
          pitchDeg: 30,
          overhang: 600,
          polygon: { outer: polygon.map((p) => ({ ...p })), holes: [] },
          baseZ,
          origin: "user",
        },
      });
      set({ statusMessage: "Roof added." });
    },
    generateRoof: () => {
      const s = get();
      const top = [...s.docState.levels].sort((a, b) => a.elevation - b.elevation).at(-1);
      const levelId = top?.id ?? s.docState.levels[0]?.id ?? "L1";
      const pts: Point[] = [];
      for (const w of s.docState.walls) if (w.levelId === levelId) pts.push(w.a, w.b);
      for (const r of s.docState.rooms) if (r.levelId === levelId) pts.push(...r.polygon.outer);
      let outer: Point[];
      if (pts.length >= 3) {
        const minX = Math.min(...pts.map((p) => p.x));
        const minY = Math.min(...pts.map((p) => p.y));
        const maxX = Math.max(...pts.map((p) => p.x));
        const maxY = Math.max(...pts.map((p) => p.y));
        outer = [
          { x: minX, y: minY },
          { x: maxX, y: minY },
          { x: maxX, y: maxY },
          { x: minX, y: maxY },
        ];
      } else if (s.docState.masses[0]) {
        outer = s.docState.masses[0].footprint.outer.map((p) => ({ ...p }));
      } else if (s.docState.site.boundary.length >= 3) {
        outer = s.docState.site.boundary.map((p) => ({ ...p }));
      } else {
        set({ statusMessage: "Nothing to roof yet — draw walls or a mass first." });
        return;
      }
      const baseZ = (top?.elevation ?? 0) + (top?.floorToFloor ?? 3600);
      s.dispatch({
        type: "roof.add",
        roof: {
          id: newId("roof"),
          levelId,
          type: "hip",
          pitchDeg: s.roofPitch ?? 30,
          overhang: 600,
          polygon: { outer, holes: [] },
          baseZ,
          origin: "user",
        },
      });
      set({ statusMessage: `Roof generated over ${top?.name ?? "the top level"}.` });
    },
    addRailing: (a, b) => {
      const s = get();
      const levelId = s.activeLevelId ?? s.docState.levels[0]?.id ?? "L1";
      if (Math.hypot(b.x - a.x, b.y - a.y) < 200) return;
      s.dispatch({
        type: "railing.add",
        railing: {
          id: newId("railing"),
          levelId,
          a: { ...a },
          b: { ...b },
          height: 1000,
          kind: "balustrade",
          material: "metal-steel",
          origin: "user",
        },
      });
      set({ statusMessage: "Railing added." });
    },
    setActiveView: (id) => {
      const s = get();
      const view = findView(viewsOf(s), id);
      const isDrawing = !!view && (view.kind === "plan" || view.kind === "elevation" || view.kind === "section");
      const patch: Partial<AppState> = {
        activeViewId: id,
        projection: isDrawing ? "orthographic" : "perspective",
      };
      // A view in the Project Browser opens the editor that shows it.
      if (view?.kind === "3d") {
        patch.mode = "schematic";
        patch.showSchematic = true;
      } else if (view?.kind === "plan") {
        patch.mode = "drawings";
        patch.panel = "drawings";
        patch.drawingsTab = "plan";
      } else if (view?.kind === "section") {
        patch.mode = "drawings";
        patch.panel = "drawings";
        patch.drawingsTab = "section";
      } else if (view?.kind === "elevation") {
        patch.mode = "drawings";
        patch.panel = "drawings";
        patch.drawingsTab = "elevation";
      }
      if (view?.levelId) patch.activeLevelId = view.levelId;
      set(patch);
    },
    addView: (kind) => {
      const s = get();
      const id = newId("view");
      const view: View = {
        id,
        kind,
        name:
          kind === "plan"
            ? "Custom plan"
            : kind === "elevation"
              ? "Custom elevation"
              : kind === "section"
                ? "Custom section"
                : "3D scene",
        createdAt: Date.now(),
        by: "you",
      };
      if (kind === "plan") view.levelId = s.activeLevelId ?? s.docState.levels[0]?.id;
      if (kind === "elevation") view.direction = "N";
      if (kind === "section" && s.sectionLine) view.line = s.sectionLine;
      s.dispatch({ type: "view.add", view });
      get().setActiveView(id);
    },
    duplicateView: (id) => get().dispatch({ type: "view.duplicate", id }),
    removeView: (id) => {
      get().dispatch({ type: "view.remove", id });
      if (get().activeViewId === id) set({ activeViewId: DEFAULT_VIEW_ID, projection: "perspective" });
    },
    renameView: (id, name) => get().dispatch({ type: "view.update", id, patch: { name } }),
    setViewLayer: (id, key, value) => {
      const current = findView(viewsOf(get()), id)?.layers ?? {};
      get().dispatch({ type: "view.setOverride", id, patch: { layers: { ...current, [key]: value } } });
    },
    setViewCutPlane: (id, mm) => get().dispatch({ type: "view.setOverride", id, patch: { cutPlane: mm } }),
    setActiveSheet: (id) => set({ activeSheetId: id }),
    addSheet: () => {
      const n = get().docState.sheets.length + 1;
      const id = newId("sheet");
      const prefix = get().studioKit.identity.sheetPrefix;
      const sheet: Sheet = {
        id,
        name: `Sheet ${n}`,
        number: `${prefix}-${String(n).padStart(2, "0")}`,
        size: "A3" as SheetSize,
        items: [],
        createdAt: Date.now(),
      };
      get().dispatch({ type: "sheet.add", sheet });
      set({ activeSheetId: id });
    },
    updateSheet: (id, patch) => get().dispatch({ type: "sheet.update", id, patch }),
    removeSheet: (id) => {
      get().dispatch({ type: "sheet.remove", id });
      if (get().activeSheetId === id) set({ activeSheetId: get().docState.sheets[0]?.id ?? null });
    },
    setSheetItems: (id, items) => get().dispatch({ type: "sheet.setItems", id, items }),
    placeViewOnSheet: (viewId) => {
      const s = get();
      let sheetId = s.activeSheetId ?? s.docState.sheets[0]?.id;
      if (!sheetId) {
        // First placed view creates a sheet.
        s.addSheet();
        sheetId = get().activeSheetId ?? get().docState.sheets[0].id;
      }
      if (!sheetId) return;
      const sheet = get().docState.sheets.find((x) => x.id === sheetId);
      if (!sheet) return;
      const item: SheetItem = {
        id: newId("sitem"),
        kind: "view",
        viewId,
        x: 20,
        y: 20,
        w: 180,
        h: 130,
        scale: 100,
      };
      get().dispatch({ type: "sheet.setItems", id: sheetId, items: [...sheet.items, item] });
    },
    captureViewport: () => {
      // The 3D renderer keeps its drawing buffer, so the canvas still holds the
      // last frame when we read it (see ViewportController's renderer options).
      const canvas = document.querySelector<HTMLCanvasElement>("[data-qreasee-viewport] canvas");
      if (!canvas) {
        set({ statusMessage: "Open the 3D view first, then capture." });
        return;
      }
      try {
        set({ capture: canvas.toDataURL("image/png"), statusMessage: "3D capture ready — place it on a sheet." });
      } catch (err) {
        set({ statusMessage: `Capture failed: ${(err as Error).message}` });
      }
    },
    placeCaptureOnSheet: () => {
      const s = get();
      const src = s.capture;
      if (!src) return;
      let sheetId = s.activeSheetId ?? s.docState.sheets[0]?.id;
      if (!sheetId) {
        s.addSheet();
        sheetId = get().activeSheetId ?? get().docState.sheets[0]?.id;
      }
      if (!sheetId) return;
      const sheet = get().docState.sheets.find((x) => x.id === sheetId);
      if (!sheet) return;
      const item: SheetItem = {
        id: newId("simg"),
        kind: "image",
        src,
        x: 20,
        y: 20,
        w: 180,
        h: 130,
        label: "3D",
      };
      get().dispatch({ type: "sheet.setItems", id: sheetId, items: [...sheet.items, item] });
    },
    setProjection: (projection) => {
      set({ projection });
    },
    setElementMaterial: (elementId, materialId) => {
      set({ elementMaterials: { ...get().elementMaterials, [elementId]: materialId } });
      refresh();
    },
    setSectionLine: (sectionLine) => set({ sectionLine }),
    addLevelFromMass: () => {
      const s = get();
      const id = s.selectedMassId ?? s.docState.masses[0]?.id;
      const mass = s.docState.masses.find((m) => m.id === id);
      if (!mass) {
        set({ statusMessage: "Select a massing first." });
        return;
      }
      const base = massBaseElevation(s.docState, mass);
      const height = mass.intent?.height?.high ?? mass.height;
      const top = base + height;
      let level = s.docState.levels.find((l) => Math.abs(l.elevation - top) < 50);
      if (!level) {
        level = {
          id: newId("lvl"),
          name: `Lt. ${s.docState.levels.length + 1}`,
          elevation: top,
          floorToFloor: height,
        };
        s.dispatch({ type: "level.add", level });
      }
      const copy: Mass = {
        ...(JSON.parse(JSON.stringify(mass)) as Mass),
        id: newId("mass"),
        levelIds: [level.id],
      };
      s.dispatch({ type: "mass.add", mass: copy });
      s.setActiveLevel(level.id);
      s.selectMass(copy.id);
      set({ statusMessage: `Level added above at +${(top / 1000).toFixed(2)} m.` });
    },
    setStatus: (statusMessage) => set({ statusMessage }),

    updateProject: (patch) => {
      set({ project: { ...get().project, ...patch } });
      get().refreshIndicators();
      schedulePersist(get);
    },
    newProject: () => {
      const s = blankState();
      const rate = get().studioKit.standards.rates.house;
      s.budget.ratePerM2 = { low: rate.low, high: rate.high };
      const doc = new DocumentStore(s, "Main");
      set({ project: defaultProject("Untitled project"), doc });
      set({ selectedMassId: null, selectedMassIds: [], compareBranchIds: [] });
      refresh();
    },
    loadSample: () => {
      const sample = createSampleProject();
      set({
        project: sample.project,
        doc: sample.store,
        screen: "workspace",
        selectedMassId: null,
        selectedMassIds: [],
        compareBranchIds: [],
        overlayCompare: false,
        lens: "visual",
        tool: "select",
        mode: "massing",
        panel: null,
        schematic: null,
        schematicMassId: null,
        showSchematic: false,
        sectionLine: null,
        selectedElement: null,
        elementMaterials: {},
        statusMessage: null,
        activeLevelId: sample.store.getState().levels[0]?.id ?? null,
      });
      refresh();
    },
    loadSampleHouse: () => {
      const sample = buildSampleHouse();
      const doc = new DocumentStore(sample.docState, "Main");
      set({
        project: sample.project,
        doc,
        screen: "workspace",
        selectedMassId: sample.mass.id,
        selectedMassIds: [],
        compareBranchIds: [],
        overlayCompare: false,
        lens: "visual",
        tool: "select",
        mode: "schematic",
        panel: null,
        schematic: null,
        schematicMassId: sample.mass.id,
        showSchematic: true,
        sectionLine: { a: { x: 4500, y: -2000 }, b: { x: 4500, y: 24000 } },
        selectedElement: null,
        selectedRoomId: null,
        elementMaterials: {},
        statusMessage: "Sample house loaded from IFC — rooms, walls, doors/windows, slabs, stairs, roof, sheets.",
        activeLevelId: "ifc-L1",
        activeSheetId: null,
      });
      refresh();
      // Show the imported model in 3D right away (the schematic is derived from
      // the document entities).
      set({ schematic: deriveSchematic(get()) });
    },
    loadDocState: (state) => {
      const doc = new DocumentStore(state, "Main");
      set({
        doc,
        screen: "workspace",
        mode: "schematic",
        showSchematic: true,
        schematic: null,
        schematicMassId: null,
        selectedMassId: null,
        selectedMassIds: [],
        compareBranchIds: [],
        selectedElement: null,
        selectedRoomId: null,
        elementMaterials: {},
        tool: "select",
        panel: null,
        activeSheetId: null,
        statusMessage: "Imported from DWG — generate from blocks to build the 3D.",
      });
      refresh();
      set({ schematic: deriveSchematic(get()) });
    },
    buildFromDwg: async (plans) => {
      set({ statusMessage: "Reading DWG floor plans…" });
      const { dwgToDxf } = await import("../lib/dwg");
      const levels: DocState["levels"] = plans.map((p) => ({
        id: p.levelId,
        name: p.name,
        elevation: p.elevation,
        floorToFloor: p.floorToFloor,
      }));
      const rooms: DocState["rooms"] = [];
      const counts: Record<string, number> = {};
      for (const p of plans) {
        const buf = await (await fetch(p.url)).arrayBuffer();
        const model = parseDxf(await dwgToDxf(buf));
        // Room blocks are bounded by the wall CENTRELINES: use all architectural
        // linework (walls, doors, windows, columns, stairs, railings) as the
        // barrier so the openings are sealed, then grow each room to the wall
        // centreline. Annotations and furniture are ignored.
        const barrier = model.lines.filter((l) => !/FURN|SANR|ANNO|SYMB|IMPT|GRID|DETL|TTLB/i.test(l.layer));
        const regions = roomsFromWalls(barrier, { cell: 60, minAreaM2: 2, closeCells: 2, ringCells: 1 });
        counts[p.levelId] = regions.length;
        if (!regions.length) continue;
        const minX = Math.min(...regions.flatMap((r) => r.polygon.map((q) => q.x)));
        const minY = Math.min(...regions.flatMap((r) => r.polygon.map((q) => q.y)));
        regions.forEach((r, i) => {
          rooms.push({
            id: `${p.levelId}-room-${i}`,
            levelId: p.levelId,
            name: `Room ${i + 1}`,
            fidelity: "concept",
            polygon: { outer: r.polygon.map((q) => ({ x: q.x - minX, y: q.y - minY })), holes: [] },
            areaMm2: r.areaMm2,
            height: p.height,
            elevationMm: p.elevation,
          });
        });
      }
      const state = emptyDocState();
      state.levels = levels;
      state.rooms = rooms;
      get().loadDocState(state);
      get().previewBlockGen();
      set({
        statusMessage: `DWG: ${rooms.length} room blocks (${Object.entries(counts)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ")}). Generate from blocks to build the 3D.`,
      });
    },
    replaceWorkspace: (project, doc) => {
      set({ project, doc, selectedMassId: null, selectedMassIds: [], compareBranchIds: [] });
      refresh();
    },
    setScreen: (screen) => set({ screen }),
    finishWizard: (panel) => {
      const binding = get().docState.brief.settings?.recipeBinding;
      set({
        screen: "workspace",
        mode: binding ? "brief" : "massing",
        tool: "select",
        panel: panel ?? (binding ? "brief" : null),
      });
    },
    openTemplate: (id) => {
      const recipe = getRecipe(id);
      if (!recipe) return;
      const lang = get().lang;
      const buildingType = (
        recipe.buildingType === "dormitory" || recipe.buildingType === "school"
          ? "small-office"
          : recipe.buildingType === "custom"
            ? "house"
            : recipe.buildingType
      ) as Project["buildingType"];
      const project = { ...defaultProject(recipe.name[lang]), buildingType };
      const s = blankState();
      const rate = get().studioKit.standards.rates[buildingType] ?? get().studioKit.standards.rates.house;
      s.budget.ratePerM2 = { low: rate.low, high: rate.high };
      s.site.boundary = siteBoundary(15, 25);
      s.grids = gridForSize(15, 25);
      const doc = new DocumentStore(s, "Main");
      set({
        project,
        doc,
        screen: "wizard",
        selectedMassId: null,
        selectedMassIds: [],
        compareBranchIds: [],
        overlayCompare: false,
        mode: "brief",
        tool: "select",
        panel: "brief",
        schematic: null,
        schematicMassId: null,
        showSchematic: false,
        sectionLine: null,
        selectedElement: null,
        elementMaterials: {},
        statusMessage: null,
        activeLevelId: doc.getState().levels[0]?.id ?? null,
      });
      refresh();
      get().bindRecipe(id);
    },
    bindRecipe: (recipeId) => {
      const recipe = getRecipe(recipeId);
      if (!recipe) return;
      const paramValues: Record<string, number> = {};
      for (const p of recipe.params) paramValues[p.key] = p.default;
      const binding: RecipeBinding = {
        recipeId,
        version: recipe.version,
        paramValues,
        addonIds: [],
        quality: "standard",
      };
      get().dispatch({ type: "brief.bindRecipe", binding });
      regenerateRecipeFromBinding(get);
    },
    setRecipeParam: (key, value) => {
      get().dispatch({ type: "brief.setParam", key, value });
      regenerateRecipeFromBinding(get);
    },
    setRecipeQuality: (quality) => {
      const binding = get().docState.brief.settings?.recipeBinding;
      if (!binding) return;
      get().dispatch({ type: "brief.bindRecipe", binding: { ...binding, quality } });
      regenerateRecipeFromBinding(get);
    },
    toggleRecipeAddon: (id) => {
      const binding = get().docState.brief.settings?.recipeBinding;
      if (!binding) return;
      const addonIds = binding.addonIds.includes(id)
        ? binding.addonIds.filter((a) => a !== id)
        : [...binding.addonIds, id];
      get().dispatch({ type: "brief.bindRecipe", binding: { ...binding, addonIds } });
      regenerateRecipeFromBinding(get);
    },
    regenerateRecipe: () => regenerateRecipeFromBinding(get),
    addProgramRow: () => {
      get().dispatch({
        type: "brief.importRows",
        rows: [
          {
            id: newId("prog"),
            name: "New room",
            targetArea: 10,
            qty: 1,
            areaEach: 10,
            source: "manual",
            group: "Public",
          },
        ],
      });
    },
    importProgramRows: (rows) => get().dispatch({ type: "brief.importRows", rows }),
    openBlank: () => {
      const { project, store: doc } = createBlankProject(get().lang);
      set({
        project,
        doc,
        screen: "wizard",
        selectedMassId: null,
        selectedMassIds: [],
        compareBranchIds: [],
        overlayCompare: false,
        mode: "massing",
        tool: "select",
        panel: null,
        schematic: null,
        schematicMassId: null,
        showSchematic: false,
        sectionLine: null,
        selectedElement: null,
        elementMaterials: {},
        statusMessage: null,
        activeLevelId: doc.getState().levels[0]?.id ?? null,
      });
      const rate = get().studioKit.standards.rates.house;
      get().dispatch({ type: "budget.set", patch: { ratePerM2: { low: rate.low, high: rate.high } } });
      refresh();
    },
    openSavedWorkspace: () => {
      const latest = get().projects[0];
      if (!latest) {
        set({ statusMessage: "No saved project found." });
        return;
      }
      get().openProject(latest.id);
    },
    openProject: (id) => {
      const lib = readLibrary();
      const data = lib.projects[id];
      if (!data) {
        set({ statusMessage: "That project could not be found." });
        return;
      }
      try {
        const ws = deserializeWorkspace(data);
        if (typeof document !== "undefined") document.documentElement.dataset.theme = ws.theme;
        lib.lastOpenedId = id;
        try {
          localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib));
        } catch {
          // Non-fatal: opening still works.
        }
        set({
          project: ws.project,
          doc: ws.doc,
          contextBuildings: ws.contextBuildings,
          showContext: ws.showContext,
          theme: ws.theme,
          screen: "workspace",
          selectedMassId: null,
        selectedMassIds: [],
          compareBranchIds: [],
          overlayCompare: false,
          mode: "massing",
          tool: "select",
          panel: null,
          schematic: null,
          schematicMassId: null,
          showSchematic: false,
          sectionLine: null,
          selectedElement: null,
          elementMaterials: {},
          statusMessage: null,
          activeLevelId: ws.doc.getState().levels[0]?.id ?? null,
        });
        refresh();
      } catch (err) {
        set({ statusMessage: `Could not open the saved project: ${(err as Error).message}` });
      }
    },
    deleteProject: (id) => {
      const lib = readLibrary();
      if (!lib.projects[id]) return;
      delete lib.projects[id];
      if (lib.lastOpenedId === id) lib.lastOpenedId = summaries(lib)[0]?.id;
      try {
        localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib));
      } catch {
        // Non-fatal.
      }
      set({ projects: summaries(lib) });
    },
    setStudioKit: (kit) => {
      const next = normalizeStudioKit(kit);
      applyBrandColor(next.identity.primaryColor);
      saveStudioKit(next);
      set({ studioKit: next });
    },
    applyStudioStandards: () => {
      const kit = get().studioKit;
      const bt = get().project.buildingType;
      const rate = kit.standards.rates[bt] ?? kit.standards.rates.house;
      get().dispatch({ type: "budget.set", patch: { ratePerM2: { low: rate.low, high: rate.high } } });
      set({ elementMaterials: {} });
      refresh();
      set({ statusMessage: "Studio standards applied to this project." });
    },
    addLayer: (name) => {
      const count = get().docState.layers.length + 1;
      const id = newId("layer");
      get().dispatch({
        type: "layer.add",
        layer: { id, name: name ?? `Layer ${count}`, visible: true },
      });
    },
    updateLayer: (id, patch) => get().dispatch({ type: "layer.update", id, patch }),
    removeLayer: (id) => {
      if (get().docState.layers.length <= 1) {
        set({ statusMessage: "Keep at least one layer." });
        return;
      }
      get().dispatch({ type: "layer.remove", id });
    },
    setActiveLayer: (id) => get().dispatch({ type: "layer.setActive", id }),
    setMassLayer: (ids, layerId) => get().dispatch({ type: "mass.setLayer", ids, layerId }),
    renameMass: (id, name) => get().dispatch({ type: "mass.update", id, patch: { name } }),
    groupSelected: () => {
      const s = get();
      const ids = s.selectedMassIds.length
        ? s.selectedMassIds
        : s.selectedMassId
          ? [s.selectedMassId]
          : [];
      if (ids.length === 0) {
        set({ statusMessage: "Select one or more objects first." });
        return;
      }
      const n = s.docState.groups.length + 1;
      const palette = ["#60a5fa", "#f472b6", "#34d399", "#fbbf24", "#a78bfa", "#fb7185"];
      const id = newId("grp");
      get().dispatch({
        type: "group.create",
        group: {
          id,
          name: `Group ${n}`,
          color: palette[(n - 1) % palette.length],
          createdAt: Date.now(),
        },
        massIds: ids,
      });
      set({ statusMessage: `${ids.length} object${ids.length > 1 ? "s" : ""} grouped.` });
    },
    ungroupSelected: () => {
      const s = get();
      const groups = new Set(
        s.docState.masses
          .filter((m) => s.selectedMassIds.includes(m.id) && m.groupId)
          .map((m) => m.groupId as Id),
      );
      if (groups.size === 0) {
        set({ statusMessage: "No group in the selection." });
        return;
      }
      for (const id of groups) get().dispatch({ type: "group.remove", id });
      set({ statusMessage: "Ungrouped." });
    },
    renameGroup: (id, name) => get().dispatch({ type: "group.update", id, patch: { name } }),
    selectGroup: (id) => {
      const ids = get().docState.masses.filter((m) => m.groupId === id).map((m) => m.id);
      set({ selectedMassIds: ids, selectedMassId: ids[ids.length - 1] ?? null });
    },
    forkBranch: () => {
      const doc = get().doc;
      const parentName = doc.active.branch.name;
      const forks = get().branches.filter((b) => !b.main).length;
      doc.createBranch({
        name: `Idea ${forks + 2}`,
        fromBranchId: doc.activeBranchId,
        owner: "you",
      });
      refresh();
      set({ statusMessage: `Forked from ${parentName}. Switch back anytime.` });
    },
    suggestMassing: () => {
      const s = get();
      const grossAreaM2 = massingGrossDefault(s.docState);
      const options = suggestMassings(s.docState, {
        grossAreaM2,
        weights: s.massingWeights,
        sun: { lat: s.project.location.lat, lng: s.project.location.lng, northAngle: s.project.northAngle },
      });
      if (options.length === 0) {
        set({ statusMessage: "No massing fits the site and rules yet." });
        return;
      }
      const decisionId = newId("dec");
      s.dispatch({
        type: "decision.add",
        decision: {
          id: decisionId,
          title: "Massing options",
          question: "Which building volume?",
          scope: { kind: "whole" },
          status: "open",
          createdAt: Date.now(),
        },
      });
      const branchIds: Id[] = [];
      const ftf = s.docState.levels[0]?.floorToFloor ?? 3500;
      for (const o of options) {
        const branch = s.doc.createBranch({ name: o.name, decisionId, owner: "you" });
        branchIds.push(branch.id);
        const levelIds = s.docState.levels.slice(0, o.floors).map((l) => l.id);
        get().dispatch({
          type: "mass.add",
          mass: {
            id: newId("mass"),
            levelIds,
            footprint: o.footprint,
            height: o.floors * ftf,
            fidelity: "massing",
            name: o.name,
          },
        });
      }
      s.doc.switchBranch(s.doc.mainBranchId);
      refresh();
      set({
        massingSuggestions: options,
        panel: "decisions",
        compareBranchIds: branchIds,
        overlayCompare: false,
        statusMessage: `${options.length} massing options created.`,
      });
    },
    setMassingWeight: (key, value) => set({ massingWeights: { ...get().massingWeights, [key]: value } }),

    addDecision: ({ title, question, scope }) => {
      const id = `dec_${Math.random().toString(36).slice(2, 9)}`;
      get().dispatch({
        type: "decision.add",
        decision: { id, title, question, scope, status: "open", createdAt: Date.now() },
      });
      return id;
    },
    createBranch: ({ name, decisionId, color }) => {
      const branch = get().doc.createBranch({
        name,
        decisionId,
        color: color ?? BRANCH_COLORS[get().branches.length % BRANCH_COLORS.length],
      });
      refresh();
      return branch;
    },
    adoptBranch: (input) => {
      const doc = get().doc;
      const result = doc.adopt({
        ...input,
        by: "you",
        buildRejected: (branch, state): RejectedBranch => ({
          branchId: branch.id,
          name: branch.name,
          color: branch.color,
          indicators: computeIndicators(state, {
            branchId: branch.id,
            version: 1,
            lang: get().lang,
          }),
        }),
      });
      if (result.ok) {
        set({ statusMessage: "Decision adopted and recorded." });
        refresh();
      }
      return result;
    },
    parkBranch: (id) => {
      get().doc.parkBranch(id);
      refresh();
    },
    reviveBranch: (id) => {
      get().doc.reviveBranch(id);
      refresh();
    },
    setCompare: (ids, overlay) => set({ compareBranchIds: ids, overlayCompare: overlay }),

    refreshIndicators: () => {
      const seq = ++indicatorSeq;
      const { doc, project, lang } = get();
      const state = doc.getState();
      const branchId = doc.activeBranchId;
      const version = doc.active.version;
      set({ indicatorsPending: true });
      void computeIndicatorsAsync(state, {
        branchId,
        version,
        lang,
        sun: { lat: project.location.lat, lng: project.location.lng, northAngle: project.northAngle },
      }).then((indicators) => {
        if (seq !== indicatorSeq) return;
        set({ indicators, indicatorsPending: false });
      });
    },
  };
});

export function selectRecord(): DecisionRecord | null {
  const state = useApp.getState().docState;
  return state.records[state.records.length - 1] ?? null;
}

/**
 * W-02: a view model for a single storey (plan drawings pass a level id), or the
 * whole model when `levelId` is omitted (sections, elevations, 3D).
 */
export function schematicForLevel(levelId?: Id): Schematic | null {
  const s = useApp.getState();
  return schematicFromDoc({
    doc: s.docState,
    options: schematicOptions(s),
    massId: s.schematicMassId ?? "",
    levelId,
  });
}
