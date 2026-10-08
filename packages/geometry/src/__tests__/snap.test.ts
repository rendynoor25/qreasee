import { describe, expect, it } from "vitest";
import { emptyDocState, type DocState, type Point } from "@qreasee/shared";
import {
  buildSnapCandidates,
  pickSnap,
  type Point3,
  type SnapCandidate,
  type SnapView,
} from "../snap";

// --- fake cameras (model space: x/y plan, z elevation) ---------------------

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const toV = (p: Point3): V3 => [p.x, p.y, p.z];

interface Cam {
  project: (p: Point3) => { x: number; y: number } | null;
  distance: (p: Point3) => number;
}

function basis(eye: V3, target: V3, up: V3) {
  const forward = norm(sub(target, eye));
  const right = norm(cross(forward, up));
  const camUp = cross(right, forward);
  return { eye, forward, right, camUp };
}

/** Perspective pinhole camera. */
function perspectiveCamera(eye: V3, target: V3, fovDeg: number, width = 800, height = 600): Cam {
  const { forward, right, camUp } = basis(eye, target, [0, 0, 1]);
  const f = height / 2 / Math.tan((fovDeg * Math.PI) / 360);
  return {
    project: (p) => {
      const d = sub(toV(p), eye);
      const zc = dot(d, forward);
      if (zc <= 1) return null;
      return { x: width / 2 + (dot(d, right) * f) / zc, y: height / 2 - (dot(d, camUp) * f) / zc };
    },
    distance: (p) => Math.hypot(...sub(toV(p), eye)),
  };
}

/** Orthographic camera. */
function orthoCamera(eye: V3, target: V3, halfH: number, width = 800, height = 600): Cam {
  const { forward, right, camUp } = basis(eye, target, [0, 0, 1]);
  const halfW = (halfH * width) / height;
  return {
    project: (p) => {
      const d = sub(toV(p), eye);
      const xc = dot(d, right);
      const yc = dot(d, camUp);
      return { x: width / 2 + (xc / halfW) * (width / 2), y: height / 2 - (yc / halfH) * (height / 2) };
    },
    distance: (p) => Math.hypot(...sub(toV(p), eye)),
  };
}

// --- scenario --------------------------------------------------------------

function rect(x0: number, y0: number, x1: number, y1: number): Point[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

function scenario(): DocState {
  const s = emptyDocState();
  s.levels = [
    { id: "L1", name: "Lt. 1", elevation: 0, floorToFloor: 3600 },
    { id: "L2", name: "Lt. 2", elevation: 3600, floorToFloor: 3600 },
    { id: "L3", name: "Lt. 3", elevation: 7200, floorToFloor: 3600 },
  ];
  s.masses = [
    {
      id: "m1",
      levelIds: ["L1", "L2", "L3"],
      footprint: { outer: rect(0, 0, 9000, 9000), holes: [] },
      height: 9000,
      fidelity: "massing",
    },
  ];
  s.rooms = [
    {
      id: "b1",
      levelId: "L2",
      name: "Stacked",
      fidelity: "concept",
      elevationMm: 3600,
      height: 3000,
      polygon: { outer: rect(20000, 0, 24000, 4000), holes: [] },
      areaMm2: 16_000_000,
    },
  ];
  s.site.boundary = rect(-2000, -2000, 13000, 13000);
  s.grids = [
    { id: "gx1", axis: "x", label: "1", offset: 0 },
    { id: "gx2", axis: "x", label: "2", offset: 9000 },
    { id: "gy1", axis: "y", label: "A", offset: 0 },
    { id: "gy2", axis: "y", label: "B", offset: 9000 },
  ];
  return s;
}

const ctx = (over: Partial<Parameters<typeof buildSnapCandidates>[1]> = {}) => ({
  activeLevelId: "L1",
  activeLevelElevation: 0,
  draftPoints: [],
  ...over,
});

const noOcclusion = (cam: Cam): SnapView => ({ project: cam.project, distance: cam.distance });

function at(cam: Cam, p: Point3, dx = 0, dy = 0) {
  const px = cam.project(p)!;
  return { x: px.x + dx, y: px.y + dy };
}

// --- tests -----------------------------------------------------------------

const state = scenario();
const cam = perspectiveCamera([18000, -18000, 26000], [4500, 4500, 0], 45, 900, 700);
const ortho = orthoCamera([18000, -18000, 26000], [4500, 4500, 0], 14000, 900, 700);
const view = noOcclusion(cam);

/** A scenario with a grid intersection away from any mass vertex. */
function gridState(): DocState {
  const s = scenario();
  s.masses = [];
  s.rooms = [];
  s.grids = [
    { id: "gx1", axis: "x", label: "1", offset: 4500 },
    { id: "gy1", axis: "y", label: "A", offset: 4500 },
  ];
  return s;
}

describe("3D screen-space snapping (LG-03)", () => {
  it("bug 3: snaps to the top corner of a 9 m mass, at its real height", () => {
    const candidates = buildSnapCandidates(state, ctx());
    const r = pickSnap(candidates, at(cam, { x: 0, y: 0, z: 9000 }), view);
    expect(r?.kind).toBe("endpoint");
    expect(r?.point.x).toBeCloseTo(0, 0);
    expect(r?.point.y).toBeCloseTo(0, 0);
    expect(r?.point.z).toBeCloseTo(9000, 0);
  });

  it("bug 3: a stacked block snaps at its own elevation, not Z=0", () => {
    const candidates = buildSnapCandidates(state, ctx());
    const r = pickSnap(candidates, at(cam, { x: 20000, y: 0, z: 6600 }), view);
    expect(r?.kind).toBe("endpoint");
    expect(r?.point.z).toBeCloseTo(6600, 0);
  });

  it("bug 2: snaps to a midpoint on a top edge", () => {
    const candidates = buildSnapCandidates(state, ctx());
    const r = pickSnap(candidates, at(cam, { x: 4500, y: 0, z: 9000 }), view);
    expect(r?.kind).toBe("midpoint");
    expect(r?.point.z).toBeCloseTo(9000, 0);
  });

  it("bug 2: snaps to a midpoint on a bottom edge", () => {
    const candidates = buildSnapCandidates(state, ctx());
    const r = pickSnap(candidates, at(cam, { x: 4500, y: 0, z: 0 }), view);
    expect(r?.kind).toBe("midpoint");
    expect(r?.point.z).toBeCloseTo(0, 0);
  });

  it("bug 2: snaps to the midpoint of a vertical edge", () => {
    const candidates = buildSnapCandidates(state, ctx());
    const r = pickSnap(candidates, at(cam, { x: 0, y: 0, z: 4500 }), view);
    expect(r?.kind).toBe("midpoint");
    expect(r?.point.z).toBeCloseTo(4500, 0);
  });

  it("bug 2: snaps to the midpoint of a site edge", () => {
    const candidates = buildSnapCandidates(state, ctx());
    const r = pickSnap(candidates, at(cam, { x: 5500, y: -2000, z: 0 }), view);
    expect(r?.kind).toBe("midpoint");
    expect(r?.point.y).toBeCloseTo(-2000, 0);
  });

  it("bug 1: no marker over the middle of a face, away from any edge", () => {
    const candidates = buildSnapCandidates(state, ctx({ cursorPlan: { x: 4500, y: 4500 } }));
    const r = pickSnap(candidates, at(cam, { x: 4500, y: 4500, z: 9000 }), view);
    expect(r).toBeNull();
  });

  it("bug 1: no marker on the ground plane away from geometry", () => {
    const candidates = buildSnapCandidates(state, ctx({ cursorPlan: { x: -50000, y: -50000 } }));
    // A screen point in the corner, far from the site/mass.
    const r = pickSnap(candidates, { x: 12, y: 12 }, view);
    expect(r).toBeNull();
  });

  it("occlusion: a point hidden behind a mass is rejected when occlusion is on", () => {
    const candidates = buildSnapCandidates(state, ctx());
    const occluded: SnapView = {
      ...view,
      isOccluded: (p) => p.z === 0, // pretend the base is hidden
    };
    const r = pickSnap(candidates, at(cam, { x: 0, y: 0, z: 0 }), occluded);
    expect(r).toBeNull();
    // …and accepted when occlusion is skipped (top-down ortho).
    const r2 = pickSnap(candidates, at(cam, { x: 0, y: 0, z: 0 }), { ...occluded, skipOcclusion: true });
    expect(r2?.kind).toBe("endpoint");
  });

  it("keeps the pixel radius constant, independent of zoom / world scale", () => {
    const cands: SnapCandidate[] = [{ kind: "endpoint", point: { x: 100, y: 100, z: 0 } }];
    const identity: SnapView = { project: (p) => ({ x: p.x, y: p.y }) };
    // A camera whose world scale differs by 10× must not change the pixel result.
    const scaled: SnapView = { project: (p) => ({ x: p.x / 10, y: p.y / 10 }) };
    for (const v of [identity, scaled]) {
      const base = v.project({ x: 100, y: 100, z: 0 })!;
      expect(pickSnap(cands, { x: base.x + 8, y: base.y }, v)?.kind).toBe("endpoint");
      expect(pickSnap(cands, { x: base.x + 20, y: base.y }, v)).toBeNull();
    }
  });

  it("works in an orthographic camera too", () => {
    const candidates = buildSnapCandidates(state, ctx());
    const r = pickSnap(candidates, at(ortho, { x: 0, y: 0, z: 9000 }), noOcclusion(ortho));
    expect(r?.kind).toBe("endpoint");
  });

  it("close-loop wins near the first draft point", () => {
    const draftPoints = [
      { x: 0, y: 0 },
      { x: 5000, y: 0 },
      { x: 5000, y: 5000 },
    ];
    const candidates = buildSnapCandidates(state, ctx({ draftPoints, cursorPlan: { x: 100, y: 100 } }));
    const r = pickSnap(candidates, at(cam, { x: 0, y: 0, z: 0 }, 2, 0), view);
    expect(r?.kind).toBe("close");
  });

  it("still snaps to grid intersections", () => {
    const candidates = buildSnapCandidates(gridState(), ctx());
    const r = pickSnap(candidates, at(cam, { x: 4500, y: 4500, z: 0 }), view);
    expect(r?.kind).toBe("intersection");
  });

  it("still snaps to the axis guide", () => {
    const candidates = buildSnapCandidates(state, ctx({ cursorPlan: { x: 3000, y: -5000 } }));
    const r = pickSnap(candidates, at(cam, { x: 0, y: -5000, z: 0 }), view);
    expect(r?.kind).toBe("axis");
  });

  it("still snaps parallel to the previous draft segment", () => {
    // A 45° segment; the parallel guide point is off both axes.
    const draftPoints = [
      { x: 0, y: 0 },
      { x: 4000, y: 4000 },
    ];
    const candidates = buildSnapCandidates(state, ctx({ draftPoints, cursorPlan: { x: 6000, y: 2000 } }));
    const r = pickSnap(candidates, at(cam, { x: 4000, y: 4000, z: 0 }), view);
    expect(r?.kind).toBe("parallel");
  });
});

describe("snap priority and tie-break", () => {
  const identity: SnapView = { project: (p) => ({ x: p.x, y: p.y }) };
  const mk = (kind: SnapCandidate["kind"], x: number, y: number): SnapCandidate => {
    if (kind === "edge") return { kind, a: { x: x - 1, y, z: 0 }, b: { x: x + 1, y, z: 0 } };
    return { kind, point: { x, y, z: 0 } };
  };

  it("prefers endpoint over midpoint over intersection over edge over grid", () => {
    const order: SnapCandidate["kind"][] = ["endpoint", "midpoint", "intersection", "edge", "grid"];
    for (let i = 0; i < order.length; i++) {
      const cands = [mk(order[i], 100, 100), mk(order[i + 1] ?? "grid", 100, 100)];
      const r = pickSnap(cands, { x: 100, y: 100 }, identity);
      expect(r?.kind).toBe(order[i]);
    }
  });

  it("breaks ties by smaller pixel distance", () => {
    const cands: SnapCandidate[] = [
      { kind: "endpoint", point: { x: 100, y: 104, z: 0 } },
      { kind: "endpoint", point: { x: 100, y: 101, z: 0 } },
    ];
    const r = pickSnap(cands, { x: 100, y: 100 }, identity);
    expect(r?.point.y).toBe(101);
  });

  it("then by nearer to the camera", () => {
    const cands: SnapCandidate[] = [
      { kind: "endpoint", point: { x: 100, y: 100, z: 5000 } },
      { kind: "endpoint", point: { x: 100, y: 100, z: 0 } },
    ];
    const cam2: SnapView = { project: (p) => ({ x: p.x, y: p.y }), distance: (p) => p.z };
    const r = pickSnap(cands, { x: 100, y: 100 }, cam2);
    expect(r?.point.z).toBe(0);
  });
});
