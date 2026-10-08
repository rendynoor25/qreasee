import type { Mass } from "@qreasee/shared";
import { deriveRooms, type RoomPlan } from "./rooms";
import { buildSchematic } from "./elements";
import type { Schematic, SchematicOptions } from "./types";

/** One call: mass + program -> rooms, walls, slabs, openings and roof. */
export function generateSchematic(
  mass: Mass,
  program: RoomPlan[],
  options: SchematicOptions,
  baseZ: number,
  height: number,
): Schematic {
  const derived = deriveRooms(mass.footprint, program, options.exteriorWallThickness);
  return buildSchematic({ mass, derived, options, baseZ, height });
}
