export interface BoundsResult {
  low: number;
  high: number;
  clamped: boolean;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function findBounds(sorted: number[], value: number): BoundsResult {
  if (sorted.length === 0) {
    throw new Error("findBounds: empty array");
  }

  if (value <= sorted[0]) {
    return { low: sorted[0], high: sorted[0], clamped: true };
  }
  const last = sorted[sorted.length - 1];
  if (value >= last) {
    return { low: last, high: last, clamped: true };
  }

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (value >= a && value <= b) {
      return { low: a, high: b, clamped: false };
    }
  }

  // Fallback – should not really happen due to guards above
  return { low: sorted[0], high: last, clamped: true };
}

export function bilinearInterpolate(
  x: number,
  y: number,
  x1: number,
  x2: number,
  y1: number,
  y2: number,
  q11: number | null,
  q12: number | null,
  q21: number | null,
  q22: number | null,
): { value: number | null; unsupported: boolean } {
  if (
    q11 == null ||
    q12 == null ||
    q21 == null ||
    q22 == null
  ) {
    return { value: null, unsupported: true };
  }

  if (x2 === x1 && y2 === y1) {
    return { value: q11, unsupported: false };
  }

  if (x2 === x1) {
    const ty = (y - y1) / (y2 - y1);
    return { value: lerp(q11, q12, ty), unsupported: false };
  }

  if (y2 === y1) {
    const tx = (x - x1) / (x2 - x1);
    return { value: lerp(q11, q21, tx), unsupported: false };
  }

  const tx = (x - x1) / (x2 - x1);
  const ty = (y - y1) / (y2 - y1);

  const r1 = lerp(q11, q21, tx);
  const r2 = lerp(q12, q22, tx);
  const p = lerp(r1, r2, ty);

  return { value: p, unsupported: false };
}

