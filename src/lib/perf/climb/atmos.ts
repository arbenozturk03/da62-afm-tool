const FT_TO_M = 0.3048;

const P0 = 101325; // Pa
const T0 = 288.15; // K
const L = 0.0065; // K/m
const R = 287.058; // J/(kg·K)
const G = 9.80665; // m/s²

const RHO0 = 1.225; // kg/m³

export function isaDensityAtPressureAltitude(
  paFt: number,
  oatC: number,
): number {
  const h = paFt * FT_TO_M;

  // Standard pressure at this pressure altitude (troposphere approximation)
  const exponent = (G / (R * L));
  const p = P0 * (1 - (L * h) / T0) ** exponent;

  const tK = oatC + 273.15;

  return p / (R * tK);
}

export function kiasToTAS(kias: number, rho: number): number {
  if (rho <= 0) return kias;
  const factor = Math.sqrt(RHO0 / rho);
  return kias * factor;
}

