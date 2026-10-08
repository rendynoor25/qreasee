/**
 * Every edit to the document is an operation (PRD coding-agent rule: all edits
 * go through the operation log; no component mutates the document directly).
 *
 * `applyOperation` is pure: it returns a new DocState and never touches its
 * input. The store appends the operation to the active branch's log.
 */

import type {
  Budget,
  Brief,
  Decision,
  DocState,
  GridLine,
  Group,
  Id,
  Layer,
  Level,
  Mass,
  Opening,
  Point,
  ProgramItem,
  ProgramSettings,
  RecipeBinding,
  RoadEdge,
  Room,
  Roof,
  Railing,
  Rules,
  Sheet,
  SheetItem,
  Slab,
  Stair,
  SurfacePolygon,
  Underlay,
  View,
  Wall,
} from "@qreasee/shared";
import { defaultProgramSettings, newId } from "@qreasee/shared";

export type Operation =
  | { type: "site.setBoundary"; points: Point[] }
  | { type: "site.setRoadEdges"; roadEdges: RoadEdge[] }
  | { type: "site.addSurface"; surface: SurfacePolygon }
  | { type: "site.removeSurface"; id: Id }
  | { type: "rules.set"; patch: Partial<Rules> }
  | { type: "rules.setSetback"; edgeIndex: number; value: number }
  | { type: "budget.set"; patch: Partial<Budget> }
  | { type: "brief.setText"; text: string }
  | { type: "brief.addProgram"; item: ProgramItem }
  | { type: "brief.updateProgram"; id: Id; patch: Partial<ProgramItem> }
  | { type: "brief.removeProgram"; id: Id }
  | { type: "brief.setSettings"; patch: Partial<ProgramSettings> }
  | { type: "brief.reorderProgram"; from: number; to: number }
  | { type: "brief.importRows"; rows: ProgramItem[] }
  | { type: "brief.bindRecipe"; binding: RecipeBinding | undefined }
  | { type: "brief.setParam"; key: string; value: number }
  | { type: "brief.setOwnerBrief"; text: string }
  | { type: "brief.applyRecipe"; rows: ProgramItem[]; binding?: RecipeBinding }
  | { type: "room.add"; room: Room }
  | { type: "room.update"; id: Id; patch: Partial<Room> }
  | { type: "room.remove"; id: Id }
  | { type: "rooms.setConcept"; rooms: Room[] }
  | { type: "wall.add"; wall: Wall }
  | { type: "wall.update"; id: Id; patch: Partial<Wall> }
  | { type: "wall.remove"; id: Id }
  | { type: "opening.add"; opening: Opening }
  | { type: "opening.update"; id: Id; patch: Partial<Opening> }
  | { type: "opening.remove"; id: Id }
  | { type: "slab.add"; slab: Slab }
  | { type: "slab.update"; id: Id; patch: Partial<Slab> }
  | { type: "slab.remove"; id: Id }
  | { type: "roof.add"; roof: Roof }
  | { type: "roof.update"; id: Id; patch: Partial<Roof> }
  | { type: "roof.remove"; id: Id }
  | { type: "stair.add"; stair: Stair }
  | { type: "stair.update"; id: Id; patch: Partial<Stair> }
  | { type: "stair.remove"; id: Id }
  | { type: "railing.add"; railing: Railing }
  | { type: "railing.update"; id: Id; patch: Partial<Railing> }
  | { type: "railing.remove"; id: Id }
  | { type: "underlay.add"; underlay: Underlay }
  | { type: "underlay.update"; id: Id; patch: Partial<Underlay> }
  | { type: "underlay.remove"; id: Id }
  | {
      type: "schematic.setGenerated";
      walls: Wall[];
      openings: Opening[];
      slabs: Slab[];
      roofs: Roof[];
      rooms: Room[];
    }
  | { type: "view.add"; view: View }
  | { type: "view.update"; id: Id; patch: Partial<View> }
  | { type: "view.remove"; id: Id }
  | { type: "view.duplicate"; id: Id }
  | { type: "view.setOverride"; id: Id; patch: Partial<View> }
  | { type: "sheet.add"; sheet: Sheet }
  | { type: "sheet.update"; id: Id; patch: Partial<Pick<Sheet, "name" | "number" | "size">> }
  | { type: "sheet.remove"; id: Id }
  | { type: "sheet.setItems"; id: Id; items: SheetItem[] }
  | { type: "level.add"; level: Level }
  | { type: "level.update"; id: Id; patch: Partial<Level> }
  | { type: "level.remove"; id: Id }
  | { type: "grid.set"; lines: GridLine[] }
  | { type: "layer.add"; layer: Layer }
  | { type: "layer.update"; id: Id; patch: Partial<Layer> }
  | { type: "layer.remove"; id: Id }
  | { type: "layer.setActive"; id: Id }
  | { type: "mass.add"; mass: Mass }
  | { type: "mass.addMany"; masses: Mass[] }
  | { type: "mass.setLayer"; ids: Id[]; layerId: Id }
  | { type: "mass.moveMany"; ids: Id[]; dx: number; dy: number }
  | { type: "mass.updateMany"; patches: Array<{ id: Id; patch: Partial<Mass> }> }
  | { type: "group.create"; group: Group; massIds: Id[] }
  | { type: "group.update"; id: Id; patch: Partial<Group> }
  | { type: "group.remove"; id: Id }
  | { type: "mass.update"; id: Id; patch: Partial<Mass> }
  | { type: "mass.move"; id: Id; dx: number; dy: number }
  | {
      type: "mass.setVertex";
      id: Id;
      holeIndex: number | null;
      vertexIndex: number;
      point: Point;
    }
  | {
      type: "mass.addVertex";
      id: Id;
      holeIndex: number | null;
      afterIndex: number;
      point: Point;
    }
  | { type: "mass.removeVertex"; id: Id; holeIndex: number | null; vertexIndex: number }
  | { type: "mass.remove"; id: Id }
  | { type: "decision.add"; decision: Decision }
  | { type: "decision.update"; id: Id; patch: Partial<Decision> };

/** Structured deep clone of plain document data. */
export function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clonePolygonPoints(mass: Mass) {
  return {
    outer: mass.footprint.outer.map((p) => ({ ...p })),
    holes: mass.footprint.holes.map((h) => h.map((p) => ({ ...p }))),
  };
}

export function applyOperation(state: DocState, op: Operation): DocState {
  const next = cloneState(state);
  switch (op.type) {
    case "site.setBoundary":
      next.site.boundary = op.points.map((p) => ({ ...p }));
      break;
    case "site.setRoadEdges":
      next.site.roadEdges = op.roadEdges.map((r) => ({ ...r }));
      break;
    case "site.addSurface":
      if (op.surface.kind === "green") next.site.greenPolygons.push(cloneState(op.surface));
      else next.site.pavedPolygons.push(cloneState(op.surface));
      break;
    case "site.removeSurface":
      next.site.greenPolygons = next.site.greenPolygons.filter((s) => s.id !== op.id);
      next.site.pavedPolygons = next.site.pavedPolygons.filter((s) => s.id !== op.id);
      break;
    case "rules.set":
      next.rules = { ...next.rules, ...op.patch };
      break;
    case "rules.setSetback":
      next.rules = {
        ...next.rules,
        setbacks: { ...next.rules.setbacks, [op.edgeIndex]: op.value },
      };
      break;
    case "budget.set":
      next.budget = { ...next.budget, ...op.patch };
      break;
    case "brief.setText":
      next.brief = { ...next.brief, text: op.text };
      break;
    case "brief.addProgram":
      next.brief = { ...next.brief, program: [...next.brief.program, { ...op.item }] };
      break;
    case "brief.updateProgram":
      next.brief = {
        ...next.brief,
        program: next.brief.program.map((p) => (p.id === op.id ? { ...p, ...op.patch } : p)),
      };
      break;
    case "brief.removeProgram":
      next.brief = {
        ...next.brief,
        program: next.brief.program.filter((p) => p.id !== op.id),
      };
      break;
    case "brief.setSettings":
      next.brief = {
        ...next.brief,
        settings: { ...(next.brief.settings ?? { circulationPct: 20, areaUnit: "m2" }), ...op.patch },
      };
      break;
    case "brief.reorderProgram": {
      const program = [...next.brief.program];
      const from = Math.max(0, Math.min(program.length - 1, op.from));
      const to = Math.max(0, Math.min(program.length - 1, op.to));
      if (from !== to) {
        const [moved] = program.splice(from, 1);
        program.splice(to, 0, moved);
        next.brief = { ...next.brief, program };
      }
      break;
    }
    case "brief.importRows":
      next.brief = {
        ...next.brief,
        program: [...next.brief.program, ...op.rows.map((r) => ({ ...r }))],
      };
      break;
    case "brief.bindRecipe":
      next.brief = {
        ...next.brief,
        settings: { ...(next.brief.settings ?? defaultProgramSettings()), recipeBinding: op.binding },
      };
      break;
    case "brief.setParam": {
      const settings = next.brief.settings ?? defaultProgramSettings();
      const binding = settings.recipeBinding;
      if (binding) {
        next.brief = {
          ...next.brief,
          settings: {
            ...settings,
            recipeBinding: { ...binding, paramValues: { ...binding.paramValues, [op.key]: op.value } },
          },
        };
      }
      break;
    }
    case "brief.setOwnerBrief":
      next.brief = {
        ...next.brief,
        text: op.text,
        settings: { ...(next.brief.settings ?? defaultProgramSettings()), ownerBrief: op.text },
      };
      break;
    case "brief.applyRecipe": {
      // Replace recipe-generated rows but never overwrite hand-edited ones.
      const kept = next.brief.program.filter((p) => p.source !== "recipe" || p.edited);
      next.brief = {
        ...next.brief,
        program: [...kept, ...op.rows.map((r) => ({ ...r }))],
        settings: op.binding
          ? { ...(next.brief.settings ?? defaultProgramSettings()), recipeBinding: op.binding }
          : next.brief.settings,
      };
      break;
    }
    case "room.add":
      next.rooms = [...next.rooms, cloneState(op.room)];
      break;
    case "room.update":
      next.rooms = next.rooms.map((r) => (r.id === op.id ? { ...r, ...op.patch } : r));
      break;
    case "room.remove":
      next.rooms = next.rooms.filter((r) => r.id !== op.id);
      break;
    case "rooms.setConcept":
      next.rooms = [
        ...next.rooms.filter((r) => r.fidelity !== "concept"),
        ...op.rooms.map((r) => cloneState(r)),
      ];
      break;
    case "wall.add":
      next.walls = [...next.walls, { ...cloneState(op.wall), origin: op.wall.origin ?? "user" }];
      break;
    case "wall.update":
      next.walls = next.walls.map((w) =>
        w.id === op.id ? { ...w, ...op.patch, origin: op.patch.origin ?? "user" } : w,
      );
      break;
    case "wall.remove":
      next.walls = next.walls.filter((w) => w.id !== op.id);
      next.openings = next.openings.filter((o) => o.wallId !== op.id);
      break;
    case "opening.add":
      next.openings = [
        ...next.openings,
        { ...cloneState(op.opening), origin: op.opening.origin ?? "user" },
      ];
      break;
    case "opening.update":
      next.openings = next.openings.map((o) =>
        o.id === op.id ? { ...o, ...op.patch, origin: op.patch.origin ?? "user" } : o,
      );
      break;
    case "opening.remove":
      next.openings = next.openings.filter((o) => o.id !== op.id);
      break;
    case "slab.add":
      next.slabs = [...next.slabs, { ...cloneState(op.slab), origin: op.slab.origin ?? "user" }];
      break;
    case "slab.update":
      next.slabs = next.slabs.map((s) =>
        s.id === op.id ? { ...s, ...op.patch, origin: op.patch.origin ?? "user" } : s,
      );
      break;
    case "slab.remove":
      next.slabs = next.slabs.filter((s) => s.id !== op.id);
      break;
    case "roof.add":
      next.roofs = [...next.roofs, { ...cloneState(op.roof), origin: op.roof.origin ?? "user" }];
      break;
    case "roof.update":
      next.roofs = next.roofs.map((r) =>
        r.id === op.id ? { ...r, ...op.patch, origin: op.patch.origin ?? "user" } : r,
      );
      break;
    case "roof.remove":
      next.roofs = next.roofs.filter((r) => r.id !== op.id);
      break;
    case "stair.add":
      next.stairs = [...next.stairs, { ...cloneState(op.stair), origin: op.stair.origin ?? "user" }];
      break;
    case "stair.update":
      next.stairs = next.stairs.map((s) =>
        s.id === op.id ? { ...s, ...op.patch, origin: op.patch.origin ?? "user" } : s,
      );
      break;
    case "stair.remove":
      next.stairs = next.stairs.filter((s) => s.id !== op.id);
      break;
    case "railing.add":
      next.railings = [...next.railings, { ...cloneState(op.railing), origin: op.railing.origin ?? "user" }];
      break;
    case "railing.update":
      next.railings = next.railings.map((r) =>
        r.id === op.id ? { ...r, ...op.patch, origin: op.patch.origin ?? "user" } : r,
      );
      break;
    case "railing.remove":
      next.railings = next.railings.filter((r) => r.id !== op.id);
      break;
    case "underlay.add":
      next.underlays = [...next.underlays, cloneState(op.underlay)];
      break;
    case "underlay.update":
      next.underlays = next.underlays.map((u) => (u.id === op.id ? { ...u, ...op.patch } : u));
      break;
    case "underlay.remove":
      next.underlays = next.underlays.filter((u) => u.id !== op.id);
      break;
    case "schematic.setGenerated": {
      // Replace only generator-owned elements; anything the user edited stays.
      // A user element keeps its stable id, so the regenerated twin is dropped.
      const userWalls = next.walls.filter((w) => w.origin === "user");
      const userWallIds = new Set(userWalls.map((w) => w.id));
      const generatedWalls = op.walls
        .map((w) => ({ ...cloneState(w), origin: "generated" as const }))
        .filter((w) => !userWallIds.has(w.id));
      next.walls = [...userWalls, ...generatedWalls];

      const wallIds = new Set(next.walls.map((w) => w.id));
      const userOpenings = next.openings.filter((o) => o.origin === "user" && wallIds.has(o.wallId));
      const userOpeningIds = new Set(userOpenings.map((o) => o.id));
      next.openings = [
        ...userOpenings,
        ...op.openings
          .map((o) => ({ ...cloneState(o), origin: "generated" as const }))
          .filter((o) => !userOpeningIds.has(o.id)),
      ];

      const userSlabs = next.slabs.filter((s) => s.origin === "user");
      const userSlabIds = new Set(userSlabs.map((s) => s.id));
      next.slabs = [
        ...userSlabs,
        ...op.slabs
          .map((s) => ({ ...cloneState(s), origin: "generated" as const }))
          .filter((s) => !userSlabIds.has(s.id)),
      ];

      const userRoofs = next.roofs.filter((r) => r.origin === "user");
      const userRoofIds = new Set(userRoofs.map((r) => r.id));
      next.roofs = [
        ...userRoofs,
        ...op.roofs
          .map((r) => ({ ...cloneState(r), origin: "generated" as const }))
          .filter((r) => !userRoofIds.has(r.id)),
      ];

      const keptRooms = next.rooms.filter((r) => r.fidelity !== "schematic" || r.origin === "user");
      const keptRoomIds = new Set(keptRooms.map((r) => r.id));
      next.rooms = [
        ...keptRooms,
        ...op.rooms
          .map((r) => ({ ...cloneState(r), fidelity: "schematic" as const, origin: "generated" as const }))
          .filter((r) => !keptRoomIds.has(r.id)),
      ];
      break;
    }
    case "view.add":
      next.views = [...next.views, cloneState(op.view)];
      break;
    case "view.update":
      if (op.id.startsWith("sys:")) {
        next.viewOverrides = {
          ...next.viewOverrides,
          [op.id]: { ...(next.viewOverrides[op.id] ?? {}), ...op.patch },
        };
      } else {
        next.views = next.views.map((v) => (v.id === op.id ? { ...v, ...op.patch } : v));
      }
      break;
    case "view.remove":
      next.views = next.views.filter((v) => v.id !== op.id);
      if (next.viewOverrides[op.id]) {
        const { [op.id]: _removed, ...rest } = next.viewOverrides;
        next.viewOverrides = rest;
      }
      break;
    case "view.duplicate": {
      const source = next.views.find((v) => v.id === op.id);
      if (source) {
        next.views = [
          ...next.views,
          { ...cloneState(source), id: newId("view"), system: false, name: `${source.name} copy` },
        ];
      }
      break;
    }
    case "view.setOverride":
      next.viewOverrides = {
        ...next.viewOverrides,
        [op.id]: { ...(next.viewOverrides[op.id] ?? {}), ...op.patch },
      };
      break;
    case "sheet.add":
      next.sheets = [...(next.sheets ?? []), cloneState(op.sheet)];
      break;
    case "sheet.update":
      next.sheets = (next.sheets ?? []).map((s) => (s.id === op.id ? { ...s, ...op.patch } : s));
      break;
    case "sheet.remove":
      next.sheets = (next.sheets ?? []).filter((s) => s.id !== op.id);
      break;
    case "sheet.setItems":
      next.sheets = (next.sheets ?? []).map((s) =>
        s.id === op.id ? { ...s, items: cloneState(op.items) } : s,
      );
      break;
    case "level.add":
      next.levels = [...next.levels, { ...op.level }];
      break;
    case "level.update":
      next.levels = next.levels.map((l) => (l.id === op.id ? { ...l, ...op.patch } : l));
      break;
    case "level.remove":
      next.levels = next.levels.filter((l) => l.id !== op.id);
      next.masses = next.masses.map((m) => ({
        ...m,
        levelIds: m.levelIds.filter((id) => id !== op.id),
      })).filter((m) => m.levelIds.length > 0);
      next.rooms = next.rooms.filter((r) => r.levelId !== op.id);
      break;
    case "grid.set":
      next.grids = op.lines.map((l) => ({ ...l }));
      break;
    case "layer.add":
      next.layers = [...(next.layers ?? []), { ...op.layer }];
      // A new layer becomes current, like every CAD tool.
      next.activeLayerId = op.layer.id;
      break;
    case "layer.update":
      next.layers = (next.layers ?? []).map((l) => (l.id === op.id ? { ...l, ...op.patch } : l));
      break;
    case "layer.remove": {
      const layers = next.layers ?? [];
      if (layers.length <= 1) break; // always keep at least one layer
      next.layers = layers.filter((l) => l.id !== op.id);
      const fallback =
        next.activeLayerId && next.activeLayerId !== op.id &&
        next.layers.some((l) => l.id === next.activeLayerId)
          ? next.activeLayerId
          : next.layers[0].id;
      // Re-home any object that lived on the removed layer.
      next.masses = next.masses.map((m) => (m.layerId === op.id ? { ...m, layerId: fallback } : m));
      if (next.activeLayerId === op.id) next.activeLayerId = fallback;
      break;
    }
    case "layer.setActive":
      next.activeLayerId = op.id;
      break;
    case "mass.add":
      next.masses = [...next.masses, cloneState(op.mass)];
      break;
    case "mass.addMany":
      next.masses = [...next.masses, ...op.masses.map((m) => cloneState(m))];
      break;
    case "mass.setLayer": {
      const ids = new Set(op.ids);
      next.masses = next.masses.map((m) => (ids.has(m.id) ? { ...m, layerId: op.layerId } : m));
      break;
    }
    case "mass.moveMany": {
      const ids = new Set(op.ids);
      next.masses = next.masses.map((m) => {
        if (!ids.has(m.id)) return m;
        return {
          ...m,
          footprint: {
            outer: m.footprint.outer.map((p) => ({ x: p.x + op.dx, y: p.y + op.dy })),
            holes: m.footprint.holes.map((h) =>
              h.map((p) => ({ x: p.x + op.dx, y: p.y + op.dy })),
            ),
          },
        };
      });
      break;
    }
    case "mass.updateMany": {
      const byId = new Map(op.patches.map((p) => [p.id, p.patch]));
      next.masses = next.masses.map((m) => {
        const patch = byId.get(m.id);
        return patch ? { ...m, ...patch } : m;
      });
      break;
    }
    case "group.create": {
      next.groups = [...(next.groups ?? []), { ...op.group }];
      const ids = new Set(op.massIds);
      next.masses = next.masses.map((m) => (ids.has(m.id) ? { ...m, groupId: op.group.id } : m));
      break;
    }
    case "group.update":
      next.groups = (next.groups ?? []).map((g) => (g.id === op.id ? { ...g, ...op.patch } : g));
      break;
    case "group.remove":
      next.groups = (next.groups ?? []).filter((g) => g.id !== op.id);
      next.masses = next.masses.map((m) => (m.groupId === op.id ? { ...m, groupId: undefined } : m));
      break;
    case "mass.update":
      next.masses = next.masses.map((m) => (m.id === op.id ? { ...m, ...op.patch } : m));
      break;
    case "mass.move":
      next.masses = next.masses.map((m) => {
        if (m.id !== op.id) return m;
        return {
          ...m,
          footprint: {
            outer: m.footprint.outer.map((p) => ({ x: p.x + op.dx, y: p.y + op.dy })),
            holes: m.footprint.holes.map((h) =>
              h.map((p) => ({ x: p.x + op.dx, y: p.y + op.dy })),
            ),
          },
        };
      });
      break;
    case "mass.setVertex":
      next.masses = next.masses.map((m) => {
        if (m.id !== op.id) return m;
        const footprint = clonePolygonPoints(m);
        const ring = op.holeIndex === null ? footprint.outer : footprint.holes[op.holeIndex];
        if (!ring || op.vertexIndex < 0 || op.vertexIndex >= ring.length) return m;
        ring[op.vertexIndex] = { ...op.point };
        return { ...m, footprint };
      });
      break;
    case "mass.addVertex":
      next.masses = next.masses.map((m) => {
        if (m.id !== op.id) return m;
        const footprint = clonePolygonPoints(m);
        const ring = op.holeIndex === null ? footprint.outer : footprint.holes[op.holeIndex];
        if (!ring) return m;
        const at = Math.min(Math.max(op.afterIndex + 1, 0), ring.length);
        ring.splice(at, 0, { ...op.point });
        return { ...m, footprint };
      });
      break;
    case "mass.removeVertex":
      next.masses = next.masses.map((m) => {
        if (m.id !== op.id) return m;
        const footprint = clonePolygonPoints(m);
        if (op.holeIndex === null) {
          if (footprint.outer.length <= 3) return m; // never a degenerate outer ring
          footprint.outer.splice(op.vertexIndex, 1);
        } else {
          const hole = footprint.holes[op.holeIndex];
          if (!hole) return m;
          hole.splice(op.vertexIndex, 1);
          if (hole.length < 3) footprint.holes.splice(op.holeIndex, 1);
        }
        return { ...m, footprint };
      });
      break;
    case "mass.remove":
      next.masses = next.masses.filter((m) => m.id !== op.id);
      break;
    case "decision.add":
      next.decisions = [...next.decisions, cloneState(op.decision)];
      break;
    case "decision.update":
      next.decisions = next.decisions.map((d) =>
        d.id === op.id ? { ...d, ...op.patch } : d,
      );
      break;
  }
  return next;
}

export function operationLabel(op: Operation): string {
  const [scope, action] = op.type.split(".");
  return `${action} ${scope}`;
}
