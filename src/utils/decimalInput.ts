/**
 * Normalize decimal input: comma to dot so "35,5" → 35.5 (iOS/locale).
 * Use for all number inputs so display and parsing always use period.
 */
export function parseDecimalInput(s: string): number {
  const normalized = String(s).trim().replace(/,/g, ".");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

/** Format number for input value: dot (no comma), no trailing .0 for whole numbers (e.g. 15 not 15.0). */
export function toDecimalString(n: number, decimals?: number): string {
  if (!Number.isFinite(n)) return "";
  if (decimals != null && decimals > 0) return Number.isInteger(n) ? String(n) : n.toFixed(decimals);
  return String(n);
}
