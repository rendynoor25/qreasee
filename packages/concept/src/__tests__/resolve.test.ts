import { describe, expect, it } from "vitest";
import {
  RECIPES,
  getRecipe,
  recipeItemsToProgramItems,
  recipeSchema,
  resolveRecipe,
  type Recipe,
} from "../index";

const house = getRecipe("house")!;
const dorm = getRecipe("dormitory")!;

function itemNamed(items: ReturnType<typeof resolveRecipe>["items"], en: string) {
  return items.find((i) => i.name.en === en)!;
}

describe("recipes (K-00)", () => {
  it("ships house, dormitory, cafe, school", () => {
    expect(RECIPES.map((r) => r.id).sort()).toEqual(["cafe", "dormitory", "house", "school"]);
  });

  it("every recipe passes the zod schema", () => {
    for (const r of RECIPES) expect(() => recipeSchema.parse(r)).not.toThrow();
  });

  it("is deterministic: same input, identical output", () => {
    const a = resolveRecipe(house, { bedrooms: 4 }, ["prayer"], "standard");
    const b = resolveRecipe(house, { bedrooms: 4 }, ["prayer"], "standard");
    expect(a).toEqual(b);
  });

  it("house defaults: 3 bedrooms and 2 bathrooms", () => {
    const { items } = resolveRecipe(house, {}, [], "standard");
    const bed = itemNamed(items, "Bedroom");
    expect(bed.qty).toBe(3);
    expect(bed.areaEach).toBe(12);
    expect(bed.totalArea).toBe(36);
    expect(itemNamed(items, "Bathroom").qty).toBe(2);
    expect(itemNamed(items, "Living").totalArea).toBe(20);
  });

  it("changing bedrooms changes the row (hand-calculated)", () => {
    const { items } = resolveRecipe(house, { bedrooms: 5 }, [], "standard");
    expect(itemNamed(items, "Bedroom").qty).toBe(5);
    expect(itemNamed(items, "Bedroom").totalArea).toBe(60);
  });

  it("dormitory: 120 beds / 6 per room = 20 rooms; 180 beds = 30", () => {
    expect(itemNamed(resolveRecipe(dorm, {}, [], "standard").items, "Dorm room").qty).toBe(20);
    expect(itemNamed(resolveRecipe(dorm, { beds: 180 }, [], "standard").items, "Dorm room").qty).toBe(30);
  });

  it("dormitory bathrooms: ceil(120 / 8) = 15", () => {
    expect(itemNamed(resolveRecipe(dorm, {}, [], "standard").items, "Bathroom").qty).toBe(15);
  });

  it("add-ons add rows (prayer = beds * 0.8 m²)", () => {
    const { items } = resolveRecipe(dorm, { beds: 120 }, ["prayer"], "standard");
    expect(itemNamed(items, "Prayer room").totalArea).toBe(96);
  });

  it("conditional add-on row only appears when its condition holds", () => {
    expect(resolveRecipe(dorm, { beds: 120 }, ["shop"], "standard").items.some((i) => i.name.en === "Rentable shop")).toBe(true);
    expect(resolveRecipe(dorm, { beds: 40 }, ["shop"], "standard").items.some((i) => i.name.en === "Rentable shop")).toBe(false);
  });

  it("quality level scales areas (premium = 1.15)", () => {
    const { items } = resolveRecipe(house, { bedrooms: 3 }, [], "premium");
    expect(itemNamed(items, "Bedroom").areaEach).toBeCloseTo(13.8, 6);
  });

  it("lists assumptions with their basis", () => {
    const { assumptions } = resolveRecipe(dorm, {}, [], "standard");
    const beds = assumptions.find((a) => a.key === "beds")!;
    expect(beds.basis).toBe("user");
    expect(beds.value).toBe(120);
    expect(assumptions.find((a) => a.key === "bedsPerRoom")!.basis).toBe("typical");
  });

  it("clamps out-of-range parameters and warns", () => {
    const { warnings, assumptions } = resolveRecipe(house, { bedrooms: 99 }, [], "standard");
    expect(assumptions.find((a) => a.key === "bedrooms")!.value).toBe(8);
    expect(warnings.some((w) => /maximum/.test(w))).toBe(true);
  });

  it("warns on unknown neighbour references", () => {
    const custom: Recipe = {
      ...house,
      rows: [{ group: "Public", name: { en: "A", id: "A" }, qty: "1", areaEach: "10", adjacentTo: ["Nope"] }],
      addons: [],
    };
    expect(resolveRecipe(custom, {}, [], "standard").warnings.some((w) => /unknown neighbour/.test(w))).toBe(true);
  });

  it("resolves neighbour names to generated ids", () => {
    const custom: Recipe = {
      ...house,
      rows: [
        { group: "Public", name: { en: "A", id: "A" }, qty: "1", areaEach: "10", adjacentTo: ["B"] },
        { group: "Public", name: { en: "B", id: "B" }, qty: "1", areaEach: "10" },
      ],
      addons: [],
    };
    const { items } = resolveRecipe(custom, {}, [], "standard");
    expect(items[0].adjacentTo).toEqual([items[1].id]);
  });

  it("throws on a bad formula rather than crashing", () => {
    const custom: Recipe = {
      ...house,
      rows: [{ group: "Public", name: { en: "A", id: "A" }, qty: "1", areaEach: "1 / 0" }],
      addons: [],
    };
    expect(() => resolveRecipe(custom, {}, [], "standard")).toThrow(/Division by zero/);
  });

  it("converts to shared ProgramItems with source + basis", () => {
    const { items } = resolveRecipe(house, {}, [], "standard");
    const program = recipeItemsToProgramItems(items);
    const bed = program.find((p) => p.nameEn === "Bedroom")!;
    expect(bed.source).toBe("recipe");
    expect(bed.basis).toBe("typical");
    expect(bed.targetArea).toBe(36);
    expect(bed.areaEach).toBe(12);
    expect(bed.qty).toBe(3);
    expect(bed.group).toBe("Private");
  });
});
