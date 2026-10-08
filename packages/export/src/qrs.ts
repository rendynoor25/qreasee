/**
 * EX-06: the documented, versioned .qrs zip. For the local-first base it holds
 * project.json (project meta, the active branch snapshot, and the full store
 * with branches and decision records).
 */

import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { DocState, Project } from "@qreasee/shared";
import type { SerializedStore } from "@qreasee/document";

export interface QrsPayload {
  format: "qreasee";
  /**
   * v1 = pre-v4.1 program; v2 = program settings/recipe fields; v3 = views (V-01);
   * v4 = schematic entities in DocState (W-01).
   */
  formatVersion: 1 | 2 | 3 | 4;
  savedAt: string;
  project: Project;
  docState: DocState;
  store: SerializedStore;
}

export function exportQrs(payload: QrsPayload): Uint8Array {
  const files: Record<string, Uint8Array> = {
    "project.json": strToU8(JSON.stringify({ ...payload, formatVersion: 4 }, null, 2)),
  };
  return zipSync(files, { level: 6 });
}

/**
 * Migrate older `.qrs` payloads. Later fields (views, schematic entities) are
 * also backfilled by `normalizeDocState` when the store is deserialised, so this
 * only bumps the version and fills the v1 program shape. Never throws.
 */
export function migrateQrsPayload(data: QrsPayload): QrsPayload {
  if (data.formatVersion >= 4) return data;
  const state: DocState =
    data.formatVersion >= 3
      ? data.docState
      : {
          ...data.docState,
          brief: {
            ...data.docState.brief,
            settings: data.docState.brief.settings ?? { circulationPct: 20, areaUnit: "m2" },
            program: data.docState.brief.program.map((p) => ({
              ...p,
              qty: p.qty ?? 1,
              areaEach: p.areaEach ?? p.targetArea,
              source: p.source ?? "manual",
            })),
          },
        };
  return { ...data, formatVersion: 4, docState: state };
}

export function importQrs(bytes: Uint8Array): QrsPayload {
  const files = unzipSync(bytes);
  const raw = files["project.json"];
  if (!raw) throw new Error("Not a Qreasee file: project.json missing");
  const data = JSON.parse(strFromU8(raw)) as QrsPayload;
  if (data.format !== "qreasee") throw new Error("Unsupported file format");
  if (
    data.formatVersion !== 1 &&
    data.formatVersion !== 2 &&
    data.formatVersion !== 3 &&
    data.formatVersion !== 4
  ) {
    throw new Error(`Unsupported .qrs version ${data.formatVersion}`);
  }
  return migrateQrsPayload(data);
}
