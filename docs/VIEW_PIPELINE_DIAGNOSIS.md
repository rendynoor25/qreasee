# View pipeline diagnosis (W-08 / instruction §0)

**Status:** first pass, written after comparing `Qreasee output.pdf` with the target
`20230715 RUMAH BU ALFIA WARDAH.pdf` (reference pages cached as PNGs).

## 1. How each sheet is produced today

| Sheet | Produced by | Geometry source | Raster or vector? |
|---|---|---|---|
| Cover (A000) | `sampleHouse.ts` → `axonModelSvg` | derived axon of the entity model | vector SVG image in the sheet |
| Concept (A100) | `sampleHouse.ts` → `axonModelSvg` + `programTableSvg` | entity model | vector |
| Plans (A101–A103) | `packages/schematic` `schematicFromDoc` → `planSvg` | `DocState` entities (walls/openings/rooms/roof) | vector |
| Elevations (A104) | `schematicFromDoc` → `elevationSvg` | entity model | vector |
| Section (A105) | `schematicFromDoc` → `sectionSvg` | entity model | vector |
| PDF | `sheetSvg` → `svg2pdf` (W-07) | the sheet SVG | vector |

So the output **is** derived from the model and is **vector** — not a canvas
screenshot. The gap is not "picture vs drawing" at the plumbing level; it is that
there is **no View object**: the drawing functions take loose `DrawingContext`
(grids, levels, pen, scale) and always apply the same rules.

## 2. The core gap: no View / View Range

`planSvg` today cuts **every** wall at the plan and subtracts **every** opening,
whatever its sill. There is no:

- `ViewRange` (`top`, `cutPlane`, `bottom`, `viewDepth`) — plans default to a
  cut at level + 0.
- look direction / far clip for sections, or a front/back/left/right for elevations.
- crop region, per-view scale (scale is passed per call, not stored on a view).
- visibility rules (cut vs projected vs above-cut dashed).
- annotation ownership (grids/levels/tags are re-derived per call).

## 3. Visible gaps vs the reference (confirmed on page A101 / A103)

1. **No room names on plans.** `schematicFromDoc` filters rooms to
   `fidelity === "schematic"`; the imported rooms are `fidelity: "concept"`, so the
   plan has no room tags at all.
2. **No floor-material fills** per room (tile / wood / grass / paving).
3. **One dimension chain** (grid-to-grid) only — no overall (9000/22900) and no
   interior chain.
4. **No section / elevation markers** on plans, and no per-view **view titles**
   (`(1) DENAH LANTAI 1 · A101 · 1:100`).
5. **Elevation**: level heads are truncated ("Lantai", "Lantai 2", "Ring Ba") and a
   stray "ELEVATION" label is printed; no materials beyond a flat facade colour;
   front and side elevations were combined in one viewport (now separate frames,
   but the reference wants one view = one viewport = one title).
6. **Section**: single section; no level heads with lines, no room names, no
   vertical/horizontal dimension chains.
7. **Roof plan**: ridges/hips are drawn (W-08b) but no **slope arrows**; the scale
   bar differs between sheets.
8. **Stairs**: "UP" is printed per step run; the reference wants **one arrow per
   run**.
9. **Axon snapshot**: rendered from the **back** (the iso basis shows +Y, the rear),
   so the front facade is hidden; wall top caps overlap slabs (z-fighting) and the
   painter's sort can drop faces.

## 4. What is already right and reusable

- Entities are the single source of truth; nothing in the model holds graphics.
- `schematicFromDoc` is pure and already separates walls/slabs/openings/rooms/roof/
  stairs/railings.
- Pen weights are a paper-mm table (Studio Kit) — matches instruction §8.
- PDF is vector with selectable text (W-07).
- `roofPlanLines` (ridges/hips), `hatchSegments` (poché hatch), `axonModelSvg`.

## 5. Proposed ticket order (mirrors instruction §13)

1. **VW-01 View + ViewRange data model** (pure): `ViewRange { top, cutPlane,
   bottom, viewDepth }` on the schematic/view; default `cutPlane = 1200`.
2. **VW-02 Plan cut plane**: wall poché only where a wall crosses the cut; openings
   crossing the cut leave a gap + symbol, openings above the cut are dashed.
3. **VW-03 Plan annotations**: room names + floor fills, overall + grid + interior
   dimension chains, section/elevation markers.
4. **VW-04 View titles + markers** (circle: detail number over sheet code) with
   cross-references that follow the viewport.
5. **VW-05 Section view**: level heads with lines, room names, dimension chains,
   far clip, hidden-line removal.
6. **VW-06 Elevation view**: 4 separate views, materials, un-truncated level heads,
   remove the stray label.
7. **VW-07 Sheet layout + auto-scale**; **VW-08 3D cleanup** (SketchUp-style shaded
   with edges, opening subtraction, front-facing axon).

## 6. Ambiguities to confirm before inventing conventions

- **Front direction**: assume "front" = the side with the main entrance (−Y, the
  grid-A side with the carport/terrace)? The reference's TAMPAK DEPAN faces it.
- **Plan poché style**: solid dark fill for cut walls (reference uses a light fill
  with heavy outline) — which to adopt?
- **Scale bar style**: 0–3 m (floor plans) vs 0–5 m (roof plan) in the reference;
  the instruction says "one consistent style for all plan sheets".
- **View-title circle**: detail number on top, sheet code below (instruction §7) —
  confirm the exact text layout.

## 7. Part 2 findings (debug overlay, `?debugPlan=1`)

The overlay draws the world origin, the layer bounding boxes and the wall
centerlines. It showed:

- **Grid vs walls**: the plan already used a single transform (one `Canvas`
  mapper, Y flipped once), so the misalignment was **data**: the generator wrote
  the reference grid (0..9000 / 0..22900) while the imported IFC geometry sat at
  x −1314 / y −7694 (same spans, different origin). Fixed with `alignToGrids` in
  the generator — every layer is shifted into the grid frame. The long walls now
  land on grids C–F and the fence on grid 1.
- **Crop**: `planSvg` took its bounds from the **first** floor slab, so the crop
  cut the building and the grid looked short. Fixed to use the bbox of all
  walls/rooms/slabs; grid ends ≥1500 mm outside; sample plans fit at 1:150.

Still open (Part 2 §3–§7): three-layer dimension chains (overall/grid/interior),
per-view crop + viewport drag from the Project Browser, per-room finish materials,
one "UP" per stair, label collision avoidance, elevation markers.
