/**
 * BG-xx: stable ids for generated elements. The id is a hash of the element kind,
 * the source block ids and the quantised coordinates, so regenerating from the
 * same blocks yields the same ids — a diff, not a rebuild.
 */

/** Quantise to a step (default 10 mm) so tiny float drift cannot change an id. */
export function quantise(v: number, step = 10): number {
  return Math.round(v / step) * step;
}

function fnv1a(key: string): string {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function stableId(prefix: string, keys: readonly string[], coords: readonly number[]): string {
  const sortedKeys = [...keys].sort().join(",");
  const cs = coords.map((c) => quantise(c)).join(",");
  return `${prefix}_${fnv1a(`${prefix}|${sortedKeys}|${cs}`)}`;
}

/** The two endpoints (x1,y1,x2,y2) in a direction-independent order. */
export function segmentCoords(a: { x: number; y: number }, b: { x: number; y: number }): number[] {
  const p = [quantise(a.x), quantise(a.y)];
  const q = [quantise(b.x), quantise(b.y)];
  const swap = p[0] > q[0] || (p[0] === q[0] && p[1] > q[1]);
  return swap ? [...q, ...p] : [...p, ...q];
}
