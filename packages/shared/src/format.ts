/**
 * Locale-aware formatting. Qreasee ships English and Bahasa Indonesia from the
 * start and must use Indonesian number formatting (comma decimal) in the ID
 * locale (PRD section 10, Localization).
 */

export type Lang = "en" | "id";

const localeOf = (lang: Lang) => (lang === "id" ? "id-ID" : "en-US");

export function formatNumber(
  value: number,
  lang: Lang = "en",
  maximumFractionDigits = 2,
): string {
  return new Intl.NumberFormat(localeOf(lang), {
    maximumFractionDigits,
  }).format(value);
}

/** Millimetres to metres, trimmed. */
export function formatMetres(mm: number, lang: Lang = "en", digits = 2): string {
  return `${formatNumber(mm / 1000, lang, digits)} m`;
}

/** Square millimetres to square metres. */
export function formatArea(mm2: number, lang: Lang = "en", digits = 2): string {
  return `${formatNumber(mm2 / 1_000_000, lang, digits)} m²`;
}

/** A ratio (0..1) as a percentage. */
export function formatPercent(
  ratio: number,
  lang: Lang = "en",
  digits = 1,
): string {
  return `${formatNumber(ratio * 100, lang, digits)}%`;
}

/** Full Rupiah with no decimals, e.g. "Rp 2.100.000.000". */
export function formatRupiah(value: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(
    Math.round(value),
  )}`;
}

function compactRupiah(value: number): { amount: string; unit: string } {
  const abs = Math.abs(value);
  if (abs >= 1e12) return { amount: formatNumber(value / 1e12, "id", 1), unit: "triliun" };
  if (abs >= 1e9) return { amount: formatNumber(value / 1e9, "id", 1), unit: "miliar" };
  if (abs >= 1e6) return { amount: formatNumber(value / 1e6, "id", 1), unit: "juta" };
  if (abs >= 1e3) return { amount: formatNumber(value / 1e3, "id", 1), unit: "ribu" };
  return { amount: formatNumber(value, "id", 0), unit: "" };
}

/** Compact single value, e.g. "Rp 2,1 miliar". */
export function formatRupiahCompact(value: number): string {
  const { amount, unit } = compactRupiah(value);
  return unit ? `Rp ${amount} ${unit}` : `Rp ${amount}`;
}

/**
 * A cost range in Indonesian locale, e.g. "Rp 2,1–2,6 miliar" (PRD 9.3).
 * Falls back to showing both units when the range crosses a unit boundary.
 */
export function formatRupiahRange(low: number, high: number): string {
  const a = compactRupiah(low);
  const b = compactRupiah(high);
  if (a.unit === b.unit) {
    return `Rp ${a.amount}–${b.amount}${a.unit ? ` ${a.unit}` : ""}`;
  }
  return `${formatRupiahCompact(low)}–${formatRupiahCompact(high)}`;
}
