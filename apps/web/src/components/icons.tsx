import type { SVGProps } from "react";

const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export const CursorIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 3l7 17 2.5-7.5L22 10z" />
  </svg>
);
export const FrameIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="1" />
  </svg>
);
export const PolygonIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3l8 6-3 10H7L4 9z" />
  </svg>
);
export const StairIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 20h4v-4h4v-4h4V8h6" />
    <path d="M3 20v-4M7 16v-4M11 12V8M15 8V4" />
  </svg>
);
export const RoofIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M2 13l10-8 10 8" />
    <path d="M6 13v7h12v-7" />
    <path d="M6 13h12" />
  </svg>
);
export const MoveIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3v18M3 12h18" />
    <path d="M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5" />
    <path d="M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" />
  </svg>
);
export const CopyIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="8" y="8" width="12" height="12" rx="1.5" />
    <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4H5.5A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
  </svg>
);
export const TapeIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="2" y="8" width="20" height="8" rx="1.5" />
    <path d="M6 8v3M10 8v3M14 8v3M18 8v3" />
  </svg>
);
export const EraserIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 15l7-7 6 6-4 4H7z" />
    <path d="M11 8l3-3 6 6-3 3" />
    <path d="M4 20h16" />
  </svg>
);
export const PaintIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 4h11a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
    <path d="M16 6h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-7v3" />
    <path d="M12 14h0.01" />
    <path d="M11 20a2 2 0 1 0 2-2c-1 0-2 1-2 2z" />
  </svg>
);
export const RailingIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 8h18" />
    <path d="M5 8v11M11 8v11M17 8v11M21 8v11" />
    <path d="M3 19h18" />
  </svg>
);
export const ExtrudeIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 14l8 4 8-4" />
    <path d="M4 18l8 4 8-4" />
    <path d="M12 2v12" />
    <path d="M9 5l3-3 3 3" />
  </svg>
);
export const VertexIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 18L12 4l8 14z" />
    <circle cx="4" cy="18" r="1.6" />
    <circle cx="12" cy="4" r="1.6" />
    <circle cx="20" cy="18" r="1.6" />
  </svg>
);
export const RoadIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 3v18M18 3v18M12 4v3M12 11v3M12 18v3" />
  </svg>
);
export const LeafIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M11 20A7 7 0 0 1 4 13c0-6 7-9 16-9 0 9-3 16-9 16z" />
    <path d="M4 13c4 0 8-2 11-6" />
  </svg>
);
export const UndoIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h9a7 7 0 0 1 0 14H9" />
  </svg>
);
export const RedoIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9h-9a7 7 0 0 0 0 14h4" />
  </svg>
);
export const SunIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
  </svg>
);
export const GridIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
  </svg>
);
export const LayersIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3l9 5-9 5-9-5z" />
    <path d="M3 13l9 5 9-5" />
  </svg>
);
export const StackIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3l9 5-9 5-9-5z" />
    <path d="M3 13l9 5 9-5" />
    <path d="M3 17l9 5 9-5" opacity="0.5" />
  </svg>
);
export const DecisionIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 3v6a3 3 0 0 0 3 3h6" />
    <path d="M12 12h3" />
    <path d="M18 9l3 3-3 3" />
    <circle cx="6" cy="3" r="2" />
    <circle cx="6" cy="21" r="2" />
    <path d="M6 5v14" />
  </svg>
);
export const ExportIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3v12" />
    <path d="M8 7l4-4 4 4" />
    <path d="M5 15v4h14v-4" />
  </svg>
);
export const InfoIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);
export const GlobeIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
  </svg>
);
export const PlusIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const TrashIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </svg>
);
export const CheckIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 12l5 5L20 6" />
  </svg>
);
export const BranchIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="6" cy="6" r="2" />
    <circle cx="6" cy="18" r="2" />
    <circle cx="18" cy="12" r="2" />
    <path d="M6 8v8M8 6h4a4 4 0 0 1 4 4v0" />
  </svg>
);
export const CircleIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
);
export const EllipseIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <ellipse cx="12" cy="12" rx="9.5" ry="6" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
);
export const ArcIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 18c3-10 15-10 18 0" />
    <circle cx="3" cy="18" r="1.5" />
    <circle cx="21" cy="18" r="1.5" />
    <circle cx="12" cy="6" r="1.5" />
  </svg>
);
export const PanIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3v18M3 12h18" />
    <path d="M12 3l-2.5 3M12 3l2.5 3M12 21l-2.5-3M12 21l2.5-3M3 12l3-2.5M3 12l3 2.5M21 12l-3-2.5M21 12l-3 2.5" />
  </svg>
);
export const RotateIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M20 12a8 8 0 1 1-2.3-5.6" />
    <path d="M20 4v4h-4" />
  </svg>
);
export const OffsetIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="1" />
    <rect x="8" y="8" width="8" height="8" rx="0.5" />
  </svg>
);
export const WallIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 8h18M3 16h18M3 8v8M21 8v8" />
  </svg>
);
export const DoorIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 20V4h9v16" />
    <path d="M14 20h5" />
    <path d="M11 12h.01" />
  </svg>
);
export const WindowIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="4" y="5" width="16" height="14" rx="1" />
    <path d="M12 5v14M4 12h16" />
  </svg>
);
export const RoomIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 4h16v16H4z" />
    <path d="M9 9h6v6H9z" opacity="0.5" />
  </svg>
);
export const MapIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M9 4l6 2 6-2v14l-6 2-6-2-6 2V6z" />
    <path d="M9 4v14M15 6v14" />
  </svg>
);
export const MoonIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </svg>
);
export const DrawIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="4" y="4" width="16" height="16" rx="1" />
    <path d="M4 9h16M9 9v11" />
  </svg>
);
export const SheetIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="1" />
    <path d="M3 8h18" />
    <path d="M7 12h7M7 15h5" />
  </svg>
);
export const CubeIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
    <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
  </svg>
);
export const SectionIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 8h18" strokeDasharray="4 3" />
    <path d="M6 4v8M18 4v8" />
    <path d="M6 16h12M6 16l2-2M6 16l2 2M18 16l-2-2M18 16l-2 2" />
  </svg>
);
export const BriefIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 6h16M4 12h16M4 18h10" />
    <path d="M8 3v18M16 3v18" opacity="0.35" />
  </svg>
);
