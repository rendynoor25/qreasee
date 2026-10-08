import type { Point } from "@qreasee/shared";
import { translatePolygon } from "@qreasee/geometry";
import type { Polygon } from "@qreasee/shared";

export interface ContextBuilding {
  id: string;
  outer: Point[];
  heightMm: number;
  name?: string;
  levels?: number;
}

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const M_PER_DEG = 111_320;

/**
 * Project a WGS84 lat/lng into model millimetres relative to the project origin,
 * rotating true north onto the project's +Y by `northAngle` (degrees clockwise).
 */
export function projectLatLng(
  lat: number,
  lng: number,
  originLat: number,
  originLng: number,
  northAngle: number,
): Point {
  const mPerDegLon = M_PER_DEG * Math.cos((originLat * Math.PI) / 180);
  const east = (lng - originLng) * mPerDegLon;
  const north = (lat - originLat) * M_PER_DEG;
  const a = (northAngle * Math.PI) / 180;
  return {
    x: (east * Math.cos(a) + north * Math.sin(a)) * 1000,
    y: (-east * Math.sin(a) + north * Math.cos(a)) * 1000,
  };
}

/** Inverse of projectLatLng: model millimetres back to WGS84. */export function unprojectToLatLng(
  p: Point,
  originLat: number,
  originLng: number,
  northAngle: number,
): { lat: number; lng: number } {
  const a = (northAngle * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const xm = p.x / 1000;
  const ym = p.y / 1000;
  const east = c * xm - s * ym;
  const north = s * xm + c * ym;
  const mPerDegLon = M_PER_DEG * Math.cos((originLat * Math.PI) / 180);
  return { lat: originLat + north / M_PER_DEG, lng: originLng + east / mPerDegLon };
}

function parseHeightMm(tags: Record<string, string>): number {
  const raw = tags.height ?? tags["building:height"];
  if (raw) {
    const n = Number.parseFloat(String(raw).replace(",", "."));
    if (Number.isFinite(n) && n > 1) return n * 1000;
  }
  const levels = Number.parseFloat(tags["building:levels"]);
  if (Number.isFinite(levels) && levels > 0) return levels * 3200 + 600;
  return 9000;
}

export interface FetchOsmOptions {
  lat: number;
  lng: number;
  northAngle: number;
  radiusM?: number;
  signal?: AbortSignal;
}

/**
 * Fetch surrounding building footprints from OpenStreetMap (Overpass API) and
 * project them into the model. Returns at most 500 buildings.
 */
export async function fetchOsmBuildings(opts: FetchOsmOptions): Promise<ContextBuilding[]> {
  const radius = Math.min(Math.max(opts.radiusM ?? 220, 60), 800);
  const query = `[out:json][timeout:25];(way["building"](around:${radius},${opts.lat},${opts.lng}););out body geom;`;
  let lastError: unknown = null;

  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: opts.signal,
      });
      if (!res.ok) throw new Error(`Overpass responded ${res.status}`);
      const data = (await res.json()) as {
        elements?: Array<{
          type: string;
          id: number;
          geometry?: Array<{ lat: number; lon: number }>;
          tags?: Record<string, string>;
        }>;
      };
      return parseElements(data.elements ?? [], opts);
    } catch (err) {
      lastError = err;
      if (opts.signal?.aborted) throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Overpass request failed");
}

function parseElements(
  elements: Array<{
    type: string;
    id: number;
    geometry?: Array<{ lat: number; lon: number }>;
    tags?: Record<string, string>;
  }>,
  opts: FetchOsmOptions,
): ContextBuilding[] {
  const out: ContextBuilding[] = [];
  for (const el of elements) {
    if (el.type !== "way" || !el.geometry || el.geometry.length < 4) continue;
    const tags = el.tags ?? {};
    if (!tags.building) continue;
    const outer = el.geometry.map((g) =>
      projectLatLng(g.lat, g.lon, opts.lat, opts.lng, opts.northAngle),
    );
    while (
      outer.length > 1 &&
      Math.hypot(outer[0].x - outer[outer.length - 1].x, outer[0].y - outer[outer.length - 1].y) < 20
    ) {
      outer.pop();
    }
    if (outer.length < 3) continue;
    const levels = Number.parseFloat(tags["building:levels"]);
    out.push({
      id: `osm-${el.id}`,
      outer,
      heightMm: parseHeightMm(tags),
      name: tags.name,
      levels: Number.isFinite(levels) ? levels : undefined,
    });
    if (out.length >= 500) break;
  }
  return out;
}

/** Convert a context building to a footprint polygon centred on the origin. */
export function contextFootprint(building: ContextBuilding): Polygon {
  return translatePolygon({ outer: building.outer, holes: [] }, 0, 0);
}

export interface PlaceResult {
  displayName: string;
  lat: number;
  lng: number;
}

/**
 * A-03: place lookup via OpenStreetMap's Nominatim. Called only on submit (not
 * per keystroke) to respect the usage policy (max ~1 req/s, no bulk geocoding,
 * attribution required). Alternatives evaluated in docs/DECISIONS.md.
 */
export async function searchPlaces(query: string, limit = 5): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=${limit}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
  return data.map((d) => ({
    displayName: d.display_name,
    lat: Number(d.lat),
    lng: Number(d.lon),
  }));
}
