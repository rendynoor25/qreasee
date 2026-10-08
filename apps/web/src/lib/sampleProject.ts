import {
  DEFAULT_RATES,
  emptyDocState,
  getTemplate,
  newId,
  type Brief,
  type Budget,
  type DocState,
  type GridLine,
  type Lang,
  type Level,
  type Mass,
  type Point,
  type Polygon,
  type Project,
  type Rules,
  type TemplateId,
} from "@qreasee/shared";
import { DocumentStore } from "@qreasee/document";

const m = 1000;

function rect(x: number, y: number, w: number, h: number): Point[] {
  return [
    { x: x * m, y: y * m },
    { x: (x + w) * m, y: y * m },
    { x: (x + w) * m, y: (y + h) * m },
    { x: x * m, y: (y + h) * m },
  ];
}

export function defaultProject(name = "Untitled project"): Project {
  return {
    id: newId("proj"),
    studioId: newId("studio"),
    name,
    location: { lat: -6.2, lng: 106.8 },
    northAngle: 12,
    units: "mm",
    buildingType: "house",
  };
}

export function blankState(): DocState {
  const s = emptyDocState();
  s.levels = [
    { id: "L1", name: "Lt. 1", elevation: 0, floorToFloor: 3500 },
    { id: "L2", name: "Lt. 2", elevation: 3500, floorToFloor: 3500 },
    { id: "L3", name: "Lt. 3", elevation: 7000, floorToFloor: 3500 },
  ];
  s.budget.ratePerM2 = DEFAULT_RATES.house;
  return s;
}

/** Simple 5 m grid covering a site of the given size. */
function gridFor(widthM: number, depthM: number): GridLine[] {
  const lines: GridLine[] = [];
  for (let x = 0; x <= widthM; x += 5) {
    lines.push({ id: `gx${x}`, axis: "x", label: String(x / 5 + 1), offset: x * m });
  }
  for (let y = 0; y <= depthM; y += 5) {
    lines.push({ id: `gy${y}`, axis: "y", label: String.fromCharCode(65 + y / 5), offset: y * m });
  }
  return lines;
}

export function siteBoundary(wM: number, dM: number): Point[] {
  return rect(0, 0, wM, dM);
}

export function gridForSize(wM: number, dM: number): GridLine[] {
  return gridFor(wM, dM);
}

/**
 * A-02: build a working project from a starter template. Rules stay empty (we
 * never invent regulation); the plot is a default rectangle the user can replace
 * in the site wizard (A-03).
 */
export function createProjectFromTemplate(
  id: TemplateId,
  lang: Lang,
): { project: Project; store: DocumentStore } {
  const template = getTemplate(id);
  if (!template) throw new Error(`Unknown template: ${id}`);
  const project: Project = {
    ...defaultProject(template.name[lang]),
    buildingType: template.buildingType,
  };
  const s = blankState();
  s.brief = {
    text: template.brief[lang],
    program: template.program.map((p) => ({
      id: newId("prog"),
      name: p.name,
      targetArea: p.targetArea,
    })),
  };
  s.budget = { ratePerM2: { ...template.ratePerM2 } };
  s.site.boundary = rect(0, 0, template.site.widthM, template.site.depthM);
  s.grids = gridFor(template.site.widthM, template.site.depthM);
  return { project, store: new DocumentStore(s, "Main") };
}

/** A-01 "Blank project": an empty 12 × 25 m plot with the standard levels. */
export function createBlankProject(lang: Lang): { project: Project; store: DocumentStore } {
  const project = defaultProject(lang === "id" ? "Proyek baru" : "New project");
  const s = blankState();
  s.site.boundary = rect(0, 0, 12, 25);
  s.grids = gridFor(12, 25);
  return { project, store: new DocumentStore(s, "Main") };
}

const levels: Level[] = [
  { id: "L1", name: "Lt. 1", elevation: 0, floorToFloor: 3500 },
  { id: "L2", name: "Lt. 2", elevation: 3500, floorToFloor: 3500 },
  { id: "L3", name: "Lt. 3", elevation: 7000, floorToFloor: 3500 },
];

const grid: GridLine[] = [
  ...[0, 5000, 10000, 15000, 20000].map((offset, i) => ({
    id: `gx${i}`,
    axis: "x" as const,
    label: String(i + 1),
    offset,
  })),
  ...[0, 5000, 10000, 15000].map((offset, i) => ({
    id: `gy${i}`,
    axis: "y" as const,
    label: String.fromCharCode(65 + i),
    offset,
  })),
];

const rules: Rules = {
  kdbMax: 60,
  klbMax: 1.8,
  kdhMin: 30,
  heightMax: 12000,
  floorsMax: 3,
  setbacks: { 0: 4000, 1: 2000, 2: 2000, 3: 2000 },
  sourceNote: "Sample KRK preset (edit for your city)",
};

const budget: Budget = {
  ceiling: 2_000_000_000,
  ratePerM2: { low: 5_000_000, high: 7_000_000 },
};

const brief: Brief = {
  text: "Corner house: office/gallery on the ground floor, family above. Keep the west facade short.",
  program: [
    { id: "p1", name: "Office", targetArea: 216 },
    { id: "p2", name: "Residence", targetArea: 108 },
  ],
};

const baseMass: Mass = {
  id: "m1",
  levelIds: ["L1", "L2", "L3"],
  footprint: { outer: rect(3, 4, 12, 9), holes: [] },
  height: 10500,
  fidelity: "massing",
  use: "Office",
};

/**
 * A ready sample that shows the whole core loop: a 300 m² corner site, rules,
 * budget, brief, grids, a compliant 3-storey mass, green space, and one open
 * decision with two branches to compare and adopt.
 */
export function createSampleProject(): { project: Project; store: DocumentStore } {
  const project: Project = {
    id: newId("proj"),
    studioId: newId("studio"),
    name: "Qreasee Corner House",
    location: { lat: -6.2, lng: 106.8 },
    northAngle: 12,
    units: "mm",
    buildingType: "house",
  };

  const s = emptyDocState();
  s.levels = levels;
  s.grids = grid;
  s.rules = rules;
  s.budget = budget;
  s.brief = brief;
  s.site.boundary = rect(0, 0, 20, 15); // 300 m²
  s.site.roadEdges = [{ edgeIndex: 0, name: "Jalan depan" }, { edgeIndex: 1, name: "Jalan samping" }];
  s.site.greenPolygons = [{ id: "g1", kind: "green", points: rect(14, 0, 6, 15) }]; // 90 m², KDH 30%
  s.masses = [baseMass];

  const store = new DocumentStore(s, "Main");
  const decisionId = newId("dec");
  store.dispatch({
    type: "decision.add",
    decision: {
      id: decisionId,
      title: "Massing direction",
      question: "Courtyard or compact with a terrace?",
      scope: { kind: "whole" },
      status: "open",
      createdAt: Date.now(),
    },
  });

  // Branch A: an L / courtyard footprint.
  store.createBranch({ name: "Courtyard", decisionId, color: "#f0913b", owner: "you" });
  const courtyard: Polygon = {
    outer: rect(3, 4, 12, 9),
    holes: [rect(7, 7, 4, 4)],
  };
  store.dispatch({ type: "mass.update", id: "m1", patch: { footprint: courtyard } });

  // Branch B: compact with a terrace (smaller footprint, stepped upper level).
  store.switchBranch(store.mainBranchId);
  store.createBranch({ name: "Compact terrace", decisionId, color: "#5eead4", owner: "you" });
  store.dispatch({
    type: "mass.update",
    id: "m1",
    patch: { footprint: { outer: rect(4, 6, 8, 7), holes: [] }, name: "Terrace mass" },
  });

  store.switchBranch(store.mainBranchId);
  return { project, store };
}
