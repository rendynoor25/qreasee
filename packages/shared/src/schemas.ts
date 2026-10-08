/**
 * Zod schemas for persisted data. Shared by client and (future) server and used
 * to validate .qrs imports (PRD 7, File format).
 */

import { z } from "zod";

export const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const polygonSchema = z.object({
  outer: z.array(pointSchema).min(3),
  holes: z.array(z.array(pointSchema)).default([]),
});

export const surfacePolygonSchema = z.object({
  id: z.string(),
  kind: z.enum(["green", "paved"]),
  points: z.array(pointSchema).min(3),
});

export const roadEdgeSchema = z.object({
  edgeIndex: z.number().int().nonnegative(),
  name: z.string().optional(),
});

export const siteSchema = z.object({
  boundary: z.array(pointSchema),
  roadEdges: z.array(roadEdgeSchema),
  greenPolygons: z.array(surfacePolygonSchema),
  pavedPolygons: z.array(surfacePolygonSchema),
});

export const rulesSchema = z.object({
  kdbMax: z.number().optional(),
  klbMax: z.number().optional(),
  kdhMin: z.number().optional(),
  heightMax: z.number().optional(),
  floorsMax: z.number().optional(),
  setbacks: z.record(z.number()),
  sourceNote: z.string().optional(),
});

export const budgetSchema = z.object({
  ceiling: z.number().optional(),
  low: z.number().optional(),
  high: z.number().optional(),
  ratePerM2: z
    .object({ low: z.number(), high: z.number() })
    .optional(),
});

export const programItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  targetArea: z.number(),
  level: z.string().optional(),
  nameId: z.string().optional(),
  nameEn: z.string().optional(),
  group: z.string().optional(),
  qty: z.number().optional(),
  areaEach: z.number().optional(),
  areaMin: z.number().optional(),
  areaMax: z.number().optional(),
  levelPref: z.union([z.literal("ground"), z.literal("upper"), z.literal("any"), z.number()]).optional(),
  adjacentTo: z.array(z.string()).optional(),
  needs: z
    .object({
      daylight: z.boolean().optional(),
      ventilation: z.boolean().optional(),
      view: z.boolean().optional(),
      privacy: z.enum(["low", "med", "high"]).optional(),
      wet: z.boolean().optional(),
      outdoor: z.boolean().optional(),
    })
    .optional(),
  color: z.string().optional(),
  notes: z.string().optional(),
  source: z.enum(["manual", "recipe", "ai", "imported", "studio"]).optional(),
  recipeId: z.string().optional(),
  basis: z.string().optional(),
  edited: z.boolean().optional(),
});

export const programSettingsSchema = z.object({
  circulationPct: z.number(),
  areaUnit: z.enum(["m2", "sqft"]),
  efficiencyNote: z.string().optional(),
  recipeBinding: z
    .object({
      recipeId: z.string(),
      version: z.number(),
      paramValues: z.record(z.number()),
      addonIds: z.array(z.string()),
      quality: z.enum(["economy", "standard", "premium"]),
    })
    .optional(),
  ownerBrief: z.string().optional(),
});

export const briefSchema = z.object({
  text: z.string(),
  program: z.array(programItemSchema),
  settings: programSettingsSchema.optional(),
});

export const levelSchema = z.object({
  id: z.string(),
  name: z.string(),
  elevation: z.number(),
  floorToFloor: z.number(),
});

export const gridLineSchema = z.object({
  id: z.string(),
  axis: z.enum(["x", "y"]),
  label: z.string(),
  offset: z.number(),
});

export const fidelitySchema = z.enum([
  "intent",
  "massing",
  "schematic",
  "detailed",
]);

export const intentRangeSchema = z.object({
  height: z.object({ low: z.number(), high: z.number() }).optional(),
  area: z.object({ low: z.number(), high: z.number() }).optional(),
});

export const massSchema = z.object({
  id: z.string(),
  levelIds: z.array(z.string()),
  footprint: polygonSchema,
  height: z.number(),
  use: z.string().optional(),
  fidelity: fidelitySchema,
  intent: intentRangeSchema.optional(),
  name: z.string().optional(),
  color: z.string().optional(),
  kind: z.enum(["building", "landscape"]).optional(),
});

export const decisionSchema = z.object({
  id: z.string(),
  title: z.string(),
  question: z.string(),
  scope: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("whole") }),
    z.object({ kind: z.literal("level"), levelId: z.string() }),
    z.object({ kind: z.literal("masses"), massIds: z.array(z.string()) }),
  ]),
  status: z.enum(["open", "deferred", "decided"]),
  revisitNote: z.string().optional(),
  createdAt: z.number(),
});

export const roomSchema = z.object({
  id: z.string(),
  levelId: z.string(),
  name: z.string(),
  programItemId: z.string().optional(),
  instanceIndex: z.number().optional(),
  fidelity: z.enum(["concept", "schematic"]),
  polygon: polygonSchema,
  areaMm2: z.number(),
  color: z.string().optional(),
  group: z.string().optional(),
  zone: z.enum(["public", "semi-private", "private", "service", "outdoor", "circulation"]).optional(),
});

export const viewSchema = z.object({
  id: z.string(),
  kind: z.enum(["plan", "elevation", "section", "3d", "render", "schedule"]),
  name: z.string(),
  system: z.boolean().optional(),
  levelId: z.string().optional(),
  direction: z.enum(["N", "E", "S", "W"]).optional(),
  line: z.object({ a: pointSchema, b: pointSchema, depth: z.number().optional() }).optional(),
  scale: z.number().optional(),
  cutPlane: z.number().nullable().optional(),
  style: z.enum(["sketch", "clean", "clay", "material"]).optional(),
  layers: z.record(z.boolean()).optional(),
  camera: z
    .object({
      position: z.tuple([z.number(), z.number(), z.number()]),
      target: z.tuple([z.number(), z.number(), z.number()]),
      zoom: z.number().optional(),
    })
    .optional(),
  crop: polygonSchema.optional(),
  createdAt: z.number(),
  by: z.string().optional(),
});

export const docStateSchema = z.object({
  site: siteSchema,
  rules: rulesSchema,
  budget: budgetSchema,
  brief: briefSchema,
  levels: z.array(levelSchema),
  grids: z.array(gridLineSchema),
  masses: z.array(massSchema),
  rooms: z.array(roomSchema).default([]),
  views: z.array(viewSchema).default([]),
  viewOverrides: z.record(viewSchema.partial()).default({}),
  decisions: z.array(decisionSchema),
  records: z.array(z.any()).default([]),
});

export type DocStateInput = z.input<typeof docStateSchema>;
