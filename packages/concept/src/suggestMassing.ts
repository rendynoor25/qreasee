/**
 * K-05: deterministic "programming massing" suggestions. No AI, no randomness:
 * candidate floor counts × shape families are fitted into the buildable area,
 * scored against the existing indicators, hard-rule breaches are rejected, and
 * the top distinct options are returned with a visible score breakdown.
 *
 * Each option is turned into a normal branch by the caller (createBranch + mass.add).
 */

import {
  type DocState,
  type IndicatorStatus,
  type Mass,
  type Point,
  type Polygon,
} from "@qreasee/shared";
import {
  bounds,
  buildableArea,
  intersectPolygons,
  polygonAreaMm2,
  polygonsAreaMm2,
  ringPerimeter,
  unionPolygons,
} from "@qreasee/geometry";
import {
  buildingHeightRangeMm,
  computeSunExposure,
  costRange,
  height as heightIndicator,
  kdb,
  kdh,
  klb,
  setback,
} from "@qreasee/indicators";

export interface MassingWeights {
  cost: number;
  rules: number;
  sun: number;
  green: number;
  compactness: number;
}

export const DEFAULT_MASSING_WEIGHTS: MassingWeights = {
  cost: 0.3,
  rules: 0.25,
  sun: 0.2,
  green: 0.15,
  compactness: 0.1,
};

export type MassingFamily = "bar" | "L" | "courtyard";

export interface MassingOption {
  id: string;
  name: string;
  family: MassingFamily;
  floors: number;
  footprint: Polygon;
  kdb: number;
  klb: number;
  kdh: number;
  heightMm: number;
  costLow: number | null;
  costHigh: number | null;
  sunHighEastWest: number;
  status: {
    kdb: IndicatorStatus;
    klb: IndicatorStatus;
    kdh: IndicatorStatus;
    setback: IndicatorStatus;
    height: IndicatorStatus;
  };
  breaches: boolean;
  score: number;
  breakdown: MassingWeights;
}

export interface SuggestOptions {
  grossAreaM2: number;
  weights?: Partial<MassingWeights>;
  count?: number;
  sun?: { lat: number; lng: number; northAngle: number };
}

const STAIR_M2 = 5; // allowance per extra level

function rect(cx: number, cy: number, w: number, d: number): Point[] {
  return [
    { x: cx - w / 2, y: cy - d / 2 },
    { x: cx + w / 2, y: cy - d / 2 },
    { x: cx + w / 2, y: cy + d / 2 },
    { x: cx - w / 2, y: cy + d / 2 },
  ];
}

interface Candidate {
  family: MassingFamily;
  footprint: Polygon;
}

function orient(
  w: number,
  d: number,
  bb: { width: number; height: number },
): [number, number] | null {
  if (w <= bb.width && d <= bb.height) return [w, d];
  if (d <= bb.width && w <= bb.height) return [d, w];
  return null;
}

/** Shape families sized to `areaM2`, centred in the buildable bounds (mm). */
function shapeCandidates(
  areaM2: number,
  bb: { center: Point; width: number; height: number },
): Candidate[] {
  const out: Candidate[] = [];
  const areaMm2 = areaM2 * 1_000_000;

  for (const aspect of [1.5, 2, 3]) {
    const w0 = Math.sqrt(areaMm2 * aspect);
    const d0 = areaMm2 / w0;
    const o = orient(w0, d0, bb);
    if (o) out.push({ family: "bar", footprint: { outer: rect(bb.center.x, bb.center.y, o[0], o[1]), holes: [] } });
  }

  // Fallbacks that fill one side of the buildable bounds (covers deep/narrow plots).
  {
    const d1 = areaMm2 / bb.width;
    if (d1 > 0 && d1 <= bb.height) {
      out.push({ family: "bar", footprint: { outer: rect(bb.center.x, bb.center.y, bb.width, d1), holes: [] } });
    }
    const w2 = areaMm2 / bb.height;
    if (w2 > 0 && w2 <= bb.width) {
      out.push({ family: "bar", footprint: { outer: rect(bb.center.x, bb.center.y, w2, bb.height), holes: [] } });
    }
  }

  // L-shape: a rectangle with a corner removed.
  {
    const baseArea = areaMm2 * 1.25;
    const w0 = Math.sqrt(baseArea * 1.5);
    const d0 = baseArea / w0;
    const o = orient(w0, d0, bb);
    if (o) {
      const [w, d] = o;
      const cutArea = baseArea - areaMm2;
      const cutW = w * 0.5;
      const cutD = cutArea / cutW;
      if (cutD < d) {
        const x0 = bb.center.x - w / 2;
        const y0 = bb.center.y - d / 2;
        const ring: Point[] = [
          { x: x0, y: y0 },
          { x: x0 + w, y: y0 },
          { x: x0 + w, y: y0 + d - cutD },
          { x: x0 + w - cutW, y: y0 + d - cutD },
          { x: x0 + w - cutW, y: y0 + d },
          { x: x0, y: y0 + d },
        ];
        out.push({ family: "L", footprint: { outer: ring, holes: [] } });
      }
    }
  }

  // Courtyard: outer rectangle with a hole (≥ 6% of the footprint).
  {
    const holeArea = areaMm2 * 0.1;
    const outerArea = areaMm2 + holeArea;
    const w0 = Math.sqrt(outerArea * 1.4);
    const d0 = outerArea / w0;
    const o = orient(w0, d0, bb);
    if (o) {
      const [w, d] = o;
      const hw = Math.sqrt(holeArea * 1.4);
      const hd = holeArea / hw;
      if (hw < w * 0.7 && hd < d * 0.7) {
        out.push({
          family: "courtyard",
          footprint: {
            outer: rect(bb.center.x, bb.center.y, w, d),
            holes: [rect(bb.center.x, bb.center.y, hw, hd)],
          },
        });
      }
    }
  }

  return out;
}

function candidateState(state: DocState, footprint: Polygon, floors: number): DocState {
  const ftf = state.levels[0]?.floorToFloor ?? 3500;
  const levels = Array.from({ length: floors }, (_, i) => ({
    id: `cand-L${i + 1}`,
    name: `L${i + 1}`,
    elevation: i * ftf,
    floorToFloor: ftf,
  }));
  const mass: Mass = {
    id: "cand",
    levelIds: levels.map((l) => l.id),
    footprint,
    height: floors * ftf,
    fidelity: "massing",
  };
  return {
    ...state,
    levels,
    masses: [mass],
    rooms: [],
    views: [],
    viewOverrides: {},
    decisions: [],
    records: [],
  };
}

function iou(a: Polygon, b: Polygon): number {
  const inter = polygonsAreaMm2(intersectPolygons([a], [b]));
  const uni = polygonsAreaMm2(unionPolygons([a, b]));
  return uni > 0 ? inter / uni : 0;
}

interface Raw extends Candidate {
  floors: number;
  areaM2: number;
  kdb: number;
  klb: number;
  kdh: number;
  heightMm: number;
  costHigh: number | null;
  costLow: number | null;
  sunHighEastWest: number;
  status: MassingOption["status"];
  breaches: boolean;
  compactness: number;
  rulesMargin: number;
  greenMargin: number;
}

function normalize(values: number[], invert: boolean): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  return values.map((v) => {
    const n = span > 0 ? (v - min) / span : 1;
    return invert ? 1 - n : n;
  });
}

export function suggestMassings(state: DocState, opts: SuggestOptions): MassingOption[] {
  const weights: MassingWeights = { ...DEFAULT_MASSING_WEIGHTS, ...opts.weights };
  const count = opts.count ?? 3;
  if (!(opts.grossAreaM2 > 0) || state.site.boundary.length < 3) return [];

  const buildable = buildableArea(state.site.boundary, state.rules.setbacks);
  if (buildable.length === 0) return [];
  const allPts = buildable.flatMap((p) => p.outer);
  const b = bounds(allPts);
  const bb = { center: b.center, width: b.width, height: b.height };

  const floorsMax = Math.min(4, Math.max(1, state.rules.floorsMax ?? 3));
  const raw: Raw[] = [];

  for (let n = 1; n <= floorsMax; n++) {
    const Af = opts.grossAreaM2 / n + STAIR_M2 * (n - 1);
    for (const cand of shapeCandidates(Af, bb)) {
      const clipped = intersectPolygons([cand.footprint], buildable);
      if (clipped.length === 0) continue;
      const poly = clipped.reduce((a, c) => (polygonAreaMm2(c) > polygonAreaMm2(a) ? c : a));
      const areaM2 = polygonAreaMm2(poly) / 1_000_000;
      if (areaM2 < Af * 0.9) continue;

      const cs = candidateState(state, poly, n);
      const kdbRes = kdb(cs);
      const klbRes = klb(cs);
      const kdhRes = kdh(cs);
      const sbRes = setback(cs);
      const hRes = heightIndicator(cs);
      const cost = costRange(cs);
      const sun = opts.sun ? computeSunExposure(cs, opts.sun) : null;

      const breaches =
        kdbRes.status === "over" ||
        klbRes.status === "over" ||
        kdhRes.status === "over" ||
        sbRes.status === "over" ||
        hRes.status === "over";

      const klbMax = state.rules.klbMax ?? 0;
      const kdhMin = state.rules.kdhMin ?? 0;
      raw.push({
        ...cand,
        footprint: poly,
        floors: n,
        areaM2,
        kdb: kdbRes.value,
        klb: klbRes.value,
        kdh: kdhRes.value,
        heightMm: buildingHeightRangeMm(cs).high,
        costLow: cost?.low ?? null,
        costHigh: cost?.high ?? null,
        sunHighEastWest: sun?.highShareOnEastWest ?? 0,
        status: {
          kdb: kdbRes.status,
          klb: klbRes.status,
          kdh: kdhRes.status,
          setback: sbRes.status,
          height: hRes.status,
        },
        breaches,
        compactness: ringPerimeter(poly.outer) / Math.sqrt(areaM2 * 1_000_000),
        rulesMargin: klbMax > 0 ? Math.max(0, klbMax - klbRes.value) : 0,
        greenMargin: kdhMin > 0 ? Math.max(0, kdhRes.value - kdhMin) : 0,
      });
    }
  }

  const valid = raw.filter((r) => !r.breaches);
  if (valid.length === 0) return [];

  const nCost = normalize(valid.map((r) => r.costHigh ?? 0), true);
  const nRules = normalize(valid.map((r) => r.rulesMargin), false);
  const nSun = normalize(valid.map((r) => r.sunHighEastWest), true);
  const nGreen = normalize(valid.map((r) => r.greenMargin), false);
  const nCompact = normalize(valid.map((r) => r.compactness), true);

  const scored = valid.map((r, i) => {
    const breakdown: MassingWeights = {
      cost: nCost[i],
      rules: nRules[i],
      sun: nSun[i],
      green: nGreen[i],
      compactness: nCompact[i],
    };
    const score =
      breakdown.cost * weights.cost +
      breakdown.rules * weights.rules +
      breakdown.sun * weights.sun +
      breakdown.green * weights.green +
      breakdown.compactness * weights.compactness;
    return { r, breakdown, score };
  });
  scored.sort((a, b2) => b2.score - a.score || a.r.floors - b2.r.floors || a.r.family.localeCompare(b2.r.family));

  // Distinctness: IoU < 0.7 or a different floor count.
  const picked: typeof scored = [];
  for (const s of scored) {
    if (picked.length >= count) break;
    const distinct = picked.every((p) => p.r.floors !== s.r.floors || iou(p.r.footprint, s.r.footprint) < 0.7);
    if (distinct) picked.push(s);
  }

  const letters = ["A", "B", "C", "D"];
  return picked.map((s, i) => ({
    id: `mass-${s.r.family}-${s.r.floors}-${i}`,
    name: `Option ${letters[i]}: ${s.r.floors} floor${s.r.floors > 1 ? "s" : ""} ${s.r.family === "L" ? "L-shape" : s.r.family}`,
    family: s.r.family,
    floors: s.r.floors,
    footprint: s.r.footprint,
    kdb: s.r.kdb,
    klb: s.r.klb,
    kdh: s.r.kdh,
    heightMm: s.r.heightMm,
    costLow: s.r.costLow,
    costHigh: s.r.costHigh,
    sunHighEastWest: s.r.sunHighEastWest,
    status: s.r.status,
    breaches: s.r.breaches,
    score: s.score,
    breakdown: s.breakdown,
  }));
}

export function massingGrossDefault(state: DocState): number {
  const net = state.brief.program.reduce((s, p) => s + (p.qty ?? 1) * (p.areaEach ?? p.targetArea), 0);
  if (net > 0) {
    const pct = state.brief.settings?.circulationPct ?? 20;
    return net * (1 + pct / 100);
  }
  return 120; // sensible fallback when no program exists yet
}
