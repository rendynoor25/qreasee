import { describe, expect, it } from "vitest";
import { emptyDocState, type DocState, type Level, type Mass, type Point } from "@qreasee/shared";
import {
  buildingHeightRangeMm,
  computeIndicators,
  computeSunExposure,
  costRange,
  costStatus,
  coverageAreaMm2,
  gfaMm2,
  gfaRangeMm2,
  kdb,
  kdh,
  klb,
  programFit,
  setback,
  siteAreaMm2,
} from "../index";

const m = 1000;
const rect = (x: number, y: number, w: number, h: number): Point[] => [
  { x: x * m, y: y * m },
  { x: (x + w) * m, y: y * m },
  { x: (x + w) * m, y: (y + h) * m },
  { x: x * m, y: (y + h) * m },
];

const L = (id: string, elevation: number): Level => ({
  id,
  name: id,
  elevation,
  floorToFloor: 3500,
});

function mass(
  id: string,
  outer: Point[],
  levelIds: string[],
  height: number,
  use?: string,
): Mass {
  return {
    id,
    levelIds,
    footprint: { outer, holes: [] },
    height,
    fidelity: "massing",
    use,
  };
}

/** 20 x 15 m corner site (300 m²) with a 10 x 12 m mass through three levels. */
function cornerProject(): DocState {
  const s = emptyDocState();
  s.levels = [L("L1", 0), L("L2", 3500), L("L3", 7000)];
  s.site.boundary = rect(0, 0, 20, 15);
  s.site.greenPolygons = [
    { id: "g1", kind: "green", points: rect(0, 0, 10, 6) },
  ];
  s.masses = [mass("A", rect(0, 0, 10, 12), ["L1", "L2", "L3"], 10500, "Office")];
  s.rules = {
    kdbMax: 60,
    klbMax: 1.8,
    kdhMin: 30,
    heightMax: 12000,
    floorsMax: 3,
    setbacks: { 0: 4000 },
  };
  s.budget = {
    ceiling: 2_000_000_000,
    ratePerM2: { low: 5_000_000, high: 7_000_000 },
  };
  s.brief = {
    text: "",
    program: [
      { id: "p1", name: "Office", targetArea: 360 },
      { id: "p2", name: "Cafe", targetArea: 100 },
    ],
  };
  return s;
}

describe("areas (PRD 9.1)", () => {
  const s = cornerProject();
  it("computes site area 300 m²", () => {
    expect(siteAreaMm2(s) / 1e6).toBeCloseTo(300, 2);
  });
  it("computes coverage 120 m²", () => {
    expect(coverageAreaMm2(s) / 1e6).toBeCloseTo(120, 2);
  });
  it("computes GFA 360 m² across three levels", () => {
    expect(gfaMm2(s) / 1e6).toBeCloseTo(360, 2);
  });
});

describe("regulation (PRD 9.2)", () => {
  const s = cornerProject();
  it("KDB = 40% and ok against 60%", () => {
    expect(kdb(s).value).toBeCloseTo(40, 2);
    expect(kdb(s).status).toBe("ok");
  });
  it("KLB = 1.2 and ok against 1.8", () => {
    expect(klb(s).value).toBeCloseTo(1.2, 3);
    expect(klb(s).status).toBe("ok");
  });
  it("KDH = 20% and over against a 30% minimum", () => {
    expect(kdh(s).value).toBeCloseTo(20, 2);
    expect(kdh(s).status).toBe("over");
  });
  it("flags the 4 m front setback breach (40 m²)", () => {
    const sb = setback(s);
    expect(sb.status).toBe("over");
    expect(sb.breachAreaMm2 / 1e6).toBeCloseTo(40, 1);
    expect(sb.massIds).toEqual(["A"]);
  });
  it("height 10.5 m and floors 3 (near max)", () => {
    expect(buildingHeightRangeMm(s).high / 1000).toBeCloseTo(10.5, 3);
    const byKey = Object.fromEntries(computeIndicators(s, { branchId: "b", version: 1 }).map((r) => [r.key, r]));
    expect(byKey.height.status).toBe("ok");
    expect(byKey.floors.value).toBe(3);
    expect(byKey.floors.status).toBe("near");
  });
});

describe("program and cost (PRD 9.3)", () => {
  const s = cornerProject();
  it("matches the 360 m² Office target and under-shoots Cafe", () => {
    const fits = programFit(s);
    const office = fits.find((f) => f.name === "Office")!;
    const cafe = fits.find((f) => f.name === "Cafe")!;
    expect(office.status).toBe("ok");
    expect(cafe.status).toBe("under");
  });
  it("cost range 1.8–2.52 miliar and near the 2 miliar ceiling", () => {
    const range = costRange(s)!;
    expect(range.low / 1e9).toBeCloseTo(1.8, 3);
    expect(range.high / 1e9).toBeCloseTo(2.52, 3);
    expect(costStatus(range, s)).toBe("near");
  });
});

describe("intent ranges (FD-02, 9.3)", () => {
  it("widens GFA and cost across an intent area range", () => {
    const s = emptyDocState();
    s.levels = [L("L1", 0)];
    s.site.boundary = rect(0, 0, 20, 15);
    const mmass = mass("I", rect(0, 0, 10, 10), ["L1"], 3500);
    mmass.fidelity = "intent";
    mmass.intent = { area: { low: 100, high: 150 } };
    s.masses = [mmass];
    s.budget = { ratePerM2: { low: 1, high: 1 } };
    const gfa = gfaRangeMm2(s);
    expect(gfa.low / 1e6).toBeCloseTo(100, 2);
    expect(gfa.high / 1e6).toBeCloseTo(150, 2);
    const range = costRange(s)!;
    expect(range.low).toBeCloseTo(100, 2);
    expect(range.high).toBeCloseTo(150, 2);
  });
});

describe("courtyard footprint", () => {
  it("removes the courtyard from coverage", () => {
    const s = emptyDocState();
    s.site.boundary = rect(0, 0, 40, 40);
    const courtyard: Mass = {
      id: "C",
      levelIds: ["L1"],
      footprint: { outer: rect(0, 0, 20, 20), holes: [rect(6, 6, 8, 8)] },
      height: 3000,
      fidelity: "massing",
    };
    s.masses = [courtyard];
    s.levels = [L("L1", 0)];
    expect(coverageAreaMm2(s) / 1e6).toBeCloseTo(336, 2);
  });
});

describe("concave site", () => {
  it("computes an L-shaped site area of 300 m²", () => {
    const s = emptyDocState();
    s.site.boundary = [
      { x: 0, y: 0 },
      { x: 20 * m, y: 0 },
      { x: 20 * m, y: 10 * m },
      { x: 10 * m, y: 10 * m },
      { x: 10 * m, y: 20 * m },
      { x: 0, y: 20 * m },
    ];
    expect(siteAreaMm2(s) / 1e6).toBeCloseTo(300, 2);
  });
});

describe("sun exposure (PRD 9.4)", () => {
  it("returns hours in 0–8 and a share in 0–1 for Jakarta", () => {
    const s = cornerProject();
    const sun = computeSunExposure(s, { lat: -6.2, lng: 106.8, northAngle: 0 });
    expect(sun.faces.length).toBeGreaterThan(0);
    for (const f of sun.faces) {
      expect(f.hours).toBeGreaterThanOrEqual(0);
      expect(f.hours).toBeLessThanOrEqual(8.001);
    }
    expect(sun.highShareOnEastWest).toBeGreaterThanOrEqual(0);
    expect(sun.highShareOnEastWest).toBeLessThanOrEqual(1);
  });
});

describe("computeIndicators", () => {
  it("returns every MVP indicator with a status", () => {
    const s = cornerProject();
    const results = computeIndicators(s, {
      branchId: "b1",
      version: 1,
      sun: { lat: -6.2, lng: 106.8, northAngle: 0 },
    });
    const keys = results.map((r) => r.key).sort();
    expect(keys).toEqual(
      ["cost", "coverage", "floors", "gfa", "height", "kdb", "kdh", "klb", "program", "programCost", "programGross", "programVsAllowed", "setback", "sun"].sort(),
    );
    expect(results.every((r) => r.branchId === "b1" && r.version === 1)).toBe(true);
    for (const r of results) expect(r.fidelity).toBeTruthy();
  });

  it("shows needs-input when budget is missing (IN-06)", () => {
    const s = cornerProject();
    s.budget = {};
    const results = computeIndicators(s, { branchId: "b", version: 1 });
    const cost = results.find((r) => r.key === "cost")!;
    expect(cost.status).toBe("needs-input");
  });
});
