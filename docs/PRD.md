# Qreasee — Product Requirements Document v3
Oct 1, 2026 · @Rendy
## What changed from v2
v3 narrows the MVP to one loop: playful massing, live context feedback, Decision Branches, and handoff to the studios' existing SketchUp/AutoCAD workflow.

| Area | v2 | v3 |
| Core promise | Explore alternatives and keep the reason for every decision | Play freely, see the consequences when deciding, keep the reason |
| Users | Personas by role | Personas by role plus three thinking styles: visual-intuitive, parametric-systemic, conceptual-reflective |
| Feedback | Regulation indicators, cost range (P1) | Regulation, cost range and sun/orientation in MVP; BoQ, OTTV and circulation in later releases, unlocked by fidelity |
| Interface | One workspace | One model, three lenses (Visual, Rules, Reflect) over the same data |
| Scope | Ideation to consultant handoff, incl. IFC, guest proposals, AI advisor | Ideation to adopted massing; handoff by export. IFC, consultant proposals and AI advisor move to Release 2+ |
| BIM layer | web-ifc directly | That Open Engine for IFC read/write and BIM viewing (from Release 2) |
| Relationship to SketchUp/AutoCAD | Replace over time | Hand off in MVP: export to formats SketchUp and AutoCAD open |

## 1. Overview
Qreasee is a web-based design decision tool for small architecture studios. It lets architects sketch building masses playfully, shows the consequences of each option against the site's rules and budget at the moment they decide, and remembers why each choice was made.
Problem. Studios of 3–10 people design houses, shophouses, cafés, small offices, retail fit-outs and renovations, mostly in SketchUp and AutoCAD. In the early stage, three things go wrong:
Rules and numbers arrive late. KDB, KLB, setbacks and budget are checked by hand, or only when drawings are already detailed, so options get reworked.
Options live in file names ("final_rev3_OK"), WhatsApp threads and screenshots, so comparing them is slow and the reasons behind a choice are lost.
Tools demand precision too early. A guess drawn on day one quietly becomes a decision.
Vision. Qreasee understands the project's context and rules, keeps the architect playful at the front, and shows the consequences (regulation fit, cost, comfort, circulation) as the design is decided. Detail is added step by step, from intent to detailed design, only when a decision has been made.
Positioning. Qreasee does not try to replace SketchUp or AutoCAD in the MVP. It owns the early decision stage, where those tools are weakest, and hands the adopted design to them for detailing. Later releases move further down the ladder (schematic, then detailed) as the pilot proves value.
MVP in one sentence. Sketch massing on a real site, see regulation, cost and sun feedback live, fork and compare options, adopt one with a reason, and export it to SketchUp/AutoCAD.
## 2. Product principles
Playful at the front. Sketching never stops for a dialog or a required field. Feedback while sketching is quiet and visual (a tint, an outline), never a popup.
Consequences when deciding. Numbers come forward when the architect compares or adopts options, not while they are playing.
Honest by fidelity. An indicator is shown only at the precision the model supports: a massing gets a cost range, never a single figure. Each indicator states its fidelity.
Defer detail. New work starts at the lowest fidelity that makes sense. Detail is added only after a decision.
Branch, do not overwrite. A real choice becomes a decision with branches. Unchosen branches are parked, never deleted.
Every decision keeps its why. Adopting a branch requires a short rationale.
One model, three lenses. Visual, Rules and Reflect views show the same model and the same indicators in the form each thinking style needs.
Hand off, don't trap. Everything adopted exports cleanly to SketchUp and AutoCAD. Studios keep their downstream workflow.
Rules are code, not AI. Regulation and cost indicators are deterministic functions with unit tests. Any AI in later releases advises in text only and never edits the model.
## 3. Users
Qreasee designs for three thinking styles (from Dr. Arman Wu's typology) and five roles. Style describes how someone thinks; role describes what they are responsible for. Any role can have any style.
3.1 Thinking styles

| Style | How they work | What Qreasee gives them | Lens |
| Visual-intuitive | Think by seeing and making; sketch, push volumes, judge by eye | Direct manipulation, no required fields, feedback as color on the model (setback breach tinted, facades tinted by sun) | Visual |
| Parametric-systemic | Think in rules, grids, modules, ratios | Context and rules panel, typed values and sliders that drive massing, live numeric indicators, grid-driven edits | Rules |
| Conceptual-reflective | Think in ideas, narrative and reasons; weigh options deliberately | Brief and intent notes, decision questions, side-by-side comparison, rationale and decision history | Reflect |

Assumption to validate: visual-intuitive is the largest group in small Indonesian studios, so the default lens is Visual and the first-run experience must feel like sketching, not data entry. There is no census data behind this; the pilot tests it by watching how each principal starts a project.
3.2 Roles

| Role | Responsibility | Main jobs in the MVP | Access |
| Principal | Direction, client, approval | Set context, frame decisions, compare, adopt | Owner / Admin |
| Project architect / junior | Develop options | Sketch massing, create branches, prepare comparisons, export | Editor |
| Consultant (structure, MEP) | Technical input | View and comment through a link (proposals in Release 2) | Guest |
| Client | Choose between options | View a comparison link | Viewer (P1) |

Typical studio: 3–10 people, mixed Windows laptops and MacBooks, integrated or mid-range GPUs, variable office internet, fluent in SketchUp and AutoCAD.
3.3 Pilot studios (design partners)
The principals of all three studios are friends of the product owner. Notes are hypotheses to confirm in interviews.

| Studio | What public sources suggest | Hypothesis to test |
| Saka Studio | Architecture-based creative studio; recent work includes retail facade and renovation projects | Fast facade and massing options under tight budgets; cost range and decision records matter most |
| Kalua Studio | Bandung; architecture, landscape, interior design and interior styling; blends local character with modern aesthetics | Decisions span architecture, landscape and interior; the Reflect lens and brief may matter more than handoff |
| Studio Talk Design | Not yet reviewed | To fill in after an interview |

First interview question for each principal: "Where in a project do you lose the most time, or make decisions you later regret?" If the answers point to detailing rather than early decisions, revisit this PRD before building M3.
## 4. MVP core loop (top feature)
The MVP is one loop, and Decision Branches (step 3) is its centre. Each step serves a thinking style: sketching for the visual-intuitive, rules and numbers for the parametric-systemic, comparison and rationale for the conceptual-reflective.
MVP core loop · 5 steps
Feedback runs underneath steps 2 and 3: quiet color while sketching, full indicator table when comparing. After adoption the massing exports to the studio's existing tools for detailing.
Example. A principal sets up a 300 m² corner site with KDB 60%, KLB 1.8, 4 m front setback and a Rp 2 miliar budget. A junior sketches a 3-storey mass; it tints red where it crosses the setback. The team forks three branches: L-shape, courtyard, and compact with a terrace. The comparison shows KLB, cost range and west-facade sun exposure side by side. The principal adopts the courtyard with "meets KLB with margin and keeps the west facade short". The junior exports it to SketchUp and continues.
## 5. Goals, non-goals and success metrics
MVP goals
An architect can set up a real site (boundary, rules, budget) in under 15 minutes.
An architect can sketch a 2–4 storey massing on that site in under 30 minutes, with no required fields.
Regulation fit, cost range and sun exposure update within 200 ms of each edit.
A team can create, compare and adopt 2–4 massing options for a decision in one session.
Every adopted decision stores a rationale, the rejected options and the rules that applied.
The adopted massing opens in SketchUp and AutoCAD with levels and grid intact.
Non-goals for MVP
Detail drawings, construction documents, BoQ with unit prices, OTTV, circulation analysis (Release 2–3).
IFC export and import, consultant proposals, overlays (Release 2).
AI advisor of any kind (Release 3).
Style kits and facade modules (Release 3).
Free-form SketchUp-class face editing, booleans, Follow Me.
Real-time co-editing of the same element; native desktop or mobile apps; photorealistic rendering.
Certifying regulatory compliance. Indicators are guides; the permit process (PBG) stays the architect's responsibility.
Success metrics (pilot)

| Metric | Target |
| Studios running a real project's early stage in Qreasee | ≥ 2 of 3 within 8 weeks of MVP |
| Decisions with at least 2 branches per pilot project | ≥ 3 |
| Adopted decisions with a rationale | ≥ 80% |
| Time to prepare 3 massing options for a client meeting vs current method | Baseline in week 1; target ≥ 40% faster |
| Principal can explain a choice made 4+ weeks earlier using only Qreasee | ≥ 4 of 5 sampled decisions |
| Adopted massings exported and continued in SketchUp or AutoCAD | ≥ 1 per pilot project |
| Weekly active members per studio | ≥ 70% |
| Willingness to pay | ≥ 2 of 3 pilot studios plus ≥ 1 of 2 outside studios say yes at target price |

## 6. Platform and architecture
Qreasee is a browser app first, built as a TypeScript monorepo. Web delivery makes branches, comments and comparison links natural, needs no installers, and suits a per-studio subscription; a Tauri desktop wrapper can follow later from the same code.
Qreasee v3 architecture · browser client and server
The UI dispatches operations to the document store. Geometry, indicators and export run in Web Workers so sketching never stutters. Operations go to the API for storage and to the realtime gateway for other viewers of the same branch.
6.1 Stack

| Layer | Choice | Notes |
| Language, monorepo | TypeScript strict; pnpm workspaces + Turborepo | Shared types between client and server |
| Frontend | React 18, Vite, Radix UI, Tailwind CSS, Zustand | Zustand for UI state only; model lives in the document store |
| 3D | three.js (WebGL2) | Camera-relative rendering; per-face color for tints |
| Polygon operations | Clipper2 (JS or WASM port) | Unions, differences, offsets for coverage, GFA and setbacks |
| Triangulation | earcut | Footprints with holes |
| Solar position | SunCalc | Sun altitude and azimuth per sample |
| Workers | Web Workers + Comlink | Geometry, indicators, export |
| Export | dxf-writer; three.js GLTFExporter and OBJExporter; COLLADA writer | For COLLADA, use a maintained library if one exists; otherwise a small custom XML writer with round-trip tests |
| Backend | Node.js 20, Fastify, tRPC, Zod; PostgreSQL + Drizzle ORM | Operations, branches, decisions, records |
| Realtime | WebSocket (ws); Yjs considered for Release 2 | Broadcast per branch |
| Storage, auth | S3-compatible (Cloudflare R2 or AWS S3); Better Auth or Auth.js | Email and Google sign-in |
| i18n, testing | i18next; Vitest, Playwright | English and Bahasa Indonesia |
| BIM layer (Release 2) | That Open Engine (@thatopen/components, Fragments, web-ifc) | IFC import and export, viewing consultant models, element properties; not used for sketch modeling |

6.2 Role of That Open Engine. It is an MIT-licensed BIM toolkit on three.js, with web-ifc (MPL-2.0) for reading and writing IFC. It suits Qreasee's BIM end in Release 2: consultant IFC files, IFC export, large-model viewing. It is not a sketch modeling kernel, so massing, branches and indicators stay in Qreasee's own packages. Keep the viewport on plain three.js so the engine can be added later without a rewrite.
6.3 Repository layout
qreasee/  apps/    web/            # React client: shell, lenses, viewport, tools, decision UI    server/         # Fastify + tRPC API, realtime gateway  packages/    geometry/       # footprints, extrusion, triangulation, polygon ops (no UI imports)    document/       # entities, operations, op log, branches, adoption, undo/redo    indicators/     # regulation, area, program, cost, sun (pure functions + fixtures)    export/         # DXF, COLLADA, glTF, OBJ, comparison sheet, decision log, .qrs    shared/         # types, zod schemas, i18n strings  docs/    PRD.md  DECISIONS.md  PROGRESS.md
## 7. Data model
The project is a document of typed entities changed only through operations. Units are millimetres and square metres internally; display units are configurable. Entities marked R2+ are reserved: define the type now, build the feature later.

| Entity | Key fields | Notes |
| Studio, User | roles per studio: owner, admin, editor, guest, viewer; preferredLens | Billing and permission boundary |
| Project | studioId, name, location {lat, lng}, northAngle, units, buildingType | One building per project |
| Site | boundary polygon, roadEdges[] (edge index + road name), area (computed) | Road edges drive front setbacks |
| Rules | kdbMax %, klbMax, kdhMin %, heightMax m, floorsMax, setbacks {edgeIndex: mm}, source note | Entered by the user from the KRK or local regulation |
| Budget | ceiling or range (Rp), ratePerM2 {low, high} by buildingType | Rates are user-entered |
| Brief | text, program[] {name, targetArea m², level?} | Used by the Reflect lens and program indicator |
| Level | name, elevation, floorToFloor | e.g. "Lt. 1" at +0.00 |
| Grid | axis, label, offset | A, B, C / 1, 2, 3 |
| Mass | levelId, footprint polygon (with holes), height or levelSpan, use (program name, optional), fidelity, intent {} | The MVP's main object; an extruded footprint |
| Zone | levelId, polygon, programName | Program areas inside masses (P1) |
| Decision | title, question, scope (mass/zone ids or a level), status: open, deferred, decided |  |
| Branch | decisionId, name, color, parentBranchId, baseVersion, owner, status: exploring, proposed, adopted, parked | Main is itself a branch |
| DecisionRecord | decisionId, chosenBranchId, rationale, rejected[] {branchId, thumbnail, indicators}, rulesSnapshot, by, at | Immutable; corrections are new records |
| IndicatorResult | branchId, version, key, value or range, status: ok, near, over, fidelity | Computed, cached; never edited |
| Comment | anchor (point, mass, branch or decision), camera view, thread[], status |  |
| Version | label, createdBy, snapshotRef | Named save points |
| Element, Material, Proposal, Overlay, AdvisorNote | R2+ | Walls, slabs, openings, consultant input, AI notes |

Storage. Each branch is an append-only operation log forked from a base version of main. The state of a branch is the nearest snapshot plus later operations. Adopting a branch appends its operations for the scoped entities to main; if main changed those entities after the fork, the adopter picks per entity. Undo/redo, versions and branches share this one mechanism.
File format. A documented, versioned .qrs zip with project.json, binary geometry buffers and thumbnails, including branches and decision records.
## 8. Functional requirements (MVP)
IDs are referenced in commits, tests and docs/PROGRESS.md. P0 = required for MVP; P1 = MVP if time allows.
8.1 Viewport

| ID | Priority | Requirement |
| VP-01 | P0 | Orbit, pan, zoom (middle-drag orbit, Shift+middle pan, wheel zoom to cursor); touchpad gestures. |
| VP-02 | P0 | Perspective and parallel projection; top, front, back, left, right, iso views. |
| VP-03 | P0 | Ground plane, axes, adaptive grid, north arrow from Project.northAngle. |
| VP-04 | P0 | Display modes: shaded, wireframe, X-ray. |
| VP-05 | P0 | Fidelity rendering: Intent masses translucent, Massing solid white, so open questions are visible at a glance. |
| VP-06 | P1 | Sun shadows for a chosen date and time at the project location. |

8.2 Site and context

| ID | Priority | Requirement |
| CX-01 | P0 | Draw or type the site boundary polygon; computed site area; mark which edges face a road. |
| CX-02 | P0 | Set location (lat, lng) by typing or picking on a map; set north angle. |
| CX-03 | P0 | Rules panel: KDB max, KLB max, KDH min, height max, floors max, setback per site edge, source note. |
| CX-04 | P0 | Budget: ceiling or range in Rp, and a cost rate range per m² for the building type. |
| CX-05 | P0 | Brief: free text and a program list (space name, target area, optional level). |
| CX-06 | P0 | Setback lines drawn on the ground as dashed offsets inside the site boundary; buildable area shaded. |
| CX-07 | P1 | Import a site boundary from DXF. |
| CX-08 | P0 | Draw open-space polygons on the site tagged green or paved; used for KDH. |

8.3 Massing (2.5D)

| ID | Priority | Requirement |
| MD-01 | P0 | Draw footprints on the active level: line/polyline, rectangle, circle, polygon. Closed loops form faces, including holes (courtyards). |
| MD-02 | P0 | Typed values after starting a tool: 3500, 3.5m, 4000,6000. |
| MD-03 | P0 | Inference: endpoint, midpoint, edge, axis, parallel/perpendicular, grid intersection, setback line, site edge; snap tooltip and guide lines. |
| MD-04 | P0 | Push/Pull a footprint to a height or through N levels; typed distance supported. |
| MD-05 | P0 | Select, move, copy, rotate, scale; linear and radial arrays by typed count; offset footprint edges. |
| MD-06 | P0 | Edit a footprint's vertices and edges after creation (drag vertex, move edge, add/remove vertex). |
| MD-07 | P0 | Optional "use" label per mass from the brief's program list; never required. |
| MD-08 | P0 | Undo/redo, unlimited, through the operation log. |
| MD-09 | P1 | Step back upper levels (terracing) and simple roof forms: flat, mono-pitch, gable, hip on a footprint. |

8.4 Levels and grids

| ID | Priority | Requirement |
| LG-01 | P0 | Create, rename and set elevations for levels; active level; isolate or hide levels. |
| LG-02 | P0 | Grids by spacing input (X: 4000,4000,5000; Y: 6000,6000) with labels A, B, C / 1, 2, 3. |
| LG-03 | P0 | Levels and grids are snap targets. |

8.5 Live feedback

| ID | Priority | Requirement |
| IN-01 | P0 | Compute the regulation, area, cost and sun indicators in section 9 for the active branch after every operation, off the main thread, within 200 ms. |
| IN-02 | P0 | While sketching (a tool is active), show feedback only on the model: masses crossing a setback or height limit tinted red; nothing pops up. |
| IN-03 | P0 | Indicator bar: compact chips (KDB, KLB, KDH, height, GFA, cost) colored ok / near (≥ 90% of limit) / over. Collapsible; collapsed by default in the Visual lens. |
| IN-04 | P0 | Sun view toggle: facades tinted by direct-sun exposure (section 9.4). |
| IN-05 | P0 | Every indicator shows its fidelity and inputs on hover ("Cost range from GFA × rate; Massing fidelity"). |
| IN-06 | P0 | Missing inputs produce a quiet "needs input" chip, never an error (e.g. no budget set). |

8.6 Lenses

| ID | Priority | Requirement |
| LN-01 | P0 | Three lenses over the same model: Visual, Rules, Reflect. Switch with one click or keys 1/2/3; remembered per user. |
| LN-02 | P0 | Visual: full-screen viewport, minimal toolbar, feedback as color only. |
| LN-03 | P0 | Rules: viewport plus a side panel with rules, typed dimensions of the selected mass, and live indicator table. Editing a value in the panel updates the model. |
| LN-04 | P0 | Reflect: brief and program, open decisions, branch comparison and decision history, with the viewport smaller. |

8.7 Fidelity

| ID | Priority | Requirement |
| FD-01 | P0 | Fidelity per mass: Intent, Massing (MVP). Schematic and Detailed are reserved for Release 2–3. |
| FD-02 | P0 | New masses start at Massing; a mass can be marked Intent ("something about this size goes here") with range values for height and area. |
| FD-03 | P0 | Indicators use the low and high ends of Intent ranges and show a range. |

8.8 Decision Branches (top feature)

| ID | Priority | Requirement |
| DB-01 | P0 | Create a decision: title, question, scope (selected masses, a level, or whole building). |
| DB-02 | P0 | Create a branch from main or another branch; name and color; unlimited per decision. |
| DB-03 | P0 | Branch owner and status: exploring, proposed, adopted, parked. Switching branch changes the viewport instantly. |
| DB-04 | P0 | Compare 2–4 branches: side-by-side synced cameras or overlay with differences colored, plus an indicator table with the best value per row highlighted. |
| DB-05 | P0 | Adopt (owner/admin): replace the scoped part of main with the branch; conflicts listed per mass and resolved by the adopter. Atomic. |
| DB-06 | P0 | Adoption requires a rationale of at least one sentence; writes a DecisionRecord with rejected branches, their thumbnails and indicators, and a rules snapshot. |
| DB-07 | P0 | Parked branches stay in the decision history and can be revived as a new branch. |
| DB-08 | P1 | Defer a decision with a revisit note or date; deferred decisions listed on the project home. |
| DB-09 | P1 | Client comparison link: read-only page with 2–4 branches, thumbnails and key indicators. |

8.9 Team

| ID | Priority | Requirement |
| TM-01 | P0 | Roles owner, admin, editor, guest, viewer; invite by email. |
| TM-02 | P0 | Edits reach other viewers of the same branch within 2 s; presence shows who is on which branch. |
| TM-03 | P0 | Different branches need no lock; within one branch, soft lock per mass while it is being edited. |
| TM-04 | P0 | Pinned comments on a point, mass, branch or decision; stores camera view; threads, @mentions, resolve. |
| TM-05 | P0 | Named versions and restore. |

8.10 Export, import and accounts

| ID | Priority | Requirement |
| EX-01 | P0 | Export DXF: site boundary, setback lines, grid, and footprints per level on separate layers (Q-SITE, Q-SETBACK, Q-GRID, Q-LT1…). Opens in AutoCAD. |
| EX-02 | P0 | Export COLLADA (.dae) with one group per mass, named by level and use, plus site and grid. Opens in SketchUp with correct scale and orientation. |
| EX-03 | P0 | Export glTF/GLB and OBJ. |
| EX-04 | P0 | Export a comparison sheet (PNG) for a decision: branch thumbnails and indicator table. |
| EX-05 | P0 | Export decision log as Markdown and CSV. |
| EX-06 | P0 | Import/export .qrs with branches and decision records. |
| EX-07 | P1 | Import DXF lines as an editable reference on a level (existing building, neighbor outlines). |
| PA-01 | P0 | Sign in with email and Google; create a studio; invite members. |
| PA-02 | P0 | Project list with thumbnail, last edited, owner. |
| PA-03 | P0 | Autosave every operation. |
| PA-04 | P0 | Interface in English and Bahasa Indonesia. |

## 9. Indicator specifications
All indicators are pure functions in packages/indicators: input is a branch state plus Site, Rules, Budget and Brief; output is an IndicatorResult. Each function has unit tests against hand-calculated fixtures, including concave sites, courtyards and Intent ranges.
9.1 Areas
Site area = area of the site polygon.
Coverage area = area of the 2D union of all mass footprints projected onto the ground plane.
GFA (gross floor area) = sum over levels of the area of the union of footprints of masses present on that level. A mass spanning levels 1–3 counts on each of those levels.
Green area = sum of site polygons tagged green (CX-08).
Polygon unions and differences use Clipper2 (JS port); areas in m² rounded to 0.01 for display only.
9.2 Regulation

| Indicator | Formula | Status |
| KDB (building coverage ratio) | coverage area ÷ site area × 100% | ok below 90% of max; near 90–100%; over above max |
| KLB (floor area ratio) | GFA ÷ site area | same thresholds against KLB max |
| KDH (green area ratio) | green area ÷ site area × 100% | over if below min; near within 10% above min. If no green polygons exist, show "needs input" plus the upper bound (site area − coverage area) |
| Height | highest mass top elevation − level 1 elevation (m) | against height max |
| Floors | number of levels containing at least one mass | against floors max |
| Setback | buildable area = site polygon minus a strip along each site edge with that edge's setback width; breach = any footprint area outside the buildable area greater than 0.01 m² | over on any breach; the breaching mass is tinted red and the breach area shown |

9.3 Program and cost
Program fit: per program item, sum of footprint areas of masses labeled with that use (per level), against the target area. ok within ±10%, near within ±20%, otherwise over/under.
Cost range = GFA × rate low to GFA × rate high. Against a budget ceiling: ok if the high end ≤ ceiling; near if the ceiling falls inside the range; over if the low end > ceiling.
Format in Indonesian locale, e.g. "Rp 2,1–2,6 miliar". Always a range at Massing fidelity.
Intent masses: compute with the low and the high ends of their ranges and widen the result accordingly.
9.4 Sun exposure
For each vertical exterior face of each mass, compute hours of direct sun on 21 March, 21 June and 21 December, sampling every 30 minutes between sunrise and sunset, using a solar position library (SunCalc) at the site latitude and longitude, corrected by the north angle.
A face counts as sunlit at a sample when sun altitude > 0 and the dot product of face normal and sun direction > 0. MVP ignores shading by other masses and neighbors (P1: ray-cast shading between masses).
Output per face: average direct-sun hours across the three days. Tint scale 0–8 h. Summary indicator: facade area split into low (< 2 h), medium (2–4 h) and high (> 4 h) exposure, with the share of high exposure on east- and west-facing faces called out.
Near the equator (Jakarta is about 6° S) north and south facades both receive seasonal sun; east and west facades carry the heat risk. The tint makes that visible without numbers.
9.5 Later indicators (not MVP)
Release 2 (Schematic): rough quantities by element (m² wall, m² slab, m³ structure), window-to-wall ratio, an OTTV estimate against the SNI 6389 envelope limit, circulation-area ratio.
Release 3 (Detailed): BoQ with unit prices in an AHSP-style structure, material-based OTTV, travel distance to stairs and exits.
Full thermal comfort and airflow simulation is out of scope until a simulation engine is integrated server-side.
## 10. Non-functional requirements

| Area | Requirement |
| Performance | 60 fps orbit on a model of 50 masses and 6 levels on an integrated-GPU laptop (Intel Iris Xe class) |
| Responsiveness | Tool feedback under 16 ms; indicators recomputed under 200 ms after an edit, in a Web Worker; branch switch under 500 ms |
| Load time | Project open under 3 s on 20 Mbps; branches load on demand |
| Browsers | Latest Chrome and Edge primary; Firefox and Safari supported |
| Reliability | Every operation acknowledged by the server; IndexedDB queue retries after short offline periods; adoption is atomic |
| Geometry robustness | Footprints must be simple polygons (no self-intersection); invalid edits are rejected with a clear message |
| Precision | Millimetres, double precision; site extents up to 500 m without jitter |
| Correctness | Indicator results match hand-calculated fixtures to 0.01 m² and 0.01 ratio |
| Security and privacy | Tenant isolation, HTTPS only, role checks on every call, signed URLs; Indonesian personal data rules (UU PDP); hosting in Indonesia or Singapore |
| Localization | English and Bahasa Indonesia from the start; Indonesian number formatting (comma decimal) in the ID locale |
| Accessibility | Keyboard shortcuts for all tools, remappable; status never shown by color alone (chip text: ok, near, over) |
| Testability | Unit tests for geometry, indicators and branch adoption; Playwright end-to-end tests for the core loop |

## 11. Roadmap and build order
The MVP is eight milestones built in strict order, about 21 weeks for one developer with an AI coding agent. Durations are estimates to re-baseline after M1; later releases start only if the pilot gate passes.
MVP milestones and later releases · estimated durations
Each later release adds one step on the fidelity ladder, so feedback grows from regulation and cost range toward full BoQ and comfort.
Acceptance criteria per milestone
M0 Foundations (VP-01 to VP-04): monorepo builds in CI; the web app shows a 3D scene with axes, grid, north arrow and navigation; Vitest and Playwright run in CI.
M1 Site and massing (CX-01 to CX-06, CX-08, MD-01 to MD-08, LG-01 to LG-03): draw a concave site with road edges and setbacks; draw a footprint with a courtyard using typed values and inference; push it through 3 levels; edit its vertices; set a 3×3 grid; undo/redo every step. No tool asks for a value.
M2 Persistence and accounts (PA-01 to PA-03, TM-05): sign in, create studio and project, reload and see the same model; named versions restore.
M3 Live feedback (IN-01 to IN-06, FD-01 to FD-03, section 9): every indicator matches its hand-calculated fixtures; a mass crossing a setback tints red within 200 ms; sun view tints facades; missing budget shows "needs input". A pilot principal checks results against one past project.
M4 Lenses (LN-01 to LN-04): the same model in Visual, Rules and Reflect; editing a dimension in Rules updates the model; Reflect shows brief and program fit.
M5 Decision Branches (DB-01 to DB-07): on one project, create a decision with three branches, compare them side by side and as overlay with indicators, adopt one with a rationale, park the others, revive one; a conflicting adoption lists the conflicting masses.
M6 Team and export (TM-01 to TM-04, EX-01 to EX-06, PA-04): two users see each other's edits within 2 s; comments restore their camera; DXF opens in AutoCAD and DAE in SketchUp with correct scale, levels and grid; comparison sheet and decision log export; Bahasa Indonesia complete.
M7 Pilot (section 10): performance targets met on studio laptops; at least two of the three studios run a real project's early stage and export to SketchUp or AutoCAD.
Pilot gate. Proceed to Release 2 only if the success metrics in section 5 are mostly met and at least two principals say they would pay.
Release 2: Schematic and consultants. Walls, slabs and openings on adopted masses; rough quantities; window-to-wall ratio and OTTV estimate; circulation-area ratio; IFC import and export through That Open Engine; consultant guest proposals and DXF/IFC overlays; client comparison links.
Release 3: Detailed. BoQ with unit prices (AHSP-style); drawing sheets; style kits and facade modules; text-only AI advisor notes; travel-distance and egress checks.
## 12. Instructions for the AI coding agent, risks and open questions
12.1 Rules for the coding agent
Build one milestone at a time (section 11). Do not start the next until the current acceptance criteria pass and a human has reviewed the code.
Reference requirement IDs (e.g. IN-02, DB-05) in commit messages, test names and code comments.
Do not write your own polygon boolean, triangulation, solar position or DXF writers. Use the libraries in section 6; for COLLADA follow the note in 6.1.
Keep packages/geometry, packages/document and packages/indicators free of UI and rendering imports; they must run in Node for tests and in Web Workers in the browser.
All edits go through the operation log. No component mutates the document directly.
Every indicator function needs fixtures with hand-calculated expected values (section 9), including a concave site, a courtyard footprint and an Intent range.
TypeScript strict; no any in geometry, document or indicator packages.
All user-facing strings go through i18n (English and Bahasa Indonesia).
Never add a required field to a sketching tool. If a value is needed for an indicator, show "needs input" instead (IN-06).
Do not build anything listed as Release 2+ or a non-goal, even if it seems easy. Reserve types only.
Write unclear points as assumptions in docs/DECISIONS.md instead of guessing silently; keep docs/PROGRESS.md listing done, in progress and blocked IDs.
12.2 Risks

| Risk | Impact | Mitigation |
| Sketching feels slower or clumsier than SketchUp | Visual-intuitive users leave | Prioritize MD-01 to MD-06 and inference quality; test with each studio during M1 |
| Indicators wrong or misleading | Loss of trust | Pure functions, fixtures, fidelity labels, ranges; principals check against a past project in M3 |
| Local rules vary by city and are entered by hand | Setup friction | Fast rules panel, copy rules from a previous project; rule presets per city later |
| Branch adoption conflicts confuse users | Users avoid branches | Scoped branches, per-mass conflict cards, every adoption revertible |
| Export doesn't open cleanly in SketchUp/AutoCAD | Handoff promise fails | Test DXF and DAE in the studios' actual software versions during M5 |
| AI-generated code drifts in quality | Hard-to-fix architecture | Small milestones, strict types, tests, human review |
| Studios won't pay | No business | Price conversation in pilot week 4; target range validated before Release 2 |

12.3 Open questions
Interview answers from all three principals: is early decision-making their biggest pain point?
Which SketchUp and AutoCAD versions do the studios use (affects DAE and DXF export settings)?
Typical rules source: KRK documents per city (Jakarta, Bandung, others)? Can presets be built?
Cost rate ranges per m² by building type: does each studio have its own, or should Qreasee suggest defaults?
Pricing: per studio per month or per seat; target range in IDR.
Hosting region: Indonesia or Singapore.
