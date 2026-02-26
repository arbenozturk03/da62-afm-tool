export type ClimbMode = "takeoff" | "cruise";

/** Pilot UI mode: Auto (Vy then Vclimb) or Manual (one table only). */
export type ClimbProfileMode = "auto" | "manual_initial" | "manual_enroute";

/** Phase within the climb for display (Vy vs Vclimb). */
export type ClimbPhase = "initial" | "enroute";

export type ClimbFlaps = "UP" | "T/O";

export interface WeightEntry {
  kg: number;
  lb: number;
}

export interface RocGridRow {
  press_alt_ft: number;
  press_alt_m: number;
  roc_array: Array<number | null>;
}

export interface TakeoffRocTable {
  flaps: ClimbFlaps;
  v_y_kias: number;
  weight: WeightEntry;
  data: RocGridRow[];
}

export interface CruiseRocTable {
  weight: WeightEntry;
  v_climb_kias: number;
  data: RocGridRow[];
}

export interface RocGridMetadata {
  document_section: {
    section_number: string;
    title: string;
  };
  conditions: Record<string, unknown>;
  calculations?: {
    description: string;
    formula: string;
  };
  table_metadata: {
    power: string;
    gear: string;
    rate_of_climb_unit: string;
    flaps?: string;
    columns_index: Record<string, string>;
  };
}

export interface TakeoffRocJson extends RocGridMetadata {
  tables: TakeoffRocTable[];
}

export interface CruiseRocJson extends RocGridMetadata {
  tables: CruiseRocTable[];
}

export interface FuelTableRow {
  press_alt_ft: number;
  press_alt_m: number;
  oat_c: number;
  oat_f: number;
  tas_kt: number;
  roc_ft_min: number;
  roc_m_s: number;
  time_min: number;
  fuel_us_gal: number;
  distance_nm: number;
}

export interface FuelTable {
  weight: WeightEntry;
  v_climb_kias: number;
  data: FuelTableRow[];
}

export interface FuelJson {
  document_section: {
    section_number: string;
    title: string;
  };
  conditions: Record<string, unknown>;
  note: string;
  example: unknown;
  tables: FuelTable[];
}

export interface ClimbSegment {
  index: number;
  /** Table used for this segment (takeoff = Vy, cruise = Vclimb). */
  mode: ClimbMode;
  /** Phase for display: initial (Vy) or enroute (Vclimb). */
  phase: ClimbPhase;
  flaps: ClimbFlaps | null;
  altStartFt: number;
  altEndFt: number;
  oatStartC: number;
  oatEndC: number;
  oatSegmentC: number;
  weightStartKg: number;
  weightEndKg: number;
  speedKias: number | null;
  tasKtas: number | null;
  rocFpm: number | null;
  gradientPercent: number | null;
  timeMin: number | null;
  fuelUsGal: number | null;
  distanceNm: number | null;
  unsupported: boolean;
  warnings: string[];
}

/** Pilot single-flow inputs (no step, fuel density, lapse, or OAT toggle in UI). */
export interface ClimbProfileInputs {
  /** "auto" = Vy then Vclimb; "manual_initial" = Vy only; "manual_enroute" = Vclimb only. */
  mode: ClimbProfileMode;
  /** Flaps for initial climb (T/O or UP). Ignored when mode is manual_enroute (effectively UP). */
  flaps: ClimbFlaps;
  weightStartKg: number;
  fieldPAft: number;
  fieldOATc: number;
  targetPAft: number;
  /** Optional override; default = fieldPAft + 3000. Only used in Auto. */
  transitionAltitudeFt?: number;
}

export interface ClimbProfileTotals {
  totalTimeMin: number;
  totalFuelUsGal: number;
  totalDistanceNm: number;
  finalWeightKg: number;
}

export interface ClimbProfileResult {
  inputs: ClimbProfileInputs;
  segments: ClimbSegment[];
  totals: ClimbProfileTotals;
  warnings: string[];
}

