/**
 * EX-02: Export COLLADA (.dae) for SketchUp — one group per mass, named by level
 * and use, plus site and grid. Units are metres, Z-up. The PRD allows a small
 * custom XML writer for COLLADA, so this stays dependency-free.
 */

import type { DocState, Mass, Project } from "@qreasee/shared";
import { extrudePolygon, massBaseElevationMm, type Flat } from "./collada-helpers";

const f = (n: number) => {
  const v = Math.round(n * 1e6) / 1e6;
  return Object.is(v, -0) ? "0" : String(v);
};

/** 2D point + elevation (mm) -> COLLADA Z-up metres. */
const toCollada = (x: number, y: number, elevation: number): [number, number, number] => [
  x / 1000,
  y / 1000,
  elevation / 1000,
];

function meshGeometry(id: string, positions: number[], normals: number[]): string {
  const triCount = positions.length / 9;
  const pos = positions.map(f).join(" ");
  const nrm = normals.map(f).join(" ");
  let p = "";
  for (let i = 0; i < triCount * 3; i++) p += `${i} ${i} `;
  return `
    <geometry id="${id}-geo" name="${id}">
      <mesh>
        <source id="${id}-pos">
          <float_array id="${id}-pos-array" count="${positions.length}">${pos}</float_array>
          <technique_common><accessor source="#${id}-pos-array" count="${positions.length / 3}" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common>
        </source>
        <source id="${id}-nrm">
          <float_array id="${id}-nrm-array" count="${normals.length}">${nrm}</float_array>
          <technique_common><accessor source="#${id}-nrm-array" count="${normals.length / 3}" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common>
        </source>
        <vertices id="${id}-vtx"><input semantic="POSITION" source="#${id}-pos"/></vertices>
        <triangles count="${triCount}" material="mass-material">
          <input semantic="VERTEX" source="#${id}-vtx" offset="0"/>
          <input semantic="NORMAL" source="#${id}-nrm" offset="1"/>
          <p>${p.trim()}</p>
        </triangles>
      </mesh>
    </geometry>`;
}

function linesGeometry(id: string, positions: number[]): string {
  const pos = positions.map(f).join(" ");
  let p = "";
  for (let i = 0; i < positions.length / 3; i++) p += `${i} `;
  return `
    <geometry id="${id}-geo" name="${id}">
      <mesh>
        <source id="${id}-pos">
          <float_array id="${id}-pos-array" count="${positions.length}">${pos}</float_array>
          <technique_common><accessor source="#${id}-pos-array" count="${positions.length / 3}" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common>
        </source>
        <vertices id="${id}-vtx"><input semantic="POSITION" source="#${id}-pos"/></vertices>
        <lines count="${positions.length / 6}">
          <input semantic="VERTEX" source="#${id}-vtx" offset="0"/>
          <p>${p.trim()}</p>
        </lines>
      </mesh>
    </geometry>`;
}

function massFlats(mass: Mass, state: DocState): Flat {
  const base = massBaseElevationMm(state, mass);
  const top = base + (mass.intent?.height?.high ?? mass.height);
  const extrusion = extrudePolygon(mass.footprint, base, top);
  const positions: number[] = [];
  const normals: number[] = [];
  for (let i = 0; i < extrusion.positions.length; i += 3) {
    const [x, y, z] = [
      extrusion.positions[i],
      extrusion.positions[i + 1],
      extrusion.positions[i + 2],
    ];
    const c = toCollada(x, y, z);
    positions.push(c[0], c[1], c[2]);
  }
  for (let i = 0; i < extrusion.normals.length; i += 3) {
    normals.push(extrusion.normals[i], extrusion.normals[i + 1], extrusion.normals[i + 2]);
  }
  return { positions, normals };
}

export function exportCollada(state: DocState, project: Project): string {
  const geometries: string[] = [];
  const nodes: string[] = [];

  const levelName = (levelId: string) =>
    state.levels.find((l) => l.id === levelId)?.name ?? "Level";

  state.masses.forEach((mass, index) => {
    const id = `mass-${index + 1}`;
    const flat = massFlats(mass, state);
    geometries.push(meshGeometry(id, flat.positions, flat.normals));
    const level = levelName(mass.levelIds[0] ?? "");
    const name = `${level} ${mass.use ?? "mass"}`.trim();
    nodes.push(`
      <node id="${id}-node" name="${escapeXml(name)}">
        <instance_geometry url="#${id}-geo">
          <bind_material><technique_common><instance_material symbol="mass-material" target="#mass-material"/></technique_common></bind_material>
        </instance_geometry>
      </node>`);
  });

  // Site boundary + grid as a single line geometry.
  const linePos: number[] = [];
  const pushLine = (ax: number, ay: number, bx: number, by: number) => {
    const a = toCollada(ax, ay, 0);
    const b = toCollada(bx, by, 0);
    linePos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  };
  for (let i = 0; i < state.site.boundary.length; i++) {
    const a = state.site.boundary[i];
    const b = state.site.boundary[(i + 1) % state.site.boundary.length];
    pushLine(a.x, a.y, b.x, b.y);
  }
  for (const g of state.grids) {
    const span = 50000;
    if (g.axis === "x") pushLine(g.offset, -span, g.offset, span);
    else pushLine(-span, g.offset, span, g.offset);
  }
  if (linePos.length > 0) {
    geometries.push(linesGeometry("site-grid", linePos));
    nodes.push(`<node id="site-grid-node" name="Site and grid"><instance_geometry url="#site-grid-geo"/></node>`);
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">
  <asset>
    <contributor><authoring_tool>Qreasee</authoring_tool></contributor>
    <created>${new Date().toISOString()}</created>
    <title>${escapeXml(project.name)}</title>
    <unit meter="1" name="meter"/>
    <up_axis>Z_UP</up_axis>
  </asset>
  <library_effects>
    <effect id="mass-effect"><profile_COMMON><technique sid="common"><lambert><diffuse><color>0.82 0.82 0.86 1</color></diffuse></lambert></technique></profile_COMMON></effect>
  </library_effects>
  <library_materials>
    <material id="mass-material" name="Massing"><instance_effect url="#mass-effect"/></material>
  </library_materials>
  <library_geometries>${geometries.join("")}
  </library_geometries>
  <library_visual_scenes>
    <visual_scene id="Scene" name="Qreasee">
      <node id="Qreasee-root" name="${escapeXml(project.name)}">${nodes.join("")}
      </node>
    </visual_scene>
  </library_visual_scenes>
  <scene><instance_visual_scene url="#Scene"/></scene>
</COLLADA>
`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
