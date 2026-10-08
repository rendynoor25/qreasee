import { z } from "zod";

const localized = z.object({ en: z.string().min(1), id: z.string().min(1) });
const basis = z.enum(["typical", "studio", "regulation", "client", "user"]);

const param = z.object({
  key: z.string().min(1),
  label: localized,
  unit: z.string().optional(),
  default: z.number(),
  min: z.number().optional(),
  max: z.number().optional(),
  basis,
  note: z.string().optional(),
});

const needs = z.object({
  daylight: z.boolean().optional(),
  ventilation: z.boolean().optional(),
  view: z.boolean().optional(),
  privacy: z.enum(["low", "med", "high"]).optional(),
  wet: z.boolean().optional(),
  outdoor: z.boolean().optional(),
});

const row = z.object({
  group: z.string().min(1),
  name: localized,
  areaEach: z.string().min(1),
  qty: z.string().optional(),
  when: z.string().optional(),
  levelPref: z.enum(["ground", "upper", "any"]).optional(),
  adjacentTo: z.array(z.string()).optional(),
  needs: needs.optional(),
});

const addon = z.object({
  id: z.string().min(1),
  label: localized,
  rows: z.array(row).min(1),
  params: z.array(param).optional(),
});

const quality = z.object({
  areaScale: z.number().positive(),
  costRateMultiplier: z.number().positive().optional(),
});

export const recipeSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  name: localized,
  buildingType: z.enum(["house", "dormitory", "cafe", "school", "custom"]),
  params: z.array(param),
  qualityLevels: z.object({ economy: quality, standard: quality, premium: quality }),
  rows: z.array(row).min(1),
  addons: z.array(addon),
  source: z.object({
    kind: z.enum(["typical", "studio", "regulation", "client"]),
    note: z.string().optional(),
    asOf: z.string().optional(),
  }),
});
