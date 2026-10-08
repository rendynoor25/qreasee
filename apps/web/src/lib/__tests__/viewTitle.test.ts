import { describe, expect, it } from "vitest";
import type { Sheet } from "@qreasee/shared";
import { sheetSvgString } from "../sheetSvg";

describe("VW-04 per-viewport title", () => {
  it("draws a split circle, the view name and the scale under each view", () => {
    const sheet: Sheet = {
      id: "s1",
      name: "Denah Lantai 1",
      number: "A101",
      size: "A3",
      createdAt: 0,
      items: [{ id: "i1", kind: "view", viewId: "v1", x: 20, y: 20, w: 150, h: 120, scale: 100 }],
    };
    const svg = sheetSvgString(sheet, {
      drawings: { v1: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 800"></svg>' },
      title: { studio: "My studio", projectName: "Sample house", scaleLabel: "SCALE" },
      views: { v1: { name: "Denah Lantai 1" } },
    });
    expect(svg).toContain("Denah Lantai 1");
    expect(svg).toContain("SCALE   1 : 100");
    expect(svg).toContain("A101");
    // detail number 1 inside the circle
    expect(svg).toMatch(/text-anchor="middle" font-size="3"[^>]*>1</);
  });

  it("omits the title when no view metadata is supplied", () => {
    const sheet: Sheet = {
      id: "s1",
      name: "Denah",
      number: "A101",
      size: "A3",
      createdAt: 0,
      items: [{ id: "i1", kind: "view", viewId: "v1", x: 20, y: 20, w: 150, h: 120, scale: 100 }],
    };
    const svg = sheetSvgString(sheet, {
      drawings: { v1: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 800"></svg>' },
      title: { studio: "S", projectName: "P", scaleLabel: "SCALE" },
    });
    expect(svg).not.toContain("SCALE   1 :");
  });
});
