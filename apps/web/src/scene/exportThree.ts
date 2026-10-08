import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { extrudePolygon } from "@qreasee/geometry";
import { massBaseElevation } from "@qreasee/indicators";
import type { DocState, Project } from "@qreasee/shared";

/** EX-03: glTF/GLB and OBJ, built with three.js exporters from the massing. */
export function buildExportScene(state: DocState, project: Project): THREE.Group {
  const root = new THREE.Group();
  root.name = project.name;
  state.masses.forEach((mass, i) => {
    const base = massBaseElevation(state, mass);
    const height = mass.intent?.height?.high ?? mass.height;
    const ex = extrudePolygon(mass.footprint, 0, height);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(ex.positions, 3));
    geom.setAttribute("normal", new THREE.Float32BufferAttribute(ex.normals, 3));
    const mesh = new THREE.Mesh(
      geom,
      new THREE.MeshStandardMaterial({ color: 0xe8ebef, roughness: 0.8, flatShading: true }),
    );
    const level = state.levels.find((l) => l.id === mass.levelIds[0])?.name ?? "Level";
    mesh.name = `${level} ${mass.use ?? "mass"} ${i + 1}`;
    mesh.position.y = base;
    root.add(mesh);
  });
  return root;
}

export function exportObj(state: DocState, project: Project): string {
  return new OBJExporter().parse(buildExportScene(state, project));
}

export function exportGltf(state: DocState, project: Project, binary = true): Promise<ArrayBuffer | string> {
  const scene = buildExportScene(state, project);
  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(
      scene,
      (result) => resolve(result as ArrayBuffer | string),
      (error) => reject(error),
      { binary },
    );
  });
}
