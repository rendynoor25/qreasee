import { ACTION_BY_ID, bindingToLabel, makeTranslator, type ActionId } from "@qreasee/shared";
import { useApp, type Mode, type Tool } from "../state/store";
import { useShortcuts } from "../state/shortcuts";
import { IconButton } from "./ui";
import {
  ArcIcon,
  BriefIcon,
  CircleIcon,
  CopyIcon,
  CubeIcon,
  CursorIcon,
  DoorIcon,
  DrawIcon,
  EllipseIcon,
  EraserIcon,
  ExtrudeIcon,
  FrameIcon,
  LayersIcon,
  LeafIcon,
  MoveIcon,
  OffsetIcon,
  PaintIcon,
  PanIcon,
  PolygonIcon,
  RailingIcon,
  RoadIcon,
  RoofIcon,
  RoomIcon,
  RotateIcon,
  SectionIcon,
  SheetIcon,
  StairIcon,
  TapeIcon,
  VertexIcon,
  WallIcon,
  WindowIcon,
} from "./icons";

type Icon = typeof CursorIcon;

const MODES: Array<{ id: Mode; key: string; Icon: Icon }> = [
  { id: "brief", key: "mode.brief", Icon: BriefIcon },
  { id: "massing", key: "mode.massing", Icon: CubeIcon },
  { id: "concept", key: "mode.concept", Icon: RoomIcon },
  { id: "schematic", key: "mode.schematic", Icon: LayersIcon },
  { id: "drawings", key: "mode.drawings", Icon: DrawIcon },
  { id: "sheets", key: "mode.sheets", Icon: SheetIcon },
];

const MASSING_TOOLS: Array<{ id: Tool; key: string; Icon: Icon }> = [
  { id: "select", key: "toolbar.select", Icon: CursorIcon },
  { id: "move", key: "shortcut.action.move", Icon: MoveIcon },
  { id: "copy", key: "shortcut.action.copy", Icon: CopyIcon },
  { id: "tape", key: "shortcut.action.tape", Icon: TapeIcon },
  { id: "eraser", key: "shortcut.action.eraser", Icon: EraserIcon },
  { id: "paint", key: "shortcut.action.paint", Icon: PaintIcon },
  { id: "rectangle", key: "toolbar.rectangle", Icon: FrameIcon },
  { id: "polygon", key: "toolbar.polygon", Icon: PolygonIcon },
  { id: "circle", key: "toolbar.circle", Icon: CircleIcon },
  { id: "ellipse", key: "toolbar.ellipse", Icon: EllipseIcon },
  { id: "arc", key: "toolbar.arc", Icon: ArcIcon },
  { id: "pushpull", key: "toolbar.pushpull", Icon: ExtrudeIcon },
  { id: "vertex", key: "toolbar.vertex", Icon: VertexIcon },
  { id: "rotate", key: "toolbar.rotateObject", Icon: RotateIcon },
  { id: "offset", key: "toolbar.offset", Icon: OffsetIcon },
  { id: "pan", key: "toolbar.pan", Icon: PanIcon },
  { id: "site", key: "toolbar.site", Icon: FrameIcon },
  { id: "road", key: "toolbar.roadEdges", Icon: RoadIcon },
  { id: "green", key: "toolbar.green", Icon: LeafIcon },
];

const SCHEMATIC_TOOLS: Array<{ id: Tool; key: string; Icon: Icon }> = [
  { id: "select", key: "toolbar.selectElement", Icon: CursorIcon },
  { id: "move", key: "shortcut.action.move", Icon: MoveIcon },
  { id: "copy", key: "shortcut.action.copy", Icon: CopyIcon },
  { id: "tape", key: "shortcut.action.tape", Icon: TapeIcon },
  { id: "eraser", key: "shortcut.action.eraser", Icon: EraserIcon },
  { id: "paint", key: "shortcut.action.paint", Icon: PaintIcon },
  { id: "wall", key: "toolbar.wall", Icon: WallIcon },
  { id: "room", key: "toolbar.room", Icon: RoomIcon },
  { id: "door", key: "toolbar.door", Icon: DoorIcon },
  { id: "window", key: "toolbar.window", Icon: WindowIcon },
  { id: "stair", key: "toolbar.stair", Icon: StairIcon },
  { id: "roof", key: "toolbar.roof", Icon: RoofIcon },
  { id: "railing", key: "toolbar.railing", Icon: RailingIcon },
  { id: "pan", key: "toolbar.pan", Icon: PanIcon },
];

const DRAWING_TOOLS: Array<{ id: Tool; key: string; Icon: Icon }> = [
  { id: "select", key: "toolbar.selectElement", Icon: CursorIcon },
  { id: "section", key: "toolbar.section", Icon: SectionIcon },
  { id: "pan", key: "toolbar.pan", Icon: PanIcon },
];

export function Toolbar() {
  const lang = useApp((s) => s.lang);
  const tr = makeTranslator(lang);
  const mode = useApp((s) => s.mode);
  const setMode = useApp((s) => s.setMode);
  const tool = useApp((s) => s.tool);
  const setTool = useApp((s) => s.setTool);
  const levels = useApp((s) => s.docState.levels);
  const activeLevelId = useApp((s) => s.activeLevelId);
  const setActiveLevel = useApp((s) => s.setActiveLevel);
  const bindings = useShortcuts((s) => s.bindings);
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  const toolTitle = (id: Tool, key: string): string => {
    const label = tr(key as never);
    const binding = bindings[`tool.${id}` as ActionId];
    return binding ? `${label} (${bindingToLabel(binding, isMac)})` : label;
  };

  const tools =
    mode === "concept"
      ? []
      : mode === "massing"
        ? MASSING_TOOLS
        : mode === "drawings"
          ? DRAWING_TOOLS
          : SCHEMATIC_TOOLS;

  return (
    <aside className="z-20 flex w-12 flex-col items-center gap-1 overflow-y-auto border-r border-ink-800 bg-ink-900/80 py-2">
      {/* Mode switcher */}
      <div className="mb-1 flex flex-col gap-1 rounded-lg border border-ink-800 bg-ink-950/50 p-0.5">
        {MODES.map(({ id, key, Icon }) => (
          <IconButton
            key={id}
            title={tr(key as never)}
            active={mode === id}
            onClick={() => setMode(id)}
          >
            <Icon />
          </IconButton>
        ))}
      </div>
      <div className="h-px w-6 bg-ink-800" />

      {tools.map(({ id, key, Icon }) => {
        const def = ACTION_BY_ID[`tool.${id}` as ActionId];
        const unavailable = !!def?.unavailable;
        return (
          <span key={id} className={unavailable ? "opacity-40" : ""}>
            <IconButton
              title={
                unavailable
                  ? `${tr(key as never)} — ${tr((def.unavailableReasonKey ?? "shortcut.reason.unavailable") as never)}`
                  : toolTitle(id, key)
              }
              active={tool === id}
              onClick={() => {
                if (!unavailable) setTool(id);
              }}
            >
              <Icon />
            </IconButton>
          </span>
        );
      })}

      {mode === "massing" && (
        <>
          <div className="my-1 h-px w-6 bg-ink-800" />
          <div className="flex flex-col gap-1">
            {levels.map((l) => (
              <button
                key={l.id}
                title={l.name}
                onClick={() => setActiveLevel(l.id)}
                className={
                  "flex h-9 w-9 flex-col items-center justify-center rounded-md border text-[9px] leading-tight transition-colors " +
                  (activeLevelId === l.id
                    ? "border-lens-rules/70 bg-lens-rules/15 text-lens-rules"
                    : "border-transparent text-ink-400 hover:border-ink-700 hover:text-ink-100")
                }
              >
                <span className="text-[10px] font-semibold">{l.name.replace(/[^0-9]/g, "") || "+"}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
