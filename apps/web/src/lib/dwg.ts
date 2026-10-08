/**
 * I-03b: convert a DWG to DXF in the browser using LibreDWG (WASM). No upload,
 * no server — the 9.5 MB module is loaded lazily on the first DWG and served
 * from /libredwg/libredwg-web.wasm.
 */

import type { LibreDwgEx } from "@mlightcad/libredwg-web";

let modulePromise: Promise<LibreDwgEx> | null = null;

async function getLibreDwg(): Promise<LibreDwgEx> {
  if (!modulePromise) {
    modulePromise = (async () => {
      const { createModule, LibreDwg } = await import("@mlightcad/libredwg-web");
      const instance = await createModule({
        locateFile: (path: string) => (path.endsWith(".wasm") ? "/libredwg/libredwg-web.wasm" : path),
      });
      return LibreDwg.createByWasmInstance(instance);
    })().catch((err: unknown) => {
      modulePromise = null;
      throw err;
    });
  }
  return modulePromise;
}

/** Convert DWG bytes to DXF text. Throws with a readable message on failure. */
export async function dwgToDxf(buffer: ArrayBuffer): Promise<string> {
  const dwg = await getLibreDwg();
  const out = dwg.dwg_write_dxf(buffer);
  if (!out || out.length === 0) throw new Error("LibreDWG could not convert this DWG.");
  return new TextDecoder().decode(out);
}

/** True when the bytes look like a DWG (AutoCAD "AC10xx" signature). */
export function looksLikeDwg(head: Uint8Array): boolean {
  return head[0] === 0x41 && head[1] === 0x43 && head[2] === 0x31 && head[3] === 0x30;
}
