import cruiseJson from "../data/cruise/cruise.json";

export type CruiseSetting = "HIGH" | "MED" | "ECO" | "LOW";

type IsaKey = "isa_m10" | "isa" | "isa_p10" | "isa_p20" | "isa_p30";

export interface CruiseCell {
  pwr: number;
  ff: number;
  tas: number;
}

export interface CruiseIsaRow {
  isa_m10: CruiseCell | null;
  isa: CruiseCell | null;
  isa_p10: CruiseCell | null;
  isa_p20: CruiseCell | null;
  isa_p30: CruiseCell | null;
}

export interface CruiseAltitudeRow {
  press_alt_ft: number;
  press_alt_m: number;
  rows: CruiseIsaRow[];
}

export interface CruiseWeightCategory {
  weight_category: string;
  data: CruiseAltitudeRow[];
}

export interface CruiseAfmJson {
  cruise_performance: CruiseWeightCategory[];
}

export const cruiseAfmData = cruiseJson as CruiseAfmJson;

export interface CruisePerformanceInputs {
  pressureAltitudeFt: number;
  isaDeviationC: number;
  weightKg: number;
  cruiseSetting: CruiseSetting;
  fuelRemainingGal?: number;
}

export interface CruisePerformanceSuccess {
  ok: true;
  inputs: CruisePerformanceInputs;
  tasKt: number;
  fuelFlowGph: number;
  pwrPercent: number;
  specificRangeNmPerGal: number;
  enduranceHr?: number;
  rangeNm?: number;
}

export interface CruisePerformanceFailure {
  ok: false;
  error: string;
}

export type CruisePerformanceResult = CruisePerformanceSuccess | CruisePerformanceFailure;

export interface Bracket {
  i0: number;
  i1: number;
  t: number;
}

export function interpolate1D(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x1 === x0) return y0;
  const t = (x - x0) / (x1 - x0);
  return y0 + (y1 - y0) * t;
}

export function bracketValue(x: number, grid: number[]): Bracket | null {
  if (grid.length === 0) return null;
  const min = grid[0];
  const max = grid[grid.length - 1];
  if (x < min || x > max) return null;

  if (x === min) return { i0: 0, i1: 0, t: 0 };
  if (x === max) {
    const last = grid.length - 1;
    return { i0: last, i1: last, t: 0 };
  }

  for (let i = 0; i < grid.length - 1; i += 1) {
    const g0 = grid[i];
    const g1 = grid[i + 1];
    if (x >= g0 && x <= g1) {
      const denom = g1 - g0;
      const t = denom === 0 ? 0 : (x - g0) / denom;
      return { i0: i, i1: i + 1, t };
    }
  }

  return null;
}

export function bilinear(
  tAlt: number,
  tIsa: number,
  v00: number,
  v10: number,
  v01: number,
  v11: number,
): number {
  const v0 = v00 + (v10 - v00) * tAlt;
  const v1 = v01 + (v11 - v01) * tAlt;
  return v0 + (v1 - v0) * tIsa;
}

function getRowIndexForSetting(setting: CruiseSetting): number {
  switch (setting) {
    case "HIGH":
      return 0;
    case "MED":
      return 1;
    case "ECO":
      return 2;
    case "LOW":
      return 3;
  }
}

function hasSettingRow(weightTable: CruiseWeightCategory, altIndex: number, setting: CruiseSetting): boolean {
  const rowIndex = getRowIndexForSetting(setting);
  const altRow = weightTable.data[altIndex];
  return !!altRow && altRow.rows.length > rowIndex;
}

export function getCell(
  weightTable: CruiseWeightCategory,
  altIndex: number,
  setting: CruiseSetting,
  isaKey: IsaKey,
): CruiseCell | null {
  const rowIndex = getRowIndexForSetting(setting);
  const altRow = weightTable.data[altIndex];
  if (!altRow) return null;
  const settingRow = altRow.rows[rowIndex];
  if (!settingRow) return null;
  const raw = settingRow[isaKey] as CruiseCell | null | undefined;
  if (!raw || raw.pwr == null || raw.ff == null || raw.tas == null) return null;
  return { pwr: raw.pwr, ff: raw.ff, tas: raw.tas };
}

const ISA_GRID_VALUES: number[] = [-10, 0, 10, 20, 30];
const ISA_KEYS: IsaKey[] = ["isa_m10", "isa", "isa_p10", "isa_p20", "isa_p30"];

function computeForWeightTable(
  weightTable: CruiseWeightCategory,
  inputs: CruisePerformanceInputs,
): CruisePerformanceSuccess | CruisePerformanceFailure {
  const { pressureAltitudeFt, isaDeviationC, cruiseSetting } = inputs;

  const altitudes = weightTable.data.map((row) => row.press_alt_ft);
  if (altitudes.length === 0) {
    return { ok: false, error: "AFM cruise data not loaded" };
  }

  const altBracket = bracketValue(pressureAltitudeFt, altitudes);
  if (!altBracket) {
    return { ok: false, error: "Altitude out of AFM range" };
  }

  const isaBracket = bracketValue(isaDeviationC, ISA_GRID_VALUES);
  if (!isaBracket) {
    return { ok: false, error: "ΔISA out of AFM range" };
  }

  const altIndices = new Set<number>([altBracket.i0, altBracket.i1]);
  for (const idx of altIndices) {
    if (!hasSettingRow(weightTable, idx, cruiseSetting)) {
      return {
        ok: false,
        error: "Cruise setting not available at this altitude in AFM",
      };
    }
  }

  const isaIndex0 = isaBracket.i0;
  const isaIndex1 = isaBracket.i1;
  const isaKey0 = ISA_KEYS[isaIndex0];
  const isaKey1 = ISA_KEYS[isaIndex1];

  const alt0 = altBracket.i0;
  const alt1 = altBracket.i1;

  // Exact grid point: no interpolation.
  if (alt0 === alt1 && isaIndex0 === isaIndex1) {
    const cell = getCell(weightTable, alt0, cruiseSetting, isaKey0);
    if (!cell) {
      return {
        ok: false,
        error: "Not available in AFM for these conditions (missing data).",
      };
    }
    const tasKt = cell.tas;
    const fuelFlowGph = cell.ff;
    const pwrPercent = cell.pwr;
    const specificRangeNmPerGal = tasKt / fuelFlowGph;

    let enduranceHr: number | undefined;
    let rangeNm: number | undefined;
    if (inputs.fuelRemainingGal != null && inputs.fuelRemainingGal > 0) {
      enduranceHr = inputs.fuelRemainingGal / fuelFlowGph;
      rangeNm = enduranceHr * tasKt;
    }

    return {
      ok: true,
      inputs,
      tasKt,
      fuelFlowGph,
      pwrPercent,
      specificRangeNmPerGal,
      enduranceHr,
      rangeNm,
    };
  }

  // Altitude-only interpolation (ISA exactly matches a column).
  if (isaIndex0 === isaIndex1) {
    const key = isaKey0;
    const c0 = getCell(weightTable, alt0, cruiseSetting, key);
    const c1 = getCell(weightTable, alt1, cruiseSetting, key);
    if (!c0 || !c1) {
      return {
        ok: false,
        error: "Not available in AFM for these conditions (missing data).",
      };
    }
    const alt0Ft = altitudes[alt0];
    const alt1Ft = altitudes[alt1];

    const tasKt = interpolate1D(pressureAltitudeFt, alt0Ft, alt1Ft, c0.tas, c1.tas);
    const fuelFlowGph = interpolate1D(pressureAltitudeFt, alt0Ft, alt1Ft, c0.ff, c1.ff);
    const pwrPercent = interpolate1D(pressureAltitudeFt, alt0Ft, alt1Ft, c0.pwr, c1.pwr);
    const specificRangeNmPerGal = tasKt / fuelFlowGph;

    let enduranceHr: number | undefined;
    let rangeNm: number | undefined;
    if (inputs.fuelRemainingGal != null && inputs.fuelRemainingGal > 0) {
      enduranceHr = inputs.fuelRemainingGal / fuelFlowGph;
      rangeNm = enduranceHr * tasKt;
    }

    return {
      ok: true,
      inputs,
      tasKt,
      fuelFlowGph,
      pwrPercent,
      specificRangeNmPerGal,
      enduranceHr,
      rangeNm,
    };
  }

  // ISA-only interpolation (altitude exactly on a grid line).
  if (alt0 === alt1) {
    const c00 = getCell(weightTable, alt0, cruiseSetting, isaKey0);
    const c01 = getCell(weightTable, alt0, cruiseSetting, isaKey1);
    if (!c00 || !c01) {
      return {
        ok: false,
        error: "Not available in AFM for these conditions (missing data).",
      };
    }
    const isa0 = ISA_GRID_VALUES[isaIndex0];
    const isa1 = ISA_GRID_VALUES[isaIndex1];

    const tasKt = interpolate1D(isaDeviationC, isa0, isa1, c00.tas, c01.tas);
    const fuelFlowGph = interpolate1D(isaDeviationC, isa0, isa1, c00.ff, c01.ff);
    const pwrPercent = interpolate1D(isaDeviationC, isa0, isa1, c00.pwr, c01.pwr);
    const specificRangeNmPerGal = tasKt / fuelFlowGph;

    let enduranceHr: number | undefined;
    let rangeNm: number | undefined;
    if (inputs.fuelRemainingGal != null && inputs.fuelRemainingGal > 0) {
      enduranceHr = inputs.fuelRemainingGal / fuelFlowGph;
      rangeNm = enduranceHr * tasKt;
    }

    return {
      ok: true,
      inputs,
      tasKt,
      fuelFlowGph,
      pwrPercent,
      specificRangeNmPerGal,
      enduranceHr,
      rangeNm,
    };
  }

  // Full bilinear interpolation in (altitude, ΔISA) space.
  const c00 = getCell(weightTable, alt0, cruiseSetting, isaKey0);
  const c10 = getCell(weightTable, alt1, cruiseSetting, isaKey0);
  const c01 = getCell(weightTable, alt0, cruiseSetting, isaKey1);
  const c11 = getCell(weightTable, alt1, cruiseSetting, isaKey1);

  if (!c00 || !c10 || !c01 || !c11) {
    return {
      ok: false,
      error: "Not available in AFM for these conditions (missing data).",
    };
  }

  const alt0Ft = altitudes[alt0];
  const alt1Ft = altitudes[alt1];
  const isa0 = ISA_GRID_VALUES[isaIndex0];
  const isa1 = ISA_GRID_VALUES[isaIndex1];

  const tAlt = (pressureAltitudeFt - alt0Ft) / (alt1Ft - alt0Ft);
  const tIsa = (isaDeviationC - isa0) / (isa1 - isa0);

  const tasKt = bilinear(tAlt, tIsa, c00.tas, c10.tas, c01.tas, c11.tas);
  const fuelFlowGph = bilinear(tAlt, tIsa, c00.ff, c10.ff, c01.ff, c11.ff);
  const pwrPercent = bilinear(tAlt, tIsa, c00.pwr, c10.pwr, c01.pwr, c11.pwr);
  const specificRangeNmPerGal = tasKt / fuelFlowGph;

  let enduranceHr: number | undefined;
  let rangeNm: number | undefined;
  if (inputs.fuelRemainingGal != null && inputs.fuelRemainingGal > 0) {
    enduranceHr = inputs.fuelRemainingGal / fuelFlowGph;
    rangeNm = enduranceHr * tasKt;
  }

  return {
    ok: true,
    inputs,
    tasKt,
    fuelFlowGph,
    pwrPercent,
    specificRangeNmPerGal,
    enduranceHr,
    rangeNm,
  };
}

const ISA_DEVIATION_MIN = -10;
const ISA_DEVIATION_MAX = 30;
/** Tolerans: tablo dışında 2°C’ye kadar clamp edip kullan, daha fazlaysa out of range say. */
const ISA_DEVIATION_TOLERANCE = 2;

export function computeCruisePerformance(inputs: CruisePerformanceInputs): CruisePerformanceResult {
  const { pressureAltitudeFt, isaDeviationC, weightKg } = inputs;

  if (pressureAltitudeFt < 2000 || pressureAltitudeFt > 20000) {
    return { ok: false, error: "Altitude out of AFM range" };
  }
  if (weightKg <= 0 || weightKg > 2300) {
    return { ok: false, error: "Weight out of AFM range" };
  }

  const minAllowed = ISA_DEVIATION_MIN - ISA_DEVIATION_TOLERANCE;
  const maxAllowed = ISA_DEVIATION_MAX + ISA_DEVIATION_TOLERANCE;
  if (isaDeviationC < minAllowed || isaDeviationC > maxAllowed) {
    return { ok: false, error: "ΔISA out of AFM range" };
  }

  const clampedIsaDeviationC = Math.max(
    ISA_DEVIATION_MIN,
    Math.min(ISA_DEVIATION_MAX, isaDeviationC),
  );
  const effectiveInputs: CruisePerformanceInputs = {
    ...inputs,
    isaDeviationC: clampedIsaDeviationC,
  };

  const lowWeightTable = cruiseAfmData.cruise_performance[0];
  const highWeightTable = cruiseAfmData.cruise_performance[1];

  if (!lowWeightTable || !highWeightTable) {
    return { ok: false, error: "AFM cruise data not loaded" };
  }

  // Weight handling and blending between categories. For TAS and fuel flow we
  // linearly blend between the two AFM weight bands. For pwrPercent we snap to
  // the nearest band instead of blending so we do not suggest intermediate
  // power settings that do not exist in the AFM tables.

  if (weightKg <= 1999) {
    return computeForWeightTable(lowWeightTable, effectiveInputs);
  }

  if (weightKg >= 2300) {
    return computeForWeightTable(highWeightTable, effectiveInputs);
  }

  const ratio = (weightKg - 1999) / (2300 - 1999);

  const lowRes = computeForWeightTable(lowWeightTable, effectiveInputs);
  if (!lowRes.ok) return lowRes;

  const highRes = computeForWeightTable(highWeightTable, effectiveInputs);
  if (!highRes.ok) return highRes;

  const tasKt = lowRes.tasKt * (1 - ratio) + highRes.tasKt * ratio;
  const fuelFlowGph = lowRes.fuelFlowGph * (1 - ratio) + highRes.fuelFlowGph * ratio;

  const midpoint = (1999 + 2300) / 2;
  const pwrPercent = weightKg <= midpoint ? lowRes.pwrPercent : highRes.pwrPercent;

  const specificRangeNmPerGal = tasKt / fuelFlowGph;

  let enduranceHr: number | undefined;
  let rangeNm: number | undefined;
  if (effectiveInputs.fuelRemainingGal != null && effectiveInputs.fuelRemainingGal > 0) {
    enduranceHr = effectiveInputs.fuelRemainingGal / fuelFlowGph;
    rangeNm = enduranceHr * tasKt;
  }

  return {
    ok: true,
    inputs: effectiveInputs,
    tasKt,
    fuelFlowGph,
    pwrPercent,
    specificRangeNmPerGal,
    enduranceHr,
    rangeNm,
  };
}

export interface TocPayload {
  tocPressureAltFt: number;
  tocOatC?: number | null;
  tocIsaDeviationC?: number | null;
  tocWeightKg: number;
}

export interface CruiseInputsFromToc {
  pressureAltitudeFt: number;
  isaDeviationC: number;
  weightKg: number;
}

export function getCruiseInputsFromTOC(payload: TocPayload): CruiseInputsFromToc {
  const { tocPressureAltFt, tocOatC, tocIsaDeviationC, tocWeightKg } = payload;

  let isaDeviationC: number;
  if (tocIsaDeviationC != null) {
    isaDeviationC = tocIsaDeviationC;
  } else if (tocOatC != null) {
    const isaTempC = 15 - 1.98 * (tocPressureAltFt / 1000);
    isaDeviationC = tocOatC - isaTempC;
  } else {
    isaDeviationC = 0;
  }

  return {
    pressureAltitudeFt: tocPressureAltFt,
    isaDeviationC,
    weightKg: tocWeightKg,
  };
}

