import { formatNumber, formatRupiah, formatRupiahCompact, type IndicatorResult, type Lang } from "@qreasee/shared";

export function indicatorValueText(r: IndicatorResult, lang: Lang): string {
  if (r.key === "cost") {
    if (r.range) return `${formatRupiahCompact(r.range.low)}–${formatRupiahCompact(r.range.high)}`;
    if (r.value !== undefined) return formatRupiah(r.value);
    return "—";
  }
  if (r.range) {
    return `${formatNumber(r.range.low, lang, 2)}–${formatNumber(r.range.high, lang, 2)} ${r.unit ?? ""}`.trim();
  }
  if (r.value === undefined) {
    if (r.key === "sun") return "0–8 h";
    return r.status;
  }
  if (r.key === "kdb" || r.key === "kdh") return `${formatNumber(r.value, lang, 1)}%`;
  if (r.key === "height") return `${formatNumber(r.value, lang, 2)} m`;
  if (r.key === "floors") return String(Math.round(r.value));
  if (r.unit === "m²") return `${formatNumber(r.value, lang, 1)} m²`;
  if (r.key === "klb") return formatNumber(r.value, lang, 2);
  if (r.key === "program") return String(Math.round(r.value));
  return formatNumber(r.value, lang, 1);
}

export const INDICATOR_ORDER = [
  "kdb",
  "klb",
  "kdh",
  "setback",
  "height",
  "floors",
  "gfa",
  "coverage",
  "cost",
  "program",
  "sun",
] as const;
