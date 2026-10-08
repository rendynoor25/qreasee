import { describe, expect, it } from "vitest";
import { computeIndicators } from "@qreasee/indicators";
import { createBlankProject, createProjectFromTemplate } from "../sampleProject";

describe("starter projects (A-01/A-02)", () => {
  it("loads a house template into a valid DocState with a plot", () => {
    const { project, store } = createProjectFromTemplate("house", "en");
    const state = store.getState();
    expect(project.name).toBe("House");
    expect(project.buildingType).toBe("house");
    expect(state.brief.program.length).toBeGreaterThan(5);
    expect(state.site.boundary.length).toBe(4);
    // 12 x 25 m plot
    expect(state.masses).toHaveLength(0);
    expect(state.rules.kdbMax).toBeUndefined(); // never invent regulation
  });

  it("computes indicators without error and marks rules as needs-input", () => {
    const { store } = createProjectFromTemplate("house", "en");
    const results = computeIndicators(store.getState(), { branchId: "b", version: 1 });
    expect(results.length).toBeGreaterThan(5);
    const kdb = results.find((r) => r.key === "kdb");
    expect(kdb?.status).toBe("needs-input");
    const program = results.find((r) => r.key === "program");
    // Program targets exist even with no rooms yet.
    expect(program).toBeDefined();
  });

  it("works in Indonesian too", () => {
    const { project, store } = createProjectFromTemplate("cafe", "id");
    expect(project.name).toBe("Kafe / Restoran");
    expect(store.getState().brief.text.length).toBeGreaterThan(0);
  });

  it("blank project has a default 12 x 25 m plot and three levels", () => {
    const { store } = createBlankProject("en");
    const state = store.getState();
    expect(state.levels).toHaveLength(3);
    expect(state.site.boundary.length).toBe(4);
  });
});
