import { describe, expect, it } from "vitest";
import {
  BUILDING_TYPES,
  DEFAULT_MATERIAL_FOR,
  DEFAULT_STUDIO_KIT,
  defaultStudioKit,
  normalizeStudioKit,
  studioKitSchema,
  type StudioKit,
} from "../index";

describe("Studio Kit", () => {
  it("ships a complete default kit", () => {
    const kit = defaultStudioKit();
    expect(kit.identity.primaryColor).toMatch(/^#/);
    expect(kit.identity.palette.length).toBeGreaterThan(0);
    expect(kit.standards.materials.wall).toBe(DEFAULT_MATERIAL_FOR.wall);
    for (const t of BUILDING_TYPES) {
      expect(kit.standards.rates[t].low).toBeGreaterThan(0);
      expect(kit.standards.rates[t].high).toBeGreaterThanOrEqual(kit.standards.rates[t].low);
    }
  });

  it("fills missing fields from the defaults (old kit still loads)", () => {
    // An old/partial kit arrives from storage as untyped JSON.
    const partial = { id: "s1", name: "Kalua", identity: { primaryColor: "#123456" } } as Partial<StudioKit>;
    const kit = normalizeStudioKit(partial);
    expect(kit.name).toBe("Kalua");
    expect(kit.identity.primaryColor).toBe("#123456");
    expect(kit.identity.palette.length).toBeGreaterThan(0);
    expect(kit.standards.rates.house.low).toBe(DEFAULT_STUDIO_KIT.standards.rates.house.low);
    expect(kit.identity.sheetPrefix).toBe("K");
  });

  it("returns a fresh copy (mutating one kit does not touch the default)", () => {
    const a = defaultStudioKit();
    a.identity.palette.push({ name: "Extra", hex: "#000000" });
    a.standards.materials.wall = "wall-aac";
    const b = defaultStudioKit();
    expect(b.identity.palette.length).toBe(DEFAULT_STUDIO_KIT.identity.palette.length);
    expect(b.standards.materials.wall).toBe(DEFAULT_STUDIO_KIT.standards.materials.wall);
  });

  it("a normalized kit satisfies the schema", () => {
    expect(studioKitSchema.safeParse(normalizeStudioKit(null)).success).toBe(true);
  });
});
