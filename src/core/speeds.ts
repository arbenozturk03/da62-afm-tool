/**
 * DA-62 AFM-based speed schedule.
 *
 * Speeds (VR, V50) depend only on weight and flap configuration.
 * Between two weight breakpoints the values are linearly interpolated
 * ONLY when the endpoints differ; otherwise the value stays constant.
 * Outside the supported weight range the nearest endpoint is used (clamp).
 */

type SpeedRow = { weight: number; VR: number; V50: number };

const SPEEDS_TO: SpeedRow[] = [
  { weight: 1800, VR: 76, V50: 83 },
  { weight: 1900, VR: 76, V50: 83 },
  { weight: 1999, VR: 76, V50: 83 },
  { weight: 2100, VR: 78, V50: 86 },
  { weight: 2200, VR: 78, V50: 86 },
  { weight: 2300, VR: 78, V50: 86 },
];

const SPEEDS_UP: SpeedRow[] = [
  { weight: 1800, VR: 80, V50: 87 },
  { weight: 1900, VR: 80, V50: 87 },
  { weight: 1999, VR: 80, V50: 87 },
  { weight: 2100, VR: 80, V50: 89 },
  { weight: 2200, VR: 80, V50: 89 },
  { weight: 2300, VR: 80, V50: 89 },
];

function lerp(a: number, b: number, t: number): number {
  if (a === b) return a;                 // identical → no interpolation
  return a + (b - a) * t;
}

function lookupSpeed(
  table: SpeedRow[],
  weightKg: number,
): { VR: number; V50: number } {
  // Clamp below
  if (weightKg <= table[0].weight) {
    return { VR: table[0].VR, V50: table[0].V50 };
  }
  // Clamp above
  if (weightKg >= table[table.length - 1].weight) {
    const last = table[table.length - 1];
    return { VR: last.VR, V50: last.V50 };
  }

  // Find bracketing interval
  for (let i = 0; i < table.length - 1; i++) {
    const lo = table[i];
    const hi = table[i + 1];
    if (weightKg >= lo.weight && weightKg <= hi.weight) {
      const t =
        hi.weight === lo.weight
          ? 0
          : (weightKg - lo.weight) / (hi.weight - lo.weight);
      return {
        VR: Math.round(lerp(lo.VR, hi.VR, t)),
        V50: Math.round(lerp(lo.V50, hi.V50, t)),
      };
    }
  }

  // Fallback (shouldn't reach)
  const last = table[table.length - 1];
  return { VR: last.VR, V50: last.V50 };
}

export function getSpeeds(input: {
  flaps: "TO" | "UP";
  weightKg: number;
}): { VR: number; V50: number } {
  const table = input.flaps === "TO" ? SPEEDS_TO : SPEEDS_UP;
  return lookupSpeed(table, input.weightKg);
}
