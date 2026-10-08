import * as Comlink from "comlink";
import { computeIndicators, computeSunExposure, type ComputeOptions, type SunContext, type SunSummary } from "@qreasee/indicators";
import type { DocState, IndicatorResult } from "@qreasee/shared";

const api = {
  compute(state: DocState, opts: ComputeOptions): IndicatorResult[] {
    return computeIndicators(state, opts);
  },
  sun(state: DocState, ctx: SunContext): SunSummary {
    return computeSunExposure(state, ctx);
  },
};

export type IndicatorsApi = typeof api;

Comlink.expose(api);
