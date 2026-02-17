/**
 * AFM Section 5.3.6 — TAKE-OFF DISTANCE correction factors.
 *
 * All corrections are multiplicative.
 * GR  corrections: grass, wet grass, soft ground, slope.
 * TOD corrections: wind (applied to full TOD after GR delta propagates).
 *
 * Speeds (VR, V50) are NOT affected by these corrections.
 */

// ─── Constants (AFM 5.3.6) ────────────────────────────────────

/** AFM: decrease TOD by 10 % for each 12 kt headwind */
const HEADWIND_RATE = 0.10;
const HEADWIND_REF_KT = 12;

/** AFM: increase TOD by 10 % for each 3 kt tailwind */
const TAILWIND_RATE = 0.10;
const TAILWIND_REF_KT = 3;

/** AFM: grass length → GR multiplier (dry) */
const GRASS_FACTOR_5CM = 1.10;   // ≤ 5 cm
const GRASS_FACTOR_10CM = 1.15;  // 5–10 cm
const GRASS_FACTOR_25CM = 1.25;  // 10–25 cm
const GRASS_MAX_CM = 25;         // > 25 cm → takeoff not permitted

/** AFM: wet grass adds 10 % on top of dry grass factor */
const WET_GRASS_FACTOR = 1.10;

/** AFM: soft ground increases GR by 45 % */
const SOFT_GROUND_FACTOR = 1.45;

/** Wet paved runway: GR multiplier ×1.1 */
const WET_PAVED_GR_FACTOR = 1.1;

/** AFM: 10 % GR increase per 1 % uphill slope */
const SLOPE_RATE_PER_PERCENT = 0.10;

// ─── Types ─────────────────────────────────────────────────────

export type CorrectionInputs = {
  /** Positive = headwind, negative = tailwind (kt) */
  windComponentKt: number;
  /** Surface type for correction purposes */
  runwaySurface: "PAVED" | "GRASS";
  /** Only used when runwaySurface === "GRASS" */
  grassCondition?: "DRY" | "WET";
  /** Grass height in cm; only used when runwaySurface === "GRASS" */
  grassLengthCm?: number;
  /** True if surface is soft (mud, snow, etc.) */
  softGround?: boolean;
  /** True if paved + wet (×0.9 GR) */
  wetPaved?: boolean;
  /** Uphill slope in percent (e.g. 2 = 2 %). Always ≥ 0. */
  slopePercent?: number;
};

export type CorrectionBreakdown = {
  windMultiplier: number;
  grassMultiplier: number;
  wetGrassMultiplier: number;
  softGroundMultiplier: number;
  wetPavedMultiplier: number;
  slopeMultiplier: number;
};

export type CorrectionResult =
  | {
      ok: true;
      correctedGroundRoll: number;
      correctedTakeoff15m: number;
      breakdown: CorrectionBreakdown;
    }
  | { ok: false; error: string };

// ─── Helpers ───────────────────────────────────────────────────

/**
 * AFM 5.3.6 — Wind correction factor.
 *   Headwind → factor < 1 (shorter TOD).
 *   Tailwind → factor > 1 (longer TOD).
 */
function windMultiplier(windKt: number): number {
  if (windKt >= 0) {
    // Headwind: decrease by 10 % per 12 kt
    return 1 - (windKt / HEADWIND_REF_KT) * HEADWIND_RATE;
  }
  // Tailwind: increase by 10 % per 3 kt
  return 1 + (Math.abs(windKt) / TAILWIND_REF_KT) * TAILWIND_RATE;
}

/**
 * AFM 5.3.6 — Dry grass GR correction factor by grass height.
 * Returns null if grass length exceeds AFM limit (>25 cm).
 */
function grassMultiplier(lengthCm: number): number | null {
  if (lengthCm > GRASS_MAX_CM) return null; // takeoff not permitted
  if (lengthCm > 10) return GRASS_FACTOR_25CM;  // 10–25 cm
  if (lengthCm > 5) return GRASS_FACTOR_10CM;   // 5–10 cm
  return GRASS_FACTOR_5CM;                        // ≤ 5 cm
}

// ─── Main correction function ──────────────────────────────────

/**
 * Apply AFM 5.3.6 correction factors to base (paved, dry, level,
 * zero-wind) takeoff distances.
 *
 * Application order for GR:
 *   1. Dry grass   (if GRASS)
 *   2. Wet grass   (if GRASS + WET, applied AFTER dry grass)
 *   3. Soft ground (additive on top of grass)
 *   4. Uphill slope
 *   5. Wind (headwind/tailwind)
 *
 * Application for TOD_15m:
 *   1. Propagate GR delta (corrected_GR − base_GR) into TOD_15m
 *   2. Wind multiplier on the resulting TOD_15m
 */
export function applyTakeoffCorrections(
  baseResults: { groundRoll_m: number; takeoff15m_m: number },
  inputs: CorrectionInputs
): CorrectionResult {
  const { groundRoll_m, takeoff15m_m } = baseResults;

  // ── 1. Wind (GR + TOD) ──────────────────────────────────────
  const wMult = windMultiplier(inputs.windComponentKt);

  // ── 2. Grass (GR only) ──────────────────────────────────────
  let gMult = 1; // no correction for paved
  let wgMult = 1;

  if (inputs.runwaySurface === "GRASS") {
    const len = inputs.grassLengthCm ?? 5; // default to short grass

    const gFactor = grassMultiplier(len);
    if (gFactor === null) {
      // AFM: > 25 cm — takeoff not permitted
      return { ok: false, error: "Takeoff not permitted per AFM (grass > 25 cm)." };
    }
    gMult = gFactor;

    // AFM: wet grass adds 10 % ON TOP of dry grass correction
    if (inputs.grassCondition === "WET") {
      wgMult = WET_GRASS_FACTOR;
    }
  }

  // ── 3. Wet paved (GR only) ─────────────────────────────────
  const wpMult = inputs.wetPaved ? WET_PAVED_GR_FACTOR : 1;

  // ── 4. Soft ground (GR only) ────────────────────────────────
  const sgMult = inputs.softGround ? SOFT_GROUND_FACTOR : 1;

  // ── 5. Uphill slope (GR only) ───────────────────────────────
  const slope = Math.max(inputs.slopePercent ?? 0, 0);
  const slMult = 1 + slope * SLOPE_RATE_PER_PERCENT;

  // ── Combine ──────────────────────────────────────────────────
  // Wind now applies to both GR and TOD (AFM 5.3.6)
  const correctedGR = groundRoll_m * gMult * wgMult * wpMult * sgMult * slMult * wMult;

  // Airborne segment stays the same; GR increase propagates into TOD.
  // Wind scales the entire TOD.
  const airborne = takeoff15m_m - groundRoll_m;
  const correctedTOD = (correctedGR + airborne * wMult);

  return {
    ok: true,
    correctedGroundRoll: Math.round(correctedGR),
    correctedTakeoff15m: Math.round(correctedTOD),
    breakdown: {
      windMultiplier: wMult,
      grassMultiplier: gMult,
      wetGrassMultiplier: wgMult,
      softGroundMultiplier: sgMult,
      wetPavedMultiplier: wpMult,
      slopeMultiplier: slMult,
    },
  };
}
