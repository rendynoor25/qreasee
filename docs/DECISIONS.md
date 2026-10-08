# Decisions and assumptions

The PRD asks the agent to write unclear points here instead of guessing silently.
Format: date · choice · alternatives · reason.

## Direction v4 decisions

- **2026-10-03 · Positioning is A2** (schematic tool that replaces SketchUp for
  concept→schematic, with handoff), superseding PRD v3 A1 ("stay a decision tool").
  *Alternatives:* A1, A3-lite. *Reason:* product owner's updated vision; Direction v4
  §1. Architecture invariants (§3 of v4, PRD) still win over scope.
- **2026-10-03 · Start screen (A-01) model.** `screen: "home" | "workspace"` in the
  app store; the app **always opens on home**, and any saved workspace is offered
  there as "Recent → Continue" (P1: start from a goal, not a tool). *Alternative:*
  jump straight into a saved workspace when one exists. *Reason:* the direction says
  "existing localStorage workspace still loads via Recent" and makes the start screen
  the entry point; a single store flag is the smallest change and keeps the URL.
- **2026-10-03 · Starter templates live in `packages/shared/src/templates/*.json`**
  and are validated by `starterTemplateSchema` at module load. *Alternative:* TS
  objects in the web app. *Reason:* the direction asks for JSON data; putting it in
  `shared` keeps it testable and reusable by a future server.
- **2026-10-03 · Starter projects seed a default rectangular plot.** The v4 script
  assumes a plot exists after step 2, but the site wizard (A-03) is not built yet, so
  templates and "Blank" create a plot (12×25 m for house/blank, template-sized
  otherwise). *Alternative:* empty site until A-03. *Reason:* avoids a dead canvas on
  first run; A-03 will let the user replace it. Revisit when A-03 ships.
- **2026-10-03 · Templates never invent rules.** `rules` stays empty; indicators show
  "needs input". Program target areas and cost rate ranges (labelled defaults) only.
  *Reason:* professional-liability risk called out in v4 §18; the KRK presets (A-10)
  are the only place rules are suggested, with source + as-of date.
- **2026-10-03 · Template program names are English for now**, while names,
  descriptions and brief text are bilingual (EN/ID). *Alternatives:* bilingual
  program item names. *Reason:* `ProgramItem.name` is also the mass "use" label and a
  single string; making it bilingual is a model change better done with the schematic
  entity work (B-01). Revisit before Phase D.
- **2026-10-03 · Fork (F-01) creates a decision-less branch.** One click duplicates
  the active branch as "Idea N" with an auto colour; a branch selector switches back.
  *Alternative:* require a Decision first. *Reason:* v4 wants fork as a one-tap
  what-if; decisions are created when options are compared/adopted.
- **2026-10-03 · No git repository.** The `qreasee` folder is not a git repo, so the
  "commit per ticket" instruction cannot be followed literally; `PROGRESS.md` is the
  record and each ticket runs `pnpm typecheck && pnpm test`. *Action for owner:*
  `git init` if commit history is wanted.
- **2026-10-03 · A-03 site wizard.** New `screen: "wizard"` between home and workspace;
  starter/blank projects open it, while the sample and a saved workspace skip it
  (they already have a plot). "Type size" dispatches `site.setBoundary` + `grid.set`
  (undoable). "Draw my plot" finishes into the map panel. Rules/budget commit through
  the op log as the user types, so they are undoable (invariant 10). The default
  template plot is kept if step 1 is skipped.
- **2026-10-03 · Place search = OpenStreetMap Nominatim** (A-03). *Alternatives
  evaluated:* Photon/Komoot (OSM-based, good, but another service to trust),
  Mapbox/Google (API key + billing, blocked for a no-key prototype), self-hosted
  Nominatim (correct long-term but heavy ops). *Reason:* no key, free, OSM-documented.
  *Policy respected:* search only on submit (not per keystroke) and ≤ a few requests;
  visible attribution in the UI; no bulk geocoding. *Open issue:* Nominatim asks for a
  valid HTTP Referer/User-Agent identifying the app — fine in a browser on a real
  domain, but production should add an app id/contact and consider self-hosting Photon
  or a paid provider; re-evaluate before G. Cited as a risk, not solved by code.
- **2026-10-03 · KRK preset picker deferred.** A-03 step 2 would show a city preset if
  one existed; A-10 (preset data) is not built, so no picker is shown and rule fields
  stay empty. No invented regulation.
- **2026-10-03 · localStorage quota error surfaced early** (part of B-03). *Reason:*
  invariant 10 ("anything a user can do, they can undo") is weakened if autosave can
  silently fail; a visible warning + "export .qrs" is cheap.

## Concept stage decisions (v4.1 / v4.2)

- **2026-10-03 · Concept stage adopted as Phase K.** Modes will become
  **Brief | Sketch | Plan | Sheets | 3D** (v4 "Rooms" → Plan; "Brief" new). The
  program table is the cheapest, most visible win and feeds massing, blocks and
  the concept PDF. *Reason:* addendum v4.1/v4.2, higher version wins.
- **2026-10-03 · New pure package `@qreasee/concept`.** Dependency direction
  `shared → geometry → concept`; `indicators` may depend on `concept` (concept
  never depends on indicators). Holds recipes, the evaluator and `rollupProgram`.
- **2026-10-03 · Custom safe expression evaluator** (recursive-descent; supports
  numbers, params, `+ - * / %`, parentheses, comparisons, ceil/floor/round/min/max/
  abs). *Alternatives:* `expr-eval`, `mathjs`, sandboxed `Function`. *Reason:*
  ~200 lines, zero dependencies, fully auditable, no `eval` — satisfies "rules are
  code, not AI" and the v4.2 rule. A malformed formula throws a clear `ExprError`.
- **2026-10-03 · Recipe numbers are starter values, not standards.** Every recipe
  parameter carries `basis` (`typical`/`user`/`studio`/`regulation`/`client`) and
  recipes ship `source.note`. `docs/RECIPE_REVIEW.md` tracks a senior-architect
  review. Regulated values stay empty with "supply source". *Reason:* the same
  liability rule as KRK presets; v4.2 §2.2.
- **2026-10-03 · Units deviation.** v4.1 wrote `areaEach` in mm²; we store it in
  **m²** to match the existing `ProgramItem.targetArea` (already m²) and the UI.
  Internal lengths remain mm; areas in the program are m². Documented, reversible.
- **2026-10-03 · Naming deviation.** New ops are `brief.setSettings`,
  `brief.reorderProgram`, `brief.importRows` (not `program.*`) because the program
  still lives inside `brief`. Revisit if/when the program becomes a top-level
  `DocState` field.
- **2026-10-03 · `ProgramItem` extended additively** (all new fields optional) and
  `.qrs` bumped to **formatVersion 2** with a v1 migrator that fills defaults and
  never throws, so old files and old `localStorage` keep loading.
- **2026-10-03 · K-05 suggest massing.** `suggestMassings` lives in
  `@qreasee/concept`. To let it use the indicator functions without a cycle, the
  program rollup was **inlined in `indicators`** and `indicators → concept` was
  removed, so `concept → geometry + indicators` is now acyclic. Shapes: bar
  (aspects 1.5/2/3 plus a "fill the buildable bounds" fallback), L and courtyard;
  hard-rule breaches are rejected; ranking is a weighted score with a visible
  breakdown; top 3 are chosen by IoU < 0.7 or a different floor count. No
  randomness. *Reason:* v4.1 §3.2.
- **2026-10-03 · V-03 elevation camera is level.** The elevation camera's eye
  height equals its target height so no top plane is visible (the earlier version
  looked down and showed the roof). Plan stays top-down. View thumbnails were
  reduced to 22 × 14 icons.
- **2026-10-03 · Brief grid = a lightweight custom table, not a grid library.**
  *Evaluated:* TanStack Table (+virtualization), AG Grid Community, Glide Data Grid.
  *Choice:* a small controlled table with native inputs, group subtotals, paste and
  CSV import/export. *Reason:* the acceptance (paste 20 rows, edit, group) needs no
  virtualization; AG Grid/Glide add hundreds of KB and licence review for a feature
  that is not yet large. **Revisit** (TanStack Table + virtualization) when tables
  routinely exceed a few hundred rows. No new dependency added.
- **2026-10-03 · CSV import auto-maps headers** (EN + ID synonyms: Room/Space/Nama/
  Ruang, Qty/Jumlah, Area/Luas, Group/Kelompok/Department) and imports immediately.
  *Deviation:* v4.2 K-02 asks for an interactive **column-mapping step**; auto-map is
  the first cut. An interactive confirm step and XLSX import/export (SheetJS/ExcelJS,
  §4.4) are deferred to K-11.
- **2026-10-03 · `Room` entity added to `DocState` (partial B-01).** Concept blocks
  are stored as `rooms` with `fidelity: "concept"` and explicit polygons, through ops
  `room.add|update|remove` and `rooms.setConcept` (undoable). Walls/openings and the
  derived schematic rooms remain in the app store until the full B-01 refactor.
  *Reason:* K-00b needs blocks to appear; this is the smallest op-log-based step that
  satisfies it without doing the whole B-01 refactor mid-ticket.
- **2026-10-03 · Dev-server gotcha.** Adding a new workspace package
  (`@qreasee/concept`) requires **restarting the Vite dev server**; a running server
  keeps a stale resolver and reports "Failed to resolve import" even though
  `pnpm install` and the production build are fine. Noted for the workflow.
- **2026-10-03 · View entity (V-01).** Custom views and saved scenes live in
  `DocState.views`; system views (plans per level, four elevations, default 3D,
  section when a line exists) are **derived** and their customisations live in
  `DocState.viewOverrides` keyed by `sys:…` id. *Reason:* v4.2 §4.3 — system views
  should not be duplicated into storage. `systemViews`/`allViews` are pure and in
  `shared`; `normalizeDocState` backfills old data so `.qrs` v1/v2 still load.
- **2026-10-03 · `.qrs` bumped to v3** (views). `importQrs` accepts 1/2/3;
  `migrateQrsPayload` bumps the version and keeps the v1 program migration.
- **2026-10-03 · V-03 is camera-level for now.** Selecting a plan/elevation sets an
  **orthographic camera** framed on the site/level; it does not yet clip the model
  at a plan cut plane, and per-view layers only wire **grid** and **context**.
  Full clipping, the other layers, drag-reorder, Renders and Sheets are deferred.
- **2026-10-03 · Vite stale-module gotcha (again).** Adding a new file/export to a
  linked workspace package can require a dev-server restart; the production build
  and `pnpm typecheck` are unaffected. This bit us twice (`@qreasee/concept`,
  `shared/views`).

## Studio Kit and project library decisions

- **2026-10-03 · Studio Kit is studio-scoped, not project-scoped.** Changing it must
  not fork a project or enter the operation log, so it lives **outside `DocState`**
  in `localStorage` (`qreasee.studio.v1`) as a single local kit; per-studio on the
  server is G-08. *Alternative:* a project-scoped kit in `DocState` — rejected
  because an identity change would then be branchable and would fork every project.
- **2026-10-03 · Studio Kit splits Identity from Standards, and they apply
  differently.** *Identity* (logo, primary colour, palette, title block, sheet
  prefix, room abbreviations) is **referenced live** — updating it recolours the
  app and updates future sheets. *Standards* (per-type cost rates, default
  materials) are **copied into a project when it is created** (and on the explicit
  "Apply standards to this project" action) so a branch's numbers never change
  silently under the architect. *Reason:* presentation identity should propagate;
  technical standards are project data once chosen.
- **2026-10-03 · The studio primary colour drives the app accent.** `lens.visual`
  in Tailwind was changed from a hard-coded hex to `rgb(var(--brand) / <alpha-value>)`,
  and the store sets `--brand` from the kit (and passes `brandColor` into the 3D
  snapshot for the selection/highlight colour). *Reason:* "apply brand" should be
  visible immediately, the way Canva's is; one CSS variable is the least invasive
  way to do it. The brand ramp (`brand-*`) is left fixed for contrast.
- **2026-10-03 · Schematic material defaults come from the kit via
  `SchematicOptions.defaults`**, not by pre-seeding `elementMaterials`.
  *Reason:* element ids (per-wall) are dynamic; category defaults are the honest
  level at which a studio standard exists, and an explicit per-element override
  still wins.
- **2026-10-03 · Persistence moved to a project library.** `qreasee.projects.v1`
  holds `{ projects: Record<id, Persisted>, lastOpenedId }`; the old single
  `qreasee.workspace.v1` blob is migrated into it on first load and then left
  alone. The landing page lists all projects sorted by last edited.
  *Alternative:* keep one workspace and only show its name — rejected because the
  owner explicitly asked to see previous projects. *Open item:* the library is
  one JSON blob, so it is not yet per-project lazy storage; fine for a handful of
  local projects, revisit with G-08/server storage.

## MVP Feature Guide alignment decisions

- **2026-10-07 · Layers live in `DocState`, not a separate store.** The guide's
  "Layer & Object Naming" is document organisation, so it belongs in the branch
  payload: layers are branchable and an adopted option carries its organisation.
  *Alternative:* a UI-only layer list — rejected because it would not survive
  branch adoption or `.qrs`, and the guide's point is that the organisation is
  what makes the DWG usable downstream.
- **2026-10-07 · Object naming is the layer, and it maps to the DXF layer.**
  Each authored mass gets a `layerId` + auto-name; `exportDxf` draws a mass on
  `Q-<layer name>` (colour → nearest ACI). *Alternative:* one DXF layer per object
  name — rejected as noisy; the guide conflates object name and layer name, and a
  flat layer is the CAD-native interpretation. Masses without a layer keep the
  per-level `Q-LT{n}` fallback so old projects export as before.
- **2026-10-07 · Schematic elements (walls/slabs) do not join layers yet.** They
  are derived, not in `DocState`; giving them layers depends on the existing
  "schematic as a document entity" refactor (technical-debt register). Noted as
  deferred, consistent with that item.
- **2026-10-07 · Layer visibility is wired to the 3D view.** An eye toggle that
  only changed an unused flag would be misleading, so hidden-layer masses are
  skipped by the renderer (and the branch overlay). *Reason:* the guide lists
  visibility as part of the minimum; a dead control would fail that.
- **2026-10-07 · "Continue Project" uses the existing project library.** The
  guide asks for a Continue card + a My Qreasee grid; the S-02 library already
  provides the data, so the card is presentation only. *Deferred:* real viewport
  **thumbnails** (the guide's `thumbnailPath`). Capturing the WebGL canvas as a
  stored image is a separate, quota-sensitive change; a placeholder/name card is
  used for now.
- **2026-10-07 · Material library is generated from the local sample library.**
  A PowerShell generator (`scripts/build-material-library.ps1`) copies textures
  to `apps/web/public/materials/` and writes a JSON manifest into `shared`.
  *Alternatives:* reference the source folder at runtime (breaks in the browser),
  or add a JS image library for the average colour. *Reason:* Windows +
  System.Drawing already decodes the swatches; 1,298 materials / ~13 MB is
  acceptable for a local-first app. The generated JSON is committed; the script
  is re-runnable when the library changes. Library `group`s (product families)
  are kept separate from the core `MaterialCategory` (element use) so the picker
  can group by product while the schematic still defaults per element.
- **2026-10-07 · Textures use box/planar UV mapping in millimetres.** UVs are
  derived from each triangle's dominant normal and divided by the material's
  `textureScaleMm`, with `RepeatWrapping`. *Alternatives:* per-material UV
  unwrap (heavy) or CSG (not needed). *Reason:* the guide asks for "planar
  mapping, auto-fit"; this tiles a texture at a real-world size on walls, slabs
  and roofs without touching the geometry kernel. Drawings (SVG) still use the
  material's average colour, which the generator computes.
- **2026-10-07 · Groups store membership on the masses, not a transform.**
  `Group` is just name + colour; membership is `Mass.groupId`, and move/rotate
  dispatch `mass.moveMany` / `mass.updateMany` so each action is **one undoable
  op**. *Alternative:* a stored group transform (the guide's JSON) — rejected
  because our masses are absolute and every edit must go through the op log and
  branch cleanly. *Deferred:* nested groups and group scale (the user waived
  scale).
- **2026-10-07 · Offset is an in-place footprint offset.** The guide's §"Offset"
  describes face/edge offset producing explicit new geometry; in the massing
  model the useful action is to inset/outset the selected mass's footprint.
  It previews live, follows the cursor or a typed value, and commits as a single
  undoable `mass.update`. *Reason:* no face/edge entity exists at massing
  fidelity; this delivers the workflow (thicken, courtyard, boundary) now.
  *Open item:* revisit when schematic elements become first-class entities.
- **2026-10-07 · Concept blocks carry a height (3D "balok").** Program blocks
  were flat concept polygons; the owner expected Lego-like volumes with a room
  height. `Room.height` (default 3000 mm) was added and blocks render as extruded
  boxes. *Reason:* the concept stage is about volume, not a floor diagram; a 3 m
  block is what an architect stacks. The block stays area-true (width×depth), so
  the program fit indicator is unaffected; height feeds the volume readout and
  later the schematic. *Deferred:* drag-to-stack (currently stack via the level
  selector / levels), and block-to-block wall snapping beyond corner snap.
- **2026-10-07 · Sheets are document state; drawings are embedded as SVG.**
  `Sheet` + items live in `DocState` (branchable), and a placed view renders the
  existing `planSvg`/`sectionSvg`/`elevationSvg` as a `data:` SVG `<image>`
  inside the sheet. *Alternatives:* a separate sheet store, or rasterising the
  drawings. *Reason:* vector output stays crisp and reuses the deterministic
  drawing generator; being in `DocState` means a branch carries its sheet set.
  *Deferred:* true 1:1 print scale per frame, more annotation types (leaders,
  tags), multi-view detail callouts, and PDF export of the sheet set.
- **2026-10-07 · The schematic is only invalidated by geometry ops.** Previously
  every dispatched operation cleared the generated schematic; adding a sheet (or
  a view/annotation) therefore wiped the drawings. Now only `mass.*`, `room.*`
  and `level.*` clear it. *Reason:* sheets and views do not change the geometry
  the schematic derives from.
- **2026-10-07 · Concept blocks stack by overlap, on an explicit base elevation.**
  `Room.elevationMm` (optional) lets a block sit anywhere; dropping one whose
  footprint overlaps another sets its elevation to that block's top
  (`stackElevationFor`, AABB overlap ≥ 20 %). *Alternatives:* a drag-to-level
  model or a full physics snap. *Reason:* Lego-like stacking is what the owner
  asked for; a pure, tested overlap function is deterministic and fits the op log
  (`room.update` with `elevationMm`). Dragging off drops it back to the level.
- **2026-10-07 · Sheet PDF export is client-side, from a shared SVG builder.**
  `lib/sheetSvg.ts` is the single source of truth for a sheet's markup; the editor
  injects it and the PDF export rasterises it into a multi-page `jspdf` document
  (one page per sheet, at paper size). *Alternatives:* a server-side renderer, or
  duplicating the sheet markup for print. *Reason:* no server yet, and one builder
  keeps print faithful to screen. *Deferred:* vector (non-raster) PDF, true 1:1
  print scale, and richer annotation (grids, level tags, section markers) — see
  the Revit-set gap list.
- **2026-10-07 · Drawing annotations come from the document, not the schematic.**
  Grids and levels are `DocState` entities, so `planSvg/sectionSvg/elevationSvg`
  take an optional `DrawingContext` rather than reading them from the schematic.
  *Reason:* the schematic is a per-mass derived slice with no project grids/levels;
  passing the document context keeps the schematic package pure and the drawings
  correct. Grid dimensions are shown in **mm** (matching Indonesian CAD/Revit
  convention); the old overall m-dimensions are kept as a fallback when a project
  has no grids.
- **2026-10-07 · The logo ring must never be invisible.** The mark uses
  `currentColor` for the ring so it reads on both themes; the shipped design asset
  had a hard **white** ring, which disappeared on white (the "cut" icon). The
  inline mark and `public/logo-*.svg` were redrawn with a bold ring, and a
  `favicon.svg` added. *Reason:* a brand mark that vanishes depending on the
  background is a bug, not a style.
- **2026-10-07 · The viewport resizes from three signals.** `ResizeObserver`,
  a per-frame container-size check in the render loop, **and** a panel-state
  change effect (timers). *Reason:* a flex sibling opening/closing changes the
  container without a window resize; `rAF` and `ResizeObserver` are paused in a
  background tab, so the state-change timer is the reliable path. The canvas must
  always exactly fill its container.

## Direction v5 decisions (Revit-quality sheet set)

- **2026-10-07 · Direction v5 adopted — the "sample-house test".** Acceptance is a
  **vector PDF sheet set** equivalent to `20230715 RUMAH BU ALFIA WARDAH.pdf`,
  authored entirely inside Qreasee (no SketchUp/AutoCAD). *Authoring model:*
  **draw like SketchUp, store like Revit** — loose line/plane input, but the
  document stores real objects (Grid, Level, Room, Wall, Opening, Slab, Roof,
  Stair + 2D annotation). *Kept:* TypeScript, React, Vite, three.js, Clipper2-js,
  earcut, Vitest, Playwright, SVG drawings, local-first. *Deferred:* IFC/That Open
  Engine, CSG/BREP, Konva/Fabric/Pixi, server-side PDF, Yjs as the document model,
  and any AI step inside drawing generation. *Reason:* the gap is that the
  schematic layer is derived (the app store, one level), so an architect cannot
  author a plan; W-01 makes it document state. Order is W-00…W-09; **do not build
  W-03 before W-01** (authored geometry would be thrown away).
- **2026-10-07 · The sample-house fixture is a TS builder, not a binary `.qrs`.**
  `apps/web/src/fixtures/wardahHouse.ts` is the single source for the acceptance
  harness and demos. *Alternative:* commit `fixtures/wardah-house.qrs`. *Reason:*
  a binary would drift and cannot encode Wall/Opening/Stair entities that do not
  exist until W-01; a `.qrs` export can be added then. Per the v5 rule, the gap is
  logged rather than hidden.
- **2026-10-07 · Missing capabilities are `it.todo`, not deleted checks.** The
  W-00 acceptance test lists W-01…W-07 work as `it.todo`, so `pnpm test` shows the
  remaining gap (10 passed, 9 todo) without failing. *Reason:* the acceptance
  harness must stay green while the capabilities are built.
- **2026-10-07 · W-01: schematic entities are document state; the drawing model is
  derived.** Walls/openings/slabs/roofs/stairs/rooms live in `DocState` and are
  authored via ops; the `Schematic` that the drawings, 3D and section consume is
  **derived** by `schematicFromDoc`. *Alternative:* keep the derived schematic in
  the app store (the pre-W-01 debt). *Reason:* v5 — sheets, collaboration and
  handoff all need authorable, branchable objects, while the generators stay pure.
- **2026-10-07 · Provenance is `origin`, and edits flip it to "user".** Every
  `*.update` op marks the element user-authored, so regeneration can never
  overwrite an edit; `schematic.setGenerated` keeps user elements and drops
  regenerated twins that share their stable id. *Reason:* v5 W-01 "edit a wall,
  regenerate, and the edit survives". *Deferred:* element **materials** still live
  in the app store (not yet entity properties); the plan-editing tools (W-03) and
  stair geometry (W-02) are next.
- **2026-10-07 · `.qrs` formatVersion 4.** Adds the schematic-entity arrays; the
  migrator bumps any older payload and **never throws** (backfill also happens in
  `normalizeDocState`). *Reason:* v5 W-01 migration requirement.
- **2026-10-07 · W-02: one view model per storey for plans, all levels for
  sections.** `schematicFromDoc` takes an optional `levelId`; plan views filter to a
  storey, sections/elevations use the full model. `starterFromMass` emits per-level
  walls/rooms/floor slabs and a ceiling + roof **over the top level only**.
  *Reason:* v5 W-02 "one plan per level; the roof sits over the top level only".
- **2026-10-07 · Stair rise/run is derived, not hard-coded.** `stairGeometry` chooses
  the riser count from the floor-to-floor height (target 180 mm, a **labelled starter
  value**) and derives the actual rise and run; treads and a stepped profile are drawn
  in plan and section. *Reason:* v5 W-02 "rise/run shown as a derived value, not a
  hard-coded standard". *Deferred:* the floor **void** over a stair is drawn as a
  dashed outline in plan; cutting a true hole in the slab polygon is a follow-up.
- **2026-10-07 · W-03 authoring tools dispatch document ops, not derived geometry.**
  The Wall/Room/Door/Window tools live in `ViewportController` and call store
  actions (`addWall`, `addRoomPolygon`, `placeOpening`) that dispatch
  `wall.add`/`room.add`/`opening.add`. *Reason:* every edit stays in the op log
  (undo + branches), per v5. The W-03 done-when (draw the ground floor with the
  tools) is met for walls, rooms and openings. *Deferred (logged):* wall joins
  (corner/T via Clipper2 union of offset polygons), column/canopy/railing, and
  **moving a wall to resize a room** — a room's polygon is currently independent of
  its generated walls.
- **2026-10-07 · W-04 pen weights are paper mm × view scale.** The Studio Kit holds
  a pen table (cut / projection / annotation / grid, in mm); the drawing generators
  multiply by the view's scale denominator so a 0.35 mm cut line reads correctly.
  *Reason:* v5 W-04 "pen table in paper millimetres, starter values". *Deferred
  (logged):* the **visual golden** (Playwright image comparison) — browsers aren't
  installed in this environment, so the harness asserts structure; and CAD-style
  **hatch patterns** (fills are flat material colour).
- **2026-10-07 · W-05 section marks derive their sheet number from placement.**
  `sectionMarks(state)` maps each section view to the sheet that contains a view item
  for it, so a plan mark reads A105/A106 and stays correct when views move between
  sheets. *Reason:* v5 W-05 done-when. *Deferred (logged):* annotation toggles are a
  single global set (not yet per-view), and opening-position / overall dimension
  strings and manual overrides are partial; grid-to-grid chains come from D-04.
- **2026-10-08 · W-06 true scale is a width in paper mm, not a zoom.** A sheet view
  embeds its drawing at `viewBox / scale`, so 1 paper mm equals `scale` model mm;
  line weights stay in paper mm (`pen.w`). The frame clips the drawing, so a view
  can crop without changing scale. *Reason:* v5 W-06 done-when ("a 9000 mm grid span
  is 90 mm on a 1:100 sheet"). *Deferred (logged):* drag-between-sheets and explicit
  crop handles; the cover is a live 3D capture (raster), vector PDF is W-07.
- **2026-10-08 · W-07 vector PDF inlines drawings and embeds Roboto.** The sheet
  builder gains a `vector` mode that emits one nested `<svg>` per placed view (no
  `data:` image); `svg2pdf.js` converts each page, and Roboto (Apache-2.0,
  `public/fonts/`) is embedded and aliased to `sans-serif`. *Reason:* v5 W-07
  done-when ("zooming stays crisp, text is searchable and selectable"). Tests read
  the PDF back with `pdfjs-dist` (page size/count, extractable text, no raster
  images, size budget). *Deferred (logged):* jsPDF still lists its unused default
  fonts (pdfjs warns about standard-font data); conversion is main-thread.
- **2026-10-08 · C-01/C-02 concept plan + visible snapping.** The concept stage
  gains a 2D plan canvas (mode `concept`) that edits `DocState.rooms` directly —
  rename/move are concept-only and the Program + Area Summary is derived live
  (`areaSummary`), never stored. Snapping is made **visible** in both the 2D
  canvas and the 3D viewport (orange corners, yellow midpoints, brand ring on the
  active point) via a shared candidate list. *Reason:* the user asked for an
  editable room diagram with a live summary, and for snap points to be seen.
  *Deferred (logged):* the 2D canvas has no true-scale/print output of its own
  (use Drawings/Sheets); circulation is not shown as a separate derived row;
  moving a room does not regenerate walls (by design).
- **2026-10-08 · S-01/S-03 sample house + room-boundary rule.** The sample house
  is reproduced **from the IFC**, not traced by hand: storeys and room boundaries
  are the file's real values (areas computed from the polygons). A room's
  boundary is **not drawn** unless the room is highlighted — the fill + label
  carry the room, keeping schematic/plan views clean. *Reason:* the user asked to
  reproduce the model house with rooms and to hide room boundaries until the
  title is highlighted. *Deferred (logged):* the source **DWG is AC1027** and
  cannot be read without ODA/LibreDWG (use DXF); an in-app IFC/DXF importer is a
  separate ticket; walls/doors/windows from the IFC are not imported yet.
- **2026-10-08 · I-01 IFC import is pure and honest about gaps.** `parseIfc`
  reads only what maps to our model (storeys, rooms, walls) and returns a
  `skipped` count for everything else (doors, windows, slabs, roofs, stairs) so
  the UI can state what was dropped. DWG (AC1027) is **not** parsed — it needs a
  converter (ODA/LibreDWG) or a DXF export. *Reason:* the user asked to import
  their IFC/DWG. *Deferred (logged):* openings + slabs/roofs/stairs from IFC.
- **2026-10-08 · I-02 openings come from the IFC void/fill chain.** A door or
  window is placed by walking `IfcRelVoidsElement` → `IfcRelFillsElement` to find
  its host wall, then projecting the opening's profile onto the wall centreline
  for offset/width (sill from the opening's base Z). This is more robust than
  guessing from the filler's own placement. *Reason:* the user asked for
  doors/windows next. *Deferred (logged):* roofs and stairs are counted only;
  ceilings import as floors; imported walls are not yet joined.
- **2026-10-08 · I-03 DXF underlays are document entities, not geometry.** Imported
  CAD linework is stored as an `Underlay` on a level (undoable, branchable,
  deletable) and drawn muted in 3D; it is never treated as the building. DWG
  (AC1027) is not parsed — the user exports DXF from AutoCAD or converts it.
  *Reason:* architects who modelled in AutoCAD need to trace, then remove the
  reference. *Deferred (logged):* DWG converter step; per-source-layer visibility
  UI (stored but not exposed); snap to underlay lines.
- **2026-10-08 · I-03b DWG is converted in the browser with LibreDWG WASM.** We do
  not ship a native converter or a server: `@mlightcad/libredwg-web` (libredwg →
  WASM) turns DWG into DXF in the page, then the same `parseDxf` runs. The wasm is
  served from `public/libredwg/` and loaded lazily. *Reason:* the user's architects
  have DWGs; a converter step that needs ODA/LibreDWG installed is a blocker.
  *Deferred (logged):* first-use download (~9 MB); LibreDWG console warnings;
  SPLINE/INSERT/3DFACE geometry.
- **2026-10-08 · I-03c DXF coverage + underlay snapping.** The importer expands
  INSERT block references (nested) and samples SPLINE/ELLIPSE, and the 3D scene
  snaps to underlay endpoints/midpoints — filtered to the cursor and the active
  level so large drawings stay interactive. *Reason:* a DWG underlay is only
  useful if it comes in complete and you can trace exactly on it. *Deferred
  (logged):* HATCH outline approximate; MLINE/LEADER/block POLYLINE not drawn.
- **2026-10-08 · R-01/R-02 stairs & roofs are first-class entities, and the
  sample is generated from the IFC.** Stairs and roofs are authored through the
  op log (`stair.add` / `roof.add`) and rendered from the derived schematic; the
  schematic re-derives from `DocState` on every dispatch, so adding one **must
  not** call the mass generator (`generateSelectedSchematic` clobbers generated
  elements — that bug was found and removed). IFC stairs/roofs are read from
  their **faceted BREP** bounding box when they are not extrusions. The sample
  house is regenerated from the source IFC rather than hand-authored, so the
  importer and the sample cannot drift. *Reason:* the owner asked to reproduce
  the IFC as a sample with the tools. *Deferred (logged):* roofs/stairs import as
  bounding boxes (not true slopes/treads); L-shaped stairs are reserved.
- **2026-10-08 · LG-04 shortcuts are a personal preference with one registry.**
  All key handling goes through `@qreasee/shared/shortcuts`; the old hard-coded
  handlers (App lens/undo/delete/Esc) were removed. Bindings live in
  `localStorage qreasee.shortcuts.v1` — **not** DocState, the op log or `.qrs` —
  because a shortcut must never fork a project; server-side sync belongs with the
  future accounts work (G-08). Defaults use plain single letters so they cannot
  collide with the browser; the remap UI refuses reserved combos with a reason and
  never calls `preventDefault` for a key we do not own. *Reason:* PRD NFR
  "keyboard shortcuts for all tools, remappable". *Deferred (logged):* Paint is
  registered but unavailable (no active-material selection exists); Backspace no
  longer deletes a selection (it edits drafts/typed values); Space-hold pan is now
  only armed mid-drag/draft so Space can be Select.
- **2026-10-08 · LG-05 Qreasee's own material library + Paint.** The branded
  1,298-entry sample library stays available, but the **default** palette is 24
  brand-free Qreasee materials (curated from the local library, plus generated
  grass and glass), so a user never has to pick a product brand. Paint applies the
  **active material** (a store preference, not DocState): schematic elements via
  `elementMaterials`, masses via `mass.update` colour. Shortcut validation was
  relaxed per the owner: Ctrl/Cmd+letter is allowed unless it is in
  `RESERVED_BROWSER_BINDINGS` (so Ctrl+C can be bound), and Paint is enabled.
  *Reason:* owner request. *Deferred (logged):* painting a mass is a colour tint,
  not a real material assignment; the reserved list still needs a browser-docs
  re-check.
- **2026-10-08 · LG-05b material thumbnails + translucent glass.** The Material
  (Paint) picker renders each swatch with its **texture image** (`BASE + texture`)
  over a light backing so glass transparency reads, and the generated glass
  textures carry real **alpha**; `surfaceMaterial` now applies `material.opacity`
  (`transparent`, `depthWrite:false`) so glass renders see-through in 3D. *Reason:*
  owner request. *Deferred (logged):* swatches are still 48 px tiles, not a large
  preview; painting a mass remains a colour tint.
- **2026-10-08 · W-08 entity material wins; the sample ships a full sheet set.** The
  schematic uses an entity's own `material` before the level defaults, so an
  authored/imported material shows in plans and elevations. DXF handoff adds
  `A-WALL`/`A-DOOR`/`A-GLAZ`/`A-GRID`/`A-ANNO` beside the `Q-*` layers. The sample
  house is delivered complete: IFC entities, a material scheme, a section line and a
  **6-sheet set** whose cover uses a generated **axonometric snapshot** (a live 3D
  capture can replace it via "Place 3D capture"). *Reason:* owner asked to apply
  materials and create the sheets. *Deferred (logged):* hatch fills,
  railings/canopy, roof ridges/hips drawn in plan.
- **2026-10-08 · W-08b the roof plan is derived from the roof faces.** Ridges, hips
  and valleys are the edges shared by exactly two roof faces (eaves are boundary
  edges), so the plan stays correct for hip/gable/shed and any footprint without
  special-casing. A plan shows the roof plan only on the roof's own level
  (`roofOnLevel`); lower plans keep the dashed outline. The slope is a real entity
  property (`Roof.pitchDeg`), and a roof can be generated over the top level or
  drawn by hand. *Reason:* owner asked for ridges/hips, editable slope, and both
  auto and manual roofs. *Deferred (logged):* hatch fills, railings/canopy; valleys
  for multi-wing roofs are drawn but not labelled.
- **2026-10-08 · W-08c hatch is scanline; railings are an entity.** Hatch fills are
  clipped line segments computed in the model (no filters/masks/clip paths), so the
  sheet PDF stays vector. Railings are first-class document entities (op log,
  undoable) rather than decoration, so they import, render and draw. The sample
  ships a **concept sheet** (mass + program table) beside the cover and the
  drawings, and the Sheets editor exports the whole set to PDF ("Download PDF",
  W-07). *Deferred (logged):* canopy; a single 45° hatch style.
- **2026-10-08 · W-08d the 3D snapshot is the real model.** `axonModelSvg` builds
  faces from the document entities (walls, slabs, roof, stairs), projects them
  isometrically and paints back-to-front with light shading — pure and
  svg2pdf-safe, so the cover shows the actual house, not a bounding box. *Reason:*
  owner wanted a real 3D of the house like the IFC/DWG. *Deferred (logged):*
  openings/glass are not yet cut into the axon faces; the snapshot is a static
  axonometric (a live WebGL capture can replace it via "Place 3D capture").
- **2026-10-08 · VW-01/VW-02 View Range + plan cut plane.** A drawing is a *View*,
  not a picture. `ViewRange` (top / cutPlane / bottom / viewDepth) is threaded
  through `schematicFromDoc`; the plan cut plane defaults to **1200 mm above the
  level** (instruction §3). Openings are classified `cut` / `above` / `below`:
  above-cut openings are dashed (seen) over solid poché, below-cut ones show in
  projection. *Reason:* owner asked for a View Range and a 1 m plan cut.
- **2026-10-08 · Plans show imported rooms.** `schematicFromDoc` includes every
  room on the level (not just `fidelity: "schematic"`), so IFC (concept) rooms
  appear as named rooms with areas — the reference's #1 plan gap.
- **2026-10-08 · VW-08 axon faces the front.** Camera at (+X, −Y, +Z) so the front
  (−Y, the grid-A/entrance side) is visible; back-face culling + outward normals
  (Newell) + a mass-footprint wall filter remove the "messed up" look; the roof
  follows the imported roof outline. *Reason:* owner: "it is facing backward… you
  are not showing the front facade". *Deferred:* the imported IFC wall heights are
  inconsistent (site walls, inflated storey heights, 3 overlapping roofs), so the
  snapshot is a cleaned *approximation*; a live 3D viewport capture is the real
  answer.
- **2026-10-08 · VW-02b/VW-04 the reference look.** Plans draw cut walls as a
  **light fill + heavy outline** (owner choice, matching Revit); the view
  name/scale move to a **per-viewport title** under each placed view (split circle
  detail/sheet + name + `SCALE 1 : n`) exactly as the reference PDF, so the
  in-drawing labels and the graphic scale bar are removed (bar stays opt-in).
  *Reason:* owner asked for the light poché and to follow the Revit example.
- **2026-10-08 · Room rename.** Rooms are renamed inline (double-click in the
  Concept plan) via the existing `room.update` op, so it is undoable/branchable;
  the name flows to the drawings and the area summary. *Reason:* owner asked that
  the user be able to rename room names.
- **2026-10-08 · Part 2 §2 one coordinate frame.** The grid/geometry mismatch was
  **data, not transform**: the generator wrote the reference grid while the IFC
  geometry kept its own origin. Fixed in the generator (`alignToGrids`) so every
  layer shares the grid frame; a `?debugPlan=1` overlay (world origin, layer
  bboxes, wall centerlines) stays for diagnosis. *Verified:* long walls on grids
  C–F, fence on grid 1, wall centerlines on the grid lines.
- **2026-10-08 · Part 2 §3/§5/§6 reference look.** Plan bounds come from **all**
  elements (not the first slab); grid ends ≥1500 mm outside; section lines are
  **black dash-dot** with a split-circle head + end bar; room fills are **opaque**.
  *Reason:* owner asked to follow the reference PDF (`output_denah.pdf`).
- **2026-10-08 · Part 3 §1/§2/§3/§4.** Wall joins draw the **union of the outset
  footprints** in the outline colour under the poché fill (one continuous outline,
  no boolean library). The IFC opening **height** was the extrusion depth (wall
  thickness) and the **sill** was world Z — both fixed, so doors/windows cut the
  1200 mm plane. Grid labels centre by cap height; chains tightened; A101 is two
  plans at **1:100**; the crop frame prints only when selected.
- **2026-10-08 · Part 3 §6 the Revit DWG is a benchmark only.** The Alfia CAD set
  is at `D:\PROJECT\RUMAH BU ALFIA WARDAH\CAD\20230712\` (A100–A106). Qreasee must
  never depend on it at runtime; next step is inventory + a dev-only underlay.
- **2026-10-08 · Part 4 §4/§6 the floor is the room finishes.** The plan drew the
  raw imported slab polygons as a base; those leaked as grey-blue patches that do
  not follow the walls, which the owner flagged as confusing. The plan now draws
  **only the room finish fills** (opaque, by room type) with text-only tags and a
  halo. *Reason:* "the floor should floor what is in the PDF".
- **2026-10-08 · Part 4 §5 stairs.** The plan spacing is the **going (300 mm)**, not
  the rise (that made the lines ~60 mm apart). One arrow + one "UP" per level (the
  IFC splits one stair into 5 flights) and the stair below shows in projection.
- **2026-10-08 · Part 4 §2/§4 window tags + dim text.** Window tags are removed
  (door tags stay); room tags are text-only; dimension text height is settable
  (`dimTextMm`). *Reason:* owner asked to delete the window tags and set the
  dimension text size. Section/elevation sheets (A103/A105) confirmed rendering.
- **2026-10-08 · Part 4 the 3D was invisible for three reasons.** The sample opened
  in **concept** mode (no viewport), the controller rendered **only** in the paused
  rAF loop, and the generator's alignment skipped the **site boundary** so the
  camera framed the old location. Fixed: the sample opens in schematic mode, the
  controller renders once after each rebuild, the site shifts with the model, and
  `schematicMassId` is set so the mass is ghosted and the real walls/roof show.
  Clicking a view in the Project Browser now opens the matching editor.
- **2026-10-08 · Part 4 Concept = blocks, Schematic = detail.** Concept mode shows
  the room **blocks** (room polygons, any shape incl. L); Schematic mode shows the
  detailed model and **hides the block** (the mass volume is not drawn while the
  schematic is on). *Reason:* owner: "the block is the room; in Schematic show the
  detail and hide the blocks".
- **2026-10-08 · Part 4/Part 3 §6 DWG benchmark.** The Alfia A101 DWG was
  inventoried in-browser (LibreDWG → DXF): mm, 30 508 lines, layers A-WALL/
  A-DOOR/A-GLAZ/S-GRID/S-COLS/S-STRS. Next use (Part 3 §6.5): **build the Alfia
  walls/openings/rooms from these layers** to replace the synthetic interior so the
  plans match the reference. Qreasee stays runtime-independent of the DWG.
- **2026-10-08 · Part 3 §6.5 wall rebuild is partial.** `wallsFromDxf` pairs the
  A-WALL faces into walls (L1 30 / L2 36, 100–165 mm). The pairing drops some walls
  (fragmentary plan), so the IFC walls remain the default and the DWG path is behind
  `QREASEE_DWG_WALLS=1`. *Honest status:* the DWG benchmark (inventory + extractor)
  is done; a complete rebuild needs the wall-graph join (Part 3 §1) instead of
  nearest-neighbour face pairing.
- **2026-10-08 · Part 4 Help + element model.** The Topbar Help button opens a
  **reproduce‑the‑sample‑house** guide (EN/ID) using Qreasee's own tools. Elements
  are **not grouped**: every room, wall, door, window, stair, roof and railing is
  its own object, clickable and undoable (rooms in the Concept editor and in 3D;
  walls/openings in 3D via `elementMeshes`). *Reason:* owner asked for a Help
  button and clickable elements.
- **2026-10-08 · Plan views now apply the cut plane.** The Plan view (Project
  Browser → plan) looks straight down and **clips at `level + 1200 mm`**, so it
  shows the cut interior/openings, not the roof — previously every level looked the
  same. *Reason:* owner: "you haven't implemented Cut Plane in this view".
- **2026-10-08 · Part 4 cut height per view + live sheets.** `View.cutPlane`
  (default 1200 mm; `null` = no cut) is settable; the **roof plan** defaults to no
  cut so the roof isn't sliced. Double-clicking a sheet viewport **enters the
  view** (not a copied picture); the title block is a Studio-Kit element (logo,
  client, etc.). *Reason:* owner on the roof being cut, and wanting editable views
  inside sheets.
- **2026-10-08 · Part 3 §1 wall graph.** Walls are a graph: endpoints cluster into
  shared nodes; an endpoint on another wall's segment is a T‑junction; each end
  extends by half the thickness of the wall it meets. One geometry source for plan,
  section and 3D (`wallGraph.ts`). This closes corners/T/X — including the IFC
  walls. The DWG wall **extraction** still drops walls, so the IFC walls stay
  default and the DWG path stays behind `QREASEE_DWG_WALLS=1`.

## Scope of this base build

- **Delivered as a runnable core loop base**, not the full 8-milestone MVP. See
  `PROGRESS.md` for what is done, partial and reserved.
- **Local-first, no server.** The user chose browser persistence so the app runs
  with one command and no database. Each operation is autosaved to
  `localStorage` (key `qreasee.workspace.v1`). The PRD's Fastify + tRPC + Postgres
  server, S3 storage, auth and realtime gateway are **not** built; the document
  store is serialisable and ready to sit behind them.
- **Monorepo matches the PRD layout** (`apps/web`, `packages/geometry`,
  `document`, `indicators`, `export`, `shared`). `apps/server` is intentionally
  absent for now.

## Category decisions

- **Clipper2 (JS port).** `clipper2-js@1.2.4` is used for all polygon booleans and
  offsets. Two quirks were worked around and covered by tests:
  1. It declares Angular peer dependencies but its bundle imports no Angular; we
     disabled peer auto-install (`auto-install-peers=false`) to avoid pulling
     Angular in.
  2. It degenerates when a clip shares an exact edge with the subject. Setback
     strips are therefore extended slightly outside the site and past both
     corners before the difference.
- **Ring orientation.** Under NonZero fill, holes must wind opposite to outers;
  `polygonsToPaths` normalises orientation so courtyard holes are subtracted.
- **Coordinate convention (map vs 3D).** The model keeps **+Y = north** (needed by
  the solar bearing maths and the OSM projection). three.js draws the ground on
  X/Z and its cameras show +Z downward, so a straight `z = y` mapping mirrored the
  plan against the map. The renderer reflects Z at the scene-group boundary
  (`modelGroup.scale.z = -1`, likewise for the draft and handle groups) and negates
  Z only in `pointerToGround`, `recenterToCursor`, `focusView` and the north arrow.
  A top view now reads north-up / east-right, matching the map, while the document,
  indicators and exports stay in +Y-north model space.
- **Units.** Internal lengths are millimetres, areas mm², money Rupiah. Intent
  ranges use millimetres for height and m² for area.
- **Cost rate defaults.** `DEFAULT_RATES` suggests per-m² ranges per building
  type; they are editable and clearly marked as suggestions (open question in the
  PRD).
- **Sun exposure** uses SunCalc, samples every 30 minutes on 21 Mar/21 Jun/21 Dec,
  and ignores shading by other masses (P1, as specified). The tint scale is 0–8 h.
- **KDH status wording.** The PRD table says "over if below min; near within 10%
  above min". Implemented literally: below min → `over`, min…1.1×min → `near`,
  otherwise `ok`.
- **Program fit** sums labelled footprint area × level count against the target;
  this is an interpretation of "sum of footprint areas … per level".
- **React 18 / Vite 5 / Vitest 2** were pinned to versions known to work together
  rather than the newest registry majors, to keep the base reproducible.
- **OpenStreetMap context** uses the public Overpass API (`overpass-api.de`, with
  a kumi.systems fallback) for `way["building"]` within ~220 m, projected to model
  millimetres with an equirectangular projection rotated by `northAngle`. Heights
  come from `height` or `building:levels` with a 9 m default. Context is reference
  only, stored outside the document, and never exported.
- **Curves are tessellated.** The Circle tool samples 64 points; the Arc tool
  samples a quadratic Bezier into 40 points. Internally everything stays a simple
  polygon so Clipper2, earcut and the exporters keep working. There is no editable
  arc primitive (reserved).
- **Snapping is 3D and screen-space (LG-03).** Candidates are generated in 3D
  (plan x/y + elevation) from masses (base, top and each level), concept blocks,
  site/green edges, grid intersections, underlay linework, and the draft
  (close / axis / parallel / perpendicular). Matching happens in **screen pixels**
  (~14 px) through the viewport's `project()`, so the cursor attaches to real
  points at any height, the radius is constant at any zoom or camera, and **no
  marker is drawn on a plain face** — the old "free / on-plane" fallback is gone.
  Priority: close > endpoint > midpoint > intersection > on-edge >
  axis/parallel/perpendicular > grid; ties break by pixel distance, then camera
  distance, then proximity to the active level. Points hidden behind a mass are
  rejected unless the view is top-down orthographic. Markers use a distinct shape
  per kind (square / triangle / X / diamond / ring) plus a label, never colour
  alone.
- **Logo** is an inline SVG approximation (ring via `currentColor`, orange swoosh).
  Replace `public/logo-dark.svg` / `logo-light.svg` and `components/Logo.tsx` with
  the production artwork.
- **Theme** now ships dark and light. The `ink` scale is mapped to CSS variables
  (`--ink-950` … `--ink-100`) in `styles.css`, and light mode inverts the scale, so
  existing `bg-ink-900` / `text-ink-100` classes flip without per-component work.
  The 3D renderer reads the theme and swaps its background, ground and grid.

## Schematic phase decisions (rooms → walls → roof → drawings)

- **Rooms from massing.** There is no precise room boundary in a mass — only a
  footprint. Qreasee approximates rooms by a **guillotine partition** of the
  footprint's bounding box (repeatedly splitting the largest cell), clipped to the
  real footprint with Clipper2, then naming rooms by matching the brief's target
  areas (largest room ↔ largest target). This is deliberately coarse: at schematic
  fidelity the room is a hypothesis, not a measured space. The architect is
  expected to adjust it later. A future version should partition along detected
  circulation rather than pure area.
- **Wall/floor/roof build-up** uses Indonesian common values: exterior wall
  150 mm, interior partition 100 mm, slab 120 mm. Openings are cut by **splitting
  the wall into solid panels** around each hole (left/right jamb, sill and lintel)
  rather than CSG — this keeps the geometry pure, robust and exportable.
- **Openings** are auto-placed (one centred window per exterior edge, one centred
  door per partition) so a generated model is complete; user placement per wall is
  the next step.
- **Roofs** are generated over the footprint's bounding box (hip, gable, one
  slope), pitch 30°, overhang 600 mm. Non-rectangular footprints fall back to the
  bounding box.
- **Drawings** are generated as SVG, not by a 3D camera. The viewBox is padded by
  12.5% of the larger dimension, so the drawing fills ~80% of the sheet. This is
  deterministic, testable and exportable, and avoids hidden-line complexity.
- **OpenStreetMap tracing** uses Leaflet with public OSM tiles; traced lat/lng are
  projected through the same `northAngle` rotation as the OSM context so site,
  context and model all stay aligned.
- **Material library** is compiled from common Indonesian practice and the
  Wikipedia "List of building materials" taxonomy (masonry, concrete, ceramic
  tile, gypsum board, terrazzo, roofing, wood, glass, metals). Colours are
  representative base colours, not product colours. There are no prices or
  quantities.
- **Element ids are stable** (`wall-ext-{ring}-{edge}`, `wall-part-{i}`,
  `slab-floor`, `slab-ceiling`, `roof`, `room-{i}`) so material assignments keyed
  by id survive regeneration.
- **Section cut** intersects the cut line with each wall/slab plan polygon and
  each roof face, and draws the resulting rectangles/segments as poché. This is a
  true cut, not a projection. The section is single-level today because a mass is
  one volume; multi-storey sections come with multi-level schematic.
- **Object rotate** follows SketchUp: pick centre, pick baseline, set angle
  (snapping to 15° at ±4°). Rotating around a picked point can translate the
  object, which is expected. Camera orbit remains on middle-drag.
- **Modes** structure the toolbar by design phase; the document is unchanged — a
  mode is a UI grouping, and schematic data is derived then overridden, not a new
  document entity yet.
- **Drawing plane vs elevation.** Footprints are 2D, but the pointer raycast plane
  is set to the active level's elevation (`groundPlane.constant = -elevation`) and
  the draft/markers use `draftY = elevation + 16`. This keeps the preview and the
  committed mass at the same height. Masses still bottom out at their lowest
  level's elevation via `massBaseElevation`, so stacking is by level, not by Z=0.
  With LG-03 snapping, a footprint tool takes the snapped point's **X/Y only** and
  keeps the level elevation, and draws a **vertical guide** to the plane so the
  height offset is visible; move/vertex/push-pull/rotate/section use the full 3D
  point.
- **Two cameras.** The viewport keeps a perspective and an orthographic camera and
  swaps `controls.object` on toggle (OrbitControls supports both). On switching to
  orthographic the frustum is sized from the perspective view (`halfH = tan(fov/2)
  × distance`), and on switching back the distance is recovered from the ortho
  frustum and zoom, so the view does not jump. `worldPerPixel` and the view-fitting
  branch on camera type.

## Deliberately reserved (types exist, features not built)

IFC, That Open Engine, consultant proposals, overlays, comments, realtime
co-editing, named versions, roof forms, radial arrays, DXF import, client
comparison links, AI advisor, OTTV/circulation/BoQ. These are Release 2/3 or
non-goals for the MVP.

## Open questions carried from the PRD

Principal interviews, SketchUp/AutoCAD versions for DAE/DXF settings, city KRK
presets, per-studio cost rates, pricing model and hosting region remain open.
