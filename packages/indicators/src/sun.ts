/**
 * Sun exposure (PRD 9.4). For each vertical exterior face, average direct-sun
 * hours across 21 March, 21 June and 21 December, sampling every 30 minutes
 * between sunrise and sunset at the site location, corrected by the north angle.
 *
 * MVP ignores shading by other masses and neighbours (P1).
 */

import SunCalc from "suncalc";
import type { DocState, Id, Mass } from "@qreasee/shared";
import { extrudePolygon } from "@qreasee/geometry";
import { massBaseElevation } from "./areas";

export interface SunContext {
  lat: number;
  lng: number;
  /** Degrees clockwise from model +Y to true north. */
  northAngle: number;
}

export interface FaceSunExposure {
  massId: Id;
  faceIndex: number;
  hours: number;
  /** Compass bearing of the outward normal, degrees clockwise from true north. */
  bearing: number;
  areaMm2: number;
}

export interface SunSummary {
  faces: FaceSunExposure[];
  /** Facade area split by exposure (PRD 9.4). */
  lowAreaMm2: number;
  mediumAreaMm2: number;
  highAreaMm2: number;
  /** Share of high-exposure area on east- and west-facing faces. */
  highShareOnEastWest: number;
}

const DAYS = [
  [2, 21],
  [5, 21],
  [11, 21],
] as const; // March, June, December
const SAMPLE_MINUTES = 30;
const SAMPLE_HOURS = SAMPLE_MINUTES / 60;

const normalize360 = (deg: number) => ((deg % 360) + 360) % 360;

/** Sunlit sample directions in model coordinates (unit horizontal vectors). */
function sunDirections(ctx: SunContext, year: number): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  const nA = ctx.northAngle;
  for (const [month, day] of DAYS) {
    const date = new Date(Date.UTC(year, month, day, 12, 0, 0));
    const times = SunCalc.getTimes(date, ctx.lat, ctx.lng);
    const sunrise = times.sunrise?.getTime() ?? NaN;
    const sunset = times.sunset?.getTime() ?? NaN;
    if (!Number.isFinite(sunrise) || !Number.isFinite(sunset) || sunset <= sunrise) continue;
    for (let t = sunrise; t <= sunset; t += SAMPLE_MINUTES * 60 * 1000) {
      const pos = SunCalc.getPosition(new Date(t), ctx.lat, ctx.lng);
      if (pos.altitude <= 0) continue;
      // SunCalc azimuth is measured from south, going west. Convert to a
      // compass bearing (clockwise from north), then to model coordinates.
      const bearing = normalize360((pos.azimuth * 180) / Math.PI + 180);
      const model = normalize360(nA + bearing);
      const rad = (model * Math.PI) / 180;
      out.push({ x: Math.sin(rad), y: Math.cos(rad) });
    }
  }
  return out;
}

export function computeSunExposure(state: DocState, ctx: SunContext): SunSummary {
  const year = new Date().getFullYear();
  const dirs = sunDirections(ctx, year);
  const faces: FaceSunExposure[] = [];

  for (const mass of state.masses) {
    faces.push(...massFaces(state, mass, ctx, dirs));
  }

  let lowAreaMm2 = 0;
  let mediumAreaMm2 = 0;
  let highAreaMm2 = 0;
  let highEastWest = 0;
  for (const f of faces) {
    const isEastWest =
      Math.abs(f.bearing - 90) <= 45 || Math.abs(f.bearing - 270) <= 45;
    if (f.hours < 2) lowAreaMm2 += f.areaMm2;
    else if (f.hours <= 4) mediumAreaMm2 += f.areaMm2;
    else {
      highAreaMm2 += f.areaMm2;
      if (isEastWest) highEastWest += f.areaMm2;
    }
  }

  return {
    faces,
    lowAreaMm2,
    mediumAreaMm2,
    highAreaMm2,
    highShareOnEastWest: highAreaMm2 > 0 ? highEastWest / highAreaMm2 : 0,
  };
}

function massFaces(
  state: DocState,
  mass: Mass,
  ctx: SunContext,
  dirs: Array<{ x: number; y: number }>,
): FaceSunExposure[] {
  const base = massBaseElevation(state, mass);
  const top = base + (mass.intent?.height?.high ?? mass.height);
  const extrusion = extrudePolygon(mass.footprint, base, top);
  const n = dirs.length || 1;
  return extrusion.walls.map((w) => {
    let lit = 0;
    for (const d of dirs) {
      if (w.normal.x * d.x + w.normal.y * d.y > 0) lit += 1;
    }
    const hours = (lit * SAMPLE_HOURS) / 3; // average across the three days
    const bearing = normalize360(
      (Math.atan2(w.normal.x, w.normal.y) * 180) / Math.PI - ctx.northAngle,
    );
    return {
      massId: mass.id,
      faceIndex: w.faceIndex,
      hours,
      bearing,
      areaMm2: w.area,
    };
  });
}
