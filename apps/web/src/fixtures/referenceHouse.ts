/**
 * Direction v5 (W-00): the reference-house fixture.
 *
 * One source of truth for the acceptance harness and demos: the reference house
 * from the source PDF, expressed as far as the current model allows (grids, levels,
 * a mass, the program, views and the seven sheets). The homeowner's name is never
 * used — this is a generic reference model.
 *
 * Reference data (from the PDF / Direction v5 §1):
 *  - Grid X (1-2-3): 5200, 3800 (total 9000)
 *  - Grid Y (A-F):   5100, 3000, 6100, 5300, 3400 (total 22900)
 *  - Levels: Lantai 1 FFL 0, Lantai 2 FFL +3600, Ring Balok +7000
 */

import {
  emptyDocState,
  type DocState,
  type GridLine,
  type Level,
  type Mass,
  type Point,
  type ProgramItem,
  type Project,
  type Sheet,
  type SheetItem,
  type View,
  type ViewDirection,
} from "@qreasee/shared";

const M = 1000;

function rect(x: number, y: number, w: number, d: number): Point[] {
  return [
    { x: x * M, y: y * M },
    { x: (x + w) * M, y: y * M },
    { x: (x + w) * M, y: (y + d) * M },
    { x: x * M, y: (y + d) * M },
  ];
}

function view(
  id: string,
  kind: View["kind"],
  name: string,
  extra: { levelId?: string; direction?: ViewDirection; line?: View["line"] },
): View {
  return { id, kind, name, createdAt: 0, by: "studio", ...extra };
}

function viewItem(viewId: string, x: number, y: number, w: number, h: number): SheetItem {
  return { id: `si-${viewId}`, kind: "view", viewId, x, y, w, h };
}

/** W-06: the cover is a captured 3D image, not a generated drawing. */
function imageItem(src: string, x: number, y: number, w: number, h: number): SheetItem {
  return { id: "si-cover-3d", kind: "image", src, x, y, w, h, label: "3D" };
}

function sheet(id: string, name: string, number: string, items: SheetItem[]): Sheet {
  return { id, name, number, size: "A3", items, createdAt: 0 };
}

function item(
  id: string,
  name: string,
  areaM2: number,
  group: string,
  levelPref: "ground" | "upper",
  qty = 1,
): ProgramItem {
  return {
    id,
    name,
    targetArea: areaM2,
    areaEach: areaM2,
    qty,
    group,
    levelPref,
    source: "manual",
  };
}

/** Ground + first-floor room schedule (areas are starter values, not surveyed). */
export function wardahProgram(): ProgramItem[] {
  return [
    item("p-teras", "Teras Depan", 12, "Public", "ground"),
    item("p-keluarga", "R. Keluarga", 20, "Public", "ground"),
    item("p-makan", "R. Makan", 12, "Public", "ground"),
    item("p-dapur", "Dapur", 9, "Wet", "ground"),
    item("p-gudang", "Gudang", 4, "Service", "ground"),
    item("p-cuci", "R. Cuci / Jemur", 6, "Wet", "ground"),
    item("p-teras-b", "Teras Belakang", 8, "Public", "ground"),
    item("p-kmwc-1", "KM/WC", 4, "Wet", "ground"),
    item("p-kta1", "KT. Anak", 12, "Private", "upper"),
    item("p-kta2", "KT. Anak", 12, "Private", "upper"),
    item("p-ktu", "KT. Utama", 18, "Private", "upper"),
    item("p-wardrobe", "Wardrobe", 6, "Private", "upper"),
    item("p-kmwc-2", "KM/WC", 4, "Wet", "upper", 3),
    item("p-tengah", "R. Tengah", 12, "Public", "upper"),
    item("p-art", "KT. ART", 9, "Private", "upper"),
  ];
}

export interface ReferenceFixture {
  project: Project;
  docState: DocState;
  /** The single mass the current schematic generator works from (W-02 makes this multi-level). */
  mass: Mass;
}

export function buildReferenceHouse(): ReferenceFixture {
  const project: Project = {
    id: "proj-wardah",
    studioId: "studio-wardah",
    name: "Sample House",
    location: { lat: -6.261, lng: 106.797 },
    northAngle: 0,
    units: "mm",
    buildingType: "house",
  };

  const levels: Level[] = [
    { id: "L1", name: "Lantai 1", elevation: 0, floorToFloor: 3600 },
    { id: "L2", name: "Lantai 2", elevation: 3600, floorToFloor: 3400 },
    { id: "LRB", name: "Ring Balok", elevation: 7000, floorToFloor: 3400 },
  ];

  const grids: GridLine[] = [
    { id: "gx1", axis: "x", label: "1", offset: 0 },
    { id: "gx2", axis: "x", label: "2", offset: 5200 },
    { id: "gx3", axis: "x", label: "3", offset: 9000 },
    { id: "gyA", axis: "y", label: "A", offset: 0 },
    { id: "gyB", axis: "y", label: "B", offset: 5100 },
    { id: "gyC", axis: "y", label: "C", offset: 8100 },
    { id: "gyD", axis: "y", label: "D", offset: 14200 },
    { id: "gyE", axis: "y", label: "E", offset: 19500 },
    { id: "gyF", axis: "y", label: "F", offset: 22900 },
  ];

  const state = emptyDocState();
  state.levels = levels;
  state.grids = grids;
  state.site.boundary = rect(-1500, -1500, 12000, 25900);
  state.brief.program = wardahProgram();

  const mass: Mass = {
    id: "mass-main",
    levelIds: ["L1", "L2"],
    footprint: { outer: rect(0, 0, 9000, 22900), holes: [] },
    height: 7000,
    fidelity: "massing",
    name: "Main building",
    layerId: state.activeLayerId,
  };
  state.masses = [mass];

  // W-02: a straight stair connects Lantai 1 to Lantai 2.
  state.stairs = [
    {
      id: "stair-main",
      levelId: "L1",
      kind: "straight",
      from: { x: 6000, y: 6000 },
      to: { x: 6000, y: 10000 },
      width: 1100,
      floorToFloor: 3600,
      origin: "user",
    },
  ];

  // Section lines run vertically (A-A' and B-B') and horizontally (C-C' and D-D').
  const at = (x: number, y: number): Point => ({ x, y });
  state.views = [
    view("v-l1", "plan", "Denah Lantai 1", { levelId: "L1" }),
    view("v-l2", "plan", "Denah Lantai 2", { levelId: "L2" }),
    view("v-roof", "plan", "Denah Atap", { levelId: "LRB" }),
    view("v-el-front", "elevation", "Tampak Depan", { direction: "N" }),
    view("v-el-right", "elevation", "Tampak Samping Kanan", { direction: "E" }),
    view("v-el-left", "elevation", "Tampak Samping Kiri", { direction: "W" }),
    view("v-sec-aa", "section", "Potongan A-A'", { line: { a: at(2600, -1500), b: at(2600, 24400) } }),
    view("v-sec-bb", "section", "Potongan B-B'", { line: { a: at(6400, -1500), b: at(6400, 24400) } }),
    view("v-sec-cc", "section", "Potongan C-C'", { line: { a: at(-1500, 6600), b: at(10500, 6600) } }),
    view("v-sec-dd", "section", "Potongan D-D'", { line: { a: at(-1500, 16200), b: at(10500, 16200) } }),
    view("v-3d", "3d", "3D", {}),
  ];

  state.sheets = [
    sheet("s-cover", "Cover", "A000", [
      imageItem(
        "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='4'%20height='3'%3E%3Crect%20width='4'%20height='3'%20fill='%23dfe6ef'/%3E%3C/svg%3E",
        20,
        20,
        240,
        200,
      ),
    ]),
    sheet("s-a101", "Denah Lantai 1 & 2", "A101", [
      viewItem("v-l1", 16, 24, 180, 250),
      viewItem("v-l2", 210, 24, 180, 250),
    ]),
    sheet("s-a102", "Denah Atap", "A102", [viewItem("v-roof", 120, 30, 180, 235)]),
    sheet("s-a103", "Tampak Depan", "A103", [viewItem("v-el-front", 60, 45, 250, 200)]),
    sheet("s-a104", "Tampak Samping Kanan & Kiri", "A104", [
      viewItem("v-el-right", 40, 20, 340, 115),
      viewItem("v-el-left", 40, 165, 340, 115),
    ]),
    sheet("s-a105", "Potongan A-A' & B-B'", "A105", [
      viewItem("v-sec-aa", 40, 20, 340, 115),
      viewItem("v-sec-bb", 40, 165, 340, 115),
    ]),
    sheet("s-a106", "Potongan C-C' & D-D'", "A106", [
      viewItem("v-sec-cc", 40, 20, 340, 115),
      viewItem("v-sec-dd", 40, 165, 340, 115),
    ]),
  ];

  return { project, docState: state, mass };
}
