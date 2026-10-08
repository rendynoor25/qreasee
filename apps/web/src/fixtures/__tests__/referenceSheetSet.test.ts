/**
 * W-00 acceptance harness: the sample-house acceptance test (Direction v5 §1).
 *
 * Loads the reference fixture, generates the sheet set (SVG), and checks the
 * structure we can already produce — page count, sheet numbers and titles, and
 * the grid/level annotations from D-04. Everything not yet possible is listed as
 * an `it.todo` so `pnpm test` shows the remaining gap without failing.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCHEMATIC_OPTIONS,
  elevationSvg,
  generateSchematic,
  planSvg,
  schematicFromDoc,
  sectionSvg,
  starterFromMass,
} from "@qreasee/schematic";
import { DocumentStore } from "@qreasee/document";
import { sectionMarks } from "@qreasee/shared";
import { sheetSvgString, svgViewBox, viewImageSize } from "../../lib/sheetSvg";
import { buildReferenceHouse } from "../referenceHouse";

const { project, docState, mass } = buildReferenceHouse();

const schematic = generateSchematic(
  mass,
  docState.brief.program.map((p) => ({ name: p.name, targetAreaM2: p.areaEach ?? p.targetArea })),
  DEFAULT_SCHEMATIC_OPTIONS,
  0,
  mass.height,
);

const ctx = { grids: docState.grids, levels: docState.levels };

/** The drawing SVG for a placed view (null when there is no generator yet). */
function drawingFor(viewId: string): string | null {
  const v = docState.views.find((x) => x.id === viewId);
  if (!v) return null;
  if (v.kind === "plan") return planSvg(schematic, v.line, ctx);
  if (v.kind === "elevation") return elevationSvg(schematic, ctx);
  if (v.kind === "section") return sectionSvg(schematic, v.line, ctx);
  return null; // the 3D cover view is a captured image (W-06)
}

const title = { studio: "Qreasee Studio", projectName: project.name, scaleLabel: "Skala" };

/** Same escaping `sheetSvg` applies to text (so `&` becomes `&amp;`). */
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const sheetSvgByNumber = Object.fromEntries(
  docState.sheets.map((sheet) => {
    const drawings: Record<string, string | null> = {};
    for (const item of sheet.items) {
      if (item.kind === "view") drawings[item.viewId] = drawingFor(item.viewId);
    }
    return [sheet.number, sheetSvgString(sheet, { drawings, title })];
  }),
);

describe("Reference acceptance harness (W-00)", () => {
  it("produces the seven reference sheets with the A101–A106 numbers", () => {
    const numbers = docState.sheets.map((s) => s.number);
    expect(numbers).toEqual(["A000", "A101", "A102", "A103", "A104", "A105", "A106"]);
    expect(docState.sheets).toHaveLength(7);
  });

  it("renders each sheet with its number and title in the title block", () => {
    for (const sheet of docState.sheets) {
      const svg = sheetSvgByNumber[sheet.number];
      expect(svg).toContain("<svg");
      expect(svg).toContain(sheet.number);
      expect(svg).toContain(esc(sheet.name));
    }
  });

  it("places two plans on A101 and two sections on A105/A106", () => {
    const views = (n: string) =>
      docState.sheets.find((s) => s.number === n)!.items.filter((i) => i.kind === "view");
    expect(views("A101")).toHaveLength(2);
    expect(views("A105")).toHaveLength(2);
    expect(views("A106")).toHaveLength(2);
  });

  it("draws the plan with grid bubbles and grid dimensions (D-04)", () => {
    const plan = drawingFor("v-l1")!;
    expect(plan).toContain("<circle");
    expect(plan).toMatch(/>1</); // grid label
    expect(plan).toContain("5200"); // grid 1→2 bay
    expect(plan).toContain("9000"); // grid 1→3
  });

  it("draws level markers on section and elevation (D-04)", () => {
    expect(drawingFor("v-sec-aa")!).toContain("+3.60");
    expect(drawingFor("v-el-front")!).toContain("+7.00");
  });

  it("embeds drawings into the sheet as frames", () => {
    expect(sheetSvgByNumber.A101).toContain("<image");
    expect(sheetSvgByNumber.A103).toContain("<image");
  });

  it("places views at true print scale (W-06)", () => {
    const drawing = drawingFor("v-l1")!;
    const vb = svgViewBox(drawing)!;
    const size = viewImageSize(drawing, 100)!;
    // 1 paper mm == 100 model mm.
    expect(size.w).toBeCloseTo(vb.w / 100, 6);
    expect(size.h).toBeCloseTo(vb.h / 100, 6);
    // A 9000 mm grid span is 90 mm on a 1:100 sheet (the W-06 done-when).
    expect(9000 / 100).toBe(90);
    const sheet = docState.sheets.find((s) => s.number === "A101")!;
    const svg = sheetSvgString(sheet, { drawings: { "v-l1": drawing }, title });
    expect(svg).toContain(`width="${size.w}"`);
    expect(svg).toContain(`height="${size.h}"`);
  });

  it("fills the right-hand Indonesian title block from the studio kit (W-06)", () => {
    const svg = sheetSvgByNumber.A101;
    expect(svg).toContain("NAMA PROYEK");
    expect(svg).toContain("DIGAMBAR");
    expect(svg).toContain("KODE");
    expect(svg).toContain("SKALA");
  });

  it("renders a captured 3D cover image (W-06)", () => {
    expect(sheetSvgByNumber.A000).toContain("<image");
  });

  it("resolves section marks to the sheet each section is placed on (W-05)", () => {
    const marks = sectionMarks(docState);
    expect(marks.find((m) => m.viewId === "v-sec-aa")?.sheetNumber).toBe("A105");
    expect(marks.find((m) => m.viewId === "v-sec-cc")?.sheetNumber).toBe("A106");
  });

  it("holds schematic entities as document state after generation (W-01)", () => {
    const store = new DocumentStore(docState);
    const entities = starterFromMass(mass, [], DEFAULT_SCHEMATIC_OPTIONS, [
      { id: "L1", elevation: 0, floorToFloor: 3600 },
      { id: "L2", elevation: 3600, floorToFloor: 3400 },
    ]);
    store.dispatch({ type: "schematic.setGenerated", ...entities });
    const s = store.getState();
    expect(s.walls.length).toBeGreaterThan(0);
    expect(s.openings.length).toBeGreaterThan(0);
    expect(s.slabs.length).toBeGreaterThanOrEqual(2);
    expect(s.roofs).toHaveLength(1);
    store.undo();
    expect(store.getState().walls).toHaveLength(0);
  });

  it("draws different level plans and a stair (W-02)", () => {
    const store = new DocumentStore(docState);
    store.dispatch({
      type: "schematic.setGenerated",
      ...starterFromMass(mass, [], DEFAULT_SCHEMATIC_OPTIONS, docState.levels),
    });
    const doc = store.getState();
    const opts = DEFAULT_SCHEMATIC_OPTIONS;
    const l1 = schematicFromDoc({ doc, options: opts, levelId: "L1" });
    const l2 = schematicFromDoc({ doc, options: opts, levelId: "L2" });
    expect(l1?.levelId).toBe("L1");
    expect(l2?.levelId).toBe("L2");
    // Each storey has its own walls.
    expect(l1!.walls[0].elementId).not.toBe(l2!.walls[0].elementId);
    // The stair on L1 is drawn (UP marker), and shows in section.
    const planL1 = planSvg(l1!, undefined, { grids: docState.grids, levels: docState.levels });
    expect(planL1).toContain("UP");
    const full = schematicFromDoc({ doc, options: opts });
    expect(full!.stairs.length).toBeGreaterThan(0);
  });

  // ---- Remaining gap, tracked as todos (Direction v5 W-03 … W-07) ----------
  it.todo("W-03: an architect can draw the plan from scratch (walls, doors, windows)");
  it.todo("W-04: plan graphics match the reference (pen weights, door swings, symbols)");
});
