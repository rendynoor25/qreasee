/**
 * Assemble IndicatorResults for a branch (PRD 8.5, 9). This is the single entry
 * point the app and the Web Worker call; individual checks stay in their files.
 */

import type { DocState, Id, IndicatorResult, IndicatorStatus, Lang } from "@qreasee/shared";
import { formatArea, formatMetres, formatPercent, formatRupiahRange, programItemTotalM2 } from "@qreasee/shared";
import { buildingHeightRangeMm, coverageAreaMm2, gfaMm2, gfaRangeMm2, siteAreaMm2 } from "./areas";
import { costRange, costStatus, programFit, budgetCeiling } from "./cost";
import { height, kdb, kdh, klb, floors, setback } from "./regulation";
import { computeSunExposure, type SunContext, type SunSummary } from "./sun";

export interface ComputeOptions {
  branchId: Id;
  version: number;
  sun?: SunContext;
  lang?: Lang;
}

const MASSING = "massing" as const;

export function computeIndicators(state: DocState, opts: ComputeOptions): IndicatorResult[] {
  const branchId = opts.branchId;
  const version = opts.version;
  const lang: Lang = opts.lang ?? "en";

  const results: IndicatorResult[] = [];
  const push = (r: Omit<IndicatorResult, "branchId" | "version">) =>
    results.push({ ...r, branchId, version });

  // --- KDB ---
  const k = kdb(state);
  push({
    key: "kdb",
    label: "KDB",
    value: k.value,
    unit: "%",
    status: k.status,
    fidelity: MASSING,
    limit: k.limit,
    inputs: "Coverage area ÷ site area; Massing fidelity",
    detail:
      k.limit !== undefined
        ? `${formatPercent(k.value / 100, lang)} of max ${formatPercent(k.limit / 100, lang)}`
        : "No KDB max set",
  });

  // --- KLB ---
  const kl = klb(state);
  push({
    key: "klb",
    label: "KLB",
    value: kl.value,
    unit: "",
    status: kl.status,
    fidelity: MASSING,
    limit: kl.limit,
    inputs: "GFA ÷ site area; Massing fidelity",
    detail:
      kl.limit !== undefined
        ? `${formatNumber(kl.value, lang)} of max ${formatNumber(kl.limit, lang)}`
        : "No KLB max set",
  });

  // --- KDH ---
  const kd = kdh(state);
  push({
    key: "kdh",
    label: "KDH",
    value: kd.value,
    unit: "%",
    status: kd.status,
    fidelity: MASSING,
    limit: kd.limit,
    inputs: "Green area ÷ site area; Massing fidelity",
    detail:
      state.site.greenPolygons.length === 0
        ? `No green polygons yet; upper bound ${formatArea(kd.upperBoundMm2, lang)}`
        : kd.limit !== undefined
          ? `${formatPercent(kd.value / 100, lang)} of min ${formatPercent(kd.limit / 100, lang)}`
          : "No KDH min set",
  });

  // --- Setback ---
  const sb = setback(state);
  push({
    key: "setback",
    label: "Setback",
    value: sb.breachAreaMm2 / 1_000_000,
    unit: "m²",
    status: sb.status,
    fidelity: MASSING,
    inputs: "Footprint area outside the buildable area; Massing fidelity",
    detail:
      sb.status === "over"
        ? `Breach ${formatArea(sb.breachAreaMm2, lang)} on ${sb.massIds.length} mass(es)`
        : sb.status === "needs-input"
          ? "Draw a site boundary and a mass"
          : "No breach",
  });

  // --- Height ---
  const ht = height(state);
  push({
    key: "height",
    label: "Height",
    value: ht.value.high / 1000,
    unit: "m",
    status: ht.status,
    fidelity: ht.value.low !== ht.value.high ? "intent" : MASSING,
    limit: ht.limit !== undefined ? ht.limit / 1000 : undefined,
    inputs: "Highest mass top − level 1 elevation; Massing fidelity",
    detail:
      ht.value.low !== ht.value.high
        ? `${formatMetres(ht.value.low, lang)}–${formatMetres(ht.value.high, lang)}`
        : formatMetres(ht.value.high, lang),
  });

  // --- Floors ---
  const fl = floors(state);
  push({
    key: "floors",
    label: "Floors",
    value: fl.value,
    unit: "",
    status: fl.status,
    fidelity: MASSING,
    limit: fl.limit,
    inputs: "Levels containing at least one mass",
    detail: `${fl.value} level(s) with mass`,
  });

  // --- Coverage ---
  push({
    key: "coverage",
    label: "Coverage",
    value: coverageAreaMm2(state) / 1_000_000,
    unit: "m²",
    status: "ok",
    fidelity: MASSING,
    inputs: "2D union of all mass footprints",
    detail: formatArea(coverageAreaMm2(state), lang),
  });

  // --- GFA ---
  const gfa = gfaRangeMm2(state);
  push({
    key: "gfa",
    label: "GFA",
    value: gfaMm2(state) / 1_000_000,
    range:
      gfa.low !== gfa.high
        ? { low: gfa.low / 1_000_000, high: gfa.high / 1_000_000 }
        : undefined,
    unit: "m²",
    status: "ok",
    fidelity: gfa.low !== gfa.high ? "intent" : MASSING,
    inputs: "Union of footprints per level; Massing fidelity",
    detail:
      gfa.low !== gfa.high
        ? `${formatArea(gfa.low, lang)}–${formatArea(gfa.high, lang)}`
        : formatArea(gfa.low, lang),
  });

  // --- Cost ---
  const range = costRange(state);
  const ceiling = budgetCeiling(state);
  push({
    key: "cost",
    label: "Cost",
    value: range?.low,
    range: range ? { low: range.low, high: range.high } : undefined,
    unit: "Rp",
    status: costStatus(range, state),
    fidelity: range && range.low !== range.high ? "intent" : MASSING,
    limit: ceiling,
    inputs: "GFA × rate low–high; Massing fidelity",
    detail: range
      ? `${formatRupiahRange(range.low, range.high)}${
          ceiling !== undefined ? ` · ceiling ${formatRupiahRange(ceiling, ceiling)}` : ""
        }`
      : "Set a cost rate range to see a cost range",
  });

  // --- Program ---
  const fits = programFit(state);
  if (fits.length === 0) {
    push({
      key: "program",
      label: "Program",
      status: "needs-input",
      fidelity: MASSING,
      inputs: "Brief program list; mass use labels",
      detail: "Add program items and label masses by use",
    });
  } else {
    const worst = fits.reduce<IndicatorStatus>(
      (acc, f) => (statusRank(f.status) > statusRank(acc) ? f.status : acc),
      "ok",
    );
    push({
      key: "program",
      label: "Program",
      value: fits.filter((f) => f.status === "ok").length,
      unit: "ok",
      status: worst,
      fidelity: MASSING,
      inputs: "Footprint area by use vs target; Massing fidelity",
      detail: `${fits.filter((f) => f.status === "ok").length}/${fits.length} spaces within ±10%`,
    });
  }

  // --- Program rollup (K-03) ---
  const programPct = state.brief.settings?.circulationPct ?? 20;
  let programNetM2 = 0;
  let programRooms = 0;
  for (const item of state.brief.program) {
    programNetM2 += programItemTotalM2(item);
    programRooms += item.qty ?? 1;
  }
  const programCircM2 = (programNetM2 * programPct) / 100;
  const programGrossM2 = programNetM2 + programCircM2;
  const siteM2 = siteAreaMm2(state) / 1_000_000;
  const allowedGfaM2 = state.rules.klbMax && state.rules.klbMax > 0 ? state.rules.klbMax * siteM2 : null;
  const rollupStatus: IndicatorStatus =
    allowedGfaM2 === null
      ? "needs-input"
      : programGrossM2 / allowedGfaM2 < 0.9
        ? "ok"
        : programGrossM2 / allowedGfaM2 <= 1
          ? "near"
          : "over";
  const programRate = state.budget.ratePerM2;
  const rollup = {
    netM2: programNetM2,
    circulationM2: programCircM2,
    grossM2: programGrossM2,
    circulationPct: programPct,
    allowedGfaM2,
    status: rollupStatus,
    costLow: programRate && programRate.low > 0 ? programGrossM2 * programRate.low : null,
    costHigh: programRate && programRate.high > 0 ? programGrossM2 * programRate.high : null,
    roomCount: programRooms,
  };
  push({
    key: "programGross",
    label: "Program gross",
    value: rollup.grossM2,
    unit: "m²",
    status: "ok",
    fidelity: MASSING,
    inputs: `Net ${formatArea(rollup.netM2 * 1_000_000, lang, 1)} + circulation ${rollup.circulationPct}%`,
    detail: `Net ${formatArea(rollup.netM2 * 1_000_000, lang, 1)} + circulation ${formatArea(rollup.circulationM2 * 1_000_000, lang, 1)}`,
  });
  push({
    key: "programVsAllowed",
    label: "Program vs KLB",
    value: rollup.grossM2,
    unit: "m²",
    status: rollup.status,
    fidelity: MASSING,
    limit: rollup.allowedGfaM2 ?? undefined,
    inputs: "Gross program vs KLB × site area",
    detail:
      rollup.allowedGfaM2 === null
        ? "Set KLB max to check the program against the plot"
        : `${formatArea(rollup.grossM2 * 1_000_000, lang, 1)} of allowed ${formatArea(rollup.allowedGfaM2 * 1_000_000, lang, 1)}`,
  });
  push({
    key: "programCost",
    label: "Program cost",
    range:
      rollup.costLow !== null && rollup.costHigh !== null
        ? { low: rollup.costLow, high: rollup.costHigh }
        : undefined,
    unit: "Rp",
    status: rollup.costLow !== null ? "ok" : "needs-input",
    fidelity: MASSING,
    inputs: "Gross program × rate low–high",
    detail:
      rollup.costLow !== null && rollup.costHigh !== null
        ? formatRupiahRange(rollup.costLow, rollup.costHigh)
        : "Set a cost rate range to see a program cost range",
  });

  // --- Sun ---
  if (opts.sun) {
    const sun = computeSunExposure(state, opts.sun);
    push(sunIndicator(sun, opts.sun, lang));
  } else {
    push({
      key: "sun",
      label: "Sun",
      status: "needs-input",
      fidelity: MASSING,
      inputs: "Site location and north angle",
      detail: "Set a project location to compute sun exposure",
    });
  }

  return results;
}

function statusRank(s: IndicatorStatus): number {
  switch (s) {
    case "needs-input":
      return 0;
    case "ok":
      return 1;
    case "under":
      return 2;
    case "near":
      return 3;
    case "over":
      return 4;
  }
}

function sunIndicator(
  sun: SunSummary,
  ctx: SunContext,
  lang: Lang,
): Omit<IndicatorResult, "branchId" | "version"> {
  return {
    key: "sun",
    label: "Sun",
    status: "ok",
    fidelity: MASSING,
    inputs: "Direct-sun hours on 21 Mar, 21 Jun, 21 Dec; Massing fidelity",
    detail: `${formatArea(sun.highAreaMm2, lang)} high (>4 h), ${formatPercent(
      sun.highShareOnEastWest,
      lang,
    )} of it east/west · lat ${formatNumber(ctx.lat, lang, 3)}, north ${formatNumber(
      ctx.northAngle,
      lang,
      0,
    )}°`,
  };
}

function formatNumber(n: number, lang: Lang, digits = 2): string {
  return new Intl.NumberFormat(lang === "id" ? "id-ID" : "en-US", {
    maximumFractionDigits: digits,
  }).format(n);
}

export { siteAreaMm2, gfaRangeMm2, buildingHeightRangeMm };
