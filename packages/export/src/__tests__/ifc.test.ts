import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { ifcToDocState, parseIfc } from "../ifc";

const SAMPLE = `
ISO-10303-21;
HEADER;
FILE_SCHEMA(('IFC2X3'));
ENDSEC;
DATA;
#1=IFCCARTESIANPOINT((0.,0.,0.));
#3=IFCDIRECTION((0.,0.,1.));
#10=IFCAXIS2PLACEMENT3D(#1,$,$);
#11=IFCLOCALPLACEMENT($,#10);
#12=IFCBUILDINGSTOREY('g0',#99,'Lantai 1',$,$,#11,$,$,0.);
#20=IFCCARTESIANPOINT((0.,0.));
#21=IFCCARTESIANPOINT((4000.,0.));
#22=IFCCARTESIANPOINT((4000.,3000.));
#23=IFCCARTESIANPOINT((0.,3000.));
#24=IFCCARTESIANPOINT((0.,0.));
#25=IFCPOLYLINE((#20,#21,#22,#23,#24));
#26=IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,#25);
#27=IFCAXIS2PLACEMENT3D(#1,$,$);
#28=IFCEXTRUDEDAREASOLID(#26,#27,#3,3000.);
#29=IFCSHAPEREPRESENTATION(#99,'Body','SweptSolid',(#28));
#30=IFCPRODUCTDEFINITIONSHAPE($,$,(#29));
#31=IFCLOCALPLACEMENT(#11,#10);
#32=IFCSPACE('g1',#99,'1',$,$,#31,#30,'R. Keluarga',.ELEMENT.,.INTERNAL.,$);
#40=IFCCARTESIANPOINT((0.,0.));
#41=IFCCARTESIANPOINT((5000.,0.));
#42=IFCPOLYLINE((#40,#41));
#43=IFCSHAPEREPRESENTATION(#99,'Axis','Curve2D',(#42));
#45=IFCAXIS2PLACEMENT3D(#1,$,$);
#46=IFCLOCALPLACEMENT(#11,#45);
#47=IFCRECTANGLEPROFILEDEF(.AREA.,$,#45,150.,5000.);
#48=IFCEXTRUDEDAREASOLID(#47,#45,#3,3000.);
#49=IFCSHAPEREPRESENTATION(#99,'Body','SweptSolid',(#48));
#50=IFCPRODUCTDEFINITIONSHAPE($,$,(#43,#49));
#51=IFCWALLSTANDARDCASE('g2',#99,'Basic Wall:Generic - 150mm:1',$,'Basic Wall:Generic - 150mm',#46,#50,'1');
#80=IFCCARTESIANPOINT((0.,0.));
#81=IFCCARTESIANPOINT((900.,0.));
#82=IFCCARTESIANPOINT((900.,150.));
#83=IFCCARTESIANPOINT((0.,150.));
#84=IFCCARTESIANPOINT((0.,0.));
#85=IFCPOLYLINE((#80,#81,#82,#83,#84));
#86=IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,#85);
#87=IFCAXIS2PLACEMENT3D(#1,$,$);
#88=IFCEXTRUDEDAREASOLID(#86,#87,#3,2100.);
#89=IFCSHAPEREPRESENTATION(#99,'Body','SweptSolid',(#88));
#90=IFCPRODUCTDEFINITIONSHAPE($,$,(#89));
#61=IFCOPENINGELEMENT('o1',#99,'Opening',$,$,#46,#90,$);
#60=IFCDOOR('g3',#99,'D1',$,$,#46,#90,'',900.,2100.);
#100=IFCCARTESIANPOINT((0.,0.));
#101=IFCCARTESIANPOINT((5000.,0.));
#102=IFCCARTESIANPOINT((5000.,4000.));
#103=IFCCARTESIANPOINT((0.,4000.));
#104=IFCCARTESIANPOINT((0.,0.));
#105=IFCPOLYLINE((#100,#101,#102,#103,#104));
#106=IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,#105);
#107=IFCAXIS2PLACEMENT3D(#1,$,$);
#108=IFCEXTRUDEDAREASOLID(#106,#107,#3,150.);
#109=IFCSHAPEREPRESENTATION(#99,'Body','SweptSolid',(#108));
#110=IFCPRODUCTDEFINITIONSHAPE($,$,(#109));
#111=IFCSLAB('s1',#99,'Floor',$,$,#46,#110,$,.FLOOR.);
#70=IFCRELAGGREGATES('g4',#99,$,$,#12,(#32));
#71=IFCRELCONTAINEDINSPATIALSTRUCTURE('g5',#99,$,$,(#51,#111),#12);
#62=IFCRELVOIDSELEMENT('g6',#99,$,$,#51,#61);
#63=IFCRELFILLSELEMENT('g7',#99,$,$,#61,#60);
ENDSEC;
END-ISO-10303-21;
`;

describe("IFC import (I-01)", () => {
  const model = parseIfc(SAMPLE);

  it("reads storeys in elevation order", () => {
    expect(model.levels).toEqual([{ name: "Lantai 1", elevation: 0 }]);
  });

  it("reads a room from its swept profile", () => {
    expect(model.rooms).toHaveLength(1);
    const room = model.rooms[0];
    expect(room.name).toBe("R. Keluarga");
    expect(room.level).toBe("Lantai 1");
    expect(room.outer).toHaveLength(4);
    const xs = room.outer.map((p) => p.x);
    const ys = room.outer.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBe(4000);
    expect(Math.max(...ys) - Math.min(...ys)).toBe(3000);
  });

  it("reads a wall from its Axis centreline", () => {
    expect(model.walls).toHaveLength(1);
    const wall = model.walls[0];
    expect(wall.a).toEqual({ x: 0, y: 0 });
    expect(wall.b).toEqual({ x: 5000, y: 0 });
    expect(wall.thickness).toBe(150);
    expect(wall.height).toBe(3000);
  });

  it("builds a document with levels, rooms and walls", () => {
    const state = ifcToDocState(model);
    expect(state.levels).toHaveLength(1);
    expect(state.rooms).toHaveLength(1);
    expect(state.rooms[0].areaMm2).toBe(12_000_000);
    expect(state.rooms[0].levelId).toBe("ifc-L1");
    expect(state.walls).toHaveLength(1);
    expect(state.walls[0].kind).toBe("exterior");
    expect(state.masses).toHaveLength(1);
  });
});

describe("IFC import — openings + slabs (I-02)", () => {
  const model = parseIfc(SAMPLE);

  it("maps a door onto its host wall as an opening", () => {
    expect(model.openings).toHaveLength(1);
    const o = model.openings[0];
    expect(o.kind).toBe("door");
    expect(o.wallIndex).toBe(0);
    expect(o.width).toBe(900);
    expect(o.offset).toBe(450); // 900-wide opening centred on the wall start
    expect(o.sill).toBe(0);
    expect(o.height).toBe(2100);
  });

  it("maps a slab as a floor", () => {
    expect(model.slabs).toHaveLength(1);
    expect(model.slabs[0].thickness).toBe(150);
    expect(model.slabs[0].kind).toBe("floor");
  });

  it("links the opening to the imported wall id", () => {
    const state = ifcToDocState(model);
    expect(state.openings).toHaveLength(1);
    expect(state.openings[0].wallId).toBe("ifc-wall-1");
    expect(state.slabs).toHaveLength(1);
    expect(state.slabs[0].levelId).toBe("ifc-L1");
  });
});

const REAL_IFC = process.env.QREASEE_IFC ?? "";

describe.skipIf(!existsSync(REAL_IFC))("IFC import — real sample-house file", () => {
  it("reads the real house (3 storeys, 18 rooms, 38 walls, openings, slabs)", () => {
    const model = parseIfc(readFileSync(REAL_IFC, "utf8"));
    expect(model.levels.map((l) => l.name)).toEqual(["LANTAI 1", "LANTAI 2", "RING BALOK"]);
    expect(model.rooms).toHaveLength(18);
    expect(model.rooms.map((r) => r.name)).toContain("R. Keluarga");
    expect(model.walls.length).toBeGreaterThanOrEqual(38);
    expect(model.openings.length).toBeGreaterThanOrEqual(10);
    expect(model.slabs.length).toBeGreaterThanOrEqual(10);
    expect(model.stairs.length).toBeGreaterThanOrEqual(1);
    expect(model.roofs.length).toBeGreaterThanOrEqual(1);
    // Every opening must point at a real imported wall.
    for (const o of model.openings) {
      expect(model.walls[o.wallIndex]).toBeDefined();
      expect(o.width).toBeGreaterThan(0);
    }
  });
});
