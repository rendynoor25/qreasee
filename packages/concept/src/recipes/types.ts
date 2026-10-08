/**
 * v4.2 K-00: program recipes. A recipe is a small deterministic data file with
 * parameterised formulas; resolving it produces program rows and the
 * "assumptions" the user can see and edit. No AI, no hidden numbers: every
 * numeric default carries a `basis` and recipes ship `source.note`.
 */

import type { ProgramNeeds, ProgramQuality, ProgramSource } from "@qreasee/shared";

export interface Localized {
  en: string;
  id: string;
}

export type RecipeBasis = "typical" | "studio" | "regulation" | "client" | "user";

export interface RecipeParam {
  key: string;
  label: Localized;
  unit?: string;
  default: number;
  min?: number;
  max?: number;
  basis: RecipeBasis;
  note?: string;
}

export interface RecipeRow {
  group: string;
  name: Localized;
  /** Safe expression in m²; e.g. "bedsPerRoom * areaPerBed". */
  areaEach: string;
  /** Safe expression; default "1". */
  qty?: string;
  /** Safe boolean expression; the row is included only when truthy. */
  when?: string;
  levelPref?: "ground" | "upper" | "any";
  adjacentTo?: string[];
  needs?: ProgramNeeds;
}

export interface RecipeAddon {
  id: string;
  label: Localized;
  rows: RecipeRow[];
  params?: RecipeParam[];
}

export interface Recipe {
  id: string;
  version: number;
  name: Localized;
  buildingType: "house" | "dormitory" | "cafe" | "school" | "custom";
  params: RecipeParam[];
  qualityLevels: Record<ProgramQuality, { areaScale: number; costRateMultiplier?: number }>;
  rows: RecipeRow[];
  addons: RecipeAddon[];
  source: {
    kind: "typical" | "studio" | "regulation" | "client";
    note?: string;
    asOf?: string;
  };
}

export interface Assumption {
  key: string;
  label: Localized;
  value: number;
  unit?: string;
  basis: RecipeBasis;
  note?: string;
}

export interface ResolvedRecipe {
  items: ResolvedProgramItem[];
  assumptions: Assumption[];
  warnings: string[];
}

export interface ResolvedProgramItem {
  id: string;
  group: string;
  name: Localized;
  qty: number;
  areaEach: number;
  totalArea: number;
  basis: RecipeBasis;
  source: ProgramSource;
  recipeId: string;
  levelPref?: "ground" | "upper" | "any";
  adjacentTo?: string[];
  needs?: ProgramNeeds;
  color?: string;
}
