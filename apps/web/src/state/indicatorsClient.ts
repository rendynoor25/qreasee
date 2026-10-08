import * as Comlink from "comlink";
import { computeIndicators, computeSunExposure, type ComputeOptions, type SunContext, type SunSummary } from "@qreasee/indicators";
import type { DocState, IndicatorResult } from "@qreasee/shared";
import type { IndicatorsApi } from "./indicators.worker";

/**
 * IN-01: indicators run in a Web Worker so sketching never stutters. Falls back
 * to the main thread if workers are unavailable (e.g. tests).
 */

let remote: Comlink.Remote<IndicatorsApi> | null = null;
let failed = false;

function getRemote(): Comlink.Remote<IndicatorsApi> | null {
  if (failed || typeof Worker === "undefined") return null;
  if (!remote) {
    try {
      const worker = new Worker(new URL("./indicators.worker.ts", import.meta.url), {
        type: "module",
      });
      remote = Comlink.wrap<IndicatorsApi>(worker);
    } catch {
      failed = true;
      return null;
    }
  }
  return remote;
}

export async function computeIndicatorsAsync(
  state: DocState,
  opts: ComputeOptions,
): Promise<IndicatorResult[]> {
  const r = getRemote();
  if (!r) return computeIndicators(state, opts);
  try {
    return await r.compute(state, opts);
  } catch {
    return computeIndicators(state, opts);
  }
}

export async function computeSunAsync(
  state: DocState,
  ctx: SunContext,
): Promise<SunSummary> {
  const r = getRemote();
  if (!r) return computeSunExposure(state, ctx);
  try {
    return await r.sun(state, ctx);
  } catch {
    return computeSunExposure(state, ctx);
  }
}
