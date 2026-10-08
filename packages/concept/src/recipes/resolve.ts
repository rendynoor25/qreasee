import type { ProgramItem, ProgramQuality } from "@qreasee/shared";
import { evalCondition, evalExpr } from "./expr";
import type { Assumption, Recipe, ResolvedProgramItem, ResolvedRecipe } from "./types";

export const GROUP_COLORS: Record<string, string> = {
  Public: "#f0913b",
  "Semi-private": "#f3a85f",
  Private: "#5eead4",
  Wet: "#60a5fa",
  Service: "#c084fc",
  Outdoor: "#4ade80",
  Circulation: "#94a3b8",
};

export function groupColor(group: string): string {
  return GROUP_COLORS[group] ?? "#9aa4b2";
}

/**
 * Resolve a recipe to concrete program items with visible assumptions. Pure and
 * deterministic: the same inputs always produce the same output (ids included).
 */
export function resolveRecipe(
  recipe: Recipe,
  paramValues: Record<string, number> = {},
  addonIds: string[] = [],
  quality: ProgramQuality = "standard",
): ResolvedRecipe {
  const warnings: string[] = [];
  const params: Record<string, number> = {};
  const assumptions: Assumption[] = [];

  for (const p of recipe.params) {
    const raw = paramValues[p.key];
    let value = raw !== undefined && Number.isFinite(raw) ? raw : p.default;
    if (p.min !== undefined && value < p.min) {
      warnings.push(`${p.label.en}: ${value} is below the minimum (${p.min}); clamped.`);
      value = p.min;
    }
    if (p.max !== undefined && value > p.max) {
      warnings.push(`${p.label.en}: ${value} is above the maximum (${p.max}); clamped.`);
      value = p.max;
    }
    params[p.key] = value;
    assumptions.push({ key: p.key, label: p.label, value, unit: p.unit, basis: p.basis, note: p.note });
  }

  const addons = recipe.addons.filter((a) => addonIds.includes(a.id));
  for (const addon of addons) {
    for (const p of addon.params ?? []) {
      if (!(p.key in params)) {
        params[p.key] = p.default;
        assumptions.push({ key: p.key, label: p.label, value: p.default, unit: p.unit, basis: p.basis, note: p.note });
      }
    }
  }

  const areaScale = recipe.qualityLevels[quality]?.areaScale ?? 1;

  const rows = [...recipe.rows, ...addons.flatMap((a) => a.rows)];
  const items: ResolvedProgramItem[] = [];
  rows.forEach((row, index) => {
    if (!evalCondition(row.when, params)) return;
    const qtyRaw = row.qty ? evalExpr(row.qty, params) : 1;
    const qty = Math.max(0, Math.round(qtyRaw));
    if (qty === 0) return;
    const areaEach = evalExpr(row.areaEach, params) * areaScale;
    if (!(areaEach > 0)) {
      warnings.push(`Row "${row.name.en}" has a non-positive area; skipped.`);
      return;
    }
    items.push({
      id: `prog-${recipe.id}-${index}`,
      group: row.group,
      name: row.name,
      qty,
      areaEach,
      totalArea: qty * areaEach,
      basis: "typical",
      source: "recipe",
      recipeId: recipe.id,
      levelPref: row.levelPref,
      adjacentTo: row.adjacentTo,
      needs: row.needs,
      color: groupColor(row.group),
    });
  });

  // Resolve neighbour references (by English name) to generated ids.
  const byName = new Map<string, string>();
  for (const item of items) byName.set(item.name.en, item.id);
  for (const item of items) {
    if (!item.adjacentTo) continue;
    const ids: string[] = [];
    for (const ref of item.adjacentTo) {
      const id = byName.get(ref);
      if (id) ids.push(id);
      else warnings.push(`Row "${item.name.en}" references unknown neighbour "${ref}".`);
    }
    item.adjacentTo = ids;
  }

  return { items, assumptions, warnings };
}

/** Convert resolved recipe items into the shared ProgramItem shape. */
export function recipeItemsToProgramItems(items: readonly ResolvedProgramItem[]): ProgramItem[] {
  return items.map((item) => ({
    id: item.id,
    name: item.name.en,
    nameEn: item.name.en,
    nameId: item.name.id,
    targetArea: item.totalArea,
    group: item.group,
    qty: item.qty,
    areaEach: item.areaEach,
    levelPref: item.levelPref,
    adjacentTo: item.adjacentTo,
    needs: item.needs,
    color: item.color,
    source: item.source,
    recipeId: item.recipeId,
    basis: item.basis,
  }));
}
