import type { DocState, Id, Project } from "@qreasee/shared";
import type { FaceSunExposure } from "@qreasee/indicators";
import type { Schematic, SectionLine } from "@qreasee/schematic";
import type { View } from "@qreasee/shared";
import type { ContextBuilding } from "../lib/osm";
import type { Tool } from "../state/store";
import type { ElementRef, Mode } from "../state/store";
import type { Lens } from "@qreasee/shared";

export interface BranchPreview {
  id: Id;
  name: string;
  color: string;
  state: DocState;
}

export interface Snapshot {
  project: Project;
  state: DocState;
  activeBranchId: Id;
  lens: Lens;
  tool: Tool;
  selectedMassId: Id | null;
  selectedMassIds: Id[];
  activeLevelId: Id | null;
  sunView: boolean;
  showGrid: boolean;
  sunFaces: FaceSunExposure[] | null;
  compareBranches: BranchPreview[];
  overlayCompare: boolean;
  contextBuildings: ContextBuilding[];
  showContext: boolean;
  schematic: Schematic | null;
  showSchematic: boolean;
  mode: Mode;
  projection: "perspective" | "orthographic";
  selectedElement: ElementRef | null;
  selectedRoomId: Id | null;
  sectionLine: SectionLine | null;
  activeView?: View;
  theme: "dark" | "light";
  lang: "en" | "id";
  /** Studio Kit primary colour, used for selection/highlights in the 3D scene. */
  brandColor: string;
}

export interface SnapMarkerView {
  kind: string;
  /** Pixels relative to the canvas container. */
  x: number;
  y: number;
  label: string;
  active: boolean;
}

export interface OverlayState {
  hint: string | null;
  snapLabel: string | null;
  typed: string;
  coords: string | null;
  breachCount: number;
  /** LG-03: snap markers to draw over the canvas (constant pixel size). */
  markers: SnapMarkerView[];
  /** ?debugSnap=1 diagnostic line. */
  debug: string | null;
  /** LG-04: Tape Measure read-out (not stored in the document). */
  tape: string | null;
}
