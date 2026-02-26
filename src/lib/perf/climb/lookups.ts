import { cruiseData, fuelData, takeoffData } from "./load";
import { findBounds, lerp, bilinearInterpolate } from "./interp";
import type {
  ClimbFlaps,
  ClimbMode,
  CruiseRocTable,
  FuelTable,
  FuelTableRow,
  TakeoffRocTable,
} from "./types";

const OAT_AXIS: number[] = [-20, -10, 0, 10, 20, 30, 40, 50];

export interface GridRocResult {
  rocFpm: number | null;
  unsupported: boolean;
  clampedWeight: boolean;
  clampedPA: boolean;
  clampedOAT: boolean;
}

export interface SpeedResult {
  speedKias: number | null;
  clampedWeight: boolean;
}

export interface CumFuelResult {
  timeMin: number;
  fuelUsGal: number;
  distanceNm: number;
  clampedWeight: boolean;
  clampedPA: boolean;
}

function getRocFromTable(
  table: TakeoffRocTable | CruiseRocTable,
  paFt: number,
  oatC: number,
): { value: number | null; unsupported: boolean; clampedPA: boolean; clampedOAT: boolean } {
  const rows = table.data;
  if (!rows.length) {
    return { value: null, unsupported: true, clampedPA: false, clampedOAT: false };
  }

  const paAxis = rows.map((r) => r.press_alt_ft);
  const paBounds = findBounds(paAxis, paFt);
  const rowLow = rows.find((r) => r.press_alt_ft === paBounds.low)!;
  const rowHigh = rows.find((r) => r.press_alt_ft === paBounds.high)!;

  const oatBounds = findBounds(OAT_AXIS, oatC);
  const iOatLow = OAT_AXIS.indexOf(oatBounds.low);
  const iOatHigh = OAT_AXIS.indexOf(oatBounds.high);

  // Bilinear grid: x = OAT, y = PA. q11=(OAT_low,PA_low), q21=(OAT_high,PA_low), q12=(OAT_low,PA_high), q22=(OAT_high,PA_high)
  const q11 = rowLow.roc_array[iOatLow] ?? null;
  const q21 = rowLow.roc_array[iOatHigh] ?? null;
  const q12 = rowHigh.roc_array[iOatLow] ?? null;
  const q22 = rowHigh.roc_array[iOatHigh] ?? null;

  const { value, unsupported } = bilinearInterpolate(
    oatC,
    paFt,
    oatBounds.low,
    oatBounds.high,
    paBounds.low,
    paBounds.high,
    q11,
    q12,
    q21,
    q22,
  );

  return {
    value,
    unsupported,
    clampedPA: paBounds.clamped,
    clampedOAT: oatBounds.clamped,
  };
}

function selectWeightTables<T extends { weight: { kg: number } }>(
  tables: T[],
  weightKg: number,
): { low: T; high: T; clamped: boolean } {
  const sorted = [...tables].sort((a, b) => a.weight.kg - b.weight.kg);
  if (sorted.length === 0) {
    throw new Error("No tables available for lookup");
  }

  if (weightKg <= sorted[0].weight.kg) {
    return { low: sorted[0], high: sorted[0], clamped: true };
  }

  const last = sorted[sorted.length - 1];
  if (weightKg >= last.weight.kg) {
    return { low: last, high: last, clamped: true };
  }

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (weightKg >= a.weight.kg && weightKg <= b.weight.kg) {
      return { low: a, high: b, clamped: false };
    }
  }

  return { low: sorted[0], high: last, clamped: true };
}

export function lookupGridRoc(
  mode: ClimbMode,
  flaps: ClimbFlaps | undefined,
  weightKg: number,
  paFt: number,
  oatC: number,
): GridRocResult {
  let tables: Array<TakeoffRocTable | CruiseRocTable> = [];

  if (mode === "takeoff") {
    if (!flaps) {
      return {
        rocFpm: null,
        unsupported: true,
        clampedWeight: false,
        clampedPA: false,
        clampedOAT: false,
      };
    }
    tables = takeoffData.tables.filter((t) => t.flaps === flaps);
  } else {
    tables = cruiseData.tables;
  }

  if (tables.length === 0) {
    return {
      rocFpm: null,
      unsupported: true,
      clampedWeight: false,
      clampedPA: false,
      clampedOAT: false,
    };
  }

  const { low, high, clamped } = selectWeightTables(tables, weightKg);

  const lowRes = getRocFromTable(low as any, paFt, oatC);
  const highRes = getRocFromTable(high as any, paFt, oatC);

  if (lowRes.unsupported || highRes.unsupported || lowRes.value == null || highRes.value == null) {
    return {
      rocFpm: null,
      unsupported: true,
      clampedWeight: clamped,
      clampedPA: lowRes.clampedPA || highRes.clampedPA,
      clampedOAT: lowRes.clampedOAT || highRes.clampedOAT,
    };
  }

  let value: number;
  if (low.weight.kg === high.weight.kg) {
    value = lowRes.value;
  } else {
    const t = (weightKg - low.weight.kg) / (high.weight.kg - low.weight.kg);
    value = lerp(lowRes.value, highRes.value, t);
  }

  return {
    rocFpm: value,
    unsupported: false,
    clampedWeight: clamped,
    clampedPA: lowRes.clampedPA || highRes.clampedPA,
    clampedOAT: lowRes.clampedOAT || highRes.clampedOAT,
  };
}

export function lookupGridSpeed(
  mode: ClimbMode,
  flaps: ClimbFlaps | undefined,
  weightKg: number,
): SpeedResult {
  let tables: Array<TakeoffRocTable | CruiseRocTable> = [];

  if (mode === "takeoff") {
    if (!flaps) {
      return { speedKias: null, clampedWeight: false };
    }
    tables = takeoffData.tables.filter((t) => t.flaps === flaps);
  } else {
    tables = cruiseData.tables;
  }

  if (tables.length === 0) {
    return { speedKias: null, clampedWeight: false };
  }

  const { low, high, clamped } = selectWeightTables(tables, weightKg);

  // Vy / Vclimb are fixed per table — no interpolation; use nearest weight table's speed
  const vLow =
    "v_y_kias" in low ? (low as TakeoffRocTable).v_y_kias : (low as CruiseRocTable).v_climb_kias;
  const vHigh =
    "v_y_kias" in high ? (high as TakeoffRocTable).v_y_kias : (high as CruiseRocTable).v_climb_kias;

  let value: number;
  if (low.weight.kg === high.weight.kg) {
    value = vLow;
  } else {
    const distToLow = Math.abs(weightKg - low.weight.kg);
    const distToHigh = Math.abs(weightKg - high.weight.kg);
    value = distToLow <= distToHigh ? vLow : vHigh;
  }

  return { speedKias: value, clampedWeight: clamped };
}

function selectFuelWeightTables(weightKg: number): {
  low: FuelTable;
  high: FuelTable;
  clamped: boolean;
} {
  const tables = fuelData.tables;
  const sorted = [...tables].sort((a, b) => a.weight.kg - b.weight.kg);
  if (sorted.length === 0) {
    throw new Error("No fuel tables available");
  }

  if (weightKg <= sorted[0].weight.kg) {
    return { low: sorted[0], high: sorted[0], clamped: true };
  }

  const last = sorted[sorted.length - 1];
  if (weightKg >= last.weight.kg) {
    return { low: last, high: last, clamped: true };
  }

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (weightKg >= a.weight.kg && weightKg <= b.weight.kg) {
      return { low: a, high: b, clamped: false };
    }
  }

  return { low: sorted[0], high: last, clamped: true };
}

function interpFuelRow(rows: FuelTableRow[], paFt: number): {
  row: FuelTableRow;
  clampedPA: boolean;
} {
  const axis = rows.map((r) => r.press_alt_ft);
  const bounds = findBounds(axis, paFt);
  const rLow = rows.find((r) => r.press_alt_ft === bounds.low)!;
  const rHigh = rows.find((r) => r.press_alt_ft === bounds.high)!;

  if (bounds.low === bounds.high) {
    return { row: rLow, clampedPA: bounds.clamped };
  }

  const t = (paFt - bounds.low) / (bounds.high - bounds.low);

  const row: FuelTableRow = {
    press_alt_ft: paFt,
    press_alt_m: lerp(rLow.press_alt_m, rHigh.press_alt_m, t),
    oat_c: lerp(rLow.oat_c, rHigh.oat_c, t),
    oat_f: lerp(rLow.oat_f, rHigh.oat_f, t),
    tas_kt: lerp(rLow.tas_kt, rHigh.tas_kt, t),
    roc_ft_min: lerp(rLow.roc_ft_min, rHigh.roc_ft_min, t),
    roc_m_s: lerp(rLow.roc_m_s, rHigh.roc_m_s, t),
    time_min: lerp(rLow.time_min, rHigh.time_min, t),
    fuel_us_gal: lerp(rLow.fuel_us_gal, rHigh.fuel_us_gal, t),
    distance_nm: lerp(rLow.distance_nm, rHigh.distance_nm, t),
  };

  return { row, clampedPA: bounds.clamped };
}

export function lookupCumFuel(weightKg: number, paFt: number): CumFuelResult {
  const { low, high, clamped } = selectFuelWeightTables(weightKg);

  const lowRowRes = interpFuelRow(low.data, paFt);
  const highRowRes = interpFuelRow(high.data, paFt);

  let timeMin: number;
  let fuelUsGal: number;
  let distanceNm: number;

  if (low.weight.kg === high.weight.kg) {
    timeMin = lowRowRes.row.time_min;
    fuelUsGal = lowRowRes.row.fuel_us_gal;
    distanceNm = lowRowRes.row.distance_nm;
  } else {
    const t = (weightKg - low.weight.kg) / (high.weight.kg - low.weight.kg);
    timeMin = lerp(lowRowRes.row.time_min, highRowRes.row.time_min, t);
    fuelUsGal = lerp(lowRowRes.row.fuel_us_gal, highRowRes.row.fuel_us_gal, t);
    distanceNm = lerp(lowRowRes.row.distance_nm, highRowRes.row.distance_nm, t);
  }

  return {
    timeMin,
    fuelUsGal,
    distanceNm,
    clampedWeight: clamped,
    clampedPA: lowRowRes.clampedPA || highRowRes.clampedPA,
  };
}

