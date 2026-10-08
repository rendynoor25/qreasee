# Qreasee — State of the Build

**Date:** 3 October 2026 · **Status:** working prototype (core loop + first schematic slice) · **Where:** `D:\Qreasee\qreasee`

**Purpose of this document:** describe precisely what has been built, what has
deliberately *not* been built, and the decisions we are about to lock in — so that
others can give direction before we invest further.

---

## One-paragraph version (for forwarding)

> Qreasee is a web design-decision tool for small architecture studios. It lets
> architects sketch massing on a real site, see the *consequences* (regulation fit,
> cost range, sun) live while they decide, fork options as **Decision Branches**,
> adopt one **with a reason**, and hand it off to SketchUp/AutoCAD. A first
> prototype is built and running: the full massing→feedback→branch→adopt loop, a
> context map (OpenStreetMap), automatic schematic generation (rooms → walls →
> openings → floor/ceiling → roof) with a material library, and automatic
> Plan/Section/Elevation drawings. It is local-first (no server yet). What we need
> now is **direction**: how far down the fidelity ladder to go, how the massing
> should turn into rooms, and whether the team/collaboration layer is core.

---

## 1. What Qreasee is (from the PRD v3)

Qreasee owns the **early decision stage** where SketchUp and AutoCAD are weakest,
and hands the adopted design to them for detailing. The core promise:

> **Sketch massing on a real site, see regulation, cost and sun feedback live,
> fork and compare options, adopt one with a reason, and export it to
> SketchUp/AutoCAD.**

It is *not* trying to replace SketchUp's geometry depth. It is a **decision tool**
that keeps a record of *why* each choice was made.

---

## 2. How to try it (5-minute tour)

```bash
cd D:\Qreasee\qreasee
pnpm install
pnpm dev            # http://localhost:5173
```

1. The app opens on a sample 300 m² corner site (rules, budget, brief, one mass,
   one open decision with two branches).
2. Left toolbar is organised by **phase**: **Massing / Schematic / Drawings**.
3. Massing: draw a **rectangle, polygon, circle, ellipse or arc**; type a size
   (`3500`, `3.5m`, `4000,6000`); push/pull height; edit vertices; **rotate** like
   SketchUp (protractor); switch levels and draw again (it sits on the active level).
4. Watch the **indicator chips** and the red breach tint update live.
5. Open **Decisions**, compare branches, and **adopt** one with a rationale.
6. Switch to **Schematic**: it auto-generates rooms, walls, openings, slabs and a
   roof; click an element and assign a **material**.
7. Switch to **Drawings**: place a **section line (A–A)** and read the auto-framed
   Plan / Section / Elevation sheets.
8. Toggle **Persp / Ortho**, the **theme**, and the **language (EN/ID)**.

---

## 3. What works today

### 3.1 Site, context and rules
- Draw or type the site boundary; computed site area; mark **road edges**.
- **Rules**: KDB max, KLB max, KDH min, height max, floors max, per-edge setbacks,
  source note — all optional (missing values show "needs input", never an error).
- **Budget**: ceiling and a cost-rate range per m².
- **Brief**: free text and a program list.
- **Setback lines** dashed inside the site; **buildable area** shaded.
- **Green / paved** open-space polygons (used for KDH).
- Location (lat/lng) and **north angle**.
- **OpenStreetMap surroundings**: fetch surrounding building footprints around the
  project location and show them as grey reference massing (show/hide).
- **Map site tracing**: trace the site boundary on a 2D OpenStreetMap map and
  project it into the model.

### 3.2 Massing (2.5D)
- Footprints: **rectangle, polygon, circle, ellipse, arc/curve**; closed loops with
  **holes (courtyards)**.
- **Typed values** while drawing; typed circle radius / oval rx,ry.
- **Snapping** that "attaches": existing mass vertices, site vertices/edges,
  midpoints, grid intersections, axes, parallel alignment, and **back to the start
  point** to close a loop — with an on-canvas snap marker.
- **Push/Pull** height by drag or typed value; masses span levels.
- **Select, move, vertex-edit, rotate** (SketchUp-style protractor: pick centre →
  baseline → angle, snapping to 15°).
- **Levels** (create/rename/elevation/active) and **grids** (spacing + labels).
- **Add level above**: clone the footprint (oval/courtyard/polygon) onto the next
  level, so you can build storey by storey.
- **Undo/redo** unlimited, through one operation log.
- Drawing plane is level-aware: a new mass previews and lands at the **active
  level's elevation**, not at zero.

### 3.3 Live feedback (the differentiator)
- **Indicators** computed off the main thread after every edit: **KDB, KLB, KDH,
  setback breach, height, floors, coverage, GFA, cost range, program fit, sun**.
- Status is always text, never colour alone: **ok / near / over / under / needs
  input**; each indicator states its **fidelity** and its inputs on hover.
- **Quiet feedback while sketching**: masses crossing a setback or height limit are
  tinted red; **nothing pops up**.
- **Sun view**: facades tinted by direct-sun hours (0–8 h), with an east/west
  high-exposure share.
- **Cost is always a range** at massing fidelity, formatted in Indonesian locale
  ("Rp 2,1–2,6 miliar"); **Intent** masses widen the range.
- All indicator functions are **deterministic and unit-tested** against
  hand-calculated fixtures (concave site, courtyard, Intent range, sun bounds).
  "Rules are code, not AI."

### 3.4 Decision Branches (top feature)
- Create a **decision** (title, question, scope); create **branches** from main.
- **Switch** branches instantly; **compare** 2–4 with an indicator table (best per
  row highlighted) and an **overlay** of other branches.
- **Adopt** a branch into main **with a rationale** (required); conflicts are listed
  per mass and resolved by the adopter; adoption is atomic.
- Writing a **DecisionRecord** (chosen rationale, rejected branches + their
  indicators, rules snapshot, who, when). **Park** and **revive** branches.

### 3.5 Lenses
- **Visual / Rules / Reflect** over the same model and indicators (keys 1/2/3).
  Reflect shows brief, program fit, open decisions and decision history.

### 3.6 Schematic phase (first slice)
- **Rooms** derived from a mass (guillotine partition clipped to the footprint,
  named from the brief's target areas).
- **Walls**: exterior **150 mm**, partitions **100 mm**, with **door/window
  openings** (auto-placed) cut by splitting walls into panels (no CSG).
- **Floor and ceiling slabs** (120 mm); **roof** hip / gable / one-slope (30°
  default, 600 mm overhang).
- **Material library** of ~35 common Indonesian materials (walls, floors, ceilings,
  roofs, structure, glass, metal, wood), assigned **per element**, affecting the 3D
  colour and the drawings. Appears only in the schematic phase.
- **Select and edit elements**: click a wall / slab / ceiling / roof / room and
  assign its material; regenerate roof type and pitch.

### 3.7 Drawings and handoff
- Automatic **Plan / Section / Elevation** as SVG, each framed to ~80% of the sheet,
  with room labels, areas and overall dimensions; downloadable.
- **Section** is a real cut: the section line is intersected with walls, slabs and
  roof faces and drawn as poché.
- **Export**: DXF (AutoCAD layers Q-SITE, Q-SETBACK, Q-GRID, Q-LTn), **COLLADA**
  (SketchUp, metres, Z-up, one node per mass), **glTF/GLB**, **OBJ**, a comparison
  sheet (PNG), a decision log (Markdown + CSV), and a **`.qrs`** project file that
  round-trips with branches and records.

### 3.8 Platform and feel
- Brand orange + logo; **light and dark theme**; **English and Bahasa Indonesia**
  with Indonesian number formatting.
- **Perspective and orthographic** projection toggle; Top/Front/Iso/Fit views.
- **Pan** (straight path) and **orbit around the point under the cursor**.
- Local-first: every operation autosaves to the browser; no server needed to try it.

---

## 4. Architecture (for technical readers)

A TypeScript strict monorepo (pnpm workspaces), 7 packages, 72 source files.

| Package | Responsibility |
|---|---|
| `apps/web` | React 18 + Vite + Tailwind + Zustand + three.js client |
| `packages/shared` | Domain types, zod schemas, i18n (EN/ID), formatting, **material library** |
| `packages/geometry` | Polygon measures, **Clipper2** adapter, earcut triangulation, extrusion, setbacks |
| `packages/document` | Entities, **operation log**, branches, undo/redo, adoption |
| `packages/indicators` | Areas, regulation, program, cost, sun — pure functions + fixtures |
| `packages/schematic` | Rooms, walls/openings, slabs, roofs, **section cut**, drawings |
| `packages/export` | DXF, COLLADA, glTF/OBJ, comparison sheet, decision log, `.qrs` |

**Invariants we hold to**
- Geometry, document and indicators are free of UI/rendering imports, so they run in
  Node tests **and** in Web Workers.
- **Every edit goes through the operation log**; no component mutates the document.
- Indicators run in a **Web Worker** so sketching stays responsive.
- **Rules are deterministic functions with tests**, not AI.

**Evidence:** 50 automated tests pass (geometry 15, indicators 16, schematic 8,
document 7, export 4); strict typecheck clean across all packages; production build
succeeds. Docs: `docs/PRD.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`.

**Note:** an earlier Next.js prototype (`D:\Qreasee\qreasee-app`) exists from 2025;
this is the separate PRD-v3 monorepo and supersedes it in direction.

---

## 5. Deliberately NOT built (scope boundaries)

Per the PRD's non-goals and the local-first choice:
- **No server, accounts, sign-in, cloud storage, realtime, presence, comments, or
  named versions.** Persistence is one browser's local storage.
- **No IFC / That Open Engine, no consultant proposals/overlays, no client links.**
- **No AI advisor.**
- **No BoQ, OTTV, circulation/egress, construction documents.**
- **No texture maps or BIM element data** — materials are colour only.
- **No free-form SketchUp-class surface editing, booleans, or Follow-Me.**

---

## 6. Honest limitations (rough edges to know about)

- **Rooms are generated, not editable.** You can rename/select them and set their
  material, but you cannot yet drag a partition, split/merge rooms, or place a door
  on a chosen wall.
- **Openings are auto-placed** (one centred window per exterior edge, one centred
  door per partition).
- **Roof is generated over the footprint's bounding box**, so strongly
  non-rectangular footprints are approximated.
- **Section is single-level** (a mass is one volume); multi-storey sections need
  multi-level schematic.
- **Stacked levels are not linked**: editing the outline on Lt. 2 does not update
  Lt. 3.
- **Performance is not yet at the PRD target** (50 masses / 6 levels at 60 fps); the
  viewport rebuilds geometry on change, which is fine for small models.
- **Materials affect colour, not texture**; drawings are line-based SVG, not a full
  Layout replacement.
- Export formats are generated and open, but have not yet been verified inside the
  studios' actual SketchUp/AutoCAD versions.

---

## 7. Product decisions already locked (challenge these if wrong)

1. **Units** mm internally, m² areas, Rupiah; ID locale formatting.
2. **Cost is always a range** at massing fidelity.
3. **Branch, don't overwrite**; every adoption needs a rationale.
4. **Feedback is quiet while sketching** (colour, not dialogs); numbers come forward
   when comparing or adopting.
5. **Native units convention** +Y = north (sun math and OSM depend on it); the
   renderer reflects to match the map.
6. **Rooms are a guess, not a computed truth** — the generator is a starting point.
7. **Hand off, don't trap** — export to SketchUp/AutoCAD is a feature, not a failure.
8. **Rules are code, not AI.**

---

## 8. Open questions — where should Qreasee go? (the ask)

Please react to these. For each I've listed the options and what we'd build.

### A. Positioning: how far down the fidelity ladder?
Qreasee today is massing + a first schematic. Options:
- **A1. Stay a decision tool** — depth is the decision record, feedback and
  comparison; leave all modelling to SketchUp/AutoCAD. (Current direction.)
- **A2. Become the schematic tool** — add editable rooms, charged walls, openings,
  materials, and credible drawings, competing with SketchUp + Layout for the early
  stages.
- **A3. Go full replacement** — schematic → detailed → documentation.
*Question:* which do studios actually want, and where does the willingness to pay
sit?

### B. The mass → room bridge (my top uncertainty)
A mass has no rooms; rooms are a design decision. Options:
- **B1. Auto-generate + edit** (recommended): one-click first guess, then drag
  partitions, place doors/windows, split/merge rooms.
- **B2. Draw rooms manually** on the adopted floor plan (like SketchUp + Layout).
- **B3. Program-driven**: rooms sized from the brief automatically, architect
  fine-tunes.
*Question:* would architects trust an auto-generated room layout, or does it get in
the way?

### C. Team and collaboration
The PRD wants branches + comments + presence; the *product* question is whether
massing itself must be shared.
- **C1. Decisions are shared, not live co-editing** (recommended): branches,
  comments, decision records, presence; editing one element simultaneously is a
  non-goal.
- **C2. Real-time co-editing** of the same model.
- **C3. Solo tool** for now.
*Question:* how does a studio actually work — one person at a time, or several in
the model?

### D. Context and rules
- Are **KRK presets per city** (Jakarta, Bandung, …) worth building, or is manual
  entry fine? Do studios have their **own cost rates**, or should Qreasee suggest
  defaults? Is **OpenStreetMap context** useful, or should it be drawing/import only?

### E. Materials and BIM depth
- **E1. Colour only** (current) vs **E2. texture maps** vs **E3. element data**
  (areas, types) and eventually **IFC**.
*Question:* at the schematic stage, do you need pretty materials or measurable ones?

### F. Drawings and handoff
- How good must Plan/Section/Elevation be before it replaces **Layout**? What does
  an exported set need — dimensions, tags, a title block, PDF, sheets?
- Do studios want **gross-section export** (DXF/DAE now) or **round-trip** (import
  back from SketchUp)?

### G. Business and delivery
- Pricing: **per studio per month** or **per seat**; target range in IDR?
- Hosting: **Indonesia or Singapore** (UU PDP)?
- Which studio is the **design partner** for the pilot, and what is their single
  biggest early-stage pain?

---

## 9. What I would build next (one opinion, not a decision)

Make **rooms and walls directly editable on the plan** — drag/split/merge rooms,
place doors and windows on a chosen wall, and **link stacked levels** so editing one
outline updates the storeys. That is the piece that turns an impressive generator
into a tool an architect would work in, and it is the prerequisite for A2/B1.

Alternative next steps: (a) the **server + accounts + sharing** if team use is
confirmed; (b) **performance + 50-mass** work before a pilot; (c) **drawings polish**
and a real title block if the handoff is the value.

---

## 10. Glossary (for non-developers)

- **Massing** — simple 3D blocks representing buildings before detail.
- **KDB / KLB / KDH** — Indonesian coverage / floor-area / green-area ratios.
- **KLB** (floor area ratio) — total floor area ÷ site area.
- **GFA** — gross floor area.
- **Branch** — a parallel version of the design you can compare and adopt.
- **Fidelity** — how precise a model is; indicators state which fidelity they use.
- **Orthographic** — parallel projection; a true plan/elevation with no perspective.

---

*Prepared as an internal discussion document. Everything above reflects the actual
running build, not a roadmap claim.*
