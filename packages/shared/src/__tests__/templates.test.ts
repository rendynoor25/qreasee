import { describe, expect, it } from "vitest";
import { STARTER_TEMPLATES, TEMPLATE_IDS, getTemplate, starterTemplateSchema } from "../index";

describe("starter templates (A-02)", () => {
  it("ships the four expected templates", () => {
    expect(STARTER_TEMPLATES.map((t) => t.id).sort()).toEqual([...TEMPLATE_IDS].sort());
  });

  it("each template passes the schema (parse throws otherwise)", () => {
    for (const id of TEMPLATE_IDS) {
      const t = getTemplate(id);
      expect(t, `template ${id} missing`).toBeDefined();
      expect(() => starterTemplateSchema.parse(t)).not.toThrow();
    }
  });

  it("has bilingual names/descriptions/briefs and positive program areas", () => {
    for (const t of STARTER_TEMPLATES) {
      expect(t.name.en.length).toBeGreaterThan(0);
      expect(t.name.id.length).toBeGreaterThan(0);
      expect(t.description.en.length).toBeGreaterThan(0);
      expect(t.brief.en.length).toBeGreaterThan(0);
      expect(t.program.length).toBeGreaterThan(0);
      for (const p of t.program) {
        expect(p.targetArea).toBeGreaterThan(0);
      }
      expect(t.ratePerM2.high).toBeGreaterThanOrEqual(t.ratePerM2.low);
      expect(t.site.widthM).toBeGreaterThan(0);
      expect(t.site.depthM).toBeGreaterThan(0);
    }
  });

  it("does not invent legal rules (templates carry only program/brief/rates)", () => {
    for (const t of STARTER_TEMPLATES) {
      expect(Object.keys(t)).not.toContain("rules");
      expect(Object.keys(t)).not.toContain("kdbMax");
    }
  });
});
