/**
 * Starter templates (Direction v4, A-02). Data-driven programs with realistic
 * target areas for small Indonesian studios. These are *starting points only*:
 * they never invent legal rules — rule fields stay empty until the user enters
 * them (invariant: no required field, never fabricate regulation).
 */

import { z } from "zod";
import house from "./templates/house.json";
import cafe from "./templates/cafe.json";
import school from "./templates/school.json";
import dormitory from "./templates/dormitory.json";

export type TemplateId = "house" | "cafe" | "school" | "dormitory";
export const TEMPLATE_IDS: TemplateId[] = ["house", "cafe", "school", "dormitory"];

const localized = z.object({ en: z.string().min(1), id: z.string().min(1) });

export const starterTemplateSchema = z
  .object({
    id: z.enum(["house", "cafe", "school", "dormitory"]),
    name: localized,
    description: localized,
    brief: localized,
    buildingType: z.enum([
      "house",
      "shophouse",
      "cafe",
      "small-office",
      "retail-fitout",
      "renovation",
    ]),
    program: z
      .array(z.object({ name: z.string().min(1), targetArea: z.number().positive() }))
      .min(1),
    ratePerM2: z.object({ low: z.number().positive(), high: z.number().positive() }),
    site: z.object({ widthM: z.number().positive(), depthM: z.number().positive() }),
  })
  .refine((t) => t.ratePerM2.high >= t.ratePerM2.low, {
    message: "ratePerM2.high must be >= low",
    path: ["ratePerM2"],
  });

export type StarterTemplate = z.infer<typeof starterTemplateSchema>;

/** Parsed + validated at module load so a bad template fails loudly in tests. */
export const STARTER_TEMPLATES: StarterTemplate[] = [
  house,
  cafe,
  school,
  dormitory,
].map((t) => starterTemplateSchema.parse(t));

export function getTemplate(id: TemplateId): StarterTemplate | undefined {
  return STARTER_TEMPLATES.find((t) => t.id === id);
}
