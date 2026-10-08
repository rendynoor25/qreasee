/**
 * S-01 / R-02: the "Sample house" — the reference model **reproduced from its
 * source IFC** (`20230707 RUMAH BU ALFIA WARDAH.ifc`, IFC2X3 from Revit) through
 * Qreasee's own importer, so the sample is exactly what the IFC import produces:
 * storeys, walls, doors/windows, floor slabs, stairs, roofs and the 18 named
 * rooms. Regenerate with `QREASEE_GENERATE=1` (see
 * `packages/export/src/__tests__/generateSample.test.ts`).
 */

import {
  normalizeDocState,
  type DocState,
  type Mass,
  type Project,
} from "@qreasee/shared";
import { axonModelSvg } from "@qreasee/schematic";
import rawDoc from "./sampleHouseDoc.json";

export interface SampleHouse {
  project: Project;
  docState: DocState;
  mass: Mass;
}

const LEVEL_NAMES: Record<string, string> = {
  "LANTAI 1": "Lantai 1",
  "LANTAI 2": "Lantai 2",
  "RING BALOK": "Ring Balok",
};

export function buildSampleHouse(): SampleHouse {
  const docState = normalizeDocState(rawDoc as unknown as DocState);
  docState.levels = docState.levels.map((l) => ({ ...l, name: LEVEL_NAMES[l.name] ?? l.name }));
  // The sample is a reference model — never show the homeowner's real name.
  docState.masses = docState.masses.map((m) => ({ ...m, name: "Main building" }));

  // W-08: the cover/concept snapshot is the REAL model (walls, slabs, roof,
  // stairs) rendered as an axonometric, not a bounding box.
  const axon = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(axonModelSvg(docState, ""))}`;
  docState.sheets = docState.sheets.map((sh) => ({
    ...sh,
    items: sh.items.map((it) =>
      it.kind === "image" && (it.id === "cover-img" || it.id === "a100-mass") ? { ...it, src: axon } : it,
    ),
  }));

  const project: Project = {
    id: "proj-sample-house",
    studioId: "studio-sample",
    name: "Sample house",
    location: { lat: -6.261, lng: 106.797 },
    northAngle: 0,
    units: "mm",
    buildingType: "house",
  };

  const mass: Mass =
    docState.masses[0] ??
    ({
      id: "mass-sample",
      levelIds: docState.levels.map((l) => l.id),
      footprint: { outer: [], holes: [] },
      height: 7000,
      fidelity: "massing",
    } as Mass);

  return { project, docState, mass };
}
