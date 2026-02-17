/**
 * DA-62 AFM-based landing performance computation.
 *
 * Uses trilinear interpolation (W × PA × OAT) for base ground roll,
 * 1D interpolation (W) for VREF, and applies AFM correction factors
 * for wind, runway surface, and downhill slope.
 */

import landingData from "../data/landing_da62.json";
import { trilinearFromGrid, interp1D, type Grid } from "./interp";

// ─── Types ─────────────────────────────────────────────────────

export type LandingConfigKey = "normal_flaps_ldg" | "abnormal_flaps_to_up";
export type AbnormalMode = "TO" | "UP";

export interface LandingInput {
  configKey: LandingConfigKey;
  abnormalMode?: AbnormalMode;
  W: number;              // kg
  PA: number;             // ft
  OAT: number;            // °C
  windComponentKt: number; // positive = headwind, negative = tailwind
  /** Surface type for correction purposes */
  runwaySurface: "PAVED" | "GRASS";
  /** Only used when runwaySurface === "GRASS" */
  grassCondition?: "DRY" | "WET";
  /** Grass height in cm; only used when runwaySurface === "GRASS" */
  grassLengthCm?: number;
  /** True if surface is soft (mud, snow, etc.) */
  softGround?: boolean;
  /** True if paved + wet */
  wetPaved?: boolean;
  downhillSlopePercent: number; // ≥ 0
}

export type CorrectionBreakdown = {
  windMultiplier: number;
  grassMultiplier: number;
  wetMultiplier: number;
  softGroundMultiplier: number;
  slopeMultiplier: number;
};

export type LandingResult =
  | {
      ok: true;
      baseGR_m: number;
      correctedGR_m: number;
      baseLD15_m: number;
      correctedLD15_m: number;
      vref_kias: number;
      breakdown: CorrectionBreakdown;
      meta?: { flaps: string; power: string; runway: string };
    }
  | { ok: false; error: string };

// ─── Correction Constants (AFM Landing) ────────────────────────

/** Headwind: 10 % decrease per 20 kt */
const HEADWIND_RATE = 0.10;
const HEADWIND_REF_KT = 20;

/** Tailwind: 10 % increase per 3 kt */
const TAILWIND_RATE = 0.10;
const TAILWIND_REF_KT = 3;

/** Downhill slope: 20 % increase per 1 % slope */
const SLOPE_RATE_PER_PERCENT = 0.20;

/** Grass length → GR multiplier (dry) */
const GRASS_FACTOR_5CM = 1.10;       // ≤ 5 cm
const GRASS_FACTOR_10CM = 1.15;      // 5–10 cm
const GRASS_FACTOR_OVER_10CM = 1.25; // > 10 cm

/** Wet condition (paved or grass): ×1.10 */
const WET_FACTOR = 1.10;

/** Soft ground: ×1.10 */
const SOFT_GROUND_FACTOR = 1.10;

// ─── Correction Helpers ────────────────────────────────────────

function windMultiplier(windKt: number): number {
  if (windKt === 0) return 1;
  if (windKt > 0) return 1 - (windKt / HEADWIND_REF_KT) * HEADWIND_RATE;
  return 1 + (Math.abs(windKt) / TAILWIND_REF_KT) * TAILWIND_RATE;
}

function grassMultiplier(lengthCm: number): number {
  if (lengthCm > 10) return GRASS_FACTOR_OVER_10CM;
  if (lengthCm > 5) return GRASS_FACTOR_10CM;
  return GRASS_FACTOR_5CM;
}

function slopeMultiplier(slopePercent: number): number {
  if (slopePercent <= 0) return 1;
  return 1 + slopePercent * SLOPE_RATE_PER_PERCENT;
}

// ─── Dataset access ────────────────────────────────────────────

type LandingConfig = {
  meta: { flaps: string; power: string; runway: string };
  speeds: {
    axisW: number[];
    VREF_kias?: (number | null)[];
    VREF_TO_kias?: (number | null)[];
    VREF_UP_kias?: (number | null)[];
  };
  axes: { W: number[]; PA: number[]; OAT: number[] };
  values: { GR: (number | null)[][][]; LDG_15m: (number | null)[][][] };
};

const dataset = landingData as Record<string, LandingConfig>;

// ─── Main Computation ──────────────────────────────────────────

export function computeLanding(input: LandingInput): LandingResult {
  const {
    configKey,
    abnormalMode,
    W,
    PA,
    OAT,
    windComponentKt,
    runwaySurface,
    grassCondition,
    grassLengthCm,
    softGround,
    wetPaved,
    downhillSlopePercent,
  } = input;

  const config = dataset[configKey];
  if (!config) {
    return { ok: false, error: `No data available for config "${configKey}".` };
  }

  // ── Build grid for trilinear interpolation ──────────────────
  const grid: Grid = {
    axes: config.axes,
    values: { GR: config.values.GR, LDG_15m: config.values.LDG_15m },
  };

  // ── 3D interpolation for base GR ───────────────────────────
  const grResult = trilinearFromGrid(grid, W, PA, OAT, "GR");
  if (!grResult.ok) {
    return {
      ok: false,
      error:
        "This condition is outside the AFM table (null cell encountered). " +
        "Adjust PA / OAT / W.  [" +
        (grResult.error ?? "interpolation failed") +
        "]",
    };
  }

  // ── 3D interpolation for landing distance over 15 m ─────────
  const ld15Result = trilinearFromGrid(grid, W, PA, OAT, "LDG_15m");
  if (!ld15Result.ok) {
    return {
      ok: false,
      error:
        "LDG_15m interpolation failed. " +
        "Adjust PA / OAT / W.  [" +
        (ld15Result.error ?? "interpolation failed") +
        "]",
    };
  }

  const baseGR_m = Math.round(grResult.value!);
  const baseLD15_m = Math.round(ld15Result.value!);

  // ── VREF: 1D interpolation by weight ───────────────────────
  const wAxis = config.speeds.axisW;
  if (W < wAxis[0] || W > wAxis[wAxis.length - 1]) {
    return {
      ok: false,
      error: `Weight ${W} kg is outside the speed table range (${wAxis[0]}–${wAxis[wAxis.length - 1]} kg).`,
    };
  }

  let vrefArray: (number | null)[];
  if (configKey === "normal_flaps_ldg") {
    vrefArray = config.speeds.VREF_kias!;
  } else {
    const mode = abnormalMode ?? "TO";
    vrefArray = mode === "TO" ? config.speeds.VREF_TO_kias! : config.speeds.VREF_UP_kias!;
  }

  const vrefResult = interp1D(wAxis, vrefArray, W);
  if (!vrefResult.ok) {
    return { ok: false, error: vrefResult.error ?? "VREF lookup failed." };
  }

  const vref_kias = Math.round(vrefResult.value);

  // ── Compute correction multipliers ──────────────────────────

  // 1. Wind (applies to GR and airborne segment)
  const wMult = windMultiplier(windComponentKt);

  // 2. Grass (GR only)
  const gMult = runwaySurface === "GRASS"
    ? grassMultiplier(grassLengthCm ?? 5)
    : 1;

  // 3. Wet (GR only)
  const wetMult =
    wetPaved || (runwaySurface === "GRASS" && grassCondition === "WET")
      ? WET_FACTOR
      : 1;

  // 4. Soft ground (GR only)
  const sgMult = softGround ? SOFT_GROUND_FACTOR : 1;

  // 5. Downhill slope (GR only)
  const slMult = slopeMultiplier(downhillSlopePercent);

  // ── Combine ───────────────────────────────────────────────
  // GR: all factors apply
  const correctedGR_m = Math.round(baseGR_m * gMult * wetMult * sgMult * slMult * wMult);

  // LD15: airborne segment (LD15 − GR) only affected by wind;
  // surface/grass/wet/slope only change GR, not the approach in air.
  const airborne = baseLD15_m - baseGR_m;
  const correctedLD15_m = Math.round(correctedGR_m + airborne * wMult);

  const breakdown: CorrectionBreakdown = {
    windMultiplier: wMult,
    grassMultiplier: gMult,
    wetMultiplier: wetMult,
    softGroundMultiplier: sgMult,
    slopeMultiplier: slMult,
  };

  return {
    ok: true,
    baseGR_m,
    correctedGR_m,
    baseLD15_m,
    correctedLD15_m,
    vref_kias,
    breakdown,
    meta: config.meta,
  };
}
