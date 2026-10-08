# Qreasee Direction v5: Reproduce a Revit-quality sheet set

Audience: OpenCode (and any agent working in `D:\Qreasee\qreasee`).
Read first: `PROGRESS.md`, `DECISIONS.md`, and the architecture invariants in the PRD / Direction v4 §3.
All earlier rules still apply: every user action goes through the op log and is undoable, branches carry the whole document, no invented regulation, deterministic code (no AI in drawing generation), each ticket ends with `pnpm typecheck && pnpm test`, and every decision is logged in `DECISIONS.md` (date · choice · alternatives · reason).

## 1. Goal and acceptance test

Qreasee must output a PDF sheet set equivalent to the reference set `20230715_RUMAH_BU_ALFIA_WARDAH.pdf` (made in Revit), from a model authored inside Qreasee, with no SketchUp or AutoCAD.

**Acceptance test ("sample-house test"):** one architect recreates the reference house in Qreasee and exports a vector PDF containing:

| Sheet | Content | Scale |
|---|---|---|
| Cover | 3D view, project name, "Pengukuran dan Dokumentasi Bangunan Eksisting" | n/a |
| A101 | Plan level 1 and plan level 2 on one sheet | 1:100 |
| A102 | Roof plan | 1:100 |
| A103 | Front elevation | 1:50 |
| A104 | Right and left elevations | 1:100 |
| A105 | Section A-A' and B-B' | 1:100 |
| A106 | Section C-C' and D-D' | 1:100 |

Reference data to build the fixture from the PDF:
- Grid X (1-2-3): 5200, 3800 (total 9000). Grid Y (A to F): 5100, 3000, 6100, 5300, 3400 (total 22900).
- Levels: Lantai 1 FFL 0, Lantai 2 FFL +3600, Ring Balok +7000.
- Ground floor rooms: Teras (front), KT. Anak, KM/WC, R. Keluarga, R. Makan, Dapur, Gudang, R. Cuci/Jemur, Teras (rear), plus carport and a stair on the east side.
- First floor rooms: KT. Utama, Wardrobe, KM/WC (x3), R. Tengah, KT. Anak (x2), KT. ART, a balcony and a stair void.
- Hip roof with overhang; stone cladding and plaster on the facade; right-hand title block (Nama Proyek, Pemberi Tugas, Konsultan Perencana, Digambar/Diperiksa, Judul Gambar, Skala/Tanggal, Kode Gambar, No Lembar).

## 2. What exists and what is missing

Already built (do not rebuild): op log, branches, layers, groups, levels, grids as `DocState` entities, Project Browser with views, Studio Kit with title-block fields, Sheets editor (D-02), grid bubbles and grid dimension chains and level markers (D-04), raster multi-page PDF via `jspdf` (D-03), DXF/DAE/glTF export, material library with textures.

Missing, in order of importance:
1. Walls, openings, slabs, roof, schematic rooms and stairs are **derived** and live in the app store, not in `DocState` (the "B-01 / schematic as a document entity" debt). The architect cannot author or edit a plan.
2. One level per mass: no multi-level plans or sections, no stairs.
3. PDF is raster, not vector, and drawings are not at true print scale (1:100 / 1:50).
4. Annotation is partial: no auto dimension strings beyond grid chains, no section marks with sheet references, no room/door/window tags, no north arrow or scale bar.
5. Plan graphics are not yet "Revit-like": line weights, poché, door swings, window symbols, stair symbol.

## 3. Technology recommendations

**Keep (do not switch):** TypeScript, React 18, Vite, pnpm monorepo, three.js (3D and the orthographic plan view), Clipper2-js (polygon union/offset), earcut, Vitest, Playwright, SVG as the drawing format, local-first persistence until the sheet set works.

**Add (small):**
- `svg2pdf.js` together with the existing `jspdf` for **vector** PDF. Do a one-day spike first. Constraints: use plain paths, text and hatch lines; avoid SVG filters, masks and blend modes; embed an open-licence TTF font (for example Inter or Roboto) so text is real and selectable.
- `pdfjs-dist` in tests only, to assert PDF page size, page count and extractable text.
- Playwright `toHaveScreenshot` for visual regression of the sheet set; keep the golden images in `e2e/__golden__/`.
- A reference fixture project (`fixtures/wardah-house.qrs`) as the single source for tests and demos.

**Do not add now:** OpenCascade, CSG or BREP kernels (Clipper2 plus panel splitting is enough for low- to mid-rise); IFC / That Open Engine (keep reserved; revisit for Revit handoff); Konva, Fabric or PixiJS (reuse the three.js orthographic Plan view with an SVG overlay for annotation); server-side PDF rendering such as Puppeteer; Yjs as the document model (it fights the op log, undo and branches); any AI step inside drawing generation.

**Collaboration (after the sheet set works):** keep the op log as the source of truth. Use the PRD's Fastify + WebSocket gateway + Postgres, with the **server ordering operations** and last-writer-wins per property, element-level soft locks and presence. Yjs may be used later for comment text only. Decide this at the G-phase, after pilots with real studios.

## 4. Milestones (build in this order)

Each ticket needs: Vitest tests, one Playwright check where UI changes, a `PROGRESS.md` entry and a `DECISIONS.md` entry.

### W-00 Fixture and acceptance harness
- Build `fixtures/wardah-house.qrs` (grids, levels, rooms, walls, openings, stairs, roof as far as the current model allows; fill the rest as later tickets land).
- Add a test that loads the fixture, generates the sheet set and checks page count, sheet numbers and titles. Mark unfinished checks as `todo`, not as failing.
- **Done when:** `pnpm test` shows the sample-house test with every missing capability listed as a `todo`.

### W-01 Schematic entities become document state (B-01, keystone)
- Add to `shared` and `DocState`: `Wall` (centreline, thickness, height, type/material, level), `Opening` (door/window on a wall: offset, width, sill, head, swing/flip), `Slab`, `Roof`, `Stair`, and schematic-fidelity `Room` (polygon, name, area).
- Ops: `wall.add|update|remove`, `opening.add|update|remove`, `slab.*`, `roof.*`, `stair.*`, `room.*`; all undoable and branch-aware. Keep the stable id scheme (`wall-ext-{ring}-{edge}` etc.).
- The existing generator becomes **"Generate starter from mass"**: it writes entities once, tagged `origin: "generated"`. Regeneration only replaces untouched generated elements; anything the user edited (`origin: "user"`) is never overwritten.
- `.qrs` formatVersion bump with a migrator that never throws.
- Drawings, 3D and DXF read from `DocState`, not the app store.
- **Done when:** edit a wall, regenerate, and the edit survives; undo/redo and branch adoption carry walls.

### W-02 Multi-level model and stairs
- Elements belong to a level; one plan per level; the roof sits over the top level only.
- Stair entity (straight and L with landing), computed from floor-to-floor height (rise/run shown as a derived value, not a hard-coded standard); floor void over a stair.
- Sections and elevations span all levels.
- **Done when:** the fixture shows two plans, a stair, and a section that cuts both floors.

### W-03 Plan authoring tools
- In the orthographic Plan view: draw wall by click (centreline snapped to grid, wall ends and midpoints); typed length; wall type chooses thickness (defaults 150 exterior / 100 partition, editable).
- Wall joins (corner, T) by Clipper2 union of offset polygons.
- Draw a room polygon, and its bounding walls are generated; moving a wall updates the room.
- Place door/window on a wall (offset, width, flip); column; canopy (slab without walls); railing (line with height).
- **Done when:** one architect draws the sample-house ground floor plan using only these tools.

### W-04 Plan graphics quality
- Pen table in paper millimetres, shipped as **starter values** editable in the Studio Kit: cut 0.35, projection 0.18, annotation 0.13, grid 0.09 (dash-dot).
- Cut walls as solid poché, door swing arcs, window symbol, stair with direction arrow and UP/DN, room fills from material colour, simple fixture symbols (WC, carport car, sofa) from a small SVG symbol library.
- **Done when:** the generated A101 plan is visually comparable to the reference at 1:100 (Playwright golden).

### W-05 Annotation generated from the model
- Auto dimension strings per plan side: openings, grid-to-grid, overall; toggles per view; manual override allowed.
- Room tags (name and area in m²), door/window tags (D1, W1), north arrow, scale bar, leaders and text notes.
- **Section line entity** (name A-A', direction, extent) with a **section mark that shows the sheet number** where the section view is placed (for example A105). Same for elevation marks.
- **Done when:** the section marks on A101/A102 show the right sheet numbers after you move views between sheets.

### W-06 True print scale and Indonesian title block
- A placed view stores `scale` (1:50, 1:100, 1:200). Drawings are generated in model millimetres; the sheet converts so 1 paper mm equals `scale` model mm. Line weights stay in paper mm.
- View frame can crop and move; several views per sheet; drag views between sheets.
- Title-block preset "right-hand column" (fields listed in section 1), bilingual labels, filled from the Studio Kit; sheet numbering by Studio Kit prefix (A101...).
- Cover sheet item: capture the 3D viewport as an image and place it.
- **Done when:** a printed A3 at 100% measures correctly with a ruler (a 9000 mm grid span is 90 mm on a 1:100 sheet).

### W-07 Vector PDF export
- Replace the rasterised export with `svg2pdf.js`: one SVG tree per sheet (inline the drawing SVG as a nested group, not a `data:` `<image>`), embedded font, correct paper size.
- Tests with `pdfjs-dist`: page size, page count, text extractable, file size under an agreed budget.
- **Done when:** zooming into the PDF stays crisp, and text can be searched and selected.

### W-08 Roof plan, elevations and handoff
- Roof plan with ridges/hips and overhang from the `Roof` entity; elevations from entities with material fills (hatch for stone cladding) and visible railing/canopy.
- Extend DXF export to walls, openings, grids and annotations on studio layers (`A-WALL`, `A-DOOR`, `A-GLAZ`, `A-GRID`, `A-ANNO`), so AutoCAD users can still take the linework.
- **Done when:** A102, A103 and A104 match the reference in content, and the DXF opens in AutoCAD/LibreCAD with sensible layers.

### W-09 Run the sample-house test with a real architect
- Time one architect from a pilot studio recreating the house and exporting the full set. Record the time, the blockers and the manual workarounds in `DECISIONS.md`.
- Turn each blocker into a ticket. Only then plan collaboration.

### After W-09
G-phase: server, auth, realtime co-editing (section 3), then comments and named versions. Optional wedge: an existing-building survey mode (trace over a photo or scan, typed dimensions) using the same entities.

## 5. Working rules for this phase

- Do not build W-03 before W-01 is done; anything authored before entities are in `DocState` has to be rewritten.
- Keep `@qreasee/schematic` and the drawing generators pure and deterministic; pass document context (grids, levels, sections) in, as D-04 already does.
- Regulated or standards-based numbers (pen weights, stair rise/run, wall thickness) are labelled starter values with a visible basis, never presented as code compliance.
- If a ticket cannot meet its "Done when", write the gap in `DECISIONS.md` instead of lowering the bar silently.
