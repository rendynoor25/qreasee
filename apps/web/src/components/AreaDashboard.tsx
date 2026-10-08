import { useMemo } from "react";
import { makeTranslator } from "@qreasee/shared";
import { areaDashboard } from "@qreasee/concept";
import { useApp } from "../state/store";
import { cn } from "../lib/utils";

/**
 * K-03: a slim target-vs-actual bar over the canvas. Status is always text
 * (ok / near / over / under), never colour alone. Clicking a chip selects the
 * first block of that program row.
 */
export function AreaDashboard() {
  const lang = useApp((s) => s.lang);
  const tr = makeTranslator(lang);
  const program = useApp((s) => s.docState.brief.program);
  const rooms = useApp((s) => s.docState.rooms);
  const selectedRoomId = useApp((s) => s.selectedRoomId);
  const selectRoom = useApp((s) => s.selectRoom);

  const rows = useMemo(() => areaDashboard(program, rooms), [program, rooms]);
  if (rows.length === 0) return null;

  const selectedItemId = rooms.find((r) => r.id === selectedRoomId)?.programItemId;

  return (
    <div className="pointer-events-auto absolute left-1/2 top-14 z-10 flex max-w-[92%] -translate-x-1/2 gap-1.5 overflow-x-auto rounded-lg border border-ink-800 bg-ink-900/85 px-2 py-1.5 backdrop-blur">
      <span className="mr-1 shrink-0 self-center text-[10px] uppercase tracking-wide text-ink-500">
        {tr("brief.program")}
      </span>
      {rows.map((r) => {
        const selected = r.programItemId === selectedItemId;
        return (
          <button
            key={r.programItemId}
            onClick={() => {
              const first = rooms.find((room) => room.programItemId === r.programItemId);
              selectRoom(first ? first.id : null);
            }}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
              selected ? "border-lens-visual/70" : "border-ink-700 hover:border-ink-500",
              r.status === "over" && "bg-state-over/10",
              r.status === "under" && "bg-state-near/10",
              r.status === "near" && "bg-state-near/10",
              r.status === "ok" && "bg-state-ok/10",
            )}
            title={`${r.name}: ${r.actualM2.toFixed(1)} of ${r.targetM2.toFixed(1)} m²`}
          >
            <span className="text-ink-300">{r.name}</span>
            <span className="font-mono text-ink-100">
              {r.actualM2.toFixed(0)}/{r.targetM2.toFixed(0)} m²
            </span>
            <span
              className={cn(
                "text-[10px]",
                r.status === "over" && "text-state-over",
                (r.status === "under" || r.status === "near") && "text-state-near",
                r.status === "ok" && "text-state-ok",
                r.status === "needs-input" && "text-ink-500",
              )}
            >
              {tr(`status.${r.status}` as never)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
