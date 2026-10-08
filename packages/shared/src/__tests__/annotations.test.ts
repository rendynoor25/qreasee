import { describe, expect, it } from "vitest";
import { emptyDocState, sectionMarks, type DocState } from "../index";

function fixture(): DocState {
  const s = emptyDocState();
  s.views = [
    {
      id: "sec-a",
      kind: "section",
      name: "Potongan A-A'",
      line: { a: { x: 0, y: 0 }, b: { x: 0, y: 10000 } },
      createdAt: 0,
    },
    { id: "plan-1", kind: "plan", name: "Plan", createdAt: 0 },
  ];
  s.sheets = [
    {
      id: "s1",
      name: "S1",
      number: "A101",
      size: "A3",
      items: [{ id: "i1", kind: "view", viewId: "plan-1", x: 0, y: 0, w: 100, h: 100 }],
    },
    {
      id: "s5",
      name: "S5",
      number: "A105",
      size: "A3",
      items: [{ id: "i2", kind: "view", viewId: "sec-a", x: 0, y: 0, w: 100, h: 100 }],
    },
  ];
  return s;
}

describe("section marks (W-05)", () => {
  it("reports the sheet each section view is placed on", () => {
    const marks = sectionMarks(fixture());
    expect(marks).toHaveLength(1);
    expect(marks[0].name).toBe("Potongan A-A'");
    expect(marks[0].sheetNumber).toBe("A105");
  });

  it("updates the sheet number when the view moves to another sheet", () => {
    const s = fixture();
    s.sheets[1].items = [];
    s.sheets.push({
      id: "s6",
      name: "S6",
      number: "A106",
      size: "A3",
      items: [{ id: "i3", kind: "view", viewId: "sec-a", x: 0, y: 0, w: 100, h: 100 }],
    });
    expect(sectionMarks(s)[0].sheetNumber).toBe("A106");
  });

  it("ignores section views with no line and non-section views", () => {
    const s = fixture();
    s.views.push({ id: "sec-b", kind: "section", name: "Potongan B-B'", createdAt: 0 });
    const marks = sectionMarks(s);
    expect(marks.map((m) => m.viewId)).toEqual(["sec-a"]);
  });
});
