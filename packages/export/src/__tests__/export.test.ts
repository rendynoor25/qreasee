import { describe, expect, it } from "vitest";
import { emptyDocState, type Decision, type DecisionRecord, type Mass, type Project } from "@qreasee/shared";
import {
  decisionLogCsv,
  decisionLogMarkdown,
  exportCollada,
  exportDxf,
  exportQrs,
  importQrs,
  migrateQrsPayload,
  type QrsPayload,
} from "../index";

const project: Project = {
  id: "p1",
  studioId: "s1",
  name: "Corner House",
  location: { lat: -6.2, lng: 106.8 },
  northAngle: 0,
  units: "mm",
  buildingType: "house",
};

function fixture() {
  const s = emptyDocState();
  s.levels = [{ id: "L1", name: "Lt. 1", elevation: 0, floorToFloor: 3500 }];
  s.site.boundary = [
    { x: 0, y: 0 },
    { x: 20000, y: 0 },
    { x: 20000, y: 15000 },
    { x: 0, y: 15000 },
  ];
  s.rules.setbacks = { 0: 4000 };
  s.grids = [
    { id: "gx1", axis: "x", label: "1", offset: 0 },
    { id: "gy1", axis: "y", label: "A", offset: 0 },
  ];
  const mass: Mass = {
    id: "m1",
    levelIds: ["L1"],
    footprint: {
      outer: [
        { x: 0, y: 0 },
        { x: 10000, y: 0 },
        { x: 10000, y: 10000 },
        { x: 0, y: 10000 },
      ],
      holes: [],
    },
    height: 3500,
    fidelity: "massing",
    use: "Office",
  };
  s.masses = [mass];
  const decision: Decision = {
    id: "d1",
    title: "Massing option",
    question: "Which?",
    scope: { kind: "whole" },
    status: "decided",
    createdAt: 0,
  };
  const record: DecisionRecord = {
    id: "r1",
    decisionId: "d1",
    chosenBranchId: "b1",
    rationale: "Meets KLB with margin.",
    rejected: [],
    rulesSnapshot: s.rules,
    budgetSnapshot: s.budget,
    by: "u1",
    at: 0,
  };
  s.decisions = [decision];
  s.records = [record];
  return s;
}

describe("DXF export (EX-01)", () => {
  it("writes layers for site, setbacks, grid and levels", () => {
    const dxf = exportDxf(fixture(), project);
    expect(dxf).toContain("Q-SITE");
    expect(dxf).toContain("Q-SETBACK");
    expect(dxf).toContain("Q-GRID");
    expect(dxf).toContain("Q-LT1");
    expect(dxf).toContain("ENTITIES");
  });

  it("draws a mass on its object layer so naming survives the handoff", () => {
    const s = fixture();
    s.layers = [{ id: "layer-1", name: "Dinding", visible: true, color: "#cc3333" }];
    s.masses[0].layerId = "layer-1";
    const dxf = exportDxf(s, project);
    expect(dxf).toContain("Q-Dinding");
  });

  it("adds studio layers for walls, doors, glazing, grid and annotations (W-08)", () => {
    const s = fixture();
    s.walls = [
      { id: "w1", levelId: "L1", a: { x: 0, y: 0 }, b: { x: 9000, y: 0 }, thickness: 150, height: 3500, kind: "exterior" },
    ];
    s.openings = [
      { id: "o1", wallId: "w1", kind: "door", offset: 1000, width: 900, sill: 0, height: 2100 },
      { id: "o2", wallId: "w1", kind: "window", offset: 5000, width: 1200, sill: 900, height: 1500 },
    ];
    s.rooms = [
      {
        id: "r1",
        levelId: "L1",
        name: "R. Keluarga",
        fidelity: "concept",
        polygon: {
          outer: [
            { x: 0, y: 0 },
            { x: 4000, y: 0 },
            { x: 4000, y: 3000 },
            { x: 0, y: 3000 },
          ],
          holes: [],
        },
        areaMm2: 12_000_000,
      },
    ];
    const dxf = exportDxf(s, project);
    for (const layer of ["A-WALL", "A-DOOR", "A-GLAZ", "A-GRID", "A-ANNO"]) {
      expect(dxf, `${layer} missing`).toContain(layer);
    }
    expect(dxf).toContain("R. Keluarga");
  });
});

describe("COLLADA export (EX-02)", () => {
  it("writes a Z-up metre scene with a named mass node", () => {
    const dae = exportCollada(fixture(), project);
    expect(dae).toContain("<COLLADA");
    expect(dae).toContain('unit meter="1"');
    expect(dae).toContain("Z_UP");
    expect(dae).toContain('name="Lt. 1 Office"');
  });
});

describe("decision log (EX-05)", () => {
  it("writes markdown and CSV", () => {
    const s = fixture();
    expect(decisionLogMarkdown(s)).toContain("Meets KLB with margin.");
    expect(decisionLogCsv(s)).toContain("Massing option");
  });
});

describe(".qrs migration (K-01)", () => {
  it("migrates a v1 program to v2 (settings, qty, areaEach, source)", () => {
    const s = fixture();
    s.brief = { text: "", program: [{ id: "p1", name: "Living", targetArea: 20 }] };
    const v1 = {
      format: "qreasee",
      formatVersion: 1,
      savedAt: new Date(0).toISOString(),
      project,
      docState: s,
      store: { version: 1, mainId: "main", activeId: "main", branches: [] },
    } as unknown as QrsPayload;
    const out = migrateQrsPayload(v1);
    expect(out.formatVersion).toBe(4);
    expect(out.docState.brief.settings?.circulationPct).toBe(20);
    expect(out.docState.brief.program[0].qty).toBe(1);
    expect(out.docState.brief.program[0].areaEach).toBe(20);
    expect(out.docState.brief.program[0].source).toBe("manual");
  });

  it("bumps a v3 payload to v4 (schematic entities) without throwing", () => {
    const s = fixture();
    const v3 = {
      format: "qreasee",
      formatVersion: 3,
      savedAt: new Date(0).toISOString(),
      project,
      docState: s,
      store: { version: 1, mainId: "main", activeId: "main", branches: [] },
    } as unknown as QrsPayload;
    const out = migrateQrsPayload(v3);
    expect(out.formatVersion).toBe(4);
    // v3 already has the program shape; it is left untouched.
    expect(out.docState).toBe(s);
  });
});

describe(".qrs round trip (EX-06)", () => {  it("exports and re-imports a project", () => {
    const s = fixture();
    const payload = {
      format: "qreasee" as const,
      formatVersion: 1 as const,
      savedAt: new Date(0).toISOString(),
      project,
      docState: s,
      store: {
        version: 1 as const,
        mainId: "main",
        activeId: "main",
        branches: [
          {
            id: "main",
            branch: {
              id: "main",
              name: "Main",
              color: "#fff",
              baseVersion: 0,
              owner: "",
              status: "exploring" as const,
              main: true,
            },
            state: s,
            opLog: [],
            version: 1,
            forkSnapshot: s,
            forkVersion: 1,
          },
        ],
      },
    };
    const bytes = exportQrs(payload);
    expect(bytes.length).toBeGreaterThan(0);
    const back = importQrs(bytes);
    expect(back.project.name).toBe("Corner House");
    expect(back.docState.masses).toHaveLength(1);
  });
});
