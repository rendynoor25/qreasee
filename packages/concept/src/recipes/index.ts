import { recipeSchema } from "./schema";
import house from "./data/house.json";
import dormitory from "./data/dormitory.json";
import cafe from "./data/cafe.json";
import school from "./data/school.json";
import type { Recipe } from "./types";

export * from "./types";
export * from "./expr";
export * from "./resolve";
export { recipeSchema } from "./schema";

/** Parsed + validated at module load so a bad recipe fails loudly in tests. */
export const RECIPES: Recipe[] = [house, dormitory, cafe, school].map(
  (r) => recipeSchema.parse(r) as unknown as Recipe,
);

export function getRecipe(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

export function recipesForBuildingType(type: Recipe["buildingType"]): Recipe[] {
  return RECIPES.filter((r) => r.buildingType === type);
}
