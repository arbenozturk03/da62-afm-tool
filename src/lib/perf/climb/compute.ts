import {
  type ClimbFlaps,
  type ClimbMode,
  type ClimbPhase,
  type ClimbProfileInputs,
  type ClimbProfileResult,
  type ClimbProfileTotals,
  type ClimbSegment,
} from "./types";
import { lookupCumFuel, lookupGridRoc, lookupGridSpeed } from "./lookups";
import { isaDensityAtPressureAltitude, kiasToTAS } from "./atmos";

const INTERNAL_STEP_FT = 500;
const LAPSE_RATE_C_PER_1000FT = 2.0;
const FUEL_DENSITY_KG_PER_GAL = 2.72;
const OAT_CORRECTION_ENABLED = true;
const DEFAULT_TRANSITION_DELTA_FT = 3000;

function oatAtAltitudeFt(
  altFt: number,
  fieldPAft: number,
  fieldOATc: number,
): number {
  const delta = altFt - fieldPAft;
  return fieldOATc - (LAPSE_RATE_C_PER_1000FT / 1000) * delta;
}

function runSegmentLoop(
  mode: ClimbMode,
  phase: ClimbPhase,
  flaps: ClimbFlaps | undefined,
  weightStartKg: number,
  altStartFt: number,
  altEndLimitFt: number,
  fieldPAft: number,
  fieldOATc: number,
  startIndex: number,
): { segments: ClimbSegment[]; nextWeightKg: number; nextAltFt: number; warnings: string[] } {
  const segments: ClimbSegment[] = [];
  const warnings: string[] = [];
  let weightKg = weightStartKg;
  let altFt = altStartFt;
  let idx = startIndex;

  while (altFt < altEndLimitFt - 1) {
    const altEndFt = Math.min(altFt + INTERNAL_STEP_FT, altEndLimitFt);
    const midAltFt = (altFt + altEndFt) / 2;

    const oatStartC = oatAtAltitudeFt(altFt, fieldPAft, fieldOATc);
    const oatEndC = oatAtAltitudeFt(altEndFt, fieldPAft, fieldOATc);
    const oatMidC = oatAtAltitudeFt(midAltFt, fieldPAft, fieldOATc);

    const segWarnings: string[] = [];
    const speedRes = lookupGridSpeed(mode, flaps, weightKg);
    if (speedRes.clampedWeight) segWarnings.push("Weight clamped to speed table range.");
    const rocStart = lookupGridRoc(mode, flaps, weightKg, altFt, oatStartC);
    const rocEndGuess = lookupGridRoc(mode, flaps, weightKg, altEndFt, oatEndC);
    if (rocStart.clampedWeight || rocEndGuess.clampedWeight) segWarnings.push("Weight clamped to ROC table range.");
    if (rocStart.clampedPA || rocEndGuess.clampedPA) segWarnings.push("Pressure altitude clamped to table bounds.");
    if (rocStart.clampedOAT || rocEndGuess.clampedOAT) segWarnings.push("OAT clamped to table bounds.");

    const deltaAltFt = altEndFt - altFt;
    let unsupported = false;
    let rocMidFpm: number | null = null;
    let timeMin: number | null = null;
    let segFuelGal: number | null = null;
    let segDistNm: number | null = null;
    let weightEndKg = weightKg;

    if (
      rocStart.unsupported || rocEndGuess.unsupported ||
      rocStart.rocFpm == null || rocEndGuess.rocFpm == null
    ) {
      unsupported = true;
      segWarnings.push("AFM data not available in this range.");
    } else {
      const cumStartGuess = lookupCumFuel(weightKg, altFt);
      const cumEndGuess = lookupCumFuel(weightKg, altEndFt);
      const segFuelGuess = cumEndGuess.fuelUsGal - cumStartGuess.fuelUsGal;
      const weightEndGuessKg = weightKg - segFuelGuess * FUEL_DENSITY_KG_PER_GAL;
      const weightMidKg = (weightKg + weightEndGuessKg) / 2;

      const rocMidRes = lookupGridRoc(mode, flaps, weightMidKg, midAltFt, oatMidC);
      if (rocMidRes.unsupported || rocMidRes.rocFpm == null || rocMidRes.rocFpm <= 0) {
        unsupported = true;
        segWarnings.push("Midpoint ROC could not be determined (AFM gap).");
      } else {
        rocMidFpm = rocMidRes.rocFpm;
        timeMin = deltaAltFt / rocMidFpm;
        const cumStartRef = lookupCumFuel(weightMidKg, altFt);
        const cumEndRef = lookupCumFuel(weightMidKg, altEndFt);
        segFuelGal = cumEndRef.fuelUsGal - cumStartRef.fuelUsGal;
        segDistNm = cumEndRef.distanceNm - cumStartRef.distanceNm;

        if (OAT_CORRECTION_ENABLED) {
          const isaAtFieldC = 15 - LAPSE_RATE_C_PER_1000FT * fieldPAft / 1000;
          const oatDeltaC = fieldOATc - isaAtFieldC;
          const factor = 1 + 0.1 * (oatDeltaC / 10);
          segFuelGal *= factor;
          segDistNm *= factor;
        }
        weightEndKg = weightKg - segFuelGal * FUEL_DENSITY_KG_PER_GAL;
      }
    }

    let tasKtas: number | null = null;
    let gradientPercent: number | null = null;
    const speedKias = speedRes.speedKias ?? null;
    if (!unsupported && speedKias != null && rocMidFpm != null) {
      const rho = isaDensityAtPressureAltitude(midAltFt, oatMidC);
      tasKtas = kiasToTAS(speedKias, rho);
      gradientPercent = (rocMidFpm / tasKtas) * 0.98;
    }
    if (speedKias == null) segWarnings.push("Speed schedule not available for this weight range.");

    segments.push({
      index: idx,
      mode,
      phase,
      flaps: mode === "takeoff" ? flaps ?? null : null,
      altStartFt: altFt,
      altEndFt,
      oatStartC,
      oatEndC,
      oatSegmentC: oatMidC,
      weightStartKg: weightKg,
      weightEndKg,
      speedKias,
      tasKtas,
      rocFpm: rocMidFpm,
      gradientPercent,
      timeMin,
      fuelUsGal: segFuelGal,
      distanceNm: segDistNm,
      unsupported,
      warnings: segWarnings,
    });

    segWarnings.forEach((w) => { if (!warnings.includes(w)) warnings.push(w); });
    weightKg = weightEndKg;
    altFt = altEndFt;
    idx += 1;
  }

  return { segments, nextWeightKg: weightKg, nextAltFt: altFt, warnings };
}

export function computeClimbProfile(inputs: ClimbProfileInputs): ClimbProfileResult {
  const warnings: string[] = [];

  if (inputs.targetPAft <= inputs.fieldPAft) {
    return {
      inputs,
      segments: [],
      totals: {
        totalTimeMin: 0,
        totalFuelUsGal: 0,
        totalDistanceNm: 0,
        finalWeightKg: inputs.weightStartKg,
      },
      warnings: ["Target altitude must be above field pressure altitude."],
    };
  }

  const allSegments: ClimbSegment[] = [];
  let weightKg = inputs.weightStartKg;
  let altFt = inputs.fieldPAft;
  let segIndex = 0;

  if (inputs.mode === "auto") {
    const transitionAltFt = inputs.transitionAltitudeFt ?? inputs.fieldPAft + DEFAULT_TRANSITION_DELTA_FT;
    const initialEndFt = Math.min(transitionAltFt, inputs.targetPAft);

    if (altFt < initialEndFt) {
      const r1 = runSegmentLoop(
        "takeoff",
        "initial",
        inputs.flaps,
        weightKg,
        altFt,
        initialEndFt,
        inputs.fieldPAft,
        inputs.fieldOATc,
        segIndex,
      );
      allSegments.push(...r1.segments);
      segIndex += r1.segments.length;
      weightKg = r1.nextWeightKg;
      altFt = r1.nextAltFt;
      r1.warnings.forEach((w) => { if (!warnings.includes(w)) warnings.push(w); });
    }

    if (altFt < inputs.targetPAft) {
      const r2 = runSegmentLoop(
        "cruise",
        "enroute",
        undefined,
        weightKg,
        altFt,
        inputs.targetPAft,
        inputs.fieldPAft,
        inputs.fieldOATc,
        segIndex,
      );
      allSegments.push(...r2.segments);
      r2.warnings.forEach((w) => { if (!warnings.includes(w)) warnings.push(w); });
    }
  } else if (inputs.mode === "manual_initial") {
    const r = runSegmentLoop(
      "takeoff",
      "initial",
      inputs.flaps,
      weightKg,
      altFt,
      inputs.targetPAft,
      inputs.fieldPAft,
      inputs.fieldOATc,
      0,
    );
    allSegments.push(...r.segments);
    r.warnings.forEach((w) => { if (!warnings.includes(w)) warnings.push(w); });
  } else {
    const r = runSegmentLoop(
      "cruise",
      "enroute",
      undefined,
      weightKg,
      altFt,
      inputs.targetPAft,
      inputs.fieldPAft,
      inputs.fieldOATc,
      0,
    );
    allSegments.push(...r.segments);
    r.warnings.forEach((w) => { if (!warnings.includes(w)) warnings.push(w); });
  }

  let totalTimeMin = 0;
  let totalFuelUsGal = 0;
  let totalDistanceNm = 0;
  for (const seg of allSegments) {
    if (seg.timeMin != null) totalTimeMin += seg.timeMin;
    if (seg.fuelUsGal != null) totalFuelUsGal += seg.fuelUsGal;
    if (seg.distanceNm != null) totalDistanceNm += seg.distanceNm;
  }
  const finalWeightKg = inputs.weightStartKg - totalFuelUsGal * FUEL_DENSITY_KG_PER_GAL;

  const totals: ClimbProfileTotals = {
    totalTimeMin,
    totalFuelUsGal,
    totalDistanceNm,
    finalWeightKg,
  };

  return {
    inputs,
    segments: allSegments,
    totals,
    warnings,
  };
}
