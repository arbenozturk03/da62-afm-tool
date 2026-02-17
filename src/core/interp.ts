/**
 * Pure TypeScript interpolation utilities for grid data.
 * Grid: axes W, PA, OAT; values[key][wIndex][paIndex][oatIndex].
 */

export function findBracket(
  axis: number[],
  q: number
): {
  i0: number;
  i1: number;
  t: number;
  clamped: boolean;
  inRange: boolean;
} {
  const n = axis.length;
  if (n === 0) {
    return { i0: 0, i1: 0, t: 0, clamped: true, inRange: false };
  }
  const min = axis[0];
  const max = axis[n - 1];
  let clamped = false;
  let inRange = true;
  let qq = q;

  if (q <= min) {
    qq = min;
    clamped = true;
    inRange = false;
  } else if (q >= max) {
    qq = max;
    clamped = true;
    inRange = false;
  }

  let i0 = 0;
  let i1 = n - 1;

  if (qq === min) {
    i0 = 0;
    i1 = 0;
    return { i0, i1, t: 0, clamped, inRange };
  }
  if (qq === max) {
    i0 = n - 1;
    i1 = n - 1;
    return { i0, i1, t: 0, clamped, inRange };
  }

  for (let i = 0; i < n - 1; i++) {
    if (axis[i] <= qq && qq <= axis[i + 1]) {
      i0 = i;
      i1 = i + 1;
      const denom = axis[i1] - axis[i0];
      const t = denom === 0 ? 0 : (qq - axis[i0]) / denom;
      return { i0, i1, t, clamped, inRange };
    }
  }

  return { i0, i1, t: 0, clamped, inRange };
}

export function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

export function interp1D(
  axis: number[],
  values: (number | null)[],
  q: number
): { ok: true; value: number; bracket: { i0: number; i1: number; t: number } } | { ok: false; error: string } {
  const bracket = findBracket(axis, q);
  const { i0, i1, t } = bracket;
  const raw0 = values[i0];
  const raw1 = values[i1];
  if (raw0 == null || raw1 == null) {
    return { ok: false, error: "Speed not available" };
  }
  const v0 = Number(raw0);
  const v1 = Number(raw1);
  if (Number.isNaN(v0) || Number.isNaN(v1)) {
    return { ok: false, error: "Speed not available" };
  }
  return {
    ok: true,
    value: lerp(v0, v1, t),
    bracket: { i0, i1, t },
  };
}

export type GridAxes = {
  W: number[];
  PA: number[];
  OAT: number[];
};

export type GridValues = {
  [key: string]: (number | null)[][][] | undefined;
};

export type Grid = {
  axes: GridAxes;
  values: GridValues;
};

/**
 * Trilinear interpolation. Expects grid.values[key][wIndex][paIndex][oatIndex].
 * Interpolation order: OAT → PA → W. Returns ok:false if any corner is null (outside AFM grid / missing cells).
 */
export function trilinearFromGrid(
  grid: Grid,
  Wq: number,
  PAq: number,
  OATq: number,
  key: string
): {
  ok: boolean;
  value?: number;
  error?: string;
  flags?: {
    clampedW: boolean;
    clampedPA: boolean;
    clampedOAT: boolean;
  };
} {
  const { axes, values } = grid;
  const arr = values[key];
  if (!arr) {
    return { ok: false, error: "AFM data not available for this condition" };
  }

  const bw = findBracket(axes.W, Wq);
  const bpa = findBracket(axes.PA, PAq);
  const boat = findBracket(axes.OAT, OATq);

  const iw0 = bw.i0,
    iw1 = bw.i1;
  const ipa0 = bpa.i0,
    ipa1 = bpa.i1;
  const ioat0 = boat.i0,
    ioat1 = boat.i1;

  const get = (iw: number, ipa: number, ioat: number): number | null | undefined => {
    const row = arr[iw];
    if (row == null) return undefined;
    const slice = row[ipa];
    if (slice == null) return undefined;
    return slice[ioat];
  };

  const c000 = get(iw0, ipa0, ioat0);
  const c001 = get(iw0, ipa0, ioat1);
  const c010 = get(iw0, ipa1, ioat0);
  const c011 = get(iw0, ipa1, ioat1);
  const c100 = get(iw1, ipa0, ioat0);
  const c101 = get(iw1, ipa0, ioat1);
  const c110 = get(iw1, ipa1, ioat0);
  const c111 = get(iw1, ipa1, ioat1);

  const corners = [c000, c001, c010, c011, c100, c101, c110, c111];
  for (const c of corners) {
    if (c == null || Number.isNaN(c)) {
      return { ok: false, error: "outside AFM grid / missing cells" };
    }
  }

  const tw = bw.t,
    tpa = bpa.t,
    toat = boat.t;

  const x00 = lerp(c000!, c001!, toat);
  const x01 = lerp(c010!, c011!, toat);
  const x10 = lerp(c100!, c101!, toat);
  const x11 = lerp(c110!, c111!, toat);

  const y0 = lerp(x00, x01, tpa);
  const y1 = lerp(x10, x11, tpa);

  const value = lerp(y0, y1, tw);

  return {
    ok: true,
    value,
    flags: {
      clampedW: bw.clamped,
      clampedPA: bpa.clamped,
      clampedOAT: boat.clamped,
    },
  };
}
