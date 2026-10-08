/**
 * W-02: render a view's drawing from the document. Plans are filtered to one
 * storey; sections and elevations span all levels. Reuses the pure generators in
 * `@qreasee/schematic`.
 */

import type { GridLine, Level } from "@qreasee/shared";
import { DEFAULT_PEN, sectionMarks } from "@qreasee/shared";
import { elevationSvg, planSvg, sectionSvg, type SectionLine } from "@qreasee/schematic";
import { schematicForLevel, useApp } from "../state/store";

export interface DrawingContext {
  grids?: GridLine[];
  levels?: Level[];
}

export function drawingSvgFor(
  kind: string,
  sectionLine: SectionLine | null | undefined,
  ctx: DrawingContext,
  levelId?: string | null,
): string | null {
  const state = useApp.getState();
  // W-04: pen weights come from the Studio Kit; the front elevation prints at 1:50.
  const pen = state.studioKit.standards.pen ?? DEFAULT_PEN;
  const scale = kind === "elevation" ? 50 : 100;
  // W-05: section marks carry the sheet number the section view is placed on.
  const sections =
    kind === "plan"
      ? sectionMarks(state.docState).map((m) => ({
          name: m.name,
          line: m.line,
          sheetNumber: m.sheetNumber,
        }))
      : undefined;
  const drawCtx = {
    ...ctx,
    pen,
    scale,
    annotations: state.annotations,
    northAngle: state.project.northAngle,
    sections,
    // Part 2 §2: `?debugPlan=1` draws the alignment overlay (never printed).
    debug: typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debugPlan"),
    dimTextMm: state.dimTextMm,
  };
  const sch = schematicForLevel(kind === "plan" ? levelId ?? undefined : undefined);
  if (!sch) return null;
  if (kind === "plan") return planSvg(sch, sectionLine ?? undefined, drawCtx);
  if (kind === "elevation") return elevationSvg(sch, drawCtx);
  if (kind === "section") return sectionSvg(sch, sectionLine ?? undefined, drawCtx);
  return null;
}
