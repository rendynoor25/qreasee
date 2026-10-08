import { cn } from "../lib/utils";

/**
 * Qreasee logo mark: a bold "Q" ring plus the brand-orange swoosh.
 *
 * The ring uses `currentColor`, so it renders light on the dark theme and dark
 * on the light theme — the ring must never be invisible (an earlier asset had a
 * hard white ring, which vanished on white). The viewBox has a small margin so
 * the swoosh tail is never clipped. Mirrors public/logo-dark.svg / logo-light.svg.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("h-7 w-7", className)} aria-hidden="true">
      <circle cx="22" cy="21" r="13" fill="none" stroke="currentColor" strokeWidth="9" />
      <path
        d="M26 26 C29.5 31.5 34.5 37.5 41 41 C43 41.8 44.5 42.3 45.5 42.5 C44 37 40.5 31.5 36 27.5 C33 24.8 29.5 23.2 26 22.5 C24.8 23.2 25.3 24.6 26 26 Z"
        fill="#e07a24"
      />
      <path
        d="M26 26 C29.5 30.5 34 35.5 39.5 39 C37.5 34.5 34 30.5 29.5 27 C28.1 26.1 26.9 25.6 26 25.5 Z"
        fill="#f3a85f"
      />
    </svg>
  );
}
