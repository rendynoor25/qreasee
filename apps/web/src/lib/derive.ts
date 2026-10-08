import { polygonAreaMm2 } from "@qreasee/geometry";
import type { DocState, Mass } from "@qreasee/shared";
import { siteAreaMm2 as siteArea, greenAreaMm2 } from "@qreasee/indicators";

export function siteAreaMm2(state: DocState): number {
  return siteArea(state);
}

export function massAreaMm2(mass: Mass): number {
  return polygonAreaMm2(mass.footprint);
}

export function greenArea(state: DocState): number {
  return greenAreaMm2(state);
}
