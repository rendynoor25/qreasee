/**
 * Common building materials for schematic design in Indonesia. Categories follow
 * the Wikipedia "List of building materials" taxonomy (masonry, concrete, ceramic
 * tile, gypsum board, terrazzo, roofing, wood, glass, metals).
 *
 * Colours are representative base colours for massing/schematic rendering, not
 * exact product colours. No prices or quantities (BoQ/OTTV are out of scope).
 */

import libraryJson from "./materialLibrary.json";
import qreaseeJson from "./qreaseeMaterials.json";

export type MaterialCategory =
  | "wall"
  | "floor"
  | "ceiling"
  | "roof"
  | "structure"
  | "glass"
  | "metal"
  | "wood";

export interface Material {
  id: string;
  name: { en: string; id: string };
  category: MaterialCategory;
  /** Base colour for schematic rendering. */
  color: string;
  roughness: number;
  metalness?: number;
  opacity?: number;
  note?: string;
  /** Texture image URL (relative to the app base), served from public/materials. */
  texture?: string;
  /** Physical size of one texture tile in mm, used for planar UV mapping. */
  textureScaleMm?: number;
  /** Product family from the sample library (HPL Pattern, Paint, Tiles, …). */
  group?: string;
  brand?: string;
}

export const MATERIALS: Material[] = [
  // --- Walls ---------------------------------------------------------------
  { id: "wall-brick-paint", name: { en: "Painted brick wall", id: "Dinding bata diplester & dicat" }, category: "wall", color: "#e8e4dc", roughness: 0.92 },
  { id: "wall-aac", name: { en: "AAC block (Hebel)", id: "Bata ringan (hebel)" }, category: "wall", color: "#dedcd6", roughness: 0.9 },
  { id: "wall-concrete-block", name: { en: "Concrete block (batako)", id: "Batako" }, category: "wall", color: "#cfcfc9", roughness: 0.92 },
  { id: "wall-concrete-exposed", name: { en: "Exposed concrete", id: "Beton ekspos" }, category: "wall", color: "#b9b9b5", roughness: 0.85 },
  { id: "wall-tile", name: { en: "Wall tile", id: "Keramik dinding" }, category: "wall", color: "#dfe7ea", roughness: 0.35 },
  { id: "wall-natural-stone", name: { en: "Natural stone", id: "Batu alam" }, category: "wall", color: "#9a938a", roughness: 0.95 },
  { id: "wall-wood-panel", name: { en: "Wood panel", id: "Panel kayu" }, category: "wall", color: "#a9793f", roughness: 0.7 },
  { id: "wall-paint-white", name: { en: "White paint", id: "Cat putih" }, category: "wall", color: "#f4f4f0", roughness: 0.88 },
  { id: "wall-paint-warm", name: { en: "Warm neutral paint", id: "Cat netral hangat" }, category: "wall", color: "#e7d8c2", roughness: 0.88 },

  // --- Floors --------------------------------------------------------------
  { id: "floor-ceramic", name: { en: "Ceramic tile", id: "Keramik" }, category: "floor", color: "#d9d2c6", roughness: 0.4 },
  { id: "floor-granite", name: { en: "Granite / homogeneous tile", id: "Granit / homogenous tile" }, category: "floor", color: "#cfc8bd", roughness: 0.25 },
  { id: "floor-terrazzo", name: { en: "Terrazzo", id: "Teraso" }, category: "floor", color: "#d8d3c8", roughness: 0.3 },
  { id: "floor-wood", name: { en: "Wood parquet", id: "Parket kayu" }, category: "floor", color: "#a9793f", roughness: 0.55 },
  { id: "floor-vinyl", name: { en: "Vinyl", id: "Vinyl" }, category: "floor", color: "#c9c4ba", roughness: 0.5 },
  { id: "floor-concrete", name: { en: "Concrete floor", id: "Lantai beton" }, category: "floor", color: "#b6b3ad", roughness: 0.9 },
  { id: "floor-stone", name: { en: "Natural stone floor", id: "Lantai batu alam" }, category: "floor", color: "#9a938a", roughness: 0.9 },

  // --- Ceilings ------------------------------------------------------------
  { id: "ceiling-gypsum", name: { en: "Gypsum board", id: "Plafon gypsum" }, category: "ceiling", color: "#f2f2ee", roughness: 0.9 },
  { id: "ceiling-grc", name: { en: "GRC board", id: "Papan GRC" }, category: "ceiling", color: "#e6e6e0", roughness: 0.9 },
  { id: "ceiling-pvc", name: { en: "PVC ceiling", id: "Plafon PVC" }, category: "ceiling", color: "#eceff1", roughness: 0.45 },
  { id: "ceiling-concrete", name: { en: "Exposed concrete slab", id: "Plat beton ekspos" }, category: "ceiling", color: "#b9b9b5", roughness: 0.85 },

  // --- Roofs ---------------------------------------------------------------
  { id: "roof-concrete-tile", name: { en: "Concrete roof tile", id: "Genteng beton" }, category: "roof", color: "#a25a3c", roughness: 0.85 },
  { id: "roof-ceramic-tile", name: { en: "Ceramic roof tile", id: "Genteng keramik" }, category: "roof", color: "#8a4a32", roughness: 0.65 },
  { id: "roof-clay-tile", name: { en: "Clay roof tile", id: "Genteng tanah liat" }, category: "roof", color: "#b06a44", roughness: 0.9 },
  { id: "roof-metal", name: { en: "Metal roof (spandek)", id: "Atap metal (spandek)" }, category: "roof", color: "#9aa1a8", roughness: 0.45, metalness: 0.35 },
  { id: "roof-asphalt", name: { en: "Asphalt shingle", id: "Atap bitumen" }, category: "roof", color: "#4a4a4e", roughness: 0.9 },
  { id: "roof-green", name: { en: "Green roof", id: "Atap hijau" }, category: "roof", color: "#4f7a3a", roughness: 0.95 },

  // --- Structure / glass / metal / wood -----------------------------------
  { id: "structure-concrete", name: { en: "Reinforced concrete", id: "Beton bertulang" }, category: "structure", color: "#b9b9b5", roughness: 0.85 },
  { id: "structure-steel", name: { en: "Structural steel", id: "Baja struktural" }, category: "structure", color: "#8b9199", roughness: 0.4, metalness: 0.7 },
  { id: "structure-timber", name: { en: "Timber", id: "Kayu" }, category: "structure", color: "#8a5a2b", roughness: 0.7 },
  { id: "glass-clear", name: { en: "Clear glass", id: "Kaca bening" }, category: "glass", color: "#bcd7e6", roughness: 0.08, opacity: 0.35 },
  { id: "glass-tempered", name: { en: "Tempered glass", id: "Kaca tempered" }, category: "glass", color: "#9fc4d8", roughness: 0.1, opacity: 0.42 },
  { id: "metal-aluminium", name: { en: "Aluminium", id: "Aluminium" }, category: "metal", color: "#b9bfc6", roughness: 0.35, metalness: 0.6 },
  { id: "metal-steel", name: { en: "Steel", id: "Baja" }, category: "metal", color: "#8b9199", roughness: 0.4, metalness: 0.7 },
  { id: "wood-teak", name: { en: "Teak", id: "Kayu jati" }, category: "wood", color: "#8a5a2b", roughness: 0.55 },
  { id: "wood-plywood", name: { en: "Plywood", id: "Triplek" }, category: "wood", color: "#c8a06a", roughness: 0.7 },
];

const BY_ID = new Map(MATERIALS.map((m) => [m.id, m]));

// --- Qreasee's own material library -----------------------------------------
// Brand-free textures curated from the local sample library, plus generated
// grass and glass. Built by scripts/build-qreasee-materials.ps1.

interface QreaseeEntry {
  id: string;
  name: { en: string; id: string };
  category: MaterialCategory;
  color: string;
  roughness: number;
  opacity: number;
  texture: string;
  textureScaleMm: number;
}

export const QREASEE_MATERIALS: Material[] = (qreaseeJson.materials as QreaseeEntry[]).map((e) => ({
  id: e.id,
  name: e.name,
  category: e.category,
  color: e.color,
  roughness: e.roughness,
  opacity: e.opacity === 1 ? undefined : e.opacity,
  texture: e.texture,
  textureScaleMm: e.textureScaleMm,
  group: "Qreasee",
}));

for (const m of QREASEE_MATERIALS) if (!BY_ID.has(m.id)) BY_ID.set(m.id, m);

// --- Sample material library ------------------------------------------------
// Generated from a local product library by scripts/build-material-library.ps1:
// textures are copied to apps/web/public/materials, metadata to the JSON below.

interface LibraryEntry {
  id: string;
  name: string;
  group: string;
  brand: string;
  category: MaterialCategory;
  tags: string[];
  texture: string;
  color: string;
  roughness: number;
  textureScaleMm: number;
}

export const MATERIAL_LIBRARY: Material[] = (libraryJson.materials as LibraryEntry[]).map((e) => ({
  id: e.id,
  name: { en: e.name, id: e.name },
  category: e.category,
  color: e.color,
  roughness: e.roughness,
  texture: e.texture,
  textureScaleMm: e.textureScaleMm,
  group: e.group,
  brand: e.brand,
  note: [e.brand, e.group].filter(Boolean).join(" · "),
}));

for (const m of MATERIAL_LIBRARY) if (!BY_ID.has(m.id)) BY_ID.set(m.id, m);

export function materialById(id: string | undefined): Material | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function materialsByCategory(category: MaterialCategory): Material[] {
  return [...MATERIALS, ...QREASEE_MATERIALS].filter((m) => m.category === category);
}

/** Distinct library groups with counts, largest first (for the picker filter). */
export function materialGroups(): Array<{ group: string; count: number }> {
  const counts = new Map<string, number>();
  for (const m of MATERIAL_LIBRARY) {
    const g = m.group ?? "Other";
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([group, count]) => ({ group, count }))
    .sort((a, b) => b.count - a.count || a.group.localeCompare(b.group));
}

/** Search the library by name/brand/group; optionally filtered to one group. */
export function searchMaterialLibrary(
  query: string,
  group?: string,
  limit = 240,
): Material[] {
  const q = query.trim().toLowerCase();
  const out: Material[] = [];
  for (const m of MATERIAL_LIBRARY) {
    if (group && m.group !== group) continue;
    if (q && !`${m.name.en} ${m.brand ?? ""} ${m.group ?? ""}`.toLowerCase().includes(q)) continue;
    out.push(m);
    if (out.length >= limit) break;
  }
  return out;
}

export const DEFAULT_MATERIAL_FOR: Record<"wall" | "floor" | "ceiling" | "roof", string> = {
  wall: "wall-brick-paint",
  floor: "floor-ceramic",
  ceiling: "ceiling-gypsum",
  roof: "roof-concrete-tile",
};

export function materialColor(id: string | undefined, fallback: string): string {
  return materialById(id)?.color ?? fallback;
}
