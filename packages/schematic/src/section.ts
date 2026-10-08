/** Compute a real section cut through a schematic along a user-placed line. */

import type { Point } from "@qreasee/shared";
import type {
  Schematic,
  SectionCut,
  SectionLine,
  SectionSlabCut,
  SectionStairCut,
  SectionWallCut,
} from "./types";

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;

/** Default section: through the centre, along the longer plan axis. */
export function defaultSectionLine(s: Schematic): SectionLine {
  const poly = s.slabs.find((x) => x.kind === "floor")?.polygon ?? s.roof.outline;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return (maxX - minX) >= (maxY - minY)
    ? { a: { x: cx, y: minY - 1000 }, b: { x: cx, y: maxY + 1000 } }
    : { a: { x: minX - 1000, y: cy }, b: { x: maxX + 1000, y: cy } };
}

export function sectionAtLine(s: Schematic, line: SectionLine): SectionCut {
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  const len = Math.hypot(dx, dy) || 1;
  const dir: Point = { x: dx / len, y: dy / len };
  const normal: Point = { x: -dir.y, y: dir.x };
  const origin = line.a;
  const signed = (p: Point) => dot(sub(p, origin), normal);
  const along = (p: Point) => dot(sub(p, origin), dir);

  const cutPolygon = (poly: readonly Point[]): Point[] => {
    const pts: Point[] = [];
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % n];
      const dp = signed(p);
      const dq = signed(q);
      if (Math.abs(dp) < 1e-6) pts.push({ ...p });
      if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) {
        const t = dp / (dp - dq);
        pts.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
      }
    }
    const uniq: Point[] = [];
    for (const p of pts) {
      if (!uniq.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < 1)) uniq.push(p);
    }
    return uniq;
  };

  const walls: SectionWallCut[] = [];
  for (const wall of s.walls) {
    const pts = cutPolygon(wall.polygon);
    if (pts.length < 2) continue;
    const us = pts.map(along);
    const lo = Math.min(...us);
    const hi = Math.max(...us);
    walls.push({
      id: wall.elementId ?? wall.id,
      u: (lo + hi) / 2,
      width: hi - lo,
      z0: wall.z0,
      z1: wall.z1,
      kind: wall.kind,
      material: wall.material,
    });
  }

  const slabs: SectionSlabCut[] = [];
  for (const slab of s.slabs) {
    const pts = cutPolygon(slab.polygon);
    if (pts.length < 2) continue;
    const us = pts.map(along);
    slabs.push({
      id: slab.id,
      u0: Math.min(...us),
      u1: Math.max(...us),
      z0: slab.z0,
      z1: slab.z1,
      kind: slab.kind,
      material: slab.material,
    });
  }

  const stairs: SectionStairCut[] = [];
  for (const st of s.stairs ?? []) {
    const pts = cutPolygon(st.outline);
    if (pts.length < 2) continue;
    const us = pts.map(along);
    const lo = Math.min(...us);
    const hi = Math.max(...us);
    stairs.push({
      id: st.id,
      u: (lo + hi) / 2,
      halfWidth: (hi - lo) / 2,
      z0: st.baseZ,
      z1: st.topZ,
      risers: st.risers,
    });
  }

  // Roof silhouette: intersect each roof face with the vertical cut plane.
  const roofSegments: Array<[number, number, number, number]> = [];
  for (const face of s.roof.faces) {
    const pts: Array<[number, number]> = [];
    const n = face.points.length;
    for (let i = 0; i < n; i++) {
      const p = face.points[i];
      const q = face.points[(i + 1) % n];
      const dp = signed({ x: p[0], y: p[2] });
      const dq = signed({ x: q[0], y: q[2] });
      if ((dp <= 0 && dq >= 0) || (dp >= 0 && dq <= 0)) {
        if (Math.abs(dp) < 1e-6) pts.push([p[0], p[1]]);
        else if (Math.abs(dq) < 1e-6) pts.push([q[0], q[1]]);
        else {
          const t = dp / (dp - dq);
          pts.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
        }
      }
    }
    const uniq: Array<[number, number]> = [];
    for (const p of pts) {
      const u = dot(sub({ x: p[0], y: 0 }, origin), dir);
      if (!uniq.some((o) => Math.hypot(o[0] - p[0], o[1] - p[1]) < 1)) {
        uniq.push([u, p[1]]);
      }
    }
    if (uniq.length >= 2) {
      uniq.sort((a, b) => a[0] - b[0]);
      roofSegments.push([uniq[0][0], uniq[0][1], uniq[uniq.length - 1][0], uniq[uniq.length - 1][1]]);
    }
  }

  const allU = [
    ...walls.map((w) => w.u - w.width / 2),
    ...walls.map((w) => w.u + w.width / 2),
    ...slabs.flatMap((sl) => [sl.u0, sl.u1]),
    ...stairs.flatMap((st) => [st.u - st.halfWidth, st.u + st.halfWidth]),
    ...roofSegments.flatMap((r) => [r[0], r[2]]),
  ];
  const uRange: [number, number] = allU.length
    ? [Math.min(...allU), Math.max(...allU)]
    : [-5000, 5000];

  return {
    walls,
    slabs,
    stairs,
    roofSegments,
    uRange,
    groundZ: s.baseZ - s.options.slabThickness,
    ridgeZ: s.roof.ridgeZ,
    eaveZ: s.roof.eaveZ,
  };
}
