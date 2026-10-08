import { describe, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { parseDxf } from "../dxfImport";
import { wallsFromDxf } from "../dwgWalls";

const DX = process.env.QREASEE_DXF ?? "D:\\Qreasee\\alfia-a101.dxf";

describe.skipIf(process.env.QREASEE_ANALYZE !== "1" || !existsSync(DX))("analyze alfia dwg", () => {
  it("reports layer + A-WALL geometry", () => {
    const model = parseDxf(readFileSync(DX, "utf8"));
    const byLayer = new Map<string, number>();
    for (const l of model.lines) byLayer.set(l.layer, (byLayer.get(l.layer) ?? 0) + 1);
    const layers = [...byLayer.entries()].sort((a, b) => b[1] - a[1]);
    console.log("UNITS", model.units, "LINES", model.lines.length, "COUNTS", JSON.stringify(model.counts));
    console.log("TOP LAYERS", JSON.stringify(layers.slice(0, 20)));
    console.log("ALL LAYERS", JSON.stringify(layers));

    const wall = model.lines.filter((l) => l.layer === "A-WALL");
    const xs = wall.flatMap((l) => [l.a.x, l.b.x]);
    const ys = wall.flatMap((l) => [l.a.y, l.b.y]);
    console.log("A-WALL count", wall.length, "x", Math.round(Math.min(...xs)), Math.round(Math.max(...xs)), "y", Math.round(Math.min(...ys)), Math.round(Math.max(...ys)));

    // Angle buckets + segment length stats.
    const buckets = { h: 0, v: 0, other: 0 };
    const lens: number[] = [];
    for (const l of wall) {
      const dx = l.b.x - l.a.x;
      const dy = l.b.y - l.a.y;
      const len = Math.hypot(dx, dy);
      lens.push(len);
      const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      const a = ((ang % 180) + 180) % 180;
      if (a < 2 || a > 178) buckets.h++;
      else if (Math.abs(a - 90) < 2) buckets.v++;
      else buckets.other++;
    }
    lens.sort((a, b) => a - b);
    console.log("A-WALL angles", JSON.stringify(buckets), "len min/med/max", Math.round(lens[0]), Math.round(lens[Math.floor(lens.length / 2)]), Math.round(lens[lens.length - 1]));

    // Horizontal lines: cluster by y, then find pairs 80..260 apart (wall thickness).
    const horiz = wall.filter((l) => Math.abs(l.a.y - l.b.y) < 2).map((l) => ({ y: (l.a.y + l.b.y) / 2, x0: Math.min(l.a.x, l.b.x), x1: Math.max(l.a.x, l.b.x) }));
    const ys2 = [...new Set(horiz.map((h) => Math.round(h.y)))].sort((a, b) => a - b);
    console.log("A-WALL horizontal y values", ys2.length, ys2.slice(0, 40).join(" "));
    let pairs = 0;
    for (let i = 0; i < ys2.length; i++)
      for (let j = i + 1; j < ys2.length; j++) {
        const t = ys2[j] - ys2[i];
        if (t > 260) break;
        if (t >= 80) pairs++;
      }
    console.log("A-WALL horizontal near-pairs (80..260mm)", pairs);

    // Reconstruct walls for the two plan regions (they sit side by side).
    const bb = (ws: { a: { x: number; y: number }; b: { x: number; y: number } }[]) => {
      if (!ws.length) return "empty";
      const xs = ws.flatMap((w) => [w.a.x, w.b.x]);
      const ys = ws.flatMap((w) => [w.a.y, w.b.y]);
      return `x ${Math.round(Math.min(...xs))}..${Math.round(Math.max(...xs))} y ${Math.round(Math.min(...ys))}..${Math.round(Math.max(...ys))}`;
    };
    const l1 = wallsFromDxf(model, { region: { minX: -20000, maxX: 12000 } });
    const l2 = wallsFromDxf(model, { region: { minX: 12000, maxX: 40000 } });
    console.log("PLAN L1 walls", l1.length, bb(l1));
    console.log("PLAN L2 walls", l2.length, bb(l2));
    const thick = l1.map((w) => w.thickness).sort((a, b) => a - b);
    console.log("L1 thickness min/med/max", thick[0], thick[Math.floor(thick.length / 2)], thick[thick.length - 1]);
  });
});
