# Qreasee — Technical Deep-Dive

**Audience:** developer / technical advisor · **Date:** 3 October 2026 ·
**Repo:** `D:\Qreasee\qreasee` · **Status:** working prototype, local-first

This document describes *how the current build is put together*, its APIs, its
algorithms, its known technical debt, and the technical decisions that need a second
opinion. It reflects the running code, not a roadmap claim. For the product view see
`docs/STATE_OF_QREASEE.md`; for the spec see `docs/PRD.md`.

---

## 1. Summary for a technical reader

Qreasee is a TypeScript strict monorepo that separates a **deterministic
document/geometry/indicator core** from a **React + three.js client**. The core is
free of UI and rendering imports so it runs identically in Node (tests) and in Web
Workers (the browser). Every edit is a serialisable **operation**; state is a pure
fold over an operation log, which is also the branch and undo/redo mechanism.

The rendered prototype is ~**72 source files**, **7 packages**, **50 unit tests**.
There is **no server** yet: persistence is `localStorage`, and all computation is
client-side. The interesting engineering is in (a) the branch/adoption model,
(b) the regulation/cost/sun indicator fixtures, (c) the mass→schematic generator and
(d) the coordinate-convention bridge between the geographic model and three.js.

---

## 2. System architecture

```
                        ┌─────────────────────────────────────────────┐
                        │                apps/web (browser)            │
                        │  React 18 · Vite · Tailwind · Zustand        │
                        │                                              │
                        │  UI (Topbar/Toolbar/Panels/IndicatorBar)     │
                        │        │ actions                             │
                        │        ▼                                     │
                        │  useApp (Zustand) ── holds DocumentStore     │
                        │        │                          │          │
                        │        │ ops                      │ state    │
                        │        ▼                          ▼          │
                        │  ViewportController (three.js)   Comlink ────┼──► Web Worker
                        │  scene groups, tools, camera     client      │   computeIndicators()
                        └───────────────┬──────────────────────────────┘   computeSunExposure()
                                        │ imports (pure TS)
        ┌───────────────┬───────────────┼───────────────┬───────────────┐
        ▼               ▼               ▼               ▼               ▼
   @qreasee/       @qreasee/       @qreasee/       @qreasee/       @qreasee/
   shared          geometry        document        indicators      schematic
   types,zod,      Clipper2,       operations,     KDB/KLB/KDH,    rooms,walls,
   i18n,format,    earcut,         DocumentStore,  cost,program,   openings,slabs,
   materials       extrude,        branches,       sun             roof,section,SVG
                   setbacks        adoption
                                        │
                                        ▼
                                  @qreasee/export
                                  DXF · COLLADA · comparison
                                  sheet · decision log · .qrs
```

**Runtime topology today:** single browser tab; one worker for indicators/sun; no
network except OpenStreetMap tiles/Overpass and optional glTF export. A `.qrs` file
is the only portable artifact.

**Dependency direction (enforced by convention, not by tooling):**
`shared → geometry → {document, indicators, schematic, export} → web`.
`geometry`, `document`, `indicators`, `schematic` must not import three.js or React.

---

## 3. Packages

| Package | Public surface (key) | Lines of note |
|---|---|---|
| `@qreasee/shared` | `DocState`, `Mass`, `Branch`, `IndicatorResult`, `Material`, zod schemas, `t()`/`makeTranslator`, `formatRupiahRange`, `MATERIALS`, `newId` | Single source of domain types; zod schemas power `.qrs` validation |
| `@qreasee/geometry` | `unionPolygons`, `differencePolygons`, `intersectPolygons`, `inflatePolygon`, `buildableArea`, `setbackLines`, `triangulatePolygon(s)`, `extrudePolygon`, `rotatePolygon`, polygon predicates | Clipper2 adapter + earcut + extrusion |
| `@qreasee/document` | `DocumentStore`, `applyOperation`, `Operation`, `SerializedStore` | Operation log, branches, adoption, undo/redo |
| `@qreasee/indicators` | `computeIndicators`, `computeSunExposure`, `siteAreaMm2`, `gfaMm2`, `kdb/klb/kdh/floors/height/setback`, `costRange`, `programFit`, `massBaseElevation` | Pure functions + fixtures |
| `@qreasee/schematic` | `generateSchematic`, `deriveRooms`, `buildSchematic`, `buildRoof`, `sectionAtLine`, `planSvg/sectionSvg/elevationSvg` | Schematic generator + drawings |
| `@qreasee/export` | `exportDxf`, `exportCollada`, `exportQrs`, `importQrs`, `decisionLogMarkdown/Csv`, `comparisonSheetSvg` | File formats |
| `apps/web` | `useApp` store, `ViewportController`, panels, `indicators.worker` | Client |

**Versions that matter:** three.js `0.169`, clipper2-js `1.2.4`, earcut `3.0`,
suncalc `1.9`, dxf-writer `1.18`, fflate `0.8`, comlink `4.4`, leaflet `1.9`,
React `18.3`, Vite `5`, Vitest `2`, turbo `2`.

---

## 4. Data model and conventions

### 4.1 Units and axes
- **Lengths: millimetres. Areas: mm². Money: Rupiah.** Display units are converted at
  the edge (`formatArea`, `formatRupiahRange`).
- Model ground plane: **+X east, +Y north**. Elevation is stored in mm on entities
  (`Level.elevation`, mass base + height).
- `Project.northAngle` = degrees **clockwise from model +Y to true north**.
- **three.js bridge (important):** three renders the ground on X/Z with **Y up**, and
  its cameras show +Z downward, which would mirror the plan against the map. We keep
  the model at +Y = north and reflect at the render boundary:
  `modelGroup.scale.z = -1` (and the draft/handle/section groups). Model point
  `(x, elev, y)` therefore lives at world `(x, elev, -y)`. Exactly four functions
  cross the boundary and negate Z: `pointerToGround`, `recenterToCursor`,
  `focusView`, and the north arrow. Document, indicators and exports stay in
  +Y-north space.

### 4.2 `DocState` (the branch payload)
```ts
interface DocState {
  site:   { boundary: Point[]; roadEdges: RoadEdge[]; greenPolygons; pavedPolygons }
  rules:  { kdbMax?; klbMax?; kdhMin?; heightMax?; floorsMax?; setbacks: Record<number, number>; sourceNote? }
  budget: { ceiling?; low?; high?; ratePerM2?: { low; high } }
  brief:  { text: string; program: ProgramItem[] }
  levels: Level[]
  grids:  GridLine[]
  masses: Mass[]
  decisions: Decision[]
  records:   DecisionRecord[]
}
```
`Mass` is the massing primitive: `{ id, levelIds[], footprint: Polygon (with holes),
height, use?, fidelity, intent?, ... }`. `Intent` adds low/high ranges for height and
area, which widen indicator results. `Fidelity = intent | massing | schematic |
detailed`; only the first two are built.

Everything is **optional-friendly**: a missing rule produces a `needs-input`
indicator, never an exception.

---

## 5. Document core: operations, branches, adoption

### 5.1 Operations
`Operation` is a closed discriminated union (22 variants): `site.*`, `rules.*`,
`budget.set`, `brief.*`, `level.*`, `grid.set`, `mass.add|update|move|setVertex|
addVertex|removeVertex|remove`, `decision.add|update`. `applyOperation(state, op)`
is **pure** — it deep-clones and returns a new `DocState`. No component mutates state.

Adding an edit = one union member + one `case`. That is the extension point.

### 5.2 `DocumentStore` API
```ts
class DocumentStore {
  get mainBranchId / activeBranchId / active / main
  getState(branchId?): DocState
  listBranches(): Branch[];  getBranch(id);  getOpLog(id?)
  canUndo(branchId?); canRedo(branchId?); get revisionNumber
  subscribe(fn): () => void
  dispatch(op): void; undo(); redo()
  switchBranch(id)
  createBranch({name,color?,decisionId?,fromBranchId?,owner?}): Branch
  setBranchStatus(id,status); renameBranch; parkBranch; reviveBranch(parkedId,name?)
  adopt({branchId,rationale,by,resolutions?,buildRejected?}): AdoptResult
  serialize(): SerializedStore; static deserialize(data)
}
```
**Branch data:** each branch owns `{ branch, state, opLog, undo[], redo[], version,
forkSnapshot, forkVersion }`. State is materialized (not replayed on read); the
`forkSnapshot` is main's state at fork time and is what conflict detection compares
against. `reviveBranch` rebuilds a parked branch by re-applying its `opLog` onto its
`forkSnapshot`.

**Undo/redo** are per-branch snapshot stacks capped at 200 entries, cleared on new
dispatch. They share the mechanism with branches conceptually but are not expressed
as inverse operations.

### 5.3 Adoption algorithm
```
adopt(branchId, rationale, resolutions?, buildRejected?):
  decision = branch.state.decisions[branch.decisionId]
  ids      = scopeMassIds(decision, main.state, branch.state)      // whole | level | masses
  conflicts = ids where mainMass, branchMass, forkMass all differ pairwise
  if conflicts and no resolution for each -> return { ok:false, conflicts }
  for id in ids:
     if resolution == "main" -> skip
     branch has, main lacks      -> op mass.add(branchMass)
     both, differ                -> op mass.update(branchMass)
     branch lacks, main has      -> op mass.remove(id)
  apply ops to main opLog; mark branch adopted; park sibling branches of the decision
  write DecisionRecord{ rationale, rejected[] + indicators, rulesSnapshot, by, at }
  decision.status = decided
```
Adoption is atomic within a synchronous call and revertible via main's undo stack.
`buildRejected` is injected by the client so `document` stays free of `indicators`.

**Known weakness:** conflict granularity is per-mass (`JSON.stringify` equality), not
per-vertex or per-property; and `reviveBranch` re-applies the op log, which assumes
ops remain valid against the snapshot.

---

## 6. Indicators engine

### 6.1 API
```ts
computeIndicators(state: DocState, opts: { branchId; version; lang?; sun?: SunContext }): IndicatorResult[]
computeSunExposure(state: DocState, ctx: { lat; lng; northAngle }): SunSummary
```
`IndicatorResult = { branchId, version, key, label, value? | range?, unit?, status,
fidelity, limit?, inputs?, detail? }`.
`key ∈ kdb|klb|kdh|setback|height|floors|gfa|coverage|cost|program|sun`,
`status ∈ ok|near|over|under|needs-input`.

### 6.2 Formulas and thresholds

| Indicator | Value | Rule |
|---|---|---|
| KDB | coverage union ÷ site × 100 | `limitStatus` |
| KLB | GFA ÷ site | `limitStatus` |
| KDH | green ÷ site × 100 | below min → `over`; min…1.1·min → `near`; else `ok`; no green → `needs-input` + upper bound (site − coverage) |
| Setback | footprint outside buildable | breach > 0.01 m² (10 000 mm²) → `over`, tinted red |
| Height | max(mass top) − level-1 elevation | `limitStatus` |
| Floors | levels containing ≥1 mass | `limitStatus` |
| Coverage | union of footprints (mm²) | informational |
| GFA | Σ per level union of footprints | range when Intent areas differ |
| Cost | GFA × rate low…high | ok high ≤ ceiling; near ceiling ∈ range; over low > ceiling; no rate → `needs-input` |
| Program | per item footprint×levels vs target | ok ±10 %, near ±20 %, else over/under |
| Sun | per-face direct-sun hours | average of 3 days |

`limitStatus(v,max)`: `v < 0.9·max → ok`, `≤ max → near`, `> max → over`.

### 6.3 Sun algorithm
`SunCalc.getPosition` sampled every 30 min between sunrise and sunset on 21 Mar / 21
Jun / 21 Dec; a face is sunlit when altitude > 0 and `dot(outward normal, sunDir) > 0`;
hours averaged across the three days; tint scale 0–8 h; summary splits facade area
into <2 h / 2–4 h / >4 h and reports the east/west share of high exposure. Shading by
other masses is intentionally ignored (PRD P1). `northAngle` rotates the solar bearing
into model coordinates.

### 6.4 Worker integration
`indicators.worker.ts` exposes `compute` and `sun` via Comlink.
`indicatorsClient.ts` wraps it and **falls back to synchronous** computation if
`Worker` is unavailable. Results are versioned against the branch; stale responses are
dropped by a monotonic sequence number. Fixtures live as Vitest tests with
hand-calculated expected values (concave site, courtyard, Intent range, sun bounds).

---

## 7. Geometry kernel

- **Booleans/offsets:** clipper2-js (Clipper2), integer engine; we scale mm→int with
  scale 1.
- **Two upstream quirks we work around (documented in `DECISIONS.md`):**
  1. clipper2-js declares Angular peer deps but imports none — `auto-install-peers=false`.
  2. It degenerates when a clip shares an exact edge with the subject — setback strips
     are extended slightly outside the site and past both corners before differencing.
- **Orientation:** under NonZero fill, holes must wind opposite to outers;
  `polygonsToPaths` normalises orientation, and `removeCollinear`/`cleanRing` remove the
  duplicate points Clipper emits.
- **Triangulation:** earcut (holes supported); `triangulatePolygons` offsets indices for
  multi-polygon output.
- **Extrusion:** `extrudePolygon(poly, baseZ, topZ)` returns non-indexed positions +
  per-vertex normals + a `wall: WallFace[]` list (outward unit normal, area) — the wall
  list feeds the sun indicator; the triangles feed three.js. Caps are flat-shaded.
- **Predicates:** shoelace area, point-in-ring with boundary, `isSimpleRing`
  (self-intersection rejection per NFR), point-on-segment with a degenerate-edge guard.
- **Setbacks:** buildable area = site − union(per-edge strips); strips are the
  min(x, …)+overhang rectangles described above.

**Numeric policy:** mm double precision; areas rounded to 0.01 m² for display only;
Clipper inputs rounded to integers.

---

## 8. Schematic generator

Pipeline: `generateSchematic(mass, program, options, baseZ, height)` →
`deriveRooms(footprint, program, tExt)` → `buildSchematic({mass, derived, options, baseZ, height})`.

**Rooms.** Guillotine partition of the footprint bounding box: repeatedly split the
largest cell along its longer side until `count` cells, where `count = #program
targets` or `footprintArea / 16 m²`. Each cell is clipped to the footprint with
Clipper2 intersection; slivers < 2 m² are dropped; rooms are named by matching
area-descending to target-descending. Partitions are the recorded guillotine split
segments clipped to the footprint (200 mm sampling). This is deterministic and
testable but **axis-aligned** — it does not follow circulation.

**Stable ids** (survive regeneration, so material assignments key by id):
`room-{i}`, `wall-ext-{ring}-{edge}`, `wall-part-{i}`, `slab-floor`, `slab-ceiling`,
`roof`.

**Walls and openings.** Exterior walls: one band per footprint ring edge, 150 mm
inward (`wallBase(off0=0, off1=t)`). Partitions: centred on the segment
(`±t/2 = ±50 mm`). Openings are cut **without CSG** by splitting the wall into solid
panels around the hole: left jamb · right jamb · sill (below) · lintel (above). A
window is `sill=900, height=1500`; a door is `sill=0, height=2100`; one centred window
per exterior edge and one centred door per partition are auto-placed.

**Slabs/roof.** Floor [baseZ − 120, baseZ], ceiling [topZ, topZ + 120]. Roof over the
**bounding box** expanded by a 600 mm overhang, pitch 30° (hip/gable/one-slope). Non-
rectangular footprints are therefore approximated for the roof.

**Materials.** `SchematicOptions.materials: Record<elementId, materialId>`; defaults
from `DEFAULT_MATERIAL_FOR`. The library is `packages/shared/materials.ts` (~35 entries,
category + colour + roughness + optional opacity/metalness). Colour only — no textures,
no quantities.

**Sections.** `sectionAtLine(schematic, line)` intersects the cut line with each
wall/slab plan polygon (line–polygon) and each roof face with the vertical plane, and
returns `SectionCut { walls, slabs, roofSegments, uRange, groundZ, eaveZ, ridgeZ }`.
`sectionSvg` draws poché from it. Single-level today.

**Drawings.** Hand-built SVG (`Canvas` class tracking bounds). Model→SVG maps plan
`(x,y)→(x,−y)`, section/elevation `(u,z)→(u,−z)`. The viewBox is padded by **12.5 % of
the larger dimension**, so the drawing fills ~80 % of the sheet. `planSvg(s, line?)`
also draws the section line; `elevationSvg` projects roof edges to x–z.

---

## 9. Export and file formats

| Format | Library | Mapping |
|---|---|---|
| DXF | dxf-writer | units mm; layers `Q-SITE`, `Q-SETBACK` (dashed), `Q-GRID`, `Q-LT{n}`; title text |
| COLLADA `.dae` | custom XML writer | **metres, `Z_UP`**; one `<node>` per mass named `"{level} {use}"`; triangles with normals; site+grid as `<lines>` |
| glTF/GLB, OBJ | three.js exporters (browser) | builds a `THREE.Group` from masses via `extrudePolygon` |
| Comparison sheet | custom SVG → canvas → PNG | branch plans + indicator table, best-per-row |
| Decision log | text | Markdown and CSV from `DecisionRecord[]` |
| `.qrs` | fflate | zip of `project.json` = `{ format:"qreasee", formatVersion:1, savedAt, project, docState, store }` |

`.qrs` validates on import (`importQrs`). It is the persistence unit and the intended
server payload shape.

---

## 10. Web client architecture

### 10.1 State (`useApp`, Zustand)
The store owns the `DocumentStore` instance plus UI state. `AppState` (abridged):
`project, doc, docState, branches, activeBranchId, revision, indicators,
indicatorsPending, sunFaces, sunSummary, contextBuildings, showContext, contextStatus,
schematic, schematicMassId, showSchematic, roofType, roofPitch, mode, projection,
selectedElement, elementMaterials, sectionLine, lang, lens, tool, panel, theme,
activeLevelId, selectedMassId, sunView, showIndicators, showGrid, compareBranchIds,
overlayCompare, statusMessage`.

Actions: `dispatch, undo, redo, switchBranch, setTool, setLens, setPanel, setTheme,
toggleTheme, setLang, selectMass, setActiveLevel, toggleSunView, toggleIndicators,
toggleGrid, fetchContext, setShowContext, clearContext, generateSelectedSchematic,
clearSchematic, toggleSchematic, setRoofType, setRoofPitch, setMode, setProjection,
selectElement, setElementMaterial, setSectionLine, addLevelFromMass, updateProject,
newProject, loadSample, replaceWorkspace, addDecision, createBranch, adoptBranch,
parkBranch, reviveBranch, setCompare, refreshIndicators, setStatus`.

`refresh()` re-snapshots `docState`/branches, bumps `revision` (the React trigger),
recomputes indicators and debounces a persist. Persist key:
`qreasee.workspace.v1` (project + serialized store + context + showContext + theme).

### 10.2 Viewport (`ViewportController`)
Owns renderer, scene, lights, `OrbitControls`, and five groups:
`modelGroup`, `draftGroup`, `handleGroup`, `sectionGroup` (all Z-reflected) and
`northGroup` (unreflected, world coords). `refresh()` rebuilds geometry from the
snapshot (no incremental diffing). Responsibilities:
- **Renderers:** masses (edges, breach tint, Intent translucency, sun vertex colours),
  site/road/setback/green/buildable, grid (project grids or 5 m fallback), axes, north
  arrow, OSM context, schematic (rooms/walls/slabs/roof), section line, handles.
- **Cameras:** perspective + orthographic; `setProjection` swaps `controls.object` and
  sizes the ortho frustum from the perspective view; `focusView(top|front|iso|fit)`;
  `worldPerPixel` branches on camera type.
- **Tools** (`Tool` union): select, rectangle, polygon, circle, ellipse, arc,
  pushpull, vertex, pan, rotate, section, site, road, green. The controller is a small
  state machine: draft points, rect/circle/ellipse/arc previews, drag kinds
  (move/height/vertex), snapping, object-rotate protractor (centre → baseline → angle,
  15° snap), section-line placement, pan (screen-plane), orbit re-centre on cursor.
- **Snapping** is **3D and screen-space** (LG-03): `@qreasee/geometry` `snap.ts`
  builds candidates in 3D (endpoints/midpoints/edges at base, top and each level;
  grid intersections; site/green edges; underlay linework; draft close/axis/
  parallel/perpendicular) and `pickSnap` matches them in **pixels** through the
  viewport's `project()`. Priority endpoint > midpoint > intersection > edge >
  guide > grid, with occlusion against mass faces (skipped in top-down ortho).
  Markers render as DOM shapes (constant pixel size, distinct shape per kind).
- **Drawing plane** is set to the active level elevation
  (`groundPlane.constant = -elevation`, `draftY = elevation + 16`); ground tools
  (site/green/road) use 0.

### 10.3 Context map (`MapPanel`)
Leaflet + OSM tiles. Tracing projects lat/lng → model via the same `northAngle`
rotation as the OSM context, so site, context and model align. `projectLatLng` /
`unprojectToLatLng` are equirectangular around the project origin.

### 10.4 Theming, i18n
The `ink` scale is CSS-variable driven (`styles.css`); `[data-theme="light"]` inverts
it, so existing utility classes flip. The 3D renderer reads the theme for background,
ground and grid. `shared/i18n.ts` holds EN + ID strings and `makeTranslator(lang)`.

---

## 11. Build, test, tooling

```
pnpm install
pnpm dev          # vite, :5173
pnpm typecheck    # turbo → tsc --noEmit, all packages
pnpm test         # turbo → vitest (50 tests)
pnpm build        # tsc + vite build
pnpm --filter @qreasee/web e2e   # playwright smoke (needs: playwright install)
```
Workspaces via `pnpm-workspace.yaml`; tasks via `turbo.json` (`build` depends on
`^build`). Packages export **TypeScript source** (`main/types` → `src/index.ts`) and
are transpiled by Vite/Vitest, so there is no per-package build step in dev; package
`build` is `tsc --noEmit`. Tests: geometry 15, indicators 16, document 7, schematic 8,
export 4. Strict TS with `noImplicitOverride`; `no any` is a PRD rule for the pure
packages (currently satisfied by convention, not lint).

**CI is not wired** (no GitHub Actions in this folder). Playwright config + one smoke
spec exist but browsers must be installed.

---

## 12. Performance and limits

- **NFR target:** 60 fps at 50 masses / 6 levels, indicators < 200 ms, branch switch
  < 500 ms, project open < 3 s / 20 Mbps.
- **Current reality:** indicators are in a worker (good); but `refresh()` **rebuilds the
  whole scene graph** on any change and re-renders continuously with damping. Fine for
  the sample (a handful of masses); **untested at the NFR target**. This is the main
  known performance gap. Fix direction: incremental scene updates keyed by entity id,
  dirty flags, and instancing for context buildings.
- Bundle: web JS ≈ 1.2 MB minified (three + clipper + leaflet + radix); no code
  splitting yet.
- Sun computation is the most expensive indicator (3 days × ~30 samples × faces); it is
  lazy (only when sun view is on) and in the worker.

---

## 13. Security, tenancy, privacy (not built)

There is no auth, no server, no multi-tenancy. A server (PRD M2) would need: tenant
isolation, role checks (owner/admin/editor/guest/viewer) on every call, signed URLs,
HTTPS-only, operation acknowledgement + IndexedDB retry queue, atomic adoption
server-side, and Indonesian personal-data (UU PDP) handling. Hosting region
(Indonesia/Singapore) and the storage choice (R2/S3) are open.

---

## 14. Roadmap mapping (PRD §11) and status

| Milestone | Scope | Status |
|---|---|---|
| M0 Foundations | viewport, axes/grid/north, tests in CI | **done** (except CI) |
| M1 Site & massing | CX-01…08, MD-01…08, LG-01…03 | **done** (copy/arrays/roof-forms reserved) |
| M2 Persistence & accounts | sign-in, studio, project list, versions | **reserved** (localStorage only) |
| M3 Live feedback | IN-01…06, FD-01…03, §9 | **done** |
| M4 Lenses | LN-01…04 | **done** |
| M5 Decision Branches | DB-01…07 | **done** (DB-08/09 reserved) |
| M6 Team & export | TM-01…05, EX-01…06, PA-04 | **export done**, team reserved |
| M7 Pilot | real studios | not started |
| Release 2 | walls/slabs/openings, quantities, OTTV, IFC, proposals | **first schematic slice only** |
| Release 3 | BoQ, sheets, style kits, AI notes | reserved |

---

## 15. Technical debt register

1. **Scene rebuild on every change** — biggest perf risk (see §12).
2. **Schematic is derived, not a document entity** — material overrides live in the app
   store, so they are not branched, not in the op log, and survive only via
   `localStorage`. Moving schematic into `DocState` (and the op log) is the clean fix.
3. **Rooms/openings are not editable geometry** — no partition dragging, no per-wall
   opening placement, no split/merge.
4. **Stacked levels are unlinked** — independently authored masses.
5. **Roof uses the bounding box** — arbitrary footprints approximated.
6. **Section is single-level.**
7. **Conflict detection is coarse** (`JSON.stringify` per mass).
8. **`reviveBranch` re-applies the op log** rather than copying the parked state; fragile
   if ops are not idempotent against the snapshot.
9. **No lint rule enforcing "no UI imports in core"** — currently convention.
10. ~~**`worldPerPixel`/snapping** is unclamped at extreme zoom.~~ **Fixed
    (LG-03):** snapping now matches in screen pixels (`@qreasee/geometry/snap`);
    `worldPerPixel` remains only for pan, push/pull height and guide dashes.
11. **Playwright not run in CI; no CI at all.**
12. **`localStorage` quota** silently swallowed on persist failure.

---

## 16. Extension guide

- **Add an edit:** add a variant to `Operation`, a `case` in `applyOperation`, and a
  dispatch helper if needed. It automatically participates in undo/redo and branches.
- **Add an indicator:** add a pure function in `indicators`, return a partial
  `IndicatorResult`, wire it into `computeIndicators`, and add a fixture test with a
  hand-calculated value.
- **Add an export:** implement `xxx(state, project)` in `export`, add a button in
  `ExportPanel`, keep it synchronous and string/`Uint8Array` based.
- **Add a tool:** extend the `Tool` union, add a toolbar entry, and a branch in
  `ViewportController.onPointer*`; use `pointerToGround`, `computeSnap`, and dispatch
  operations.
- **Add a material:** append to `MATERIALS` with a category; it appears in the picker.

---

## 17. Open technical questions for the advisor

1. **Schematic as a document entity:** should walls/rooms/openings be first-class
   branchable entities in the op log (my recommendation), or stay derived with
   overrides? This determines whether schematic decisions can be branched/compared.
2. **Room generation:** guillotine (current) vs a circulation-graph partition vs
   manual drawing. Which is most credible to architects, and what is the migration path
   to editable rooms?
3. **Linked storeys:** model a stacked building as one entity with per-level overrides,
   or keep independent masses and add a "link" relation?
4. **Performance:** incremental scene + instancing now, or wait for a pilot? What is the
   realistic target model size?
5. **Geometry kernel longevity:** keep clipper2-js (with its quirks) or move to a
   maintained Clipper2 WASM; is CSG (for true openings/booleans) needed for Release 2?
6. **Collaboration transport:** Yjs/CRDT vs an operation log with server sequence
   numbers. The op log is a good fit for branch semantics but CRDT is stronger for
   concurrent editing. Which do we commit to?
7. **Server language/deploy:** stay TS (Fastify + tRPC + Drizzle + Postgres) per the
   PRD, or choose otherwise given the geometry is client-side?
8. **IFC timing:** adopt That Open Engine at Release 2 as planned, or defer until the
   schematic schema is stable?
9. **Drawing engine:** continue hand-built SVG, or move to a real 2D CAD/SVG library as
   drawings grow (dimensions, tags, sheets, PDF)?
10. **Testing strategy at the seams:** what should be property-based (geometry,
    adoption) vs fixture-based (indicators) vs e2e (core loop)?

---

## 18. Appendix

**Repo layout**
```
qreasee/
  apps/web/{index.html, vite.config.ts, src/…}   # React client
  packages/{shared,geometry,document,indicators,schematic,export}/src
  docs/{PRD.md, DECISIONS.md, PROGRESS.md, STATE_OF_QREASEE.md, TECHNICAL_DEEP_DIVE.md}
  package.json, pnpm-workspace.yaml, turbo.json, tsconfig.base.json
```
**Commands:** see §11. **Persistence key:** `qreasee.workspace.v1`. **File format:**
`.qrs` (zip / `project.json`, `formatVersion: 1`).

**Invariants to preserve**
- No UI/rendering imports in `geometry`, `document`, `indicators`, `schematic`.
- All edits through the operation log; no direct mutation.
- Indicators deterministic + fixture-tested; no AI in the model path.
- Never a required field in a sketching tool; missing inputs → `needs-input`.

---

*Prepared for technical review. Numbers and APIs reflect the repository at the date
above; regenerate with `pnpm test` and `pnpm typecheck` before quoting.*
