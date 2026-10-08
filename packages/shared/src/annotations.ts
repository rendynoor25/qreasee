/**
 * W-05: annotation data derived from the model. A section view knows the sheet it
 * is placed on, so a plan can draw a section mark that references the right sheet
 * (e.g. "A105") and keep it correct when views move between sheets.
 */

import type { DocState, Point } from "./types";

export interface SectionMark {
  viewId: string;
  name: string;
  line: { a: Point; b: Point };
  /** The sheet number the section view is placed on, if any. */
  sheetNumber?: string;
}

/** Every section view with its plan line and the sheet number it appears on. */
export function sectionMarks(state: DocState): SectionMark[] {
  const sheetByView = new Map<string, string>();
  for (const sheet of state.sheets) {
    for (const item of sheet.items) {
      if (item.kind === "view") sheetByView.set(item.viewId, sheet.number);
    }
  }
  const out: SectionMark[] = [];
  for (const v of state.views) {
    if (v.kind !== "section" || !v.line) continue;
    out.push({
      viewId: v.id,
      name: v.name,
      line: { a: v.line.a, b: v.line.b },
      sheetNumber: sheetByView.get(v.id),
    });
  }
  return out;
}
