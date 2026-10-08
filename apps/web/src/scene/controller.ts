import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  buildableArea,
  buildSnapCandidates,
  clonePolygon,
  bounds as polygonBounds,
  extrudePolygon,
  inflatePolygon,
  nearbySnapMarkers,
  pickSnap,
  pointInPolygon,
  rotatePolygon,
  setbackLines,
  translatePolygon,
  triangulatePolygons,
  type Point3,
  type SnapCandidate,
  type SnapGuide,
  type SnapResult,
  type SnapView,
} from "@qreasee/geometry";
import { breachingMassIds, massBaseElevation } from "@qreasee/indicators";
import { stackElevationFor, type StackBox } from "@qreasee/concept";
import type { Schematic, SectionLine } from "@qreasee/schematic";
import {
  materialById,
  newId,
  t,
  type DocState,
  type Mass,
  type Material,
  type Point,
  type Polygon,
  type View,
} from "@qreasee/shared";
import type { OverlayState, SnapMarkerView, Snapshot } from "./types";
import type { ContextBuilding } from "../lib/osm";
import { useApp, type ElementRef } from "../state/store";

/** Drag-and-drop MIME type used to move a material from the picker to a face. */
export const MATERIAL_DND_TYPE = "application/x-qreasee-material";

export interface ViewportCallbacks {
  getSnapshot: () => Snapshot;
  dispatch: (op: unknown) => void;
  onSelect: (id: string | null, additive?: boolean) => void;
  onSelectElement: (ref: ElementRef | null) => void;
  onElementMaterial: (ref: ElementRef, materialId: string) => void;
  onSelectRoom: (id: string | null) => void;
  onSectionLine: (line: SectionLine | null) => void;
  onOverlay: (overlay: OverlayState) => void;
  /** W-03 plan authoring. */
  onAddWall: (a: Point, b: Point) => void;
  onPlaceOpening: (point: Point, kind: "door" | "window") => void;
  onAddRoom: (points: Point[]) => void;
  /** R-01: author stairs and roofs. */
  onAddStair: (a: Point, b: Point) => void;
  onAddRoof: (polygon: Point[]) => void;
  /** W-08: author a railing run. */
  onAddRailing: (a: Point, b: Point) => void;
}

interface DragState {
  kind: "move" | "height" | "vertex" | "room";
  massId: string;
  /** Masses that move with this drag (a group or a multi-selection). */
  memberIds?: string[];
  roomId?: string;
  originalRoom?: Polygon;
  group?: THREE.Group;
  start: Point;
  original?: Polygon;
  startY?: number;
  startHeight?: number;
  holeIndex?: number | null;
  vertexIndex?: number;
  handle?: THREE.Mesh;
  liveHeight?: number;
}

const COLORS = {
  background: 0x0b0d10,
  ground: 0x101318,
  site: 0x22c55e,
  road: 0xf59e0b,
  setback: 0xfacc15,
  buildable: 0xf0913b,
  green: 0x22c55e,
  mass: 0xe8ebef,
  intent: 0xc7cdd6,
  breach: 0xef4444,
  selected: 0xf0913b,
  gridMinor: 0x1c222b,
  gridMajor: 0x2a3340,
  context: 0x6b7686,
  contextEdge: 0x9aa4b2,
};

function hexToInt(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  return m ? parseInt(m[1], 16) : 0xf0913b;
}

/** Shortest distance from a point to a closed ring's edges, in mm. */
function distanceToRing(p: Point, ring: readonly Point[]): number {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby || 1;
    let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t)));
  }
  return best;
}

/**
 * Box/planar UV mapping in millimetres: pick the projection plane from each
 * triangle's normal so a texture tiles at a real-world size. UVs are divided by
 * the material's tile size, so the texture itself uses RepeatWrapping at 1:1.
 */
function planarUVs(positions: number[], normals: number[], scaleMm: number): number[] {
  const scale = scaleMm > 0 ? scaleMm : 1000;
  const uv: number[] = [];
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    const nx = Math.abs(normals[i]);
    const ny = Math.abs(normals[i + 1]);
    const nz = Math.abs(normals[i + 2]);
    let u: number;
    let v: number;
    if (ny >= nx && ny >= nz) {
      u = x;
      v = z;
    } else if (nx >= nz) {
      u = y;
      v = z;
    } else {
      u = x;
      v = y;
    }
    uv.push(u / scale, v / scale);
  }
  return uv;
}

function sunColor(hours: number): THREE.Color {
  const t = Math.max(0, Math.min(1, hours / 8));
  const cool = new THREE.Color(0x3b82f6);
  const mid = new THREE.Color(0xf3a85f);
  const hot = new THREE.Color(0xef4444);
  return t < 0.5
    ? cool.clone().lerp(mid, t / 0.5)
    : mid.clone().lerp(hot, (t - 0.5) / 0.5);
}

export class ViewportController {
  private container: HTMLElement;
  private cb: ViewportCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private persp: THREE.PerspectiveCamera;
  private ortho: THREE.OrthographicCamera;
  private projection: "perspective" | "orthographic" = "perspective";
  private controls: OrbitControls;
  private modelGroup = new THREE.Group();
  private draftGroup = new THREE.Group();
  private handleGroup = new THREE.Group();
  private northGroup = new THREE.Group();
  private sectionGroup = new THREE.Group();
  private snapGroup = new THREE.Group();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private drawPlaneElevation = 0;
  private draftY = 16;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private frame = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;
  private lastW = 0;
  private lastH = 0;

  private draftPoints: Point[] = [];
  private rectStart: Point | null = null;
  private stairA: Point | null = null;
  private roofA: Point | null = null;
  private railingA: Point | null = null;
  private tapeA: Point | null = null;
  private tapeLabel: string | null = null;
  private circleCenter: Point | null = null;
  private circleRadius = 0;
  private ellipseCenter: Point | null = null;
  private arcA: Point | null = null;
  private arcB: Point | null = null;
  private snapPoint: Point | null = null;
  private snapLabel: string | null = null;
  /** The full 3D snap point (plan x/y + elevation z), when one is active. */
  private snapPoint3: Point3 | null = null;
  private snapGuides: SnapGuide[] = [];
  private snapCandidates: SnapCandidate[] = [];
  private overlayMarkers: SnapMarkerView[] = [];
  private activeSnapKind: string | null = null;
  private lastSnapResult: SnapResult | null = null;
  private occlusionRay = new THREE.Raycaster();
  private debugSnap = false;
  /** Studio Kit primary colour, for selection highlights. */
  private brandHex = 0xf0913b;
  private lastPointer: Point | null = null;
  private typed = "";
  private drag: DragState | null = null;
  private downAt = { x: 0, y: 0, time: 0 };
  private panning = false;
  private panLast = { x: 0, y: 0 };
  private spaceDown = false;
  private massGroups = new Map<string, THREE.Group>();
  private massHeights = new Map<string, number>();
  private elementMeshes: THREE.Object3D[] = [];
  private roomGroups = new Map<string, THREE.Group>();
  private textureCache = new Map<string, THREE.Texture>();
  private textureLoader = new THREE.TextureLoader();
  private dropRef: ElementRef | null = null;
  private dropHighlight: THREE.Mesh | null = null;
  private rotateCenter: Point | null = null;
  private rotateBaseline: Point | null = null;
  private rotateLiveDeg = 0;
  private offsetDelta: number | null = null;
  private offsetPoly: Polygon | null = null;
  private offsetInside = false;
  private offsetY = 20;
  private sectionA: Point | null = null;
  private lastViewId: string | null = null;
  private theme: "dark" | "light" = "dark";
  private handles: Array<{
    mesh: THREE.Mesh;
    massId: string;
    holeIndex: number | null;
    vertexIndex: number;
  }> = [];

  constructor(container: HTMLElement, cb: ViewportCallbacks) {
    this.container = container;
    this.cb = cb;
    this.debugSnap = new URLSearchParams(window.location.search).has("debugSnap");

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(COLORS.background, 1);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(COLORS.background, 120000, 500000);

    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    this.persp = new THREE.PerspectiveCamera(50, aspect, 100, 2_000_000);
    this.persp.position.set(32000, 30000, 42000);
    const halfH = Math.tan((50 * Math.PI) / 360) * 48000;
    this.ortho = new THREE.OrthographicCamera(-halfH * aspect, halfH * aspect, halfH, -halfH, 1, 2_000_000);
    this.ortho.position.set(32000, 30000, 42000);
    this.camera = this.persp;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.zoomToCursor = true;
    this.controls.mouseButtons = {
      LEFT: null as unknown as THREE.MOUSE,
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.PAN,
    };
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    this.controls.target.set(10000, 2000, -7500);

    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x20242c, 1.05);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    dir.position.set(40000, 70000, 30000);
    this.scene.add(dir);
    const fill = new THREE.DirectionalLight(0x93c5fd, 0.35);
    fill.position.set(-40000, 30000, -30000);
    this.scene.add(fill);

    this.scene.add(this.modelGroup, this.draftGroup, this.handleGroup, this.northGroup, this.sectionGroup, this.snapGroup);

    // Model space has +Y = north (matching the map and the OSM projection).
    // three.js renders the ground on X/Z, and its cameras show +Z downward, so a
    // straight (x, z=y) mapping mirrors the plan against the map. Reflect Z on the
    // model groups so a top view reads north-up / east-right, exactly like the map.
    for (const g of [this.modelGroup, this.draftGroup, this.handleGroup, this.sectionGroup, this.snapGroup]) g.scale.z = -1;

    const dom = this.renderer.domElement;
    dom.addEventListener("pointerdown", this.onPointerDown);
    dom.addEventListener("pointerdown", this.onCapturePointerDown, true);
    dom.addEventListener("pointermove", this.onPointerMove);
    dom.addEventListener("pointerup", this.onPointerUp);
    dom.addEventListener("pointerleave", this.onPointerLeave);
    dom.addEventListener("contextmenu", this.preventDefault);
    dom.addEventListener("dragover", this.onDragOver);
    dom.addEventListener("dragleave", this.onDragLeave);
    dom.addEventListener("drop", this.onDrop);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("resize", this.onResize);

    // The panel/sidebar open/close changes the container size without a window
    // resize, so observe the container itself and keep the canvas filling it.
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.onResize());
      this.resizeObserver.observe(container);
    }

    this.loop();
    this.scheduleOverlay();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    const dom = this.renderer.domElement;
    dom.removeEventListener("pointerdown", this.onPointerDown);
    dom.removeEventListener("pointerdown", this.onCapturePointerDown, true);
    dom.removeEventListener("pointermove", this.onPointerMove);
    dom.removeEventListener("pointerup", this.onPointerUp);
    dom.removeEventListener("pointerleave", this.onPointerLeave);
    dom.removeEventListener("contextmenu", this.preventDefault);
    dom.removeEventListener("dragover", this.onDragOver);
    dom.removeEventListener("dragleave", this.onDragLeave);
    dom.removeEventListener("drop", this.onDrop);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("resize", this.onResize);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.controls.dispose();
    this.renderer.dispose();
    dom.remove();
  }

  private preventDefault = (e: Event) => e.preventDefault();

  /** Resize the renderer to the current container size. Safe to call anytime. */
  resize() {
    this.onResize();
  }

  private onResize = () => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const aspect = w / Math.max(1, h);
    this.persp.aspect = aspect;
    this.persp.updateProjectionMatrix();
    const halfH = (this.ortho.top - this.ortho.bottom) / 2;
    const halfW = halfH * aspect;
    this.ortho.left = -halfW;
    this.ortho.right = halfW;
    this.ortho.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    // Keep the canvas exactly filling its container. A ResizeObserver alone is
    // unreliable when a flex sibling (the right panel) opens/closes, so also
    // check the size each frame — cheap, and guarantees no dead strip.
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w !== this.lastW || h !== this.lastH) {
      this.lastW = w;
      this.lastH = h;
      this.onResize();
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private scheduleOverlay() {
    const snap = this.cb.getSnapshot();
    this.cb.onOverlay({
      hint: hintFor(snap.tool),
      snapLabel: this.snapLabel,
      typed: this.typed,
      coords: this.lastPointer
        ? `${(this.lastPointer.x / 1000).toFixed(2)}, ${(this.lastPointer.y / 1000).toFixed(2)} m`
        : null,
      breachCount: 0,
      markers: this.overlayMarkers,
      tape: this.tapeLabel,
      debug: this.debugSnap && this.lastSnapResult
        ? `${this.lastSnapResult.kind} · ${this.lastSnapResult.px.toFixed(1)}px · ${this.snapCandidates.length} candidates`
        : null,
    });
  }

  // ---------------------------------------------------------------- rebuild
  refresh() {
    const snap = this.cb.getSnapshot();
    this.theme = snap.theme;
    this.brandHex = hexToInt(snap.brandColor);
    const light = snap.theme === "light";
    const bg = light ? 0xf4f5f7 : COLORS.background;
    this.renderer.setClearColor(bg, 1);
    if (this.scene.fog) this.scene.fog.color.set(bg);
    this.controls.mouseButtons = {
      LEFT: (snap.tool === "rotate" ? THREE.MOUSE.ROTATE : null) as unknown as THREE.MOUSE,
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.PAN,
    };
    this.renderer.domElement.style.cursor =
      snap.tool === "pan"
        ? "grab"
        : snap.tool === "rotate" || snap.tool === "section"
          ? "crosshair"
          : snap.tool === "select"
            ? "default"
            : "crosshair";
    this.clearGroup(this.modelGroup);
    this.clearGroup(this.northGroup);
    this.clearGroup(this.sectionGroup);
    this.elementMeshes = [];

    // Draw on the active level, not the world Y=0 plane, so a new mass previews
    // and lands at the active level's elevation instead of jumping up from zero.
    const activeElev = snap.state.levels.find((l) => l.id === snap.activeLevelId)?.elevation ?? 0;
    const groundTools = snap.tool === "site" || snap.tool === "green" || snap.tool === "road";
    this.drawPlaneElevation = groundTools ? 0 : activeElev;
    this.groundPlane.constant = -this.drawPlaneElevation;
    this.draftY = this.drawPlaneElevation + 16;
    this.setProjection(snap.projection);
    if (snap.tool !== "rotate") {
      this.rotateCenter = null;
      this.rotateBaseline = null;
    }
    if (snap.tool !== "section") this.sectionA = null;
    if (snap.tool !== "stair") this.stairA = null;
    if (snap.tool !== "roof") this.roofA = null;
    if (snap.tool !== "railing") this.railingA = null;
    if (snap.tool !== "tape") {
      this.tapeA = null;
      this.tapeLabel = null;
    }
    this.massGroups.clear();
    this.massHeights.clear();
    this.clearGroup(this.handleGroup);
    this.handles = [];

    this.addGround(snap);
    this.addSite(snap);
    if (snap.showGrid) this.addGrid(snap);
    this.addAxes(snap);
    this.addNorthArrow(snap);
    if (snap.showContext && snap.contextBuildings.length > 0) this.addContext(snap.contextBuildings);

    const breaching = breachSet(snap.state);
    const hiddenLayers = new Set(
      (snap.state.layers ?? []).filter((l) => !l.visible).map((l) => l.id),
    );
    for (const mass of snap.state.masses) {
      if (mass.layerId && hiddenLayers.has(mass.layerId)) continue;
      // Concept/Massing show the block; Schematic shows the detailed model with
      // the block hidden (the block is the room volume).
      const isSchematicMass = snap.showSchematic && snap.schematic?.massId === mass.id;
      if (isSchematicMass) continue;
      const isActiveLevel =
        !snap.activeLevelId || mass.levelIds.includes(snap.activeLevelId);
      const group = this.buildMass(mass, snap, {
        breach: breaching.has(mass.id),
        selected: snap.selectedMassIds.includes(mass.id),
        dim: !isActiveLevel && snap.lens === "visual",
        ghost: false,
      });
      this.modelGroup.add(group);
      this.massGroups.set(mass.id, group);
    }

    // Overlay other branches for DB-04 comparison.
    if (snap.overlayCompare) {
      for (const b of snap.compareBranches) {
        const hidden = new Set(
          (b.state.layers ?? []).filter((l) => !l.visible).map((l) => l.id),
        );
        for (const mass of b.state.masses) {
          if (mass.layerId && hidden.has(mass.layerId)) continue;
          const group = this.buildMass(mass, snap, {
            breach: false,
            selected: false,
            dim: true,
            overrideColor: new THREE.Color(b.color),
            opacity: 0.28,
          });
          this.modelGroup.add(group);
        }
      }
    }

    this.addHandles(snap);
    if (snap.showSchematic && snap.schematic) this.addSchematic(snap.schematic);
    this.addConceptRooms(snap);
    this.addUnderlays(snap);
    this.addRailings(snap);
    this.renderSectionLine(snap);
    if (snap.tool === "rotate" && snap.selectedMassId) this.renderRotateProtractor(snap);
    this.applyActiveView(snap.activeView);
    // VW-02: a plan view is a CUT 1.2 m above its level — clip everything above so
    // the plan shows the cut (interior, openings), not the roof. Other views are
    // unclipped.
    const view = snap.activeView;
    const cut = view && view.kind === "plan" ? (view.cutPlane === undefined ? 1200 : view.cutPlane) : null;
    if (view && view.kind === "plan" && cut !== null) {
      const level = snap.state.levels.find((l) => l.id === view.levelId);
      const cutZ = (level?.elevation ?? 0) + cut;
      this.renderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), cutZ)];
    } else if (this.renderer.clippingPlanes.length) {
      this.renderer.clippingPlanes = [];
    }
    this.scheduleOverlay();
    // Render once now, so a rebuild is visible immediately and the frame is still
    // correct when rAF is paused (background tab, capture, print).
    this.renderer.render(this.scene, this.camera);
  }

  private clearGroup(group: THREE.Group) {
    for (const child of [...group.children]) {
      group.remove(child);
      disposeObject(child);
    }
  }

  private addGround(snap: Snapshot) {
    const b = snap.state.site.boundary;
    const size = b.length >= 3 ? Math.max(polygonBounds(b).width, polygonBounds(b).height) * 6 : 200000;
    const geom = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.MeshStandardMaterial({
      color: this.theme === "light" ? 0xeceef1 : COLORS.ground,
      roughness: 1,
      metalness: 0,
    });
    const plane = new THREE.Mesh(geom, mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(b[0]?.x ?? 0, -20, b[0]?.y ?? 0);
    this.modelGroup.add(plane);
  }

  private addSite(snap: Snapshot) {
    const { state } = snap;
    const b = state.site.boundary;
    if (b.length >= 3) {
      const pts = b.map((p) => new THREE.Vector3(p.x, 8, p.y));
      const line = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: COLORS.site, linewidth: 2 }),
      );
      this.modelGroup.add(line);

      // Road edges.
      for (const road of state.site.roadEdges) {
        const a = b[road.edgeIndex];
        const c = b[(road.edgeIndex + 1) % b.length];
        if (!a || !c) continue;
        const seg = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(a.x, 14, a.y),
            new THREE.Vector3(c.x, 14, c.y),
          ]),
          new THREE.LineBasicMaterial({ color: COLORS.road, linewidth: 3 }),
        );
        this.modelGroup.add(seg);
      }
    }

    // Setback lines.
    const segs = setbackLines(b, state.rules.setbacks);
    if (segs.length > 0) {
      const pts: THREE.Vector3[] = [];
      for (const s of segs) {
        pts.push(new THREE.Vector3(s.a.x, 12, s.a.y), new THREE.Vector3(s.b.x, 12, s.b.y));
      }
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.LineSegments(
        geom,
        new THREE.LineDashedMaterial({ color: COLORS.setback, dashSize: 900, gapSize: 600 }),
      );
      line.computeLineDistances();
      this.modelGroup.add(line);
    }

    // Buildable area fill.
    const buildable = buildableArea(b, state.rules.setbacks);
    if (b.length >= 3 && buildable.length > 0 && hasSetbacks(state)) {
      this.addFlatFill(buildable, COLORS.buildable, 0.1, 6);
    }

    // Green polygons.
    for (const g of state.site.greenPolygons) {
      this.addFlatFill([{ outer: g.points, holes: [] }], COLORS.green, 0.22, 4);
    }
  }

  private addFlatFill(polys: Polygon[], color: number, opacity: number, y: number) {
    const tri = triangulatePolygons(polys);
    if (tri.indices.length === 0) return;
    const geom = new THREE.BufferGeometry();
    const positions: number[] = [];
    for (let i = 0; i < tri.indices.length; i++) {
      const vi = tri.indices[i];
      positions.push(tri.vertices[vi * 2], y, tri.vertices[vi * 2 + 1]);
    }
    geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide });
    this.modelGroup.add(new THREE.Mesh(geom, mat));
  }

  private addGrid(snap: Snapshot) {
    const b = snap.state.site.boundary;
    const bounds = b.length >= 3 ? polygonBounds(b) : { min: { x: 0, y: 0 }, max: { x: 50000, y: 50000 }, width: 50000, height: 50000, center: { x: 25000, y: 25000 } };
    const pad = 12000;
    const xs = snap.state.grids.filter((g) => g.axis === "x").map((g) => g.offset);
    const ys = snap.state.grids.filter((g) => g.axis === "y").map((g) => g.offset);

    const minorPts: THREE.Vector3[] = [];
    const majorPts: THREE.Vector3[] = [];
    if (xs.length || ys.length) {
      for (const x of xs)
        majorPts.push(
          new THREE.Vector3(x, 2, bounds.min.y - pad),
          new THREE.Vector3(x, 2, bounds.max.y + pad),
        );
      for (const y of ys)
        majorPts.push(
          new THREE.Vector3(bounds.min.x - pad, 2, y),
          new THREE.Vector3(bounds.max.x + pad, 2, y),
        );
    } else {
      const step = 5000;
      for (let x = Math.floor(bounds.min.x / step) * step; x <= bounds.max.x + pad; x += step)
        minorPts.push(
          new THREE.Vector3(x, 2, bounds.min.y - pad),
          new THREE.Vector3(x, 2, bounds.max.y + pad),
        );
      for (let y = Math.floor(bounds.min.y / step) * step; y <= bounds.max.y + pad; y += step)
        minorPts.push(
          new THREE.Vector3(bounds.min.x - pad, 2, y),
          new THREE.Vector3(bounds.max.x + pad, 2, y),
        );
    }
    if (minorPts.length)
      this.modelGroup.add(
        new THREE.LineSegments(
          new THREE.BufferGeometry().setFromPoints(minorPts),
          new THREE.LineBasicMaterial({ color: this.theme === "light" ? 0xe2e5ea : COLORS.gridMinor }),
        ),
      );
    if (majorPts.length)
      this.modelGroup.add(
        new THREE.LineSegments(
          new THREE.BufferGeometry().setFromPoints(majorPts),
          new THREE.LineBasicMaterial({ color: this.theme === "light" ? 0xccd2da : COLORS.gridMajor }),
        ),
      );
  }

  private addAxes(snap: Snapshot) {
    const b = snap.state.site.boundary;
    const size = b.length >= 3 ? Math.max(polygonBounds(b).width, polygonBounds(b).height) * 1.4 : 40000;
    const axes = new THREE.AxesHelper(size);
    axes.position.set(0, 30, 0);
    this.modelGroup.add(axes);
  }

  private addNorthArrow(snap: Snapshot) {
    const b = snap.state.site.boundary;
    if (b.length < 3) return;
    const bounds = polygonBounds(b);
    const x = bounds.max.x + 6000;
    const y = bounds.min.y;
    const angle = (snap.project.northAngle * Math.PI) / 180;
    // Model north (sin, cos) maps to world (sin, 0, -cos) after the Z reflection.
    const dir = new THREE.Vector3(Math.sin(angle), 0, -Math.cos(angle));
    const base = new THREE.Vector3(x, 20, -y);
    const tip = base.clone().add(dir.clone().multiplyScalar(5000));

    const geom = new THREE.ConeGeometry(900, 4000, 12);
    const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color: 0xef4444 }));
    mesh.position.copy(base.clone().add(dir.clone().multiplyScalar(2000)));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    this.northGroup.add(mesh);

    const label = makeLabel("N", "#ef4444");
    label.position.copy(tip.clone().add(new THREE.Vector3(0, 1500, 0)));
    this.northGroup.add(label);
  }

  private addContext(buildings: ContextBuilding[]) {
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.context,
      transparent: true,
      opacity: 0.28,
      roughness: 0.95,
      flatShading: true,
      side: THREE.DoubleSide,
    });
    const edgeMat = new THREE.LineBasicMaterial({
      color: COLORS.contextEdge,
      transparent: true,
      opacity: 0.4,
    });
    for (const b of buildings) {
      if (b.outer.length < 3) continue;
      const ex = extrudePolygon({ outer: b.outer, holes: [] }, 0, b.heightMm);
      if (ex.positions.length === 0) continue;
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.Float32BufferAttribute(ex.positions, 3));
      geom.setAttribute("normal", new THREE.Float32BufferAttribute(ex.normals, 3));
      this.modelGroup.add(new THREE.Mesh(geom, mat));
      this.modelGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(geom, 20), edgeMat));
    }
  }

  private loadTexture(path: string): THREE.Texture {
    const url = import.meta.env.BASE_URL.replace(/\/$/, "") + "/" + path;
    const cached = this.textureCache.get(url);
    if (cached) return cached;
    const tex = this.textureLoader.load(url);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    this.textureCache.set(url, tex);
    return tex;
  }

  /** Standard material for a schematic surface: uses the texture if there is one. */
  private surfaceMaterial(
    material: Material | undefined,
    fallback: string,
    selected: boolean,
  ): THREE.MeshStandardMaterial {
    const mat = material?.texture
      ? new THREE.MeshStandardMaterial({
          map: this.loadTexture(material.texture),
          roughness: material.roughness ?? 0.85,
          metalness: material.metalness ?? 0,
          side: THREE.DoubleSide,
          flatShading: true,
        })
      : new THREE.MeshStandardMaterial({
          color: new THREE.Color(material?.color ?? fallback),
          roughness: material?.roughness ?? 0.9,
          metalness: material?.metalness ?? 0,
          side: THREE.DoubleSide,
          flatShading: true,
        });
    if (selected) {
      mat.emissive = new THREE.Color(this.brandHex);
      mat.emissiveIntensity = 0.4;
    }
    // Translucent materials (glass): honour the material's opacity.
    if (material?.opacity !== undefined && material.opacity < 1) {
      mat.transparent = true;
      mat.opacity = material.opacity;
      mat.depthWrite = false;
    }
    return mat;
  }

  private addSchematic(sch: Schematic) {
    const sel = this.cb.getSnapshot().selectedElement;
    const isSel = (kind: string, id: string) => !!sel && sel.kind === kind && sel.id === id;

    sch.rooms.forEach((room) => {
      const tri = triangulatePolygons([{ outer: room.polygon, holes: [] }]);
      if (tri.indices.length === 0) return;
      const positions: number[] = [];
      const normals: number[] = [];
      for (let k = 0; k < tri.indices.length; k++) {
        const vi = tri.indices[k];
        positions.push(tri.vertices[vi * 2], sch.baseZ + 40, tri.vertices[vi * 2 + 1]);
        normals.push(0, 1, 0);
      }
      const material = materialById(room.material);
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute(
          planarUVs(positions, normals, material?.textureScaleMm ?? 1000),
          2,
        ),
      );
      const mat = this.surfaceMaterial(material, "#c9c4ba", isSel("room", room.id));
      mat.transparent = true;
      mat.opacity = 0.5;
      mat.depthWrite = false;
      const mesh = new THREE.Mesh(geom, mat);
      mesh.userData = { elementKind: "room", elementId: room.id };
      this.modelGroup.add(mesh);
      this.elementMeshes.push(mesh);
    });

    for (const slab of sch.slabs) {
      this.addPrism(
        slab.polygon,
        slab.z0,
        slab.z1,
        materialById(slab.material),
        "#cfd4da",
        { kind: "slab", id: slab.id },
        isSel("slab", slab.id),
      );
    }
    for (const wall of sch.walls) {
      if (wall.polygon.length < 3) continue;
      const id = wall.elementId ?? wall.id;
      this.addPrism(
        wall.polygon,
        wall.z0,
        wall.z1,
        materialById(wall.material),
        wall.kind === "exterior" ? "#8f97a3" : "#c2c8d0",
        { kind: "wall", id },
        isSel("wall", id),
      );
    }

    // Roof mesh from its faces.
    const positions: number[] = [];
    for (const face of sch.roof.faces) {
      const pts = face.points;
      for (let i = 1; i < pts.length - 1; i++) {
        positions.push(...pts[0], ...pts[i], ...pts[i + 1]);
      }
    }
    if (positions.length > 0) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geom.computeVertexNormals();
      const normals = Array.from(geom.getAttribute("normal").array as Float32Array);
      const roofMaterial = materialById(sch.roof.material);
      geom.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute(
          planarUVs(positions, normals, roofMaterial?.textureScaleMm ?? 1000),
          2,
        ),
      );
      const mesh = new THREE.Mesh(
        geom,
        this.surfaceMaterial(roofMaterial, "#b5651d", isSel("roof", "roof")),
      );
      mesh.userData = { elementKind: "roof", elementId: "roof" };
      this.modelGroup.add(mesh);
      this.elementMeshes.push(mesh);
      this.modelGroup.add(
        new THREE.LineSegments(
          new THREE.EdgesGeometry(geom, 20),
          new THREE.LineBasicMaterial({ color: 0x7a3f0f }),
        ),
      );
    }

    // Stairs (R-01): a solid tread run per step.
    for (const g of sch.stairs) {
      const totalLen = g.runs.reduce((s, r) => s + Math.hypot(r.b.x - r.a.x, r.b.y - r.a.y), 0) || 1;
      let cum = 0;
      for (const run of g.runs) {
        const dx = run.b.x - run.a.x;
        const dy = run.b.y - run.a.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const nx = -uy;
        const ny = ux;
        const steps = Math.max(1, Math.round((g.risers * len) / totalLen));
        const tread = len / steps;
        const w = run.width / 2;
        for (let i = 0; i < steps; i++) {
          const t0 = i * tread;
          const t1 = (i + 1) * tread;
          const ax = run.a.x + ux * t0;
          const ay = run.a.y + uy * t0;
          const bx = run.a.x + ux * t1;
          const by = run.a.y + uy * t1;
          const poly = [
            { x: ax + nx * w, y: ay + ny * w },
            { x: bx + nx * w, y: by + ny * w },
            { x: bx - nx * w, y: by - ny * w },
            { x: ax - nx * w, y: ay - ny * w },
          ];
          const top = g.baseZ + (cum + i + 1) * g.riserMm;
          this.addPrism(poly, g.baseZ, top, undefined, "#9aa4b2", { kind: "stair", id: g.id }, isSel("stair", g.id));
        }
        cum += steps;
      }
    }
  }

  private addPrism(
    polygon: Point[],
    z0: number,
    z1: number,
    material: Material | undefined,
    fallback: string,
    ref?: ElementRef,
    selected = false,
  ) {
    const ex = extrudePolygon({ outer: polygon, holes: [] }, z0, z1);
    if (ex.positions.length === 0) return;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(ex.positions, 3));
    geom.setAttribute("normal", new THREE.Float32BufferAttribute(ex.normals, 3));
    geom.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(
        planarUVs(ex.positions, ex.normals, material?.textureScaleMm ?? 1000),
        2,
      ),
    );
    const mesh = new THREE.Mesh(geom, this.surfaceMaterial(material, fallback, selected));
    if (ref) {
      mesh.userData = { elementKind: ref.kind, elementId: ref.id };
      this.elementMeshes.push(mesh);
    }
    this.modelGroup.add(mesh);
  }

  private addConceptRooms(snap: Snapshot) {
    this.roomGroups.clear();
    const rooms = snap.state.rooms;
    if (rooms.length === 0) return;
    for (const room of rooms) {
      const level = snap.state.levels.find((l) => l.id === room.levelId);
      const base = room.elevationMm ?? level?.elevation ?? 0;
      const height = room.height ?? 3000;
      const top = base + height;
      const selected = room.id === snap.selectedRoomId;
      const ex = extrudePolygon(room.polygon, base, top);
      if (ex.positions.length === 0) continue;
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.Float32BufferAttribute(ex.positions, 3));
      geom.setAttribute("normal", new THREE.Float32BufferAttribute(ex.normals, 3));
      const group = new THREE.Group();
      const mesh = new THREE.Mesh(
        geom,
        new THREE.MeshStandardMaterial({
          color: selected ? this.brandHex : (room.color ?? "#9aa4b2"),
          roughness: 0.85,
          metalness: 0,
          transparent: true,
          opacity: selected ? 0.92 : 0.74,
          side: THREE.DoubleSide,
          flatShading: true,
        }),
      );
      mesh.userData.roomId = room.id;
      group.add(mesh);
      // C-03: the room boundary shows only when the room is highlighted.
      if (selected) {
        const outline = room.polygon.outer.map((p) => new THREE.Vector3(p.x, top + 1, p.y));
        if (outline.length >= 3) {
          group.add(
            new THREE.LineLoop(
              new THREE.BufferGeometry().setFromPoints(outline),
              new THREE.LineBasicMaterial({ color: this.brandHex }),
            ),
          );
        }
      }
      this.modelGroup.add(group);
      this.roomGroups.set(room.id, group);
    }
  }

  /** W-08: railing runs as posts + a top rail. */
  private addRailings(snap: Snapshot) {
    for (const r of snap.state.railings ?? []) {
      const level = snap.state.levels.find((l) => l.id === r.levelId);
      const base = level?.elevation ?? 0;
      const dx = r.b.x - r.a.x;
      const dy = r.b.y - r.a.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const nx = -uy;
      const ny = ux;
      const w = 40;
      const rail = [
        { x: r.a.x + (nx * w) / 2, y: r.a.y + (ny * w) / 2 },
        { x: r.b.x + (nx * w) / 2, y: r.b.y + (ny * w) / 2 },
        { x: r.b.x - (nx * w) / 2, y: r.b.y - (ny * w) / 2 },
        { x: r.a.x - (nx * w) / 2, y: r.a.y - (ny * w) / 2 },
      ];
      this.addPrism(rail, base + r.height - 60, base + r.height, undefined, "#8b9199", {
        kind: "railing",
        id: r.id,
      }, false);
      const posts = Math.max(2, Math.round(len / 1200));
      for (let i = 0; i <= posts; i++) {
        const t = i / posts;
        const px = r.a.x + ux * len * t;
        const py = r.a.y + uy * len * t;
        const post = [
          { x: px - 30, y: py - 30 },
          { x: px + 30, y: py - 30 },
          { x: px + 30, y: py + 30 },
          { x: px - 30, y: py + 30 },
        ];
        this.addPrism(post, base, base + r.height, undefined, "#9aa4b2", undefined, false);
      }
    }
  }

  /** I-03: draw imported CAD underlays at their level, muted, as line segments. */
  private addUnderlays(snap: Snapshot) {
    const underlays = snap.state.underlays ?? [];
    for (const u of underlays) {
      if (u.visible === false) continue;
      const level = snap.state.levels.find((l) => l.id === u.levelId);
      const y = (level?.elevation ?? 0) + (u.elevationMm ?? 0) + 20;
      const visibility = u.layerVisibility ?? {};
      const positions: number[] = [];
      for (const line of u.lines) {
        if (line.layer && visibility[line.layer] === false) continue;
        positions.push(line.a.x, y, line.a.y, line.b.x, y, line.b.y);
      }
      if (positions.length === 0) continue;
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      const seg = new THREE.LineSegments(
        geom,
        new THREE.LineBasicMaterial({
          color: new THREE.Color(u.color ?? "#7c8797"),
          transparent: true,
          opacity: 0.9,
        }),
      );
      seg.userData = { underlayId: u.id };
      this.modelGroup.add(seg);
    }
  }

  private pickRoom(): string | null {
    const meshes: THREE.Object3D[] = [];
    for (const g of this.roomGroups.values()) meshes.push(...g.children);
    if (meshes.length === 0) return null;
    const hits = this.raycaster.intersectObjects(meshes, false);
    for (const h of hits) {
      const ud = h.object.userData as { roomId?: string };
      if (ud?.roomId) return ud.roomId;
    }
    return null;
  }

  private pickElement(): ElementRef | null {
    if (this.elementMeshes.length === 0) return null;
    const hits = this.raycaster.intersectObjects(this.elementMeshes, false);
    for (const h of hits) {
      const ud = h.object.userData as { elementKind?: string; elementId?: string };
      if (ud?.elementKind && ud?.elementId) {
        return { kind: ud.elementKind as ElementRef["kind"], id: ud.elementId };
      }
    }
    return null;
  }

  private renderSectionLine(snap: Snapshot) {
    const line = snap.sectionLine;
    const a = this.sectionA;
    if (!line && !a) return;
    const color = 0xef4444;
    const group = this.sectionGroup;
    const sectionY = this.drawPlaneElevation + 60;
    const addSeg = (p: Point, q: Point, c: number) => {
      group.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(p.x, sectionY, p.y),
            new THREE.Vector3(q.x, sectionY, q.y),
          ]),
          new THREE.LineBasicMaterial({ color: c }),
        ),
      );
    };
    const addDot = (p: Point, c: number) => {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(320, 10, 10), new THREE.MeshBasicMaterial({ color: c }));
      dot.position.set(p.x, sectionY, p.y);
      group.add(dot);
    };
    if (line) {
      addSeg(line.a, line.b, color);
      addDot(line.a, color);
      addDot(line.b, color);
    }
    if (a) addDot(a, 0xffffff);
  }

  private renderRotateProtractor(snap: Snapshot) {
    this.clearGroup(this.draftGroup);
    const mass = snap.state.masses.find((m) => m.id === snap.selectedMassId);
    if (!mass) return;
    const b = polygonBounds(mass.footprint.outer);
    const radius = Math.max(b.width, b.height) * 0.75 + 1500;
    const center = this.rotateCenter ?? b.center;
    const baseY = massBaseElevation(snap.state, mass);
    const ring: THREE.Vector3[] = [];
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      ring.push(new THREE.Vector3(center.x + Math.cos(a) * radius, baseY + 60, center.y + Math.sin(a) * radius));
    }
    this.draftGroup.add(
      new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), new THREE.LineBasicMaterial({ color: 0xf0913b })),
    );
    const addLine = (to: Point) =>
      this.draftGroup.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(center.x, baseY + 70, center.y),
            new THREE.Vector3(to.x, baseY + 70, to.y),
          ]),
          new THREE.LineBasicMaterial({ color: 0xf0913b }),
        ),
      );
    if (this.rotateBaseline) addLine(this.rotateBaseline);
    if (this.rotateCenter && this.snapPoint) addLine(this.snapPoint);
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(360, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    dot.position.set(center.x, baseY + 70, center.y);
    this.draftGroup.add(dot);
  }

  private angleBetween(center: Point, from: Point, to: Point): number {
    const v1x = from.x - center.x;
    const v1y = from.y - center.y;
    const v2x = to.x - center.x;
    const v2y = to.y - center.y;
    const a = (Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y) * 180) / Math.PI;
    const snapped = Math.round(a / 15) * 15;
    return Math.abs(a - snapped) < 4 ? snapped : a;
  }

  private handleRotateDown(event: PointerEvent, snap: Snapshot) {
    const id = snap.selectedMassId;
    if (!id) {
      this.snapLabel = "select a mass first";
      this.scheduleOverlay();
      return;
    }
    const raw = this.pointerToGround(event);
    if (!raw) return;
    const p = this.computeSnap(event, raw).point;
    if (!this.rotateCenter) {
      this.rotateCenter = p;
    } else if (!this.rotateBaseline) {
      this.rotateBaseline = p;
    } else {
      const angle = this.angleBetween(this.rotateCenter, this.rotateBaseline, p);
      const center = this.rotateCenter;
      const ids = snap.selectedMassIds.length ? snap.selectedMassIds : [id];
      if (Math.abs(angle) > 0.1) {
        const patches = ids.flatMap((mid) => {
          const m = snap.state.masses.find((x) => x.id === mid);
          return m
            ? [{ id: mid, patch: { footprint: rotatePolygon(m.footprint, angle, center) } }]
            : [];
        });
        if (patches.length) this.cb.dispatch({ type: "mass.updateMany", patches });
      }
      this.rotateCenter = null;
      this.rotateBaseline = null;
      this.rotateLiveDeg = 0;
    }
    this.refresh();
  }

  private offsetFromPoint(
    snap: Snapshot,
    point: Point,
  ): { delta: number; poly: Polygon; y: number } | null {
    const id = snap.selectedMassId;
    if (!id) return null;
    const mass = snap.state.masses.find((m) => m.id === id);
    if (!mass) return null;
    const inside = pointInPolygon(point, mass.footprint);
    const dist = distanceToRing(point, mass.footprint.outer);
    const delta = inside ? -dist : dist;
    const poly = inflatePolygon(mass.footprint, delta)[0];
    if (!poly) return null;
    return { delta, poly, y: massBaseElevation(snap.state, mass) + 20 };
  }

  private renderOffsetPreview() {
    this.clearGroup(this.draftGroup);
    const poly = this.offsetPoly;
    if (!poly) return;
    const y = this.offsetY;
    const line = (ring: Point[]) => {
      if (ring.length < 3) return;
      const pts = ring.map((p) => new THREE.Vector3(p.x, y, p.y));
      this.draftGroup.add(
        new THREE.LineLoop(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: this.brandHex }),
        ),
      );
    };
    line(poly.outer);
    for (const hole of poly.holes) line(hole);
  }

  private commitOffset(snap: Snapshot, magnitudeMm?: number) {
    const id = snap.selectedMassId;
    if (!id) {
      this.snapLabel = "select a mass first";
      this.scheduleOverlay();
      return;
    }
    const mass = snap.state.masses.find((m) => m.id === id);
    if (!mass) return;
    const delta = magnitudeMm ?? this.offsetDelta;
    if (delta == null || Math.abs(delta) < 1) {
      this.snapLabel = "move the cursor to set a distance";
      this.scheduleOverlay();
      return;
    }
    const poly = inflatePolygon(mass.footprint, delta)[0];
    if (!poly) {
      this.snapLabel = "offset too large for this shape";
      this.scheduleOverlay();
      return;
    }
    this.cb.dispatch({ type: "mass.update", id, patch: { footprint: poly } });
    this.offsetDelta = null;
    this.offsetPoly = null;
    this.typed = "";
    this.setTyping();
    this.clearGroup(this.draftGroup);
    this.snapLabel = `offset ${Math.round(delta)} mm`;
    this.scheduleOverlay();
    this.refresh();
  }

  private handleSectionDown(event: PointerEvent, _snap: Snapshot) {
    const raw = this.pointerToGround(event);
    if (!raw) return;
    const p = this.computeSnap(event, raw).point;
    if (!this.sectionA) {
      this.sectionA = p;
      this.refresh();
      return;
    }
    const line: SectionLine = { a: this.sectionA, b: p };
    this.sectionA = null;
    this.cb.onSectionLine(line);
  }

  private setOrthoFrustum(half: number) {
    if (!(this.camera instanceof THREE.OrthographicCamera)) return;
    const aspect = this.container.clientWidth / Math.max(1, this.container.clientHeight);
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix();
  }

  /** V-03: open the active view — plan/elevation/section as orthographic. */
  private applyActiveView(view: View | undefined) {
    if (!view || view.id === this.lastViewId) return;
    this.lastViewId = view.id;
    const snap = this.cb.getSnapshot();
    const b = snap.state.site.boundary;
    const center = b.length >= 3 ? polygonBounds(b).center : { x: 10000, y: 7500 };
    const span = b.length >= 3 ? Math.max(polygonBounds(b).width, polygonBounds(b).height) : 30000;

    if (view.kind === "plan") {
      const level = snap.state.levels.find((l) => l.id === view.levelId);
      const z = level?.elevation ?? 0;
      this.controls.target.set(center.x, z, -center.y);
      this.camera.position.set(center.x, z + span * 1.8, -center.y + 0.01);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(this.controls.target);
      this.setOrthoFrustum(span * 0.85);
    } else if (view.kind === "elevation" || view.kind === "section") {
      const d = view.direction ?? "S";
      // Level camera: eye height equals target height, so no top plane is visible.
      const eyeH = span * 0.3;
      this.controls.target.set(center.x, eyeH, -center.y);
      const dist = span * 2;
      if (d === "N") this.camera.position.set(center.x, eyeH, -center.y - dist);
      else if (d === "S") this.camera.position.set(center.x, eyeH, -center.y + dist);
      else if (d === "E") this.camera.position.set(center.x + dist, eyeH, -center.y);
      else this.camera.position.set(center.x - dist, eyeH, -center.y);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(this.controls.target);
      this.setOrthoFrustum(span * 0.85);
    } else {
      this.focusView("iso");
    }
    this.controls.update();
  }

  private buildMass(
    mass: Mass,
    snap: Snapshot,
    opts: { breach: boolean; selected: boolean; dim: boolean; ghost?: boolean; overrideColor?: THREE.Color; opacity?: number },
  ): THREE.Group {
    const group = new THREE.Group();
    const base = massBaseElevation(snap.state, mass);
    const height = mass.intent?.height?.high ?? mass.height;
    group.position.y = base;
    group.userData.massId = mass.id;
    this.massHeights.set(mass.id, height);

    const extrusion = extrudePolygon(mass.footprint, 0, height);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(extrusion.positions, 3));
    geom.setAttribute("normal", new THREE.Float32BufferAttribute(extrusion.normals, 3));

    const baseColor = opts.breach
      ? COLORS.breach
      : this.theme === "light"
        ? 0xd9dde3
        : COLORS.mass;
    let color = opts.overrideColor ?? new THREE.Color(baseColor);
    let vertexColors = false;
    if (snap.sunView && snap.sunFaces && !opts.overrideColor) {
      vertexColors = true;
      const colors = new Float32Array(extrusion.positions.length);
      const neutral = new THREE.Color(0xdadde3);
      const capVerts = (extrusion.positions.length - extrusion.walls.length * 18) / 3;
      for (let i = 0; i < capVerts; i++) {
        colors[i * 3] = neutral.r;
        colors[i * 3 + 1] = neutral.g;
        colors[i * 3 + 2] = neutral.b;
      }
      const byFace = new Map<number, number>();
      for (const f of snap.sunFaces) if (f.massId === mass.id) byFace.set(f.faceIndex, f.hours);
      extrusion.walls.forEach((w, wi) => {
        const c = sunColor(byFace.get(w.faceIndex) ?? 0);
        const start = capVerts + wi * 6;
        for (let k = 0; k < 6; k++) {
          colors[(start + k) * 3] = c.r;
          colors[(start + k) * 3 + 1] = c.g;
          colors[(start + k) * 3 + 2] = c.b;
        }
      });
      geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    }

    const material = new THREE.MeshStandardMaterial({
      color,
      vertexColors,
      transparent: mass.fidelity === "intent" || opts.dim || !!opts.ghost || (opts.opacity ?? 1) < 1,
      opacity: opts.opacity ?? (opts.ghost ? 0.14 : opts.dim ? 0.35 : mass.fidelity === "intent" ? 0.5 : 1),
      roughness: 0.82,
      metalness: 0.02,
      side: THREE.DoubleSide,
      flatShading: true,
      wireframe: opts.dim && !!opts.overrideColor,
    });
    const mesh = new THREE.Mesh(geom, material);
    mesh.userData.massId = mass.id;
    group.add(mesh);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geom, 25),
      new THREE.LineBasicMaterial({
        color: opts.selected
          ? this.brandHex
          : this.theme === "light"
            ? 0xaab1bb
            : 0x333d4a,
        transparent: !!opts.ghost,
        opacity: opts.ghost ? 0.3 : 1,
      }),
    );
    group.add(edges);
    if (opts.selected) {
      const outline = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(
          mass.footprint.outer.map((p) => new THREE.Vector3(p.x, height + 20, p.y)),
        ),
        new THREE.LineBasicMaterial({ color: this.brandHex }),
      );
      group.add(outline);
    }
    return group;
  }

  private addHandles(snap: Snapshot) {
    if (snap.tool !== "vertex" || !snap.selectedMassId) return;
    const mass = snap.state.masses.find((m) => m.id === snap.selectedMassId);
    if (!mass) return;
    const base = massBaseElevation(snap.state, mass);
    const geom = new THREE.SphereGeometry(320, 12, 12);
    const mat = new THREE.MeshBasicMaterial({ color: this.brandHex });
    const addRing = (ring: Point[], holeIndex: number | null, y: number) => {
      ring.forEach((p, vertexIndex) => {
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(p.x, y, p.y);
        mesh.userData = { handle: true, massId: mass.id, holeIndex, vertexIndex };
        this.handleGroup.add(mesh);
        this.handles.push({ mesh, massId: mass.id, holeIndex, vertexIndex });
      });
    };
    addRing(mass.footprint.outer, null, base + (mass.intent?.height?.high ?? mass.height) + 200);
    mass.footprint.holes.forEach((hole, hi) =>
      addRing(hole, hi, base + (mass.intent?.height?.high ?? mass.height) + 200),
    );
  }

  // ------------------------------------------------------------- interaction
  private pointerToGround(event: PointerEvent): Point | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const target = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, target);
    // World Z is the reflection of model Y (see the group Z-scale note above).
    return hit ? { x: target.x, y: -target.z } : null;
  }

  private pickMass(): string | null {
    const hits = this.raycaster.intersectObjects(this.modelGroup.children, true);
    for (const h of hits) {
      let obj: THREE.Object3D | null = h.object;
      while (obj) {
        if (obj.userData?.massId) return obj.userData.massId as string;
        obj = obj.parent;
      }
    }
    return null;
  }

  private pickHandle(): (typeof this.handles)[number] | null {
    const hits = this.raycaster.intersectObjects(this.handleGroup.children, false);
    for (const h of hits) {
      const found = this.handles.find((x) => x.mesh === h.object);
      if (found) return found;
    }
    return null;
  }

  private worldPerPixel(): number {
    if (this.camera instanceof THREE.OrthographicCamera) {
      return (this.camera.top - this.camera.bottom) / this.camera.zoom / this.container.clientHeight;
    }
    const distance = this.camera.position.distanceTo(this.controls.target);
    const height = 2 * Math.tan((this.camera.fov * Math.PI) / 360) * distance;
    return height / this.container.clientHeight;
  }

  // -------------------------------------------------------------- snapping
  // LG-03: candidates are generated in 3D (plan x/y + elevation) and matched in
  // screen pixels, so the cursor attaches to real points at any height and the
  // radius stays constant at any zoom or camera.

  private pointerPixels(event: PointerEvent | MouseEvent): { x: number; y: number } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  /** Model (x, y plan; z elevation) → three.js world (Z is reflected). */
  private toWorld(p: Point3): THREE.Vector3 {
    return new THREE.Vector3(p.x, p.z, -p.y);
  }

  private projectPoint(p: Point3): { x: number; y: number } | null {
    const v = this.toWorld(p).project(this.camera);
    if (!Number.isFinite(v.x) || v.z > 1) return null;
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
  }

  /** True when the orthographic camera looks straight down (everything visible). */
  private isTopDown(): boolean {
    if (!(this.camera instanceof THREE.OrthographicCamera)) return false;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return dir.y < -0.95;
  }

  private isOccluded(p: Point3): boolean {
    const target = this.toWorld(p);
    const dir = target.clone().sub(this.camera.position);
    const dist = dir.length();
    if (dist < 1) return false;
    this.occlusionRay.set(this.camera.position, dir.normalize());
    this.occlusionRay.far = dist;
    const hits = this.occlusionRay.intersectObjects(this.modelGroup.children, true);
    this.occlusionRay.far = Infinity;
    return hits.length > 0 && hits[0].distance < dist - 50;
  }

  private snapView(): SnapView {
    const skip = this.isTopDown();
    return {
      project: (p) => this.projectPoint(p),
      distance: (p) => this.camera.position.distanceTo(this.toWorld(p)),
      isOccluded: skip ? undefined : (p) => this.isOccluded(p),
      skipOcclusion: skip,
    };
  }

  /**
   * Resolve the snap at the pointer. Returns the plan point (for tools that draw
   * on a level), the full 3D point, the translated label and any guide lines.
   * When nothing qualifies the point is the raw plane hit and there is no label,
   * so no marker is shown (bug 1).
   */
  private computeSnap(
    event: PointerEvent,
    raw: Point,
  ): { point: Point; point3: Point3 | null; label: string | null; guides: SnapGuide[] } {
    const snap = this.cb.getSnapshot();
    const activeElev = snap.state.levels.find((l) => l.id === snap.activeLevelId)?.elevation ?? 0;
    const candidates = buildSnapCandidates(snap.state, {
      activeLevelId: snap.activeLevelId,
      activeLevelElevation: activeElev,
      cursorPlan: raw,
      draftPoints: this.draftPoints,
      underlayCullMm: this.worldPerPixel() * 60,
    });
    this.snapCandidates = candidates;
    const pointer = this.pointerPixels(event);
    const result = pickSnap(candidates, pointer, this.snapView(), { radiusPx: 14 }, activeElev);
    this.activeSnapKind = result?.kind ?? null;
    this.lastSnapResult = result;
    if (!result) return { point: raw, point3: null, label: null, guides: [] };
    return {
      point: { x: result.point.x, y: result.point.y },
      point3: result.point,
      label: t(snap.lang, result.label as never),
      guides: result.guides,
    };
  }

  /** Marker overlay data + guide lines + optional debug dots, then the overlay. */
  private renderSnapFeedback(event: PointerEvent) {
    const snap = this.cb.getSnapshot();
    const pointer = this.pointerPixels(event);
    const view = this.snapView();
    const markers: SnapMarkerView[] = nearbySnapMarkers(this.snapCandidates, pointer, view, 14).map((m) => ({
      kind: m.kind,
      x: m.screen.x,
      y: m.screen.y,
      label: t(snap.lang, m.label as never),
      active: false,
    }));
    if (this.snapPoint3) {
      const ap = this.projectPoint(this.snapPoint3);
      if (ap) {
        const hit = markers.find((m) => Math.abs(m.x - ap.x) < 1.5 && Math.abs(m.y - ap.y) < 1.5);
        if (hit) hit.active = true;
        else if (this.activeSnapKind) {
          markers.push({
            kind: this.activeSnapKind,
            x: ap.x,
            y: ap.y,
            label: this.snapLabel ?? "",
            active: true,
          });
        }
      }
    }
    this.overlayMarkers = markers;

    // Guide lines (axis / parallel / perpendicular) and the vertical drop to the
    // drawing plane when the snapped point sits at another elevation.
    this.clearGroup(this.snapGroup);
    const dash = Math.max(this.worldPerPixel() * 6, 60);
    const addGuide = (from: Point3, to: Point3) => {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([this.toWorld(from), this.toWorld(to)]),
        new THREE.LineDashedMaterial({ color: this.brandHex, dashSize: dash, gapSize: dash * 0.6 }),
      );
      line.computeLineDistances();
      this.snapGroup.add(line);
    };
    for (const g of this.snapGuides) addGuide(g.from, g.to);
    if (this.snapPoint3 && Math.abs(this.snapPoint3.z - this.drawPlaneElevation) > 1) {
      addGuide(this.snapPoint3, {
        x: this.snapPoint3.x,
        y: this.snapPoint3.y,
        z: this.drawPlaneElevation,
      });
    }

    if (this.debugSnap) this.renderDebugDots(pointer);
    this.publishSnapDebug(pointer);
    this.scheduleOverlay();
  }

  /** ?debugSnap=1 — draw every nearby candidate as a small dot, colour by kind. */
  private renderDebugDots(pointer: { x: number; y: number }) {
    const geom = new THREE.SphereGeometry(1, 6, 6);
    const colors: Record<string, number> = {
      endpoint: 0xf97316,
      midpoint: 0xfacc15,
      intersection: 0x60a5fa,
      edge: 0x22d3ee,
      close: 0xf0913b,
      grid: 0x9ca3af,
      axis: 0xa78bfa,
      parallel: 0x34d399,
      perpendicular: 0xfb7185,
    };
    let drawn = 0;
    for (const c of this.snapCandidates) {
      if (drawn > 3000) break;
      const p =
        c.kind === "edge"
          ? { x: (c.a.x + c.b.x) / 2, y: (c.a.y + c.b.y) / 2, z: (c.a.z + c.b.z) / 2 }
          : c.point;
      const s = this.projectPoint(p);
      if (!s || Math.hypot(s.x - pointer.x, s.y - pointer.y) > 220) continue;
      const mesh = new THREE.Mesh(
        geom,
        new THREE.MeshBasicMaterial({ color: colors[c.kind] ?? 0xffffff, depthTest: false }),
      );
      mesh.position.copy(this.toWorld(p));
      mesh.scale.setScalar(Math.max(this.worldPerPixel() * 3, 40));
      this.snapGroup.add(mesh);
      drawn++;
    }
  }

  /** A small read-only global so tests can assert snap state without pixels. */
  private publishSnapDebug(pointer: { x: number; y: number }) {
    (window as unknown as { __qreaseeSnap?: unknown }).__qreaseeSnap = {
      kind: this.lastSnapResult?.kind ?? null,
      label: this.lastSnapResult?.label ?? null,
      px: this.lastSnapResult?.px ?? null,
      point: this.lastSnapResult?.point ?? null,
      candidates: this.snapCandidates.length,
      markers: this.overlayMarkers.length,
      debug: this.debugSnap,
      pointer,
    };
  }

  private onKeyUp = (event: KeyboardEvent) => {
    if (event.code === "Space") this.spaceDown = false;
  };

  private onCapturePointerDown = (event: PointerEvent) => {
    const snap = this.cb.getSnapshot();
    // Shift+middle pans without letting OrbitControls orbit.
    if (event.button === 1 && event.shiftKey) {
      this.panning = true;
      this.panLast = { x: event.clientX, y: event.clientY };
      this.controls.enabled = false;
      return;
    }
    // Orbit around whatever is under the cursor instead of the site centre, so
    // the object never leaves the view while rotating.
    if (event.button === 1 || (event.button === 0 && snap.tool === "rotate")) {
      this.recenterToCursor(event);
    }
  };

  private recenterToCursor(event: PointerEvent) {
    this.raycaster.setFromCamera(this.raycasterFromEvent(event), this.camera);
    const hits = this.raycaster.intersectObjects(this.modelGroup.children, true);
    let point: THREE.Vector3 | null = hits.length > 0 ? hits[0].point.clone() : null;
    if (!point) {
      const g = this.pointerToGround(event);
      if (g) point = new THREE.Vector3(g.x, 0, -g.y);
    }
    if (!point) return;
    const oldTarget = this.controls.target.clone();
    const offset = this.camera.position.clone().sub(oldTarget);
    this.controls.target.copy(point);
    this.camera.position.copy(point.clone().add(offset));
    this.controls.update();
  }

  /** Straight-line pan: translate camera and target along the screen plane. */
  private panBy(dxPx: number, dyPx: number) {
    const wpp = this.worldPerPixel();
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
    const move = right.multiplyScalar(-dxPx * wpp).add(up.multiplyScalar(dyPx * wpp));
    this.camera.position.add(move);
    this.controls.target.add(move);
  }

  private onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const snap = this.cb.getSnapshot();
    if (snap.tool === "pan" || this.spaceDown) {
      this.panning = true;
      this.panLast = { x: event.clientX, y: event.clientY };
      this.controls.enabled = false;
      return;
    }
    if (snap.tool === "rotate") {
      this.handleRotateDown(event, snap);
      return;
    }
    if (snap.tool === "section") {
      this.handleSectionDown(event, snap);
      return;
    }
    if (snap.tool === "offset") {
      this.commitOffset(snap);
      return;
    }
    if ((snap.tool === "select" || snap.tool === "move") && snap.mode !== "massing") {
      this.raycaster.setFromCamera(this.raycasterFromEvent(event), this.camera);
      const roomId = this.pickRoom();
      if (roomId) {
        this.cb.onSelectRoom(roomId);
        const ground = this.pointerToGround(event);
        const room = snap.state.rooms.find((r) => r.id === roomId);
        if (ground && room) {
          this.drag = {
            kind: "room",
            massId: "",
            roomId,
            start: ground,
            originalRoom: clonePolygon(room.polygon),
            group: this.roomGroups.get(roomId),
          };
          this.controls.enabled = false;
        }
        return;
      }
      const ref = this.pickElement();
      if (ref) {
        this.cb.onSelectElement(ref);
        return;
      }
      this.cb.onSelectElement(null);
      this.cb.onSelectRoom(null);
    }
    this.raycaster.setFromCamera(this.raycasterFromEvent(event), this.camera);
    this.downAt = { x: event.clientX, y: event.clientY, time: performance.now() };

    if (snap.tool === "select" || snap.tool === "move") {
      const id = this.pickMass();
      const additive = event.shiftKey;
      this.cb.onSelect(id, additive);
      if (id && !additive) {
        const ground = this.pointerToGround(event);
        const mass = snap.state.masses.find((m) => m.id === id);
        if (ground && mass) {
          const memberIds =
            mass.groupId != null
              ? snap.state.masses.filter((m) => m.groupId === mass.groupId).map((m) => m.id)
              : [id];
          this.drag = {
            kind: "move",
            massId: id,
            memberIds,
            start: ground,
            original: clonePolygon(mass.footprint),
          };
          this.controls.enabled = false;
        }
      }
      return;
    }

    if (snap.tool === "pushpull") {
      const id = this.pickMass();
      if (id) {
        this.cb.onSelect(id);
        const mass = snap.state.masses.find((m) => m.id === id);
        this.drag = {
          kind: "height",
          massId: id,
          start: { x: 0, y: 0 },
          startY: event.clientY,
          startHeight: mass?.height ?? 3500,
          group: this.massGroups.get(id),
          liveHeight: mass?.height ?? 3500,
        };
        this.controls.enabled = false;
      }
      return;
    }

    if (snap.tool === "vertex") {
      const handle = this.pickHandle();
      if (handle) {
        this.drag = {
          kind: "vertex",
          massId: handle.massId,
          start: { x: 0, y: 0 },
          holeIndex: handle.holeIndex,
          vertexIndex: handle.vertexIndex,
          handle: handle.mesh,
        };
        this.controls.enabled = false;
        return;
      }
      const id = this.pickMass();
      this.cb.onSelect(id);
      this.refresh();
      return;
    }

    // Drawing tools use the ground.
    const raw = this.pointerToGround(event);
    if (!raw) return;
    const snapped = this.computeSnap(event, raw);
    this.snapPoint = snapped.point;
    this.snapLabel = snapped.label;
    this.snapPoint3 = snapped.point3;
    this.snapGuides = snapped.guides;

    if (snap.tool === "circle") {
      this.circleCenter = snapped.point;
      this.circleRadius = 0;
      this.controls.enabled = false;
      this.updateDraftPreview(snap);
      this.scheduleOverlay();
      return;
    }

    if (snap.tool === "ellipse") {
      if (!this.ellipseCenter) {
        this.ellipseCenter = snapped.point;
      } else {
        const c = this.ellipseCenter;
        const rx = Math.abs(snapped.point.x - c.x);
        const ry = Math.abs(snapped.point.y - c.y);
        this.ellipseCenter = null;
        this.clearGroup(this.draftGroup);
        if (rx > 100 && ry > 100) {
          this.createMass({ outer: ellipsePolygon(c, rx, ry), holes: [] }, snap);
        }
      }
      this.updateDraftPreview(snap);
      this.scheduleOverlay();
      return;
    }

    if (snap.tool === "arc") {
      if (!this.arcA) {
        this.arcA = snapped.point;
      } else if (!this.arcB) {
        this.arcB = snapped.point;
      } else {
        this.commitArc(snapped.point, snap);
        return;
      }
      this.updateDraftPreview(snap);
      this.scheduleOverlay();
      return;
    }

    if (snap.tool === "rectangle" && snap.lens !== "reflect") {
      if (!this.rectStart) {
        this.rectStart = snapped.point;
      } else {
        this.commitRectangle(this.rectStart, snapped.point, snap);
        this.rectStart = null;
      }
      this.scheduleOverlay();
      return;
    }

    if (snap.tool === "road") {
      this.toggleRoadEdge(snapped.point, snap);
      return;
    }

    if (snap.tool === "wall") {
      this.draftPoints.push(snapped.point);
      const n = this.draftPoints.length;
      if (n >= 2) {
        const a = this.draftPoints[n - 2];
        const b = this.draftPoints[n - 1];
        if (Math.hypot(b.x - a.x, b.y - a.y) > 50) this.cb.onAddWall(a, b);
        else this.draftPoints.pop();
      }
      this.renderDraft(snap);
      this.scheduleOverlay();
      return;
    }

    if (snap.tool === "room") {
      const first = this.draftPoints[0];
      if (first && this.draftPoints.length >= 3 && near(snapped.point, first, this.worldPerPixel() * 12)) {
        this.commitDraft(snap);
        return;
      }
      this.draftPoints.push(snapped.point);
      this.renderDraft(snap);
      this.scheduleOverlay();
      return;
    }

    if (snap.tool === "door" || snap.tool === "window") {
      this.cb.onPlaceOpening(snapped.point, snap.tool);
      return;
    }

    if (snap.tool === "stair") {
      if (!this.stairA) {
        this.stairA = snapped.point;
      } else {
        const a = this.stairA;
        this.stairA = null;
        this.cb.onAddStair(a, snapped.point);
      }
      this.scheduleOverlay();
      return;
    }

    if (snap.tool === "roof") {
      if (!this.roofA) {
        this.roofA = snapped.point;
      } else {
        const a = this.roofA;
        const b = snapped.point;
        this.roofA = null;
        this.cb.onAddRoof([
          { x: a.x, y: a.y },
          { x: b.x, y: a.y },
          { x: b.x, y: b.y },
          { x: a.x, y: b.y },
        ]);
      }
      this.scheduleOverlay();
      return;
    }

    if (snap.tool === "eraser") {
      const massId = this.pickMass();
      if (massId) {
        this.cb.dispatch({ type: "mass.remove", id: massId });
      } else {
        const roomId = this.pickRoom();
        if (roomId) this.cb.dispatch({ type: "room.remove", id: roomId });
      }
      return;
    }

    if (snap.tool === "paint") {
      const materialId = useApp.getState().activeMaterialId;
      const ref = this.pickElement();
      if (ref) {
        this.cb.onElementMaterial(ref, materialId);
      } else {
        const massId = this.pickMass();
        const color = materialById(materialId)?.color;
        if (massId && color) {
          this.cb.dispatch({ type: "mass.update", id: massId, patch: { color } });
        }
      }
      return;
    }

    if (snap.tool === "tape") {
      if (!this.tapeA) {
        this.tapeA = snapped.point;
      } else {
        const a = this.tapeA;
        const dist = Math.hypot(snapped.point.x - a.x, snapped.point.y - a.y);
        this.tapeLabel = `${(dist / 1000).toFixed(3)} m`;
        this.tapeA = null;
      }
      this.scheduleOverlay();
      return;
    }

    if (snap.tool === "copy") {
      const ids = snap.selectedMassIds.length
        ? snap.selectedMassIds
        : snap.selectedMassId
          ? [snap.selectedMassId]
          : [];
      const masses = ids
        .map((id) => snap.state.masses.find((m) => m.id === id))
        .filter((m): m is NonNullable<typeof m> => !!m);
      if (masses.length === 0) {
        this.snapLabel = t(snap.lang, "overlay.selectMassFirst" as never);
        this.scheduleOverlay();
        return;
      }
      const pts = masses.flatMap((m) => m.footprint.outer);
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      const clones = masses.map((m) => ({
        ...(JSON.parse(JSON.stringify(m)) as typeof m),
        id: newId("mass"),
        footprint: translatePolygon(m.footprint, snapped.point.x - cx, snapped.point.y - cy),
      }));
      this.cb.dispatch({ type: "mass.addMany", masses: clones });
      return;
    }

    if (snap.tool === "railing") {
      if (!this.railingA) {
        this.railingA = snapped.point;
      } else {
        const a = this.railingA;
        this.railingA = null;
        this.cb.onAddRailing(a, snapped.point);
      }
      this.scheduleOverlay();
      return;
    }

    if (snap.tool === "site" || snap.tool === "polygon" || snap.tool === "green") {
      const first = this.draftPoints[0];
      if (first && this.draftPoints.length >= 3 && near(snapped.point, first, this.worldPerPixel() * 12)) {
        this.commitDraft(snap);
        return;
      }
      this.draftPoints.push(snapped.point);
      this.renderDraft(snap);
      this.scheduleOverlay();
    }
  };

  private onPointerMove = (event: PointerEvent) => {
    if (this.panning) {
      this.panBy(event.clientX - this.panLast.x, event.clientY - this.panLast.y);
      this.panLast = { x: event.clientX, y: event.clientY };
      return;
    }
    const snap = this.cb.getSnapshot();
    this.raycaster.setFromCamera(this.raycasterFromEvent(event), this.camera);
    const raw = this.pointerToGround(event);
    if (!raw) return;
    const snapped = this.computeSnap(event, raw);
    this.snapPoint = snapped.point;
    this.snapLabel = snapped.label;
    this.snapPoint3 = snapped.point3;
    this.snapGuides = snapped.guides;
    this.lastPointer = snapped.point;

    // LG-03: markers + guides, in sync with the cursor.
    if (snap.tool !== "pan" && snap.tool !== "rotate" && snap.tool !== "section" && snap.tool !== "offset") {
      this.renderSnapFeedback(event);
    }

    if (snap.tool === "rotate" && this.rotateCenter && this.rotateBaseline && this.snapPoint) {
      this.rotateLiveDeg = this.angleBetween(this.rotateCenter, this.rotateBaseline, this.snapPoint);
      this.snapLabel = `${Math.round(this.rotateLiveDeg)}°`;
      this.renderRotateProtractor(snap);
      this.scheduleOverlay();
      return;
    }

    if (snap.tool === "offset") {
      const raw = this.pointerToGround(event);
      if (!raw) return;
      const point = this.computeSnap(event, raw).point;
      this.lastPointer = point;
      const res = this.offsetFromPoint(snap, point);
      this.offsetInside = res ? res.delta < 0 : false;
      this.offsetDelta = res ? res.delta : null;
      this.offsetPoly = res?.poly ?? null;
      if (res) this.offsetY = res.y;
      this.renderOffsetPreview();
      this.snapLabel = res
        ? `${res.delta >= 0 ? "+" : ""}${Math.round(res.delta)} mm`
        : "select a mass first";
      this.scheduleOverlay();
      return;
    }

    if (this.drag) {
      if (this.drag.kind === "move" && this.drag.original) {
        const dx = snapped.point.x - this.drag.start.x;
        const dy = snapped.point.y - this.drag.start.y;
        for (const mid of this.drag.memberIds ?? [this.drag.massId]) {
          const g = this.massGroups.get(mid);
          if (g) g.position.set(dx, g.position.y, dy);
        }
      } else if (this.drag.kind === "height" && this.drag.group && this.drag.startY !== undefined) {
        const delta = (this.drag.startY - event.clientY) * this.worldPerPixel() * 0.9;
        const next = Math.max(500, Math.min(60000, (this.drag.startHeight ?? 3500) + delta));
        this.drag.liveHeight = next;
        const original = this.massHeights.get(this.drag.massId) || next;
        this.drag.group.scale.y = next / original;
      } else if (this.drag.kind === "room" && this.drag.group) {
        const dx = snapped.point.x - this.drag.start.x;
        const dy = snapped.point.y - this.drag.start.y;
        this.drag.group.position.set(dx, this.drag.group.position.y, dy);
      } else if (this.drag.kind === "vertex" && this.drag.handle) {
        const base = this.drag.handle.position.y;
        this.drag.handle.position.set(snapped.point.x, base, snapped.point.y);
      }
      this.updateDraftPreview(snap);
      this.scheduleOverlay();
      return;
    }

    if (this.circleCenter && this.lastPointer) {
      this.circleRadius = Math.hypot(
        snapped.point.x - this.circleCenter.x,
        snapped.point.y - this.circleCenter.y,
      );
    }
    if (this.draftPoints.length > 0 || this.rectStart || this.circleCenter || this.arcA || this.ellipseCenter) {
      this.updateDraftPreview(snap);
    }
    this.scheduleOverlay();
  };

  private onPointerUp = (event: PointerEvent) => {
    if (this.panning) {
      this.panning = false;
      this.controls.enabled = true;
      return;
    }
    if (event.button !== 0) return;
    const snap = this.cb.getSnapshot();
    if (snap.tool === "circle" && this.circleCenter) {
      const center = this.circleCenter;
      const radius = this.circleRadius;
      this.circleCenter = null;
      this.circleRadius = 0;
      this.controls.enabled = true;
      this.clearGroup(this.draftGroup);
      if (radius > 100) this.createMass({ outer: circlePolygon(center, radius), holes: [] }, snap);
      this.scheduleOverlay();
      return;
    }
    const drag = this.drag;
    if (!drag) return;
    this.controls.enabled = true;

    if (drag.kind === "move" && drag.original) {
      const dx = (this.lastPointer?.x ?? drag.start.x) - drag.start.x;
      const dy = (this.lastPointer?.y ?? drag.start.y) - drag.start.y;
      if (Math.hypot(dx, dy) > 20) {
        const ids = drag.memberIds && drag.memberIds.length > 1 ? drag.memberIds : [drag.massId];
        this.cb.dispatch({ type: "mass.moveMany", ids, dx, dy });
      }
    } else if (drag.kind === "height" && drag.liveHeight !== undefined) {
      const mass = snap.state.masses.find((m) => m.id === drag.massId);
      if (mass && Math.abs(drag.liveHeight - mass.height) > 1) {
        this.cb.dispatch({ type: "mass.update", id: drag.massId, patch: { height: Math.round(drag.liveHeight) } });
      }
    } else if (drag.kind === "room" && drag.roomId && drag.originalRoom) {
      const dx = (this.lastPointer?.x ?? drag.start.x) - drag.start.x;
      const dy = (this.lastPointer?.y ?? drag.start.y) - drag.start.y;
      if (Math.hypot(dx, dy) > 20) {
        const polygon = translatePolygon(drag.originalRoom, dx, dy);
        const boxes: StackBox[] = [];
        for (const r of snap.state.rooms) {
          if (r.id === drag.roomId || r.fidelity !== "concept") continue;
          const lvl = snap.state.levels.find((l) => l.id === r.levelId);
          boxes.push({
            polygon: r.polygon,
            baseMm: r.elevationMm ?? lvl?.elevation ?? 0,
            heightMm: r.height ?? 3000,
          });
        }
        const elevationMm = stackElevationFor(boxes, polygon);
        this.cb.dispatch({ type: "room.update", id: drag.roomId, patch: { polygon, elevationMm } });
      }
    } else if (drag.kind === "vertex" && drag.vertexIndex !== undefined && drag.handle) {
      const p = { x: drag.handle.position.x, y: drag.handle.position.z };
      this.cb.dispatch({
        type: "mass.setVertex",
        id: drag.massId,
        holeIndex: drag.holeIndex ?? null,
        vertexIndex: drag.vertexIndex,
        point: p,
      });
    }
    this.drag = null;
    this.refresh();
  };

  private onPointerLeave = () => {
    if (this.drag) this.onPointerUp({ button: 0 } as PointerEvent);
    this.clearGroup(this.snapGroup);
    this.overlayMarkers = [];
    this.scheduleOverlay();
  };

  private pickElementAt(event: MouseEvent): ElementRef | null {
    this.raycaster.setFromCamera(this.raycasterFromEvent(event as PointerEvent), this.camera);
    return this.pickElement();
  }

  private meshFor(ref: ElementRef): THREE.Mesh | null {
    for (const obj of this.elementMeshes) {
      const u = obj.userData as { elementKind?: string; elementId?: string };
      if (u.elementKind === ref.kind && u.elementId === ref.id) return obj as THREE.Mesh;
    }
    return null;
  }

  private highlightDrop(ref: ElementRef) {
    const mesh = this.meshFor(ref);
    const mat = mesh?.material as THREE.MeshStandardMaterial | undefined;
    if (mat && "emissive" in mat) {
      mat.emissive = new THREE.Color(this.brandHex);
      mat.emissiveIntensity = 0.55;
      this.dropHighlight = mesh;
    }
  }

  private clearDropHighlight() {
    const mat = this.dropHighlight?.material as THREE.MeshStandardMaterial | undefined;
    if (mat && "emissive" in mat) {
      mat.emissive = new THREE.Color(0x000000);
      mat.emissiveIntensity = 0;
    }
    this.dropHighlight = null;
  }

  private onDragOver = (event: DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    if (!this.cb.getSnapshot().showSchematic) return;
    const ref = this.pickElementAt(event);
    const same =
      ref && this.dropRef && ref.kind === this.dropRef.kind && ref.id === this.dropRef.id;
    if (same) return;
    this.clearDropHighlight();
    this.dropRef = ref;
    if (ref) this.highlightDrop(ref);
  };

  private onDragLeave = () => {
    this.clearDropHighlight();
    this.dropRef = null;
  };

  private onDrop = (event: DragEvent) => {
    event.preventDefault();
    const id =
      event.dataTransfer?.getData(MATERIAL_DND_TYPE) ||
      event.dataTransfer?.getData("text/plain") ||
      "";
    const ref = this.pickElementAt(event);
    this.clearDropHighlight();
    this.dropRef = null;
    if (id && ref) this.cb.onElementMaterial(ref, id);
  };

  private raycasterFromEvent(event: PointerEvent): THREE.Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    return this.pointer;
  }

  private onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable))
      return;
    const snap = this.cb.getSnapshot();
    const drawing = ["site", "polygon", "green", "rectangle", "circle", "arc", "offset"].includes(snap.tool);
    // Space arms pan only mid-drag/mid-draft; otherwise it is the Select shortcut.
    if (
      event.code === "Space" &&
      (this.drag || this.draftPoints.length > 0 || this.rectStart || this.circleCenter || snap.tool === "pan")
    ) {
      this.spaceDown = true;
      event.preventDefault();
      return;
    }

    if (event.key === "Escape") {
      this.cancelDraft();
      return;
    }
    if (drawing && /^[0-9.,mM]$/.test(event.key)) {
      this.typed += event.key;
      this.setTyping();
      this.scheduleOverlay();
      event.preventDefault();
      return;
    }
    if (event.key === "Backspace" && this.typed) {
      this.typed = this.typed.slice(0, -1);
      this.setTyping();
      this.scheduleOverlay();
      event.preventDefault();
      return;
    }
    if (event.key === "Backspace" && this.draftPoints.length) {
      this.draftPoints.pop();
      this.renderDraft(snap);
      this.scheduleOverlay();
      event.preventDefault();
      return;
    }
    if (event.key === "Enter") {
      if (this.typed) {
        this.applyTyped(snap);
      } else if (snap.tool === "wall" && this.draftPoints.length >= 2) {
        this.cancelDraft();
        this.refresh();
      } else if (this.draftPoints.length >= 3) {
        this.commitDraft(snap);
      }
    }
  };

  private applyTyped(snap: Snapshot) {
    const parts = this.typed.split(",").map((s) => parseLength(s));
    this.typed = "";
    this.setTyping();
    if (snap.tool === "offset") {
      const mag = Math.abs(parts[0] ?? 0);
      if (mag > 0) {
        const signed = (parts[0] ?? 0) < 0 ? -mag : this.offsetInside ? -mag : mag;
        this.commitOffset(snap, signed);
      }
      return;
    }
    if (snap.tool === "wall" && this.draftPoints.length >= 1 && parts[0] > 0) {
      const last = this.draftPoints[this.draftPoints.length - 1];
      const dir = this.lastPointer
        ? normalize({ x: this.lastPointer.x - last.x, y: this.lastPointer.y - last.y })
        : { x: 1, y: 0 };
      const next = { x: last.x + dir.x * parts[0], y: last.y + dir.y * parts[0] };
      this.draftPoints.push(next);
      this.cb.onAddWall(last, next);
      this.renderDraft(snap);
      this.scheduleOverlay();
      return;
    }
    if (snap.tool === "ellipse" && this.ellipseCenter && parts[0] > 0) {
      const c = this.ellipseCenter;
      const rx = parts[0];
      const ry = parts[1] ?? parts[0];
      this.ellipseCenter = null;
      this.clearGroup(this.draftGroup);
      this.createMass({ outer: ellipsePolygon(c, rx, ry), holes: [] }, snap);
      this.scheduleOverlay();
      return;
    }
    if (snap.tool === "circle" && this.circleCenter && parts[0] > 0) {
      const center = this.circleCenter;
      this.circleCenter = null;
      this.circleRadius = 0;
      this.clearGroup(this.draftGroup);
      this.createMass({ outer: circlePolygon(center, parts[0]), holes: [] }, snap);
      this.scheduleOverlay();
      return;
    }
    if (snap.tool === "rectangle" && this.rectStart && parts.length >= 1) {
      const w = parts[0];
      const d = parts[1] ?? parts[0];
      if (w > 0 && d > 0) {
        const start = this.rectStart;
        this.commitRectangle(start, { x: start.x + w, y: start.y + d }, snap);
        this.rectStart = null;
      }
      this.scheduleOverlay();
      return;
    }
    if (this.draftPoints.length >= 1 && parts[0] > 0) {
      const last = this.draftPoints[this.draftPoints.length - 1];
      const dir = this.lastPointer
        ? normalize({ x: this.lastPointer.x - last.x, y: this.lastPointer.y - last.y })
        : { x: 1, y: 0 };
      this.draftPoints.push({ x: last.x + dir.x * parts[0], y: last.y + dir.y * parts[0] });
      this.renderDraft(snap);
    }
    this.scheduleOverlay();
  }

  private setTyping() {
    useApp.setState({ typingValue: this.typed.length > 0 });
  }

  private cancelDraft() {
    this.draftPoints = [];
    this.rectStart = null;
    this.circleCenter = null;
    this.circleRadius = 0;
    this.ellipseCenter = null;
    this.arcA = null;
    this.arcB = null;
    this.typed = "";
    this.setTyping();
    this.offsetDelta = null;
    this.offsetPoly = null;
    this.clearGroup(this.draftGroup);
    this.scheduleOverlay();
  }

  private commitDraft(snap: Snapshot) {
    if (this.draftPoints.length < 3) return;
    const points = this.draftPoints.map((p) => ({ ...p }));
    if (snap.tool === "site") {
      this.cb.dispatch({ type: "site.setBoundary", points });
    } else if (snap.tool === "green") {
      this.cb.dispatch({ type: "site.addSurface", surface: { id: newId("surf"), kind: "green", points } });
    } else if (snap.tool === "polygon") {
      this.createMass({ outer: points, holes: [] }, snap);
    } else if (snap.tool === "room") {
      // W-03: a room polygon generates its bounding walls.
      this.cb.onAddRoom(points);
    }
    this.cancelDraft();
  }

  private commitRectangle(a: Point, b: Point, snap: Snapshot) {
    const x1 = Math.min(a.x, b.x);
    const x2 = Math.max(a.x, b.x);
    const y1 = Math.min(a.y, b.y);
    const y2 = Math.max(a.y, b.y);
    if (x2 - x1 < 100 || y2 - y1 < 100) return;
    this.createMass(
      {
        outer: [
          { x: x1, y: y1 },
          { x: x2, y: y1 },
          { x: x2, y: y2 },
          { x: x1, y: y2 },
        ],
        holes: [],
      },
      snap,
    );
  }

  private createMass(footprint: Polygon, snap: Snapshot) {
    const levelId = snap.activeLevelId ?? snap.state.levels[0]?.id;
    if (!levelId) {
      this.cb.dispatch({ type: "level.add", level: { id: newId("lvl"), name: "Lt. 1", elevation: 0, floorToFloor: 3500 } });
    }
    const level = snap.state.levels.find((l) => l.id === levelId);
    const id = newId("mass");
    const mass: Mass = {
      id,
      levelIds: [snap.activeLevelId ?? snap.state.levels[0]?.id ?? levelId],
      footprint,
      height: level?.floorToFloor ?? 3500,
      fidelity: "massing",
    };
    this.cb.dispatch({ type: "mass.add", mass });
    this.cb.onSelect(id);
  }

  private toggleRoadEdge(p: Point, snap: Snapshot) {
    const b = snap.state.site.boundary;
    let bestEdge = -1;
    let bestDist = this.worldPerPixel() * 16;
    for (let i = 0; i < b.length; i++) {
      const a = b[i];
      const c = b[(i + 1) % b.length];
      const proj = projectPointOnSegment(p, a, c);
      if (!proj) continue;
      const dist = Math.hypot(proj.x - p.x, proj.y - p.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestEdge = i;
      }
    }
    if (bestEdge < 0) return;
    const exists = snap.state.site.roadEdges.some((r) => r.edgeIndex === bestEdge);
    const roadEdges = exists
      ? snap.state.site.roadEdges.filter((r) => r.edgeIndex !== bestEdge)
      : [...snap.state.site.roadEdges, { edgeIndex: bestEdge }];
    this.cb.dispatch({ type: "site.setRoadEdges", roadEdges });
  }

  private renderDraft(snap: Snapshot) {
    this.clearGroup(this.draftGroup);
    const pts = this.draftPoints.map((p) => new THREE.Vector3(p.x, this.draftY, p.y));
    if (this.snapPoint && snap.tool !== "select") pts.push(new THREE.Vector3(this.snapPoint.x, this.draftY, this.snapPoint.y));
    if (pts.length >= 2) {
      const color = snap.tool === "site" ? COLORS.site : snap.tool === "green" ? COLORS.green : this.brandHex;
      this.draftGroup.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color }),
        ),
      );
    }
    // vertex markers
    const geom = new THREE.SphereGeometry(260, 10, 10);
    for (const p of this.draftPoints) {
      const dot = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      dot.position.set(p.x, this.draftY, p.y);
      this.draftGroup.add(dot);
    }
  }

  private updateDraftPreview(snap: Snapshot) {
    if (this.ellipseCenter && this.snapPoint) {
      this.clearGroup(this.draftGroup);
      this.draftGroup.add(
        this.buildEllipseGuide(
          this.ellipseCenter,
          Math.abs(this.snapPoint.x - this.ellipseCenter.x),
          Math.abs(this.snapPoint.y - this.ellipseCenter.y),
        ),
      );
      this.addSnapMarker();
      return;
    }
    if (this.circleCenter && this.snapPoint) {
      this.clearGroup(this.draftGroup);
      this.draftGroup.add(this.buildGuideRing(this.circleCenter, this.circleRadius));
      this.addSnapMarker();
      return;
    }
    if (this.arcA) {
      this.clearGroup(this.draftGroup);
      const pts: Point[] = [];
      if (this.arcB && this.snapPoint) {
        pts.push(...quadBezier(this.arcA, this.snapPoint, this.arcB, 32));
      } else if (this.snapPoint) {
        pts.push(this.arcA, this.snapPoint);
      }
      if (pts.length >= 2) {
        this.draftGroup.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, this.draftY, p.y))),
            new THREE.LineBasicMaterial({ color: this.brandHex }),
          ),
        );
      }
      for (const p of [this.arcA, this.arcB].filter(Boolean) as Point[]) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(300, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        dot.position.set(p.x, this.draftY, p.y);
        this.draftGroup.add(dot);
      }
      this.addSnapMarker();
      return;
    }
    if (this.rectStart && this.snapPoint) {
      this.clearGroup(this.draftGroup);
      const a = this.rectStart;
      const b = this.snapPoint;
      const x1 = Math.min(a.x, b.x);
      const x2 = Math.max(a.x, b.x);
      const y1 = Math.min(a.y, b.y);
      const y2 = Math.max(a.y, b.y);
      const ring = [
        new THREE.Vector3(x1, this.draftY, y1),
        new THREE.Vector3(x2, this.draftY, y1),
        new THREE.Vector3(x2, this.draftY, y2),
        new THREE.Vector3(x1, this.draftY, y2),
      ];
      this.draftGroup.add(
        new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ring), new THREE.LineBasicMaterial({ color: this.brandHex })),
      );
      this.addSnapMarker();
      return;
    }
    if (this.draftPoints.length > 0) {
      this.renderDraft(snap);
      this.addSnapMarker();
    }
  }

  private addSnapMarker() {
    if (!this.snapPoint) return;
    const snapped = !!this.snapLabel;
    const closing = this.snapLabel === "close";
    const color = closing ? 0x22c55e : snapped ? this.brandHex : 0xffffff;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(snapped ? 420 : 260, snapped ? 70 : 40, 8, 24),
      new THREE.MeshBasicMaterial({ color }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(this.snapPoint.x, this.draftY + 4, this.snapPoint.y);
    this.draftGroup.add(ring);
  }

  private buildGuideRing(center: Point, radius: number): THREE.Object3D {
    const points: THREE.Vector3[] = [];
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(center.x + Math.cos(a) * radius, this.draftY, center.y + Math.sin(a) * radius));
    }
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: this.brandHex }),
    );
  }

  private buildEllipseGuide(center: Point, rx: number, ry: number): THREE.Object3D {
    const points: THREE.Vector3[] = [];
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(center.x + Math.cos(a) * rx, this.draftY, center.y + Math.sin(a) * ry));
    }
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: this.brandHex }),
    );
  }

  private commitArc(control: Point, snap: Snapshot) {
    if (!this.arcA || !this.arcB) return;
    const points = quadBezier(this.arcA, control, this.arcB, 40);
    this.arcA = null;
    this.arcB = null;
    this.clearGroup(this.draftGroup);
    if (points.length >= 3) this.createMass({ outer: points, holes: [] }, snap);
    this.scheduleOverlay();
  }

  /** Switch between perspective and orthographic without a view jump. */
  setProjection(kind: "perspective" | "orthographic") {
    if (kind === this.projection) return;
    const target = this.controls.target.clone();
    const aspect = this.container.clientWidth / Math.max(1, this.container.clientHeight);
    if (kind === "orthographic") {
      const distance = this.persp.position.distanceTo(target);
      const halfH = Math.tan((this.persp.fov * Math.PI) / 360) * distance;
      const halfW = halfH * aspect;
      this.ortho.left = -halfW;
      this.ortho.right = halfW;
      this.ortho.top = halfH;
      this.ortho.bottom = -halfH;
      this.ortho.zoom = 1;
      this.ortho.near = 1;
      this.ortho.far = 2_000_000;
      this.ortho.position.copy(this.camera.position);
      this.ortho.up.copy(this.camera.up);
      this.ortho.lookAt(target);
      this.ortho.updateProjectionMatrix();
      this.camera = this.ortho;
    } else {
      const halfH = (this.ortho.top - this.ortho.bottom) / (2 * this.ortho.zoom);
      const distance = Math.max(500, halfH / Math.tan((this.persp.fov * Math.PI) / 360));
      const dir = this.camera.position.clone().sub(target);
      if (dir.lengthSq() < 1) dir.set(1, 1, 1);
      dir.normalize();
      this.persp.position.copy(target.clone().add(dir.multiplyScalar(distance)));
      this.persp.up.copy(this.camera.up);
      this.persp.lookAt(target);
      this.persp.updateProjectionMatrix();
      this.camera = this.persp;
    }
    this.projection = kind;
    (this.controls as unknown as { object: THREE.Camera }).object = this.camera;
    this.controls.update();
  }

  focusView(kind: "top" | "front" | "iso" | "fit") {
    const snap = this.cb.getSnapshot();
    const b = snap.state.site.boundary;
    const center = b.length >= 3 ? polygonBounds(b).center : { x: 10000, y: 7500 };
    const span = b.length >= 3 ? Math.max(polygonBounds(b).width, polygonBounds(b).height) : 30000;
    this.controls.target.set(center.x, 2000, -center.y);
    if (kind === "top") this.camera.position.set(center.x, span * 1.8, -center.y + 0.01);
    else if (kind === "front") this.camera.position.set(center.x, span * 0.5, -center.y + span * 1.8);
    else if (kind === "iso") this.camera.position.set(center.x + span, span * 1.1, -center.y + span);
    else this.camera.position.set(center.x + span * 1.2, span * 1.2, -center.y + span * 1.2);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.controls.target);
    if (this.camera instanceof THREE.OrthographicCamera) {
      const half = span * 0.85;
      const aspect = this.container.clientWidth / Math.max(1, this.container.clientHeight);
      this.camera.top = half;
      this.camera.bottom = -half;
      this.camera.left = -half * aspect;
      this.camera.right = half * aspect;
      this.camera.zoom = 1;
      this.camera.updateProjectionMatrix();
    }
    this.controls.update();
  }
}

// ------------------------------------------------------------------ helpers
function hintFor(tool: string): string {
  switch (tool) {
    case "site":
      return "viewport.hint.drawSite";
    case "polygon":
    case "rectangle":
      return "viewport.hint.drawFootprint";
    case "circle":
      return "viewport.hint.circle";
    case "ellipse":
      return "viewport.hint.ellipse";
    case "arc":
      return "viewport.hint.arc";
    case "pushpull":
      return "viewport.hint.pushpull";
    case "road":
      return "viewport.hint.road";
    case "green":
      return "viewport.hint.green";
    case "vertex":
      return "viewport.hint.vertex";
    default:
      return "viewport.hint.select";
  }
}

function parseLength(raw: string): number {
  const trimmed = raw.trim().toLowerCase();
  const hasM = trimmed.endsWith("m");
  const value = Number(trimmed.replace(/m$/, "").replace(",", "."));
  if (!Number.isFinite(value)) return 0;
  if (hasM) return value * 1000;
  // Values below 100 are read as metres (e.g. "3.5"), otherwise millimetres.
  return value < 100 ? value * 1000 : value;
}

function projectPointOnSegment(p: Point, a: Point, b: Point): Point | null {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-6) return null;
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + abx * t, y: a.y + aby * t };
}

function near(a: Point, b: Point, eps: number): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= eps;
}

function normalize(v: Point): Point {
  const l = Math.hypot(v.x, v.y);
  return l < 1e-6 ? { x: 1, y: 0 } : { x: v.x / l, y: v.y / l };
}

function circlePolygon(center: Point, radius: number, segments = 64): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push({ x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius });
  }
  return pts;
}

function ellipsePolygon(center: Point, rx: number, ry: number, segments = 64): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push({ x: center.x + Math.cos(a) * rx, y: center.y + Math.sin(a) * ry });
  }
  return pts;
}

/** Quadratic Bezier through a control point, sampled into a polyline. */
function quadBezier(a: Point, c: Point, b: Point, segments: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    pts.push({
      x: mt * mt * a.x + 2 * mt * t * c.x + t * t * b.x,
      y: mt * mt * a.y + 2 * mt * t * c.y + t * t * b.y,
    });
  }
  return pts;
}

function breachSet(state: DocState): Set<string> {
  return breachingMassIds(state);
}

function hasSetbacks(state: DocState): boolean {
  return Object.values(state.rules.setbacks).some((v) => v > 0);
}

function makeLabel(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.font = "bold 90px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 68);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(3000, 3000, 1);
  return sprite;
}

function disposeObject(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose();
  });
}
