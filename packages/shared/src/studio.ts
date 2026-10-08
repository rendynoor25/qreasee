/**
 * Studio Kit (the "Brand Kit" parallel). Studio-scoped, not project-scoped, so
 * changing it never forks a project or touches the operation log. Identity is
 * referenced live (logo, palette); standards seed new projects.
 *
 * v1 scope: palette + logo + title block + default rates + default materials.
 */

import { z } from "zod";
import type { BuildingType, Id } from "./types";
import { BUILDING_TYPES, DEFAULT_RATES } from "./types";
import { DEFAULT_MATERIAL_FOR } from "./materials";

export interface StudioColor {
  name: string;
  hex: string;
}

export interface TitleBlockFields {
  studioName: string;
  address?: string;
  /** W-06: owner/client (Pemberi Tugas) and consultant (Konsultan Perencana). */
  client?: string;
  consultant?: string;
  drawnBy?: string;
  checkedBy?: string;
  approvedBy?: string;
  stageLabel?: string;
}

/**
 * W-04 pen table, in **paper millimetres** (starter values, not a standard).
 * Line weight on a drawing = penMm × the view's scale denominator.
 */
export interface PenTable {
  cut: number;
  projection: number;
  annotation: number;
  grid: number;
}

export const DEFAULT_PEN: PenTable = {
  cut: 0.35,
  projection: 0.18,
  annotation: 0.13,
  grid: 0.09,
};

export interface StudioKit {
  id: Id;
  name: string;
  identity: {
    logoUrl?: string;
    primaryColor: string;
    palette: StudioColor[];
    titleBlock: TitleBlockFields;
    sheetPrefix: "K" | "A";
    roomAbbreviations?: Record<string, string>;
  };
  standards: {
    rates: Record<BuildingType, { low: number; high: number }>;
    materials: {
      wall: string;
      partition: string;
      floor: string;
      ceiling: string;
      roof: string;
    };
    pen: PenTable;
  };
  version: number;
  updatedAt: number;
}

export const DEFAULT_STUDIO_KIT: StudioKit = {
  id: "studio-local",
  name: "My studio",
  identity: {
    primaryColor: "#f0913b",
    palette: [
      { name: "Primary", hex: "#f0913b" },
      { name: "Ink", hex: "#1c1f24" },
      { name: "Paper", hex: "#f4f4f0" },
      { name: "Green", hex: "#4f7a3a" },
      { name: "Water", hex: "#60a5fa" },
    ],
    titleBlock: { studioName: "My studio", stageLabel: "GAMBAR KONSEP" },
    sheetPrefix: "K",
  },
  standards: {
    rates: { ...DEFAULT_RATES },
    materials: {
      wall: DEFAULT_MATERIAL_FOR.wall,
      partition: DEFAULT_MATERIAL_FOR.wall,
      floor: DEFAULT_MATERIAL_FOR.floor,
      ceiling: DEFAULT_MATERIAL_FOR.ceiling,
      roof: DEFAULT_MATERIAL_FOR.roof,
    },
    pen: { ...DEFAULT_PEN },
  },
  version: 1,
  updatedAt: 0,
};

export function defaultStudioKit(): StudioKit {
  return JSON.parse(JSON.stringify(DEFAULT_STUDIO_KIT)) as StudioKit;
}

/** Fill missing fields from the defaults so an old/partial kit still loads. */
export function normalizeStudioKit(kit: Partial<StudioKit> | null | undefined): StudioKit {
  const d = defaultStudioKit();
  if (!kit) return d;
  const rates = { ...d.standards.rates };
  for (const t of BUILDING_TYPES) {
    const r = kit.standards?.rates?.[t];
    if (r && r.low > 0 && r.high > 0) rates[t] = { low: r.low, high: r.high };
  }
  return {
    ...d,
    ...kit,
    id: kit.id ?? d.id,
    name: kit.name ?? d.name,
    identity: {
      ...d.identity,
      ...kit.identity,
      titleBlock: { ...d.identity.titleBlock, ...kit.identity?.titleBlock },
      palette: kit.identity?.palette?.length ? kit.identity.palette : d.identity.palette,
      sheetPrefix: kit.identity?.sheetPrefix ?? d.identity.sheetPrefix,
    },
    standards: {
      rates,
      materials: { ...d.standards.materials, ...kit.standards?.materials },
      pen: { ...d.standards.pen, ...kit.standards?.pen },
    },
    version: kit.version ?? d.version,
    updatedAt: kit.updatedAt ?? 0,
  };
}

export const studioColorSchema = z.object({ name: z.string(), hex: z.string() });

export const studioKitSchema = z.object({
  id: z.string(),
  name: z.string(),
  identity: z.object({
    logoUrl: z.string().optional(),
    primaryColor: z.string(),
    palette: z.array(studioColorSchema),
    titleBlock: z.object({
      studioName: z.string(),
      address: z.string().optional(),
      client: z.string().optional(),
      consultant: z.string().optional(),
      drawnBy: z.string().optional(),
      checkedBy: z.string().optional(),
      approvedBy: z.string().optional(),
      stageLabel: z.string().optional(),
    }),
    sheetPrefix: z.enum(["K", "A"]),
    roomAbbreviations: z.record(z.string()).optional(),
  }),
  standards: z.object({
    rates: z.record(z.object({ low: z.number(), high: z.number() })),
    materials: z.object({
      wall: z.string(),
      partition: z.string(),
      floor: z.string(),
      ceiling: z.string(),
      roof: z.string(),
    }),
    pen: z.object({
      cut: z.number(),
      projection: z.number(),
      annotation: z.number(),
      grid: z.number(),
    }),
  }),
  version: z.number(),
  updatedAt: z.number(),
});
