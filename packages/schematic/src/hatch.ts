/**
 * W-08: hatch lines for cut poché and material fills. Pure scanline clipping — no
 * SVG filters, masks or clip paths, so the output stays vector and svg2pdf-safe.
 */

import type { Point } from "@qreasee/shared";

/** Parallel hatch segments (in the polygon's own units) clipped to the polygon. */
export function hatchSegments(
  polygon: readonly Point[],
  angleDeg: number,
  spacing: number,
): Array<[Point, Point]> {
  if (polygon.length < 3 || !(spacing > 0)) return [];
  const a = (angleDeg * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  // Rotate by -angle so hatch lines become horizontal scanlines.
  const rot = (p: Point): Point => ({ x: p.x * ca + p.y * sa, y: -p.x * sa + p.y * ca });
  const inv = (p: Point): Point => ({ x: p.x * ca - p.y * sa, y: p.x * sa + p.y * ca });
  const rp = polygon.map(rot);
  const minY = Math.min(...rp.map((p) => p.y));
  const maxY = Math.max(...rp.map((p) => p.y));
  const out: Array<[Point, Point]> = [];

  for (let y = minY + spacing / 2; y < maxY; y += spacing) {
    const xs: number[] = [];
    for (let i = 0; i < rp.length; i++) {
      const p = rp[i];
      const q = rp[(i + 1) % rp.length];
      if ((p.y <= y && q.y > y) || (q.y <= y && p.y > y)) {
        const t = (y - p.y) / (q.y - p.y);
        xs.push(p.x + t * (q.x - p.x));
      }
    }
    xs.sort((m, n) => m - n);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      out.push([inv({ x: xs[i], y }), inv({ x: xs[i + 1], y })]);
    }
  }
  return out;
}

/**
 * Materials that read as masonry/stone get a hatch fill. Returns the paper-mm
 * spacing, or null for materials that stay flat.
 */
export function hatchSpacingPaperMm(materialId: string | undefined): number | null {
  if (!materialId) return null;
  const id = materialId.toLowerCase();
  if (/(stone|andesite|limestone|granite|brick|bata)/.test(id)) return 3;
  return null;
}
