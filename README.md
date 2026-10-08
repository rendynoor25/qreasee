# Qreasee

Sketch massing on a real site, see regulation, cost and sun feedback live, fork
and compare options, adopt one with a reason, and export it to SketchUp and
AutoCAD.

This repository is the **runnable core-loop base** of Qreasee v3. It follows the
PRD's TypeScript monorepo layout and is local-first: no server or database is
needed to try it.

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

The app opens with a sample 300 m² corner site, rules, budget, brief, a compliant
3-storey mass, and one open decision with two branches to compare and adopt.

Other commands:

```bash
pnpm test         # Vitest: geometry, document, indicators, export (42 tests)
pnpm typecheck    # strict TypeScript across the workspace
pnpm build        # production build of the web app
pnpm --filter @qreasee/web e2e   # Playwright smoke test (install browsers first)
```

## The core loop

1. **Set up context** — site boundary, road edges, KDB/KLB/KDH/setbacks, budget,
   brief (Context panel, or key `2` for the Rules lens).
2. **Sketch** — Rectangle, Polygon, **Circle** and **Arc/curve** footprints, typed
   values (`3500`, `3.5m`), Push/Pull height, vertex editing. Snapping attaches to
   grid, site and mass vertices/edges, midpoints, parallel axes, and back to the
   start point to close a loop. Feedback is colour on the model and quiet chips;
   sketching never stops for a dialog.
3. **Context** — fetch surrounding building massing from OpenStreetMap
   (Site → Surroundings), show/hide it as grey reference blocks.
4. **Branch** — create a decision, spin up branches, compare them side by side or
   as an overlay, and adopt one **with a rationale**.
5. **Hand off** — export DXF (AutoCAD), COLLADA (SketchUp), glTF/OBJ, a comparison
   sheet, a decision log, or a `.qrs` project file.
6. **Go schematic** — switch the toolbar to **Schematic** to generate rooms, walls
   (with door and window openings), floor, ceiling and a hip/gable/shed roof.
   Click a wall, slab, roof or room and assign a **material** from the library.
   Switch to **Drawings** to place a **section line (A–A)** and read the automatic
   Plan / Section / Elevation sheets, each framed to ~80% of the sheet.

The left toolbar is organised by **phase**: **Massing** (rectangle, polygon, circle,
**ellipse/oval**, arc, push/pull, vertices, SketchUp-style **rotate**, and **add
level above** to stack a non-rectangular footprint storey by storey), **Schematic**
(select and edit elements, materials) and **Drawings** (section line, sheets).

The viewport has a **Persp / Ortho** toggle for parallel (orthographic) projection,
next to the Top / Front / Iso / Fit view buttons — so you can check proportion in
perspective and true dimensions in orthographic.

Mouse: **middle-drag** orbit, **Shift+middle / right-drag** pan, **wheel** zoom.
Keys: `1/2/3` lenses, `Ctrl+Z` / `Ctrl+Shift+Z` undo/redo, `Delete` remove mass,
`Esc` cancel.

## Branding

The UI accent is brand orange (`#f0913b`). The logo mark lives in
`apps/web/src/components/Logo.tsx`; it uses `currentColor` for the ring (white on
the dark theme, black on a light theme) with an orange swoosh. Standalone assets
are at `apps/web/public/logo-dark.svg` and `logo-light.svg` — replace those with
the production artwork when ready. The app is dark-theme only for now; a light
theme is not yet implemented.

## Layout

```
apps/web/                 React 18 + Vite + Tailwind + Zustand + three.js
packages/shared/          domain types, zod schemas, i18n (EN/ID), formatting
packages/geometry/        polygon measures, Clipper2 adapter, earcut, extrusion, setbacks
packages/document/        entities, operation log, branches, undo/redo, adoption
packages/indicators/      areas, regulation, program, cost, sun (pure + fixtures)
packages/schematic/       rooms, walls/openings, slabs, roof, plan/section/elevation SVG
packages/export/          DXF, COLLADA, glTF/OBJ (in web), comparison sheet, decision log, .qrs
docs/                     PRD.md, DECISIONS.md, PROGRESS.md
```

Geometry, document and indicators are free of UI/rendering imports so they run in
Node tests and in Web Workers. Every edit goes through the operation log; no
component mutates the document directly.

## What is and isn't built

See `docs/PROGRESS.md` for a requirement-by-requirement status. In short: M0, M1,
M3, M4, the M5 decision-branch loop and M6 export work, and a first schematic
slice (rooms → walls/openings → slabs → roof → automatic drawings) is in place;
accounts, realtime, comments, versions, IFC and the later fidelity releases are
reserved.
`docs/DECISIONS.md` records the assumptions and the Clipper2 workarounds.
