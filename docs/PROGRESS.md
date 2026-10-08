# Progress

Legend: done / partial / reserved. Requirement IDs follow PRD section 8.
Ticket IDs (A-01, B-01, C-01 …) follow `QREASEE_DIRECTION_v4.md`.

> **Repository note:** this folder is **not a git repository**, so tickets are
> tracked here rather than in commits. Each ticket runs `pnpm typecheck` and
> `pnpm test` before being marked done.

## Direction v4 — progress

### Phase A — Make it obvious
- **A-01 Start screen — done.** `screen: "home" | "workspace"`; a fresh profile
  opens "What are you designing?" with House / Café / School / Dormitory / Blank /
  Try the sample, a Recent card for the saved workspace, and `.qrs` import. Logo
  and the Project menu return to it. Playwright: `e2e/onboarding.spec.ts`.
- **A-02 Starter templates — done.** `packages/shared/src/templates/*.json` (house,
  cafe, school, dormitory) validated by `starterTemplateSchema`; loading produces a
  valid `DocState` with a program, a default plot and rate range; **rule fields stay
  empty** (never invent regulation). Tests: shared 4 + web 4.
- **A-03 Site wizard — done.** A skippable 3-step wizard between the start screen and
  the canvas: (1) **Where is it?** — search address (Nominatim), draw my plot (opens
  the map), or **type size** (width × depth → rectangle + grid); (2) optional rules;
  (3) optional budget. Everything is skippable and undoable (edits go through the op
  log); the default template plot is kept if step 1 is skipped. KRK preset picker is
  **deferred to A-10** (no preset data exists yet). Playwright: `e2e/onboarding.spec.ts`.
- A-04 … A-11 — not started.

### Phase F quick wins
- **F-01 Fork button — done.** One-click Fork in the top bar duplicates the active
  branch ("Idea 2", auto colour) and shows a toast; a branch selector switches back.
- F-02, F-03 — not started.

### Phase B — Foundations (started early, partial)
- **B-03 (partial) — done early.** localStorage quota failure now surfaces a visible
  message ("Autosave failed … Export a .qrs"). CI, lint rule and Playwright-in-CI
  still to do.
- B-01, B-02, B-04, B-05 — not started. **B-01/B-02 must precede Phase C.**

### Phase K — Concept stage (v4.1 / v4.2)
- **K-01 Program model + migration — done (core).** `ProgramItem` extended
  additively (group, qty, areaEach, bilingual names, needs, source/recipeId/basis,
  edited); `ProgramSettings` (circulation %, unit, recipe binding, owner brief);
  ops `brief.setSettings|reorderProgram|importRows`; `.qrs` bumped to v2 with a v1
  migrator that never throws; `programFit` now uses qty × areaEach.
- **K-00 Program recipes engine — done.** New pure package `@qreasee/concept`:
  safe expression evaluator (no `eval`/`Function`), `resolveRecipe`, and recipes
  `house`, `dormitory`, `cafe`, `school` with visible assumptions and `basis`
  labels. **27 tests** (acceptance was ≥ 25).
- **K-03 rollup + indicators + Area Dashboard — done.** `rollupProgram` (net /
  circulation / gross / allowed / cost), indicators `programGross`,
  `programVsAllowed`, `programCost`, and the **Area Dashboard** bar over the canvas
  (target vs actual per room, text status ok/near/over/under, click a chip to
  select its block).
- **K-00b Start wizard — done.** Choosing a type opens a recipe wizard (How big? →
  Anything special? → Site → Budget), all skippable, with **Skip all**; the program
  and blocks regenerate live as parameters change. Finishing enters **Brief mode**.
- **K-02 Brief mode — done (core).** A new **Brief** mode with the **program table**
  (editable rows, group subtotals, add/delete/reorder, **paste TSV from Excel**,
  **CSV import** with EN/ID header mapping, **CSV export**), the **Assumptions
  panel** (recipe params, quality, add-ons, `basis` labels) and the **Summary
  panel**.
- **K-04 Blocks from program — done (core).** `blocksFromProgram` creates one
  area-true block per instance; blocks render in the viewport, are **selectable and
  draggable** (undoable `room.update`), and can be **resized** (area-locked by
  default) from the Brief panel's Block editor. Selection is **linked**: dashboard
  chip → block, row focus → block. Multi-select, array and drag-to-level are not
  built yet.
- **K-05 Suggest massing — done.** `suggestMassings` (deterministic, no AI) generates
  bar / L / courtyard shapes across candidate floor counts, fits them into the
  buildable area, computes the existing indicators, **rejects hard-rule breaches**,
  ranks by a **weighted score with a visible breakdown**, and returns the top 3
  distinct options. A **"Suggest building volume"** button (Decisions panel) creates
  one branch per option and opens compare; weights are editable. 9 tests incl. a
  corner site, a narrow plot, a concave site and a "cannot fit" case.
- **K-13 Program Assistant** — not started (interface + mock provider only, later).

### Phase V — Project Browser (v4.2)
- **V-01 View entity and operations — done.** `View` in `DocState.views` (custom
  views + saved scenes) with `viewOverrides` for system views; ops
  `view.add|update|remove|duplicate|setOverride` (undoable, branch-aware); system
  views derived from levels + directions (`systemViews`, `allViews` in `shared`);
  `normalizeDocState` fills views/rooms/settings on load; `.qrs` bumped to
  **formatVersion 3** with a migrator. 14 new tests.
- **V-02 Project Browser — done (core).** Left sidebar with **Views** and
  **Stories** tabs: Plans (Site Plan + one per level), Elevations (N/E/S/W),
  Sections (when a section line exists), 3D Views (Default + scenes), Renders
  (empty state). Click to switch, active highlight, collapse «, "+" adds custom
  views, rename/delete for custom views, a layers popover (grid/context), and a
  Stories list (levels, elevation, add). Thumbnails are cheap inline SVG.
- **V-03 In-canvas views — done (basic).** Selecting a plan/elevation/section
  switches to an orthographic camera framed on the site/level; 3D Default returns
  to perspective iso. The **elevation camera is level** (eye height = target height)
  so no top plane is visible; the plan view is top-down. View **thumbnails are small
  icons** (22 × 14). Clipping planes and the full fidelity-aware layer set are not
  built yet.
- **Deferred:** per-view layer wiring beyond grid/context; drag-reorder of views;
  Renders/Sheets content; ⌘K navigation (A-09).

### Phase S — Studio Kit and project library (v4.2 follow-on)

- **S-01 Studio Kit — done (v1).** A studio-scoped **Studio Kit** (the Canva
  Brand Kit parallel) split into **Identity** and **Standards**:
  - *Identity* (referenced live): logo, primary colour, named palette, title-block
    fields (studio name/address/drawn/checked/approved/stage label), sheet prefix
    (K/A), room abbreviations.
  - *Standards* (seed new projects): default cost rates per building type and
    default materials (exterior wall, partition, floor, ceiling, roof).
  - The **primary colour drives the app accent** (`--brand` CSS variable) and the
    3D selection colour; the **logo shows in the top bar**. New projects get the
    kit's rates; schematic generation uses the kit's material defaults unless an
    element is overridden. An **"Apply standards to this project"** action copies
    them into the open project.
  - Stored studio-scoped in `localStorage` (`qreasee.studio.v1`) — **outside**
    `DocState`, so changing the kit never forks a project or enters the op log
    (server-side per-studio storage is G-08). 4 new tests in `shared`.
- **S-02 Project library on the landing page — done.** Persistence moved from a
  single `qreasee.workspace.v1` blob to a **project library**
  (`qreasee.projects.v1`) keyed by project id, with a one-time migration from the
  old key. The landing page lists **Your projects** (name, type, last edited;
  click to open, ✕ to delete); autosave writes each project under its own id and
  tracks the last opened one. The old "Recent" single card is gone.

### Phase L — MVP Feature Guide alignment

Source: `Qreasee MVP Feature Guide.docx` §2 "Layer & Object Naming" (the guide's
explicit build-order #3, flagged as a pilot blocker alongside snap/numeric and
DXF export, both already built).

- **L-01 Layer & Object Naming — done (core).** A flat `Layer` entity
  (`{id, name, color?, visible, locked?}`) lives in `DocState` with
  `activeLayerId`, so layers are **branchable** and carried by an adopted option.
  Ops: `layer.add|update|remove|setActive`, `mass.setLayer` (all undoable). Every
  authored mass gets a `layerId` and an auto-name (`Mass 01…`) when it is created;
  removing a layer re-homes its objects and never leaves zero layers.
  `normalizeDocState` backfills a default layer so old `.qrs`/localStorage load.
  A **Layers** panel (top bar) lists layers with a colour chip, an eye
  visibility toggle (wired to the 3D view — hidden-layer masses are not drawn),
  inline rename, an object count, set-current, and delete; a **Selected object**
  section renames the selected mass and moves it between layers. New tests:
  shared 3, document 5, export 1.
- **L-02 DXF carries object layers.** `exportDxf` draws each mass on its object
  layer (`Q-<layer name>`, sanitised, colour → nearest ACI), so the studio's own
  organisation survives the AutoCAD handoff; masses without a layer still fall
  back to the per-level `Q-LT{n}` layer.
- **L-03 Landing page "Continue Project".** Per guide §3.4.1, the projects
  section is now **My Qreasee** with a **Continue where you left off** card for
  the most recent project above the grid.

### Phase L2 — Material library, Groups, Offset

- **L-04 Material library & textures — done.** A generator
  (`scripts/build-material-library.ps1`) scans a local product library, copies
  each texture to `apps/web/public/materials/`, and writes
  `packages/shared/src/materialLibrary.json` (**1,298 materials** across 10
  groups — HPL/PVC, Paint, Tiles, Timber) with name, brand, group, tags, average
  colour and a texture scale. `Material` gained `texture`, `textureScaleMm`,
  `group`, `brand`; `materialById` now searches core + library;
  `materialGroups()` / `searchMaterialLibrary()` power the picker. The schematic
  renderer applies the texture with **box/planar UV mapping in mm**
  (`planarUVs`) and a cached `TextureLoader`. The Schematic panel gained a
  searchable, group-filtered **card grid** of real product swatches that can be
  **clicked or dragged onto a wall/slab/roof** (the controller raycasts on
  `drop`; the hovered face highlights before drop). ~13 MB of textures.
- **L-05 Group / Component — done (MVP).** A flat `Group {id, name, color}` in
  `DocState` + `Mass.groupId`; ops `group.create|update|remove`,
  `mass.moveMany`, `mass.updateMany` (each one undoable step). **Shift+click**
  builds a multi-selection; clicking any member selects the whole group;
  dragging or rotating a grouped mass moves/rotates **all members together**
  (rotation about the protractor centre). A **Groups** section in the Layers
  panel creates/renames/selects/ungroups. No nested groups or group scale yet.
- **L-06 Offset tool — done.** A new `offset` tool: with a mass selected, moving
  the cursor previews an **inset (inside) or outset (outside)** of its footprint
  using `inflatePolygon`; the distance follows the cursor or a **typed value**
  (Enter commits, Esc cancels). Commit is an undoable `mass.update` of the
  footprint. *Deviation:* the guide describes face offset with explicit new
  geometry; this is an in-place footprint offset (the useful concept-stage
  behaviour) — see DECISIONS.
- **L-07 Concept blocks are 3D "balok" — done.** Program blocks were flat
  polygons; they now carry a **height (default 3000 mm)** and render as extruded
  boxes, so the brief produces stackable Lego-like volumes instead of flat
  rectangles. The block editor gained a **height field**, a **volume readout**,
  the **target area + delta** vs the program, and a **level selector** (stack a
  block on another storey). Block corners are added to **snapping**. The right
  panel is now narrower (Brief 360 px, others 288 px) with a **collapse** button,
  so the 3D world stays wide.
- **L-08 Block stacking (balok) — done.** Blocks carry a base **elevation** and
  stack like Lego: **drag one block over another and it drops onto its top**
  (`stackElevationFor` in `@qreasee/concept`, AABB-overlap test), or use the
  **"Stack on top"** button in the block editor; dragging off drops it back to
  the ground. The editor shows the current elevation. 4 new tests.

### Phase D — Sheets / slide editor (D-02)

- **D-02 Sheets editor — done (core).** A new **Sheets** mode is a slide-like
  editor: a **filmstrip** of sheets (with thumbnails), an mm-accurate **sheet
  canvas** (A4/A3/A2 landscape), and a **properties** column. You can **place a
  view** (plan/section/elevation from the Project Browser's views) as a framed
  drawing, **add text**, and **draw dimensions** between two points; drag items
  to arrange; the **title block** is filled from the Studio Kit (studio name,
  project, sheet number/name, scale). `Sheet` + items (`view`/`text`/`dimension`)
  live in `DocState`, so sheets are **branchable**; ops
  `sheet.add|update|remove|setItems` are undoable. New `document` tests.
- **Fix:** only geometry ops (`mass.*`, `room.*`, `level.*`) invalidate the
  generated schematic now; adding sheets/views/annotations no longer wipes it.
- **D-03 Sheet-set PDF export — done.** **Download PDF** renders every sheet
  (one page each, at its paper size) to a multi-page PDF via a client-side
  library (`jspdf`). Sheets are drawn by a **pure SVG builder**
  (`lib/sheetSvg.ts`) that the editor and the PDF both use, so the print matches
  the screen. Verified: a 2-sheet export produced a valid 2-page `%PDF`.
- **D-04 Drawing annotations — done (step 1 of the Revit-sheet match).** The
  plan/section/elevation generator now draws the sheet furniture from a Revit set:
  - **Grid lines + circled grid bubbles** (labels 1/2/3, A/B/C) on plans, from
    `DocState.grids`;
  - **Automatic grid dimension chains** (bay-to-bay, in mm) on plans;
  - **Level markers** (e.g. `Lt. 2 +3.50`) with a tag on sections and elevations,
    from `DocState.levels`;
  - **Material colour fills** — rooms, slabs and walls use their material colour,
    and the elevation facade is tinted by the exterior wall material.
  `planSvg/sectionSvg/elevationSvg` take an optional `DrawingContext`
  (`{ grids, levels }`), so they stay backwards-compatible; the Drawings panel and
  the Sheets editor both pass it. 3 new tests.
- **D-05 UI fixes.** (a) The **logo mark** is redrawn with a bold ring that uses
  `currentColor` (it was already theme-aware, but the design asset had a hard
  white ring that vanished on white — "cut" look); `public/logo-dark.svg`,
  `logo-light.svg` updated to match and a **`favicon.svg`** is now linked, so the
  tab shows the real Q. (b) The **3D viewport now fills its container** when the
  right panel opens/closes or the sidebar collapses: the controller resizes on a
  `ResizeObserver`, per-frame size check, and a panel-state change (timers, which
  also work in a background tab). Verified: canvas = main width in both states.

## Direction v5 — Revit-quality sheet set ("sample-house test")

Source: `docs/DIRECTION_v5_SHEETSET.md` and `docs/Qreasee_Authoring_Path.docx`.
Goal: output a **vector PDF sheet set equivalent to the reference**
(`20230715 RUMAH BU ALFIA WARDAH.pdf`) from a model authored inside Qreasee — cover
+ A101 plan L1/L2, A102 roof plan, A103 front elevation, A104 side elevations,
A105/A106 sections. Authoring philosophy: **draw like SketchUp, store like Revit**
(loose input, object model: Grid, Level, Room, Wall, Opening, Slab, Roof, Stair,
plus 2D annotation). Build order **W-00 … W-09**; W-01 (schematic entities become
document state) is the keystone and **must precede W-03** (authoring UI).

- **W-00 Fixture and acceptance harness — done.** `apps/web/src/fixtures/wardahHouse.ts`
  builds the reference project (grids 1-2-3 = 5200/3800, A-F = 5100/3000/6100/5300/3400;
  levels 0 / 3600 / 7000; a mass; the ground + first-floor program; 11 views; the seven
  sheets A000, A101–A106). `apps/web/src/fixtures/__tests__/wardahSheetSet.test.ts`
  generates the sheet set (SVG) and checks page count, sheet numbers/titles, multi-view
  placement, and the D-04 grid/level annotations, plus an end-to-end W-01 check that
  schematic entities live in `DocState`. The remaining capabilities (W-02…W-07) are
  `it.todo`, so `pnpm test` shows the gap **without failing**. Deviation: the fixture is
  a TS builder, not a committed `fixtures/wardah-house.qrs` (a `.qrs` is only meaningful
  once W-01 entities exist).
- **W-01 Schematic entities are document state — done.** `DocState` now holds
  `walls`, `openings`, `slabs`, `roofs`, `stairs` **and** schematic-fidelity `rooms`
  as first-class entities with `origin: "generated" | "user"`. Ops
  `wall.*`, `opening.*`, `slab.*`, `roof.*`, `stair.*` are undoable/branchable, and
  **editing an element flips it to `origin: "user"`**. `schematic.setGenerated`
  replaces only generator-owned elements, keeps user edits/additions, and drops
  regenerated twins that share a user element's stable id. The old generator is now
  **"Generate starter from mass"** (`starterFromMass`), and the drawings/3D/section
  consume a view model **derived from `DocState`** (`schematicFromDoc`). `.qrs` bumped
  to **formatVersion 4** with a non-throwing migrator; `normalizeDocState` backfills.
  **Done-when verified:** editing a wall survives regeneration; undo/redo and branch
  adoption carry walls. New tests: shared 2, document 6, schematic 3, export 1.
- **W-02 Multi-level model and stairs — done.** `starterFromMass` now emits walls,
  rooms and a floor slab for **every level the mass spans**, and a single ceiling +
  roof **over the top level only**. `schematicFromDoc` takes an optional `levelId`,
  so **plan drawings are filtered to one storey** while sections/elevations span all
  levels; the Drawings panel and the Sheets editor pass each view's level. New
  **`stairGeometry`** derives the riser count from the floor-to-floor height (the
  180 mm riser target is a labelled starter value) and renders treads + an UP marker
  in plan and a stepped profile in section. The sample-house fixture now carries a stair.
  New tests: schematic 4, web 1 (the W-00 harness's two W-02 todos became real checks).
- **W-03 Plan authoring tools — done (core).** In Schematic mode the toolbar now
  has **Wall / Room / Door / Window** tools. The **Wall** tool draws a chain of
  walls by click, snapped to grids, wall ends/midpoints and block corners, with
  typed length (Enter ends the chain); the wall kind (**exterior 150 / partition
  100**) is a toggle in the Schematic panel. The **Room** tool draws a polygon and
  **generates its bounding walls**. **Door/Window** place an opening on the nearest
  wall (offset + sill/head). Everything goes through the op log (`wall.add`,
  `opening.add`, `room.add`), so it is undoable and branchable. New tests: web 3.
  **Deferred (logged):** wall joins (corner/T via Clipper2 union of offset
  polygons), column/canopy/railing, and moving a wall to resize a room.
- **W-04 Plan graphics quality — done.** Drawings now use a **pen table in paper
  millimetres** (Studio Kit, editable): **cut 0.35, projection 0.18, annotation 0.13,
  grid 0.09**, multiplied by the view scale (plan/section 1:100, front elevation
  1:50). Plan graphics gained **solid poché walls**, **door swing arcs**, a **window
  symbol**, the **stair direction arrow + UP**, room fills from material colour, and
  simple **fixture symbols** (WC, car, sofa, bed, dining, kitchen) matched from room
  names. The pen table has an editor in the Studio Kit panel. New tests: schematic 3.
  Verified live: plan strokes are 35/18/13/9 model units at 1:100 with a dash-dot
  grid. **Deferred (logged):** the Playwright visual golden (browsers aren't
  installed here) and CAD-style hatch patterns (fills are flat colour).
- **W-05 Annotation from the model — done (core).** Plans now draw, with toggles in
  the Drawings panel (**Dims / Tags / North / Scale / Sections**): **room tags**
  (name + area), **door/window tags** (D1/W1) with leaders, a **north arrow**
  (rotated by the model north angle), a **graphic scale bar**, and **section marks**
  whose bubbles carry the **sheet number the section view is placed on**. The lookup
  is the pure `sectionMarks(state)`, so moving a section view between sheets updates
  its mark (the W-05 done-when). Grid-to-grid dimension chains remain (D-04). New
  tests: shared 3, schematic 3. **Deferred (logged):** toggles are a single global
  set (not yet per-view), and opening-position / overall dimension strings plus
  manual overrides are partial.
- **W-06 True print scale & Indonesian title block — done (core).** A placed view
  stores `scale` (1:50/1:100/1:200, editable per view); the sheet embeds the drawing
  so **1 paper mm == `scale` model mm** — verified live: a plan image is 258 mm wide
  at 1:100 and exactly 129 mm at 1:200, so a 9000 mm grid span measures 90 mm on a
  1:100 sheet (the W-06 done-when). The **right-hand title-block column** is filled
  from the Studio Kit (studio, address, project, client, consultant, drawn/checked/
  approved, drawing title, scale, sheet code, sheet no.) with **bilingual ID · EN
  labels**; sheets number from the Studio Kit prefix (K-01…). The **cover** is a
  captured 3D image (`Capture` in the 3D overlay → `Place 3D capture`; new
  `SheetImageItem`). New tests: apps/web 3 (scale ratio, title-block fields, cover
  image). **Deferred (logged):** drag-between-sheets and explicit crop handles.
- **W-07 Vector PDF export — done.** Export now runs each sheet through
  `svg2pdf.js` instead of rasterising: drawings are inlined as nested `<svg>`
  (vector, not a `data:` image) and text stays real. Roboto (Apache-2.0, in
  `public/fonts/`) is embedded and aliased to `sans-serif` so drawing text lands
  in one face. New `pdfjs-dist` tests: 7 pages, A3 = 420 × 297 mm, title-block
  text extractable (`A101`, `NAMA PROYEK`), no `paintImageXObject` (even the
  cover), file size < 3 MB. Verified live: the Download PDF button produces a
  140 KB `application/pdf` blob; a single sheet builds in ~0.7 s. New tests:
  apps/web 4. **Deferred (logged):** jsPDF still lists its unused default fonts
  (pdfjs warns for standard-font data); conversion runs on the main thread.
- **W-08 … W-09** — not started. Next: **W-08** (roof plan, elevations with
  material fills, DXF handoff).

### Concept-stage UX (user-requested, after W-07)
- **C-01 2D Concept plan canvas — done.** A new **Concept** mode: a top-down
  editor where concept rooms are colored, area-true blocks with name + area
  labels. You can **drag** a room to move it (snaps to neighbours) and **rename**
  it in the side inspector (or the table). A live **Program + Area Summary**
  table groups rooms by name → count → total, plus a Total row, and updates on
  every edit. Dimension chains run along the bottom/left; **snap points are
  visible** (orange corners, yellow edge midpoints) plus a cursor dot. Add Room
  creates a concept room (no walls, per the chosen scope); Export CSV / SVG.
  Pure `areaSummary()` in `@qreasee/concept` (concept tests +5). Verified live:
  add 3 rooms → rename one → the table re-groups (Room 2 · 32 m² + Living Area
  1 · 16 m², Total 48 m²); dragging moves the polygon.
- **C-02 Visible 3D snap markers — done.** The 3D viewport now draws a small
  marker for every snap point near the cursor — **orange at corners/endpoints,
  yellow at edge midpoints**, blue for grid/other — plus a brand **ring** on the
  point the cursor is actually snapping to. Candidates come from a shared
  `collectSnapCandidates()` (mass vertices, concept-block corners *and*
  midpoints, wall ends/mids, grid intersections, site vertices/edge midpoints).
  Verified live: hovering a mass vertex shows the orange marker + highlight ring
  with the overlay reading `vertex 3.00, 13.00 m`.
- **S-01 "Sample house" from the source IFC — done.** The reference model
  (`20230707 RUMAH BU ALFIA WARDAH.ifc`, IFC2X3 from Revit) was parsed offline:
  3 storeys (LANTAI 1/2 @ 0/3600, RING BALOK @ 7000) and **18 named rooms** with
  their real extruded profiles. `fixtures/sampleHouse.ts` reproduces it and a new
  Home card **"Sample house (Rooms)"** loads it straight into Concept. Verified
  live: 18 rooms, live summary (e.g. R. Keluarga 46.7 m², KT. Anak ×3, KM/WC ×4;
  **Total 246.6 m²**). Fixture test: apps/web +4.
- **C-03 Room boundary is hidden until highlighted — done.** In both the Concept
  canvas and the 3D concept rooms, a room's **boundary stroke is invisible by
  default** and appears only when its title/room is **highlighted** (selected or
  hovered); the coloured fill and the name + area label stay. Verified live:
  every room polygon reads `stroke="none"` until hovered, then `#f0913b`.
- **Import (W-08-adjacent) — findings.** The **IFC is readable** (IFC2X3 STEP):
  storeys, spaces (name/area/geometry), walls, doors, windows, slabs, roof,
  stairs. The **DWG is AC1027 (AutoCAD 2013)**, a proprietary binary, and **no
  converter is installed** (no ODA File Converter, no LibreDWG, no ezdxf) — DWG
  needs ODA/LibreDWG or a DXF export.
- **I-01 IFC import — done.** "Import an IFC" on the Home screen parses an
  IFC2X3/IFC4 file **in the browser** (`@qreasee/export` `parseIfc` /
  `ifcToDocState` — pure, no DOM, no network) and opens it as a project:
  **storeys** (`IfcBuildingStorey`), **rooms** (`IfcSpace` — LongName + swept
  profile placed by the solid's Position) and **walls** (`IfcWall*` — Axis
  centreline + thickness/height from the Body profile). Doors/windows/slabs/
  roofs/stairs are **counted and reported**, never invented. Tests: a
  deterministic fixture (+5) and a guarded test that reads the real sample-house IFC
  (**3 storeys, 18 rooms, 38 walls**). Verified live: importing a file opens
  Concept with the rooms and the status "Imported N rooms, M walls, K storeys."
  **Deferred (logged):** doors/windows/slabs/roofs/stairs are not mapped yet;
  DWG still needs a converter (ODA/LibreDWG) or a DXF export.
- **I-02 IFC openings + slabs — done.** Doors and windows are now mapped onto
  their **host wall** by following the IFC chain `IfcRelVoidsElement` (wall →
  opening) → `IfcRelFillsElement` (opening → IfcDoor/IfcWindow): the opening's
  swept profile is projected onto the wall centreline to give the **offset**,
  **width** and (from its base Z) the **sill**/**height**, producing real
  `Opening` entities. `IfcSlab` bodies import as **floor slabs** (polygon, z,
  thickness). Tests: the fixture now carries a door + slab, and the guarded real
  file asserts **≥10 openings and ≥10 slabs**, each opening pointing at a real
  wall. Verified live: importing a file gives status
  `Imported 1 rooms, 1 walls, 1 openings, 1 slabs, 1 storeys.` and the door lands
  on `ifc-wall-1` (offset 450, width 900). **Deferred (logged):** roofs/stairs
  are still counted, not mapped; ceilings are imported as floors.
- **I-03 DXF underlay import — done.** The Layers panel gains an **Underlays**
  section: pick a **level**, **Import DXF** (AutoCAD linework), and it drops a
  tracing underlay on that level — a normal document entity (undoable, branchable)
  that can be **hidden or deleted** any time. `parseDxf` (`@qreasee/export`, pure)
  reads `LINE`, `LWPOLYLINE`, `POLYLINE`/`VERTEX`, `CIRCLE` and `ARC`, honours
  `$INSUNITS` (in/cm/m/mm/ft), and caps at 50 000 lines (reporting truncation).
  The 3D viewport draws the underlay muted at the level's elevation. A `.dwg`
  selection is detected and explained (export DXF or convert first). Tests: export
  +4 (DXF parse, units, underlay), document +2 (ops + migration). Verified live:
  a 37-line DXF imports as `Underlay "ground-floor": 37 lines onto Lt. 1`, toggles
  visibility and deletes. **Deferred (logged):** DWG (AC1027) still needs a
  converter; no per-source-layer visibility UI yet (the data is stored).
- **I-03b DWG converter (in-browser) — done.** A `.dwg` (or a DWG renamed `.dxf`)
  is now converted **in the browser** with **LibreDWG compiled to WASM**
  (`@mlightcad/libredwg-web`), then parsed like any DXF — no server, no upload.
  The module is loaded lazily on the first DWG; the 9.5 MB `libredwg-web.wasm` is
  served from `public/libredwg/`. Verified live on the real
  **`sample house.dwg`** (AC1027, 1.6 MB): `Underlay "sample house": 5477 lines
  onto Lt. 1.` (LibreDWG prints its own UTF-8/MATERIAL warnings to the console;
  they are non-fatal). **Deferred (logged):** the first conversion downloads the
  9 MB module; LibreDWG's console warnings are not silenced; complex entities
  (SPLINE/INSERT/3DFACE) are not yet drawn.
- **I-03c wider DXF coverage + snap to underlay — done.** The importer now reads
  **SPLINE** (fit points, or a de Boor B-spline sample), **INSERT** block
  references (expanded with scale/rotation and nested, incl. MINSERT arrays),
  **ELLIPSE**, **3DFACE/SOLID** and a best-effort **HATCH** outline — on top of
  LINE/LWPOLYLINE/POLYLINE/CIRCLE/ARC. Blocks are read from the `BLOCKS` section.
  The 3D viewport now **snaps to underlay linework** (endpoints orange, midpoints
  yellow) near the cursor on the active level, capped at 40k scanned lines for
  responsiveness. Tests: export +4 (SPLINE/3DFACE/INSERT/layers). Verified live on
  the real DWG: line count rose to **5541**, and hovering an underlay line reads
  `underlay 1.39, 15.21 m` with visible markers. **Deferred (logged):** HATCH
  outline is approximate; block-contained POLYLINE vertices and MLINE/LEADER are
  not drawn; LibreDWG's console warnings remain.
- **LG-03 3D screen-space snapping — done.** Snapping is rebuilt as a pure module
  (`@qreasee/geometry/snap`): candidates are generated in **3D** (endpoints,
  midpoints and edges of masses at **base, top and every level**, concept blocks,
  site/green edges, grid intersections, underlay linework, plus draft close / axis
  / parallel / perpendicular), then matched in **screen pixels** (~14 px) via the
  viewport's `project()`. Priority endpoint > midpoint > intersection > edge >
  guide > grid; ties by pixel distance, camera distance, active-level proximity.
  Occlusion rejects points hidden behind a mass (skipped top-down). Markers are
  DOM shapes (square/triangle/X/diamond/ring + label), so they are constant size
  and never rely on colour. Footprint tools take the snapped X/Y and keep the
  level elevation, drawing a **vertical guide** to the plane; move/vertex/push-pull/
  rotate/section use the full 3D point. `?debugSnap=1` draws every candidate and
  prints the active kind + pixel distance. Tests: geometry **+18** (fake
  perspective and orthographic cameras), plus a Playwright check for bug 1.
  Verified live: hovering a plain face shows **no marker**; corners at z=7000 snap
  as endpoints; midpoints, edges, grid intersections, axis and parallel all fire;
  tooltip reads "Endpoint"/"Midpoint"/…; works in perspective and top ortho.
- **LG-04 Keyboard shortcuts — done.** A single pure registry
  (`@qreasee/shared/shortcuts`) is the source of truth: `ActionId` + label +
  category + default binding + scope, with `normalizeEvent`, `matchBinding`,
  `bindingToLabel` (⌘/⌥/⇧ on Mac), `validateBinding`, `findConflicts` and
  `RESERVED_BROWSER_BINDINGS`. Owner defaults: **M** Move, **R** Rotate, **C**
  Copy, **T** Tape, **E** Eraser, **P** Paint, **G** Group, **1/2/3** lenses,
  Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z redo, Delete, Esc; proposals **Space** Select,
  **B** Rectangle, **L** Polygon, **O** Circle, **A** Arc, **H** Push/Pull,
  **F** Offset. One keydown handler in `App.tsx` routes through the registry
  (`resolveShortcut`), ignoring inputs/selects/contenteditable, IME, `event.repeat`
  for tools, non-workspace screens, and typed-value entry. Settings →
  **Keyboard shortcuts** panel (⌘ in the top bar) records keys, resolves conflicts
  with **Replace/Cancel**, resets one/all, and exports/imports JSON. Overrides live
  in `localStorage qreasee.shortcuts.v1` (personal, **not** DocState/op-log/.qrs),
  validated with zod; corrupt data falls back to defaults. Toolbar tooltips show
  live bindings ("Move (M)"), **?** opens a cheat sheet. New tools: **Move**
  (select-drag), **Copy** (duplicate selection, one `mass.addMany` op), **Tape**
  (two-point read-out, not stored), **Eraser** (remove mass/room), **Group**
  (existing action); **Paint** is registered but **unavailable** ("Pick a material
  first"). Tests: shared +18, apps/web +7. Verified live.
- **LG-05 Qreasee material library + Paint — done.**
  `scripts/build-qreasee-materials.ps1` curates **24 brand-free materials** from
  the local sample library (brick, concrete, stone, wood, timber, paint, roof,
  metal) and **generates grass and glass** textures; bilingual names, category,
  average colour, texture, scale and opacity land in
  `packages/shared/src/qreaseeMaterials.json` → `QREASEE_MATERIALS`. The Layers
  panel gains a **Material (Paint)** swatch picker (the active material lives in
  the store, a personal preference), and **Paint** is now enabled: it applies the
  active material to a picked schematic element, or tints a picked mass via
  `mass.update`. Verified live: **24 swatches** (grass + 2 glass), painting a mass
  turns it to the grass colour. Shortcut follow-ups from the owner: **Ctrl/Cmd+letter
  is now allowed when not reserved** (so Ctrl+C can be bound), and Paint is no
  longer marked unavailable. Follow-up: the picker now shows **texture
  thumbnails** (not flat colours) on a light backing so transparency reads, and
  **glass is translucent** — the glass textures carry real alpha and
  `surfaceMaterial` honours `material.opacity` (`transparent` + `depthWrite:false`).
- **W-08 Roof plan, elevations & DXF handoff — done (core).** The schematic now
  prefers an **entity's own material** over the level defaults
  (`matFor(id, own, fallback)`), so the sample's walls/slabs/roof/stairs render with
  their real materials in plans and elevations (the elevation facade is tinted by
  the exterior wall material; roof faces are drawn). DXF export gains **studio
  layers** — `A-WALL` (wall centrelines), `A-DOOR` / `A-GLAZ` (opening ticks),
  `A-GRID`, `A-ANNO` (room names) — alongside the existing `Q-*` layers. Tests:
  export +1. **Deferred (logged):** stone-cladding hatch fills; visible
  railing/canopy; roof ridges/hips drawn in plan (the roof outline is dashed).
- **Sample house: material scheme + sheet set — done.** The IFC-derived sample now
  carries a **material scheme** (brick exterior / painted partitions, screed floors,
  concrete roof, concrete stairs) and a **section line**, and ships a **6-sheet
  set**: **A000 Cover** with a generated **axonometric snapshot** of the building
  plus the document title, then **A101 Denah Lantai 1**, **A102 Denah Lantai 2**,
  **A103 Denah Atap** (roof plan), **A104 Tampak Depan & Samping**, **A105 Potongan
  A-A**. Verified live: 6 sheets, cover image + title render, schematic shows the
  Qreasee materials (66 wall panels, roof `qr-roof-concrete`, 5 stairs). Regenerate
  with `QREASEE_GENERATE=1`.
- **W-08b Roof plan with ridges/hips, editable slope, generate-or-draw — done.**
  `roofPlanLines(roof)` (pure, tested) derives the roof seen from above: boundary
  edges are the **eaves**, an edge shared by two faces is a **ridge / hip /
  valley** (a hip roof gives 1 ridge + 4 hips; a gable gives the ridge + 2 rakes; a
  shed has none). `planSvg` draws the **roof plan** (solid eaves + ridge/hip lines)
  when the plan's level is the roof's level (`Schematic.roofOnLevel`), and keeps the
  dashed outline above on lower levels. The **slope** is editable in the Schematic
  panel (number + slider → `setRoofPitch` → `roof.update`, re-derives; a steeper
  pitch raises `ridgeZ`). The roof can be **generated over the highest level**
  ("Generate roof over top level" → `generateRoof`, footprint from that level's
  walls/rooms, else the mass, else the site) **or drawn** with the Roof tool.
  Tests: schematic +4. Verified live: `roofOnLevel` true for L2/L3, pitch 30→45
  raises the ridge, the button is present. Also fixed: the sample's sheet view ids
  now match the real level ids (`sys:plan:ifc-L1/2/3`) and `activeLevelId` is
  `ifc-L1`.
- **W-08c Hatch fills, railings, and the concept sheet — done.** `hatchSegments`
  (pure scanline, tested) fills cut poché and masonry facades with hatch lines — no
  SVG filters/masks/clip paths, so it stays vector and svg2pdf-safe. Masonry
  materials (brick / stone / andesite / limestone / granite) hatch in **sections**
  and **elevations**. A new **Railing** entity (`railing.add/update/remove`) renders
  as posts + a top rail in 3D, a line in plan and a line at height in elevation;
  the **Railing tool** authors runs and the IFC importer maps `IfcRailing`. The
  sample now ships **7 sheets**: **A000 Cover**, **A100 Konsep Massa & Program**
  (axonometric mass + a generated **Program + Area Summary table**), A101–A103
  plans, A104 elevations, A105 section. Tests: schematic +8, apps/web +1. Verified
  live: 5 imported railings, the Railing tool adds one, section/elevation carry
  hatch lines, and the Sheets editor has a **Download PDF** button.
- **W-08d the 3D snapshot is the real model — done.** The cover/concept snapshot is
  no longer a bounding box: `axonModelSvg` (pure, +2 tests) builds faces from the
  document entities (**walls, slabs, roof, stairs**), projects them isometrically
  and paints back-to-front with light shading, so the sheet shows the actual house.
  Verified: the cover image carries **340 faces** and the sample-house PDF has
  **344 vector fill ops on page 1** across 7 A3 pages.
- **VW-01 View Range — done.** `ViewRange { top, cutPlane, bottom, viewDepth }`
  (+ `DEFAULT_VIEW_RANGE.cutPlane = 1200`, `cutStateFor`) is a first-class value
  threaded through `schematicFromDoc` and carried on the derived `Schematic`.
- **VW-02 plan cut plane — done.** Walls are cut at level + 1200 mm; an opening is
  `cut` when the plane crosses it, `above` when its sill is higher (drawn dashed
  over solid poché) and `below` when its head is lower (projection over poché).
  `+4 tests`.
- **Plan room names — done.** `schematicFromDoc` no longer filters imported rooms
  to `fidelity: "schematic"`, so the IFC (concept) rooms appear as named rooms with
  areas on the plans. Verified in the sample PDF: page A101 lists *R. Keluarga
  46.7 m², R.Makan 29.3 m², Dapur …*.
- **VW-08 axon orientation — done.** The cover snapshot camera is now at
  (+X, −Y, +Z) so the **front facade** (grid-A / entrance side) is visible, faces
  are **back-face culled** and outward-oriented (Newell), the shell is filtered to
  the mass footprint (site/fence walls dropped) and the roof uses the imported roof
  outline. `docs/VIEW_PIPELINE_DIAGNOSIS.md` records the pipeline gap analysis and
  the VW-01…VW-08 ticket order.
- **VW-02b light poché + VW-04 view titles — done.** Cut walls are now a **light
  fill with a heavy outline** (matching the reference, not a dark solid); the
  in-drawing `PLAN`/`SECTION`/`ELEVATION` labels are gone and the graphic scale bar
  is off by default — the scale lives in the new **per-viewport title** on the
  sheet: a split circle (detail number over sheet code) + rule + view name +
  `SCALE 1 : n` (`sheetSvg.viewTitleMarkup`, `+2 tests`). Level labels are no
  longer clipped by the drawing bounds. Verified on sheet A101:
  `1 · A101 · Plan · Lantai 1 · SCALE 1 : 100`.
- **Room rename — done.** Double-click a room in the Concept plan to rename it
  inline (`foreignObject` input); it goes through the `room.update` op (undoable)
  and the new name flows to the plans and the area summary. Hint updated (EN/ID).
- **Part 2 · VP-01 grid/wall alignment — done.** Root cause found with a new
  `?debugPlan=1` overlay: the plan already used ONE transform, but the generator
  wrote the reference grid (0..9000 / 0..22900) while the imported IFC geometry sat
  at x −1314 / y −7694 — same spans, **different frame**. The generator now shifts
  every layer (walls, rooms, slabs, roofs, stairs, railings) into the grid frame
  (`alignToGrids`), so the long walls land on grids C–F and the fence on grid 1.
- **Part 2 · VP-02 crop + grid extent — done.** `planSvg` took its bounds from the
  **first** floor slab, which cropped the building and shortened the grid; it now
  uses the bbox of all walls/rooms/slabs. Grid ends are `max(1500, span·0.08)`
  outside with bubbles on both sides, and the sample plans are fit at **1:150** so
  nothing clips.
- **Part 2 · VP-03 section line — done.** Black dash-dot line, split-circle head
  (detail number over sheet code) with a filled arrow, and a thick end bar — as in
  the reference (was a red dashed line with a letter). Printed in black.
- **Part 2 · VP-04 opaque room fills — done.** Room fills are opaque, so
  overlapping rooms no longer muddy the colour.
- **Part 3 · WP-01 wall joins — done.** `planSvg` now draws the **union of the
  outset wall footprints** in the outline colour, then the wall footprints in
  poché on top (no boolean library needed) — one continuous outline with no gaps
  or interior lines at corners/T-junctions. End extension = half the thickest
  wall.
- **Part 3 · WP-02 doors/windows cut the walls — done.** Root cause: the IFC
  import read the opening **height** from the extrusion depth (≈ wall thickness
  150) and the **sill** from world Z (so L2 windows showed sill 4550). Now the
  height is the opening's vertical extent (else door 2100 / window 1500) and the
  sill is measured **above the host level** — so openings cross the 1200 cut plane
  and cut; high windows (> cut) stay dashed. Doors now show leaf + swing.
- **Part 3 · WP-03 grid text + sizes — done.** Bubble labels are centred by cap
  height in a 7 mm bubble; chain offsets tightened to ~13.5 mm/side so the plan
  fits A3 at **1:100**.
- **Part 3 · WP-04 scale/fit/frame — done.** A101 is **Denah Lantai 1 & 2 side by
  side at 1:100**; the viewport crop frame is drawn only when selected (never
  printed).
- **Part 3 · WP-05 sheet set — done (partial).** Shet set is A000 cover, A100
  concept, A101 L1+L2, A102 roof, A103 front/back, A104 sides, A105 section. (No
  A106 — only one section view exists; the view names are still English.)
- **Part 4 · WP-06 the floor is the room finishes — done.** The plan was drawing
  the raw imported slab polygons as a grey-blue base (the "patches that don't
  follow the walls"); those are gone. The floor is now the **room finish fills**
  only, opaque, by room type — cream interior, green-grey terrace paving, light
  wet areas, service — with a text halo. Furniture placeholders that sat under the
  tags are removed, so room tags are **text-only** (Part 4 §4). Bounds now come
  from walls + rooms + roof so the crop tracks the building.
- **Part 4 · WP-07 bounded floor.** The room fills are **clipped to the exterior
  wall bounding box**, so the floor no longer spills outside the building.
- **Part 4 · WP-08 stairs (Part 4 §5).** Treads are spaced at the **300 mm going**
  (not the rise, which made them ~60 mm and too tight); riser lines are thin for a
  stair below the cut. **One arrow + one "UP" per level** (the IFC splits one stair
  into 5 flights). A stair arriving from the level below is **shown in projection**
  (thin, no "UP") on the upper plan.
- **Part 4 · WP-09 window tags removed + dimension text size.** Only door tags
  (D1…) are drawn now. Dimension text height is settable (`dimTextMm`, default
  2.5 mm) with a field in the Drawings panel.
- **Part 4 · WP-10 Project Browser opens the right view.** Clicking a view now
  switches the editor: **3D** → schematic mode (3D viewport), **plan/elevation/
  section** → drawings mode with the matching tab (the Drawings tab is now store
  state, `drawingsTab`). Previously the browser only changed the projection.
- **Part 4 · WP-11 the 3D model renders.** The sample now loads in **schematic**
  mode (was concept, so no 3D). Three bugs fixed: the controller rendered **only**
  in the rAF loop (paused in a background tab / capture) so a rebuild never drew —
  it now renders once after every rebuild; the generator's alignment skipped the
  **site boundary**, so the camera framed the old location and the model was
  off-screen — the site is shifted too; and `schematicMassId` was null so the mass
  was not ghosted — it is now set, so the imported walls/roof show.
- **Part 4 · WP-12 smaller room tags.** Plan room name 2.4 mm / area 1.7 mm;
  concept plan tag reduced.
- **Part 4 · WP-13 Concept vs Schematic filter — done.** Concept shows the room
  **blocks** (the room polygons, any shape including L); Schematic shows the
  detailed model and **hides the block** (the mass volume is no longer drawn when
  the schematic is on).
- **Part 4 · WP-14 DWG benchmark inventory — done.** `@qreasee/export` gained
  `DxfModel.counts` (entity counts by type) and `importUnderlay` now returns the
  inventory. The A101 DWG (`20230712 -Sheet - A101 - DENAH LANTAI 1 & 2.dwg`) was
  converted in-browser (LibreDWG) and inventoried: **units mm**, 30 508 lines,
  **132 INSERT** blocks, 704 LINE, 18 DIMENSION, 66 MTEXT, 3 VIEWPORT; layers
  include **A-WALL, A-DOOR, A-GLAZ, A-FLOR, S-COLS, S-GRID, S-STRS, I-FURN,
  S-STRS** (a standard Revit set); bbox ≈ 57.8 × 28.0 m (sheet + both plans).
  Qreasee never depends on a DWG at runtime (the copied refs were removed).
- **Part 3 §6.5 wall extractor — partial.** `@qreasee/export/dwgWalls.ts`
  reconstructs axis-aligned walls from the A-WALL face pairs (pair the two faces,
  centreline + thickness). It finds the two plan regions (L1 30 walls, L2 36 walls,
  thickness 100–165 mm, mm units). **But the face-pairing is not yet complete** —
  it drops some walls, so the result is fragmentary and worse than the IFC walls.
  The generator keeps the IFC walls by default and uses the DWG walls only when
  `QREASEE_DWG_WALLS=1`. Next: a real wall-graph join (Part 3 §1) on the DWG faces,
  not nearest-neighbour pairing.
- **Part 4 · WP-15 Help guide + clickable elements.** The Topbar **Help** button
  now opens a guide that reproduces the sample house with Qreasee's own tools
  (grid → concept rooms as blocks → schematic walls → openings → stairs/roof →
  views → sheets/PDF), EN + ID. Every element (room, wall, door, window, stair,
  roof, railing) is a **separate, clickable object** — verified: clicking the 3D
  selects a room (`selectedRoomId`) and elements are registered for hit-testing
  (`elementMeshes` + `onSelectElement`). Nothing is grouped by default.
- **Part 4 · WP-16 plan view cut plane — done.** The Plan view (Project Browser →
  a plan) is now a real **cut**: the controller clips to `level + 1200 mm`
  (`renderer.clippingPlanes`) and looks straight down, so you see the cut interior
  and openings — not the roof. Before, every level looked the same (top view, no
  cut). Views other than plans are unclipped.
- **Part 4 · WP-17 settable cut plane — done.** The cut height is per view
  (`View.cutPlane`, default 1200 mm, `null` = no cut) with a **Cut plane (mm)** input
  and a **No cut (roof)** toggle in the Drawings panel. The **topmost plan is the
  roof plan and defaults to no cut**, so the roof is no longer sliced. Verified:
  "Plan · Ring Balok" shows the whole hip roof.
- **Part 4 · WP-18 live sheet viewports — done.** Double-clicking a viewport on a
  sheet **enters the view** (opens it in the editor) instead of being a static
  picture — the sheet already renders the drawing from the model. Verified:
  double-clicking A101's plan opened `sys:plan:ifc-L1`. The **title block** is
  filled from the Studio Kit (studio, client, consultant, drawn/checked/approved,
  logo), editable in the Studio panel.
- **Part 3 §1 wall graph — done.** `packages/schematic/src/wallGraph.ts` clusters
  wall endpoints into shared nodes (within `max(thickness)·0.75`), snaps an
  endpoint that lands on another wall's segment (T‑junction), and extends each wall
  end by half the thickness of the wall it meets. `schematicFromDoc` now feeds the
  extended geometry into the wall panels, so **plan, section and 3D all join** —
  corners/T/X are one continuous outline (+5 tests: free end, L, T, X, collinear
  run). Verified on the IFC‑wall plan. The DWG‑extracted walls are still
  fragmentary even with joins, so the IFC walls remain the default.




- **R-01 Stair + roof authoring tools — done.** The schematic toolbar gains
  **Stair** and **Roof**. The stair tool takes two plan points → a straight stair
  on the active level (width 1 m, floor-to-floor from the level); the roof tool
  takes two corners → a hip roof over that footprint, based at the level's top.
  Both dispatch `stair.add` / `roof.add` (undoable, branchable), and the 3D
  schematic now renders **stairs** as solid tread runs (it already rendered
  roofs). Verified live: "Stair added." / "Roof added." via the tools.
- **R-02 IFC stairs + roofs, and the sample reproduced from the IFC — done.**
  The importer now maps `IfcStairFlight` (straight run from the flight footprint)
  and `IfcRoof` (own body, or the union of its aggregated parts) using a
  **faceted-BREP bounding-box fallback** for geometry that isn't an extrusion.
  The "Sample house" fixture is now **generated from the IFC** by Qreasee's own
  importer (`fixtures/sampleHouseDoc.json`, regenerate with `QREASEE_GENERATE=1`)
  and carries the whole model: **18 rooms, 40 walls, 18 doors/windows, 28 slabs,
  5 stairs, 3 roofs** across Lantai 1 / Lantai 2 / Ring Balok. Loading it opens
  **Concept** (the conceptual output: rooms + live Program/Area Summary, Total
  **246.6 m²**); Schematic then renders walls, roof and stairs. Verified live.


### Deviations from the plan (see DECISIONS.md)
- Starter projects get a **default rectangular plot** so the canvas is usable before
  the A-03 wizard exists (the doc's script expects a plot after step 2).
- Template **program names are English** for now; names/descriptions/brief are
  bilingual.

---

## M0 Foundations — done

- VP-01 Orbit/pan/zoom (middle-drag orbit, right-drag pan, wheel zoom to cursor)
- VP-02 Projection + Top/Front/Iso/Fit view buttons (perspective **and
  orthographic**, toggle in the viewport)
- VP-03 Ground, axes, grid, north arrow from `Project.northAngle`
- VP-04 Shaded rendering (wireframe/X-ray partial)
- Monorepo builds (`pnpm -r typecheck`, `vite build`), Vitest green, Playwright
  config + smoke spec wired.

## M1 Site and massing — done (MVP subset)

- CX-01 Draw/clear site boundary; computed area; mark road edges
- CX-02 Location and north angle
- CX-03 Rules panel with per-edge setbacks; optional values
- CX-04 Budget and cost rate range
- CX-05 Brief text and program list
- CX-06 Setback dashed lines + buildable-area shading
- CX-08 Green open-space polygons
- MD-01 Rectangle, polygon, circle and arc/curve footprints; holes via courtyard sample
- MD-02 Typed values (`3500`, `3.5m`, `4000,6000`) while drawing; typed circle radius
- MD-03 Snapping to grid, site and mass vertices, edge projections, midpoints,
  parallel axes and the draft start point ("close"), with an on-canvas snap marker
- MD-04 Push/Pull height by drag or typed height; levels per mass
- MD-05 Move (select-drag); copy/rotate/scale/arrays **reserved**
- MD-06 Vertex editing by dragging handles; add/remove vertex **partial**
- MD-07 Optional mass use label
- MD-08 Undo/redo through the operation log
- LG-01 Levels: create/rename/elevation/active
- LG-02 Grid by spacing with labels
- LG-03 Levels and grids participate in snapping

## M2 Persistence and accounts — partial

- PA-03 Autosave every operation (localStorage)
- PA-01/PA-02 Sign-in, studios, project list, accounts **reserved** (local-first)

## M3 Live feedback — done (MVP subset)

- IN-01 Indicators computed off the main thread in a Web Worker
- IN-02 Breach/height tint on masses while sketching; no popups
- IN-03 Indicator chips with ok/near/over and collapsible bar
- IN-04 Sun view tinting facades (0–8 h legend)
- IN-05 Fidelity + inputs on hover
- IN-06 Missing inputs show "needs input" (e.g. no budget)
- FD-01/02/03 Intent vs Massing fidelity with ranges
- Hand-calculated fixtures for areas, regulation, program, cost, intent,
  courtyard, concave site and sun bounds

## M4 Lenses — done

- LN-01 Visual/Rules/Reflect with keys 1/2/3
- LN-02 Visual: full viewport, colour-only feedback
- LN-03 Rules: context panel with rules, mass dimensions and indicator table
- LN-04 Reflect: brief, program fit, decisions and history

## M5 Decision Branches — done (MVP subset)

- DB-01 Create decision (title, question, whole-building scope)
- DB-02 Create branches from main, name and colour
- DB-03 Branch owner/status; switching is instant
- DB-04 Compare 2–4 branches: indicator table with best highlighted; overlay
  renders other branches as wireframe
- DB-05 Adopt into main with per-mass conflict resolution
- DB-06 Rationale required; writes a DecisionRecord with rejected branches
- DB-07 Park and revive branches
- DB-08/09 Defer and client link **reserved**

## M6 Team and export — export done, team reserved

- EX-01 DXF: Q-SITE, Q-SETBACK, Q-GRID, Q-LTn layers
- EX-02 COLLADA (.dae) with one node per mass, metres, Z-up
- EX-03 glTF/GLB and OBJ via three.js exporters
- EX-04 Comparison sheet PNG (SVG rasterised)
- EX-05 Decision log Markdown and CSV
- EX-06 `.qrs` zip export/import with branches and records
- PA-04 English and Bahasa Indonesia with Indonesian number formatting
- TM-01…TM-05 Roles, realtime presence, soft locks, comments, versions
  **reserved**

## M7 Pilot — not started (needs real studios)

## Iteration 2 additions (this pass)

- Brand orange theme (`#f0913b`), logo mark top-left, dark/light-ready assets.
- Circle tool (click-drag or typed radius) and Arc/curve tool (start, end, bulge).
- Stronger snapping: attaches to existing mass vertices/edges, midpoints, grid,
  axes and back to the starting point, with a visible snap marker.
- OpenStreetMap surroundings: fetch building footprints via Overpass around the
  project location, projected into the model and rendered as grey reference
  massing with show/hide (Site → Surroundings).

## Iteration 3 additions (this pass)

- Light theme, toggled from the top bar and remembered; the whole `ink` scale is
  CSS-variable driven so every surface flips. The 3D scene, ground and grid also
  adapt. Logo ring follows `currentColor`.
- Pan tool and **Shift+middle / right-drag / Space+drag** pan along the screen
  plane (straight path, no revolve). Orbit now re-centres on the point **under the
  cursor** on middle-drag or the Rotate tool, so the object stays in view.
- Site map (Leaflet + OpenStreetMap tiles): trace a site boundary on the 2D map
  and project it into the model; set the project location from the map.
- Fixed the map/3D mirror: the renderer now reflects Z so a top view reads
  north-up / east-right like the map (model space stays +Y = north).
- New `@qreasee/schematic` package: derive rooms from a mass (guillotine partition
  clipped to the footprint), then exterior walls (150 mm) and partitions (100 mm)
  with centred window/door openings, floor and ceiling slabs (120 mm), and a hip /
  gable / one-slope roof (30° default, 600 mm overhang).
- 3D schematic layer: room floor tints, wall panels, slabs and roof.
- Drawings panel: automatic **Plan / Section / Elevation** SVG, each framed to
  ~80% of the sheet, with room labels, areas and overall dimensions; downloadable.

## Iteration 4 additions (this pass)

- **Phase-based toolbar**: a mode switcher (Massing / Schematic / Drawings) that
  shows the tools for that phase. Schematic/drawings modes auto-generate the
  schematic from the selected mass. The redundant top-bar Schematic/Drawings panel
  buttons were removed to avoid a title clash with the mode buttons.
- **Material library** (`packages/shared/materials.ts`): ~35 common Indonesian
  materials across wall / floor / ceiling / roof / structure / glass / metal /
  wood, with representative colours. Materials are assigned per element, appear
  only in the schematic phase, and drive both the 3D colour and the drawings.
- **Selectable and editable schematic elements**: click a wall, slab, ceiling,
  roof or room in the viewport (or a room in the panel) and assign its material.
  Elements have stable ids so assignments survive regeneration.
- **Object rotate** (SketchUp-style): the Rotate tool draws a protractor ring;
  click to set the centre, click to set the baseline, move to set the angle
  (snapping to 15°), then click to apply. Camera orbit stays on middle-drag and
  re-centres on the point under the cursor.
- **Section feature**: a Section-line tool places a user cut in plan (drawn in
  3D as a red A–A line). The Section sheet is now a real cut through the
  schematic — slabs, walls (poché), openings and the roof are intersected with the
  cut plane, not merely projected.

## Iteration 5 additions (this pass)

- **Level-aware drawing plane.** The drawing/raycast plane now sits at the
  **active level's elevation** instead of the world zero plane, so a new mass
  previews and lands where it will be built (e.g. Lt. 2 at +3.50 m) instead of
  jumping up from Z=0. Site/green/road tools still use the ground.
- **Ellipse (oval) tool** alongside Circle and Arc, so masses are not only
  rectangular. Click the centre then a corner (or type `rx,ry`).
- **Add level above**: from a selected mass, creates (or reuses) the level at the
  mass top and copies its footprint — oval, courtyard or polygon — onto it, so you
  build storey by storey from a non-rectangular mass.
- **Orthographic projection** (VP-02): a Persp/Ortho toggle in the viewport swaps
  between the perspective and orthographic cameras without a view jump. The
  orthographic frustum is fitted to the current perspective view on switch, and
  the Top/Front/Iso/Fit views use it, so elevations and plans read true.

### Still reserved

Editable curved polygon edges (arcs are tessellated); mass copy/scale/arrays;
user-placed doors/windows on a chosen wall; multi-level drawings (one level per
mass today); automatic room naming from a circulation graph; texture maps and
material quantities (no BoQ/OTTV); server, auth, realtime, comments, versions.

## Block → Building Elements generator (BG-xx)

- **BG-DWG: build the 3D from DWG floor plans — done.** `@qreasee/export`
  `roomExtract.ts` (`roomsFromWalls`) derives **room blocks** from a floor plan's
  wall linework: rasterise the architectural lines, close gaps, flood fill from the
  border, label the enclosed regions, grow each region to the **wall centreline**
  (`ringCells`) and trace + simplify its outline. A store action **`buildFromDwg`**
  reads the DWG floor plans (LibreDWG → DXF), extracts rooms per level, loads the
  document and previews the generator. Verified on the Alfia plans: **22 room
  blocks (11 L1 + 11 L2)** → BG produced **222 walls, 79 slabs, 77 roofs, 75
  openings** (453 ops) and the 3D renders. The **centreline** rule keeps room
  blocks aligned to the walls.

- **BG-01 edge analysis + walls — done.** `packages/schematic/src/blockGenerator/`
  (pure): `analyseEdges` splits every concept-block edge where a same-storey
  neighbour overlaps it collinearly (tolerance 50 mm) and classifies each segment
  **SHARED** (→ one partition, 100 mm) or **EXTERIOR** (→ exterior wall, 150 mm).
  `generateFromBlocks` emits **stable-id** walls (`origin: "generated"`,
  `sourceBlockIds`), dedupes shared edges and **diffs** against the existing
  generated walls (manual walls are never touched; same input → zero ops). Ops are
  a structural subset of the document `Operation`. `+6 tests`: two rectangles →
  1 partition + 6 exterior with no duplicates; L-shape (no duplicate ids);
  idempotent regeneration; moving one block only changes affected walls; a manual
  wall survives.
  *Assumptions:* `ElementOrigin` is `"generated" | "user"` (the brief says
  "manual"); settings default exterior 150 / partition 100 / snap 50;
  `edgeLocation: "innerFace"` applies to exterior walls only; net area uses the
  perimeter approximation — Clipper2 is **not** in the repo, so BG-02 adds a pure
  inset.
- **BG-02 floors + ceilings — done.** One **floor slab per storey** = the union of
  that storey's block footprints (a pure coordinate-compression union,
  `unionPolygons`), thickness 150 mm, top at the storey elevation, with
  `sourceBlockIds`. One **ceiling per room** at `elevation + height`, **skipped
  when a block sits directly above** (its floor is the ceiling). `+4 tests`: one
  block; two adjacent → one union slab; a stacked block skips the lower ceiling;
  slabs idempotent. (Clipper2 is not in the repo; the union is exact for rectilinear
  blocks and stepped otherwise.)
- **BG-03 roofs — done.** For each storey, **exposed top = union(storey footprints) −
  union(footprints of blocks above)** (`subtractPolygons`). Each exposed rectangle
  gets a roof: **shed** when the room reads as carport/terrace/canopy, else the
  setting (default **gable**); pitch 30°, overhang 600 mm, `baseZ` at the storey top,
  `sourceBlockIds`. Because the union/difference already returns **rectangles**,
  a non-rectangular region is automatically split into rectangles — the flat‑and‑
  parapet fallback is therefore unused. This **replaces the bounding‑box roof** in
  the generator. `+4 tests`: single block → gable; carport → shed; stacked block →
  exposed = lower − upper; roofs idempotent.
- **BG-04 openings — done.** Rooms are classified (`classifyRoom`: outdoor / wet /
  circulation / living / private / service). **Doors** go on shared partitions the
  adjacency rule connects (any side circulation or living; or wet↔private/
  circulation), centred, **900 mm** (**800** if either side is wet); the **main
  entrance** lands on the entrance/living room's exterior wall **nearest the site
  frontage** (site min‑Y). **Windows** on exterior walls of habitable rooms
  (skip circulation/outdoor/entrance wall): **1200 × sill 900**, but **sill 1500**
  for wet areas. Any opening that doesn't fit with a **150 mm corner margin** is
  skipped. `+5 tests`: shared‑wall door; exterior window; bathroom high window;
  too‑short wall → none; openings idempotent.
- **BG-05 stairs — done.** A block named `stair|tangga` generates one **straight run
  inside it** (along the long axis, width ≤ 1200 mm) with `floorToFloor` from the
  level; the run is on the lower level (so the plan cuts it with one "UP" and the
  level above shows it in projection, as the drawing pipeline already does). The
  stair footprint is **cut as a void from the floor slab of the storey above**.
  `+3 tests`: run width/floor‑to‑floor; upper‑floor void (6000×4000 − 2000×4000 =
  4000×4000); idempotent.
- **BG-06 override/diff + UI — done.** The generator takes an **override map**
  (stable id → `{ locked }`); a locked id is kept as‑is (no update/remove).
  `previewBlockGen` / `applyBlockGen` compute and apply the diff, and the
  **Drawings panel** has a **"Generate from blocks"** section: an
  **Auto-regenerate** toggle (off by default), the **Generate walls & roof** button
  and a **diff preview** (`+adds · ~updates · −removes`) with **Apply/Cancel**.
  Selecting a generated element shows **"Generated from ⟨blocks⟩"** and a
  **"Detach (make manual)"** button (sets `origin: "user"`). Verified in the app on
  the sample: preview **+316 / −94**, apply → 143 walls/54 slabs/46 roofs/73
  openings, **second preview 0/0/0** (idempotent).

## Known gaps to pick up next

- Synchronised side-by-side camera panes for DB-04 (overlay + table are shipped).
- Vertex add/remove UI, copy/rotate/scale, arrays (MD-05/MD-06 remainder).
- Roof forms and terracing (MD-09, P1).
- Server, auth, realtime and versions (M2/M6).
- Performance pass on the 50-mass / 6-level target; the current viewport rebuilds
  the model group on change, which is fine for small models but not the NFR goal.
