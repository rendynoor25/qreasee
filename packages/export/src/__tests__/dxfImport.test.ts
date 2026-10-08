import { describe, expect, it } from "vitest";
import { dxfToUnderlay, parseDxf } from "../dxfImport";

const SAMPLE = `0
SECTION
2
HEADER
9
$INSUNITS
70
4
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
8
WALL
10
0.0
20
0.0
11
5000.0
21
0.0
0
LWPOLYLINE
8
ROOM
70
1
10
0.0
20
0.0
10
4000.0
20
0.0
10
4000.0
20
3000.0
10
0.0
20
3000.0
0
CIRCLE
8
DOOR
10
1000.0
20
1000.0
40
500.0
0
ENDSEC
0
EOF
`;

describe("DXF import (I-03)", () => {
  const model = parseDxf(SAMPLE);

  it("reads units and layer names", () => {
    expect(model.units).toBe("mm");
    expect(model.layers).toEqual(["DOOR", "ROOM", "WALL"]);
  });

  it("turns LINE, a closed LWPOLYLINE and a CIRCLE into line segments", () => {
    // 1 (line) + 4 (closed rectangle) + 32 (circle) = 37
    expect(model.lines).toHaveLength(37);
    const wall = model.lines.find((l) => l.layer === "WALL")!;
    expect(wall.a).toEqual({ x: 0, y: 0 });
    expect(wall.b).toEqual({ x: 5000, y: 0 });
  });

  it("builds a deletable underlay on a level", () => {
    const u = dxfToUnderlay(model, { id: "u1", name: "Ground floor", levelId: "L1" });
    expect(u.levelId).toBe("L1");
    expect(u.lines).toHaveLength(37);
    expect(u.lines.every((l) => typeof l.layer === "string")).toBe(true);
    expect(u.origin).toBe("user");
  });

  it("scales inches to millimetres", () => {
    const inches = SAMPLE.replace("70\n4", "70\n1");
    const m = parseDxf(inches);
    expect(m.units).toBe("in");
    const wall = m.lines.find((l) => l.layer === "WALL")!;
    expect(wall.b.x).toBeCloseTo(5000 * 25.4, 3);
  });
});

const CURVES = `0
SECTION
2
ENTITIES
0
SPLINE
8
CURVE
71
3
10
0.0
20
0.0
10
1000.0
20
1000.0
10
2000.0
20
0.0
10
3000.0
20
1000.0
40
0
40
0
40
0
40
0
40
1
40
1
40
1
40
1
0
3DFACE
8
WALL
10
0.0
20
0.0
11
1000.0
21
0.0
12
1000.0
22
1000.0
13
0.0
23
1000.0
0
INSERT
8
BLK
2
DOOR
10
5000.0
20
5000.0
41
1.0
42
1.0
50
0.0
0
ENDSEC
0
SECTION
2
BLOCKS
0
BLOCK
8
0
2
DOOR
70
0
10
0.0
20
0.0
0
LINE
8
DOOR
10
0.0
20
0.0
11
900.0
21
0.0
0
LINE
8
DOOR
10
900.0
20
0.0
11
900.0
21
100.0
0
ENDBLK
0
ENDSEC
0
EOF
`;

describe("DXF entity coverage (I-03c)", () => {
  const model = parseDxf(CURVES);

  it("samples a SPLINE into a polyline", () => {
    const curve = model.lines.filter((l) => l.layer === "CURVE");
    expect(curve.length).toBeGreaterThanOrEqual(8);
  });

  it("reads a 3DFACE outline", () => {
    const face = model.lines.filter((l) => l.layer === "WALL");
    expect(face).toHaveLength(4);
  });

  it("expands an INSERT block reference with its transform", () => {
    const door = model.lines.filter((l) => l.layer === "DOOR");
    expect(door).toHaveLength(2);
    // The block's first line starts at its base point, moved to the insert point.
    const first = door.find((l) => l.a.x === 5000 && l.a.y === 5000);
    expect(first).toBeDefined();
    expect(first!.b).toEqual({ x: 5900, y: 5000 });
  });

  it("reports every layer, including block-internal ones", () => {
    expect(model.layers).toEqual(expect.arrayContaining(["BLK", "CURVE", "DOOR", "WALL"]));
  });
});
