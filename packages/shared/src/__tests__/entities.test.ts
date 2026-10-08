import { describe, expect, it } from "vitest";
import { emptyDocState, normalizeDocState } from "../index";

describe("schematic entity backfill (W-01)", () => {
  it("emptyDocState carries the entity arrays", () => {
    const s = emptyDocState();
    expect(s.walls).toEqual([]);
    expect(s.openings).toEqual([]);
    expect(s.slabs).toEqual([]);
    expect(s.roofs).toEqual([]);
    expect(s.stairs).toEqual([]);
  });

  it("normalizeDocState backfills a pre-W-01 document without throwing", () => {
    const old = { ...emptyDocState() } as Record<string, unknown>;
    delete old.walls;
    delete old.openings;
    delete old.slabs;
    delete old.roofs;
    delete old.stairs;
    const s = normalizeDocState(old as never);
    expect(s.walls).toEqual([]);
    expect(s.openings).toEqual([]);
    expect(s.slabs).toEqual([]);
    expect(s.roofs).toEqual([]);
    expect(s.stairs).toEqual([]);
  });
});
