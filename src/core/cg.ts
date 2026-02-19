import { aircraftConfig } from "../data/aircraftConfig";

export type CabinMode = "passenger" | "cargo";

export interface CgInputs {
  emptyMass: number;
  emptyCg: number;
  seat1: number;
  seat2: number;
  seat3: number;
  seat4: number;
  seat5: number;
  seat6: number;
  seat7: number;
  lhNoseKg: number;
  rhNoseKg: number;
  rearFKg: number;
  mainFuelL: number;
  auxFuelL: number;
  deiceEnabled: boolean;
  deiceLiters: number;
  mode: CabinMode;
}

export interface CgStation {
  label: string;
  mass: number;
  arm: number;
  moment: number;
}

export interface CgResult {
  stations: CgStation[];
  totalMass: number;
  totalMoment: number;
  cg: number;
  zeroFuelMass: number;
  zeroFuelMoment: number;
  zeroFuelCg: number;
  warnings: string[];
}

function station(label: string, mass: number, arm: number): CgStation {
  return { label, mass, arm, moment: mass * arm };
}

export function computeCg(inputs: CgInputs): CgResult {
  const { arms, densities, limits, baggageLimits } = aircraftConfig;

  const frontMass = inputs.seat1 + inputs.seat2;
  const middleMass = inputs.seat3 + inputs.seat4 + inputs.seat5;

  const rearPaxMass = inputs.mode === "passenger" ? inputs.seat6 + inputs.seat7 : 0;
  const rearCargoMass = inputs.mode === "cargo" ? inputs.rearFKg : 0;

  const mainFuelKg = inputs.mainFuelL * densities.fuel;
  const auxFuelKg = inputs.auxFuelL * densities.fuel;
  const deiceKg = inputs.deiceEnabled ? inputs.deiceLiters * densities.deice : 0;

  const stations: CgStation[] = [
    station("Empty Aircraft", inputs.emptyMass, inputs.emptyCg),
    station("Front Seats", frontMass, arms.frontSeats),
    station("Middle Row", middleMass, arms.rearRow1),
  ];

  if (inputs.mode === "passenger") {
    stations.push(station("Rear Seats", rearPaxMass, arms.rearRow2));
  } else {
    stations.push(station("Rear Cargo (F)", rearCargoMass, arms.rearBaggageF));
  }

  stations.push(
    station("LH Nose Baggage", inputs.lhNoseKg, arms.lhNose),
    station("RH Nose Baggage", inputs.rhNoseKg, arms.rhNose),
    station("Main Fuel", mainFuelKg, arms.fuelMain),
    station("Aux Fuel", auxFuelKg, arms.fuelAux),
  );

  if (inputs.deiceEnabled) {
    stations.push(station("De-Ice Fluid", deiceKg, arms.deice));
  }

  const totalMass = stations.reduce((s, st) => s + st.mass, 0);
  const totalMoment = stations.reduce((s, st) => s + st.moment, 0);
  const cg = totalMass > 0 ? totalMoment / totalMass : 0;

  const fuelMass = mainFuelKg + auxFuelKg;
  const fuelMoment = mainFuelKg * arms.fuelMain + auxFuelKg * arms.fuelAux;
  const zeroFuelMass = totalMass - fuelMass;
  const zeroFuelMoment = totalMoment - fuelMoment;
  const zeroFuelCg = zeroFuelMass > 0 ? zeroFuelMoment / zeroFuelMass : 0;

  const warnings: string[] = [];

  if (totalMass > limits.MTOW) {
    warnings.push(`MTOW exceeded: ${totalMass.toFixed(1)} kg > ${limits.MTOW} kg`);
  }
  if (zeroFuelMass > limits.MZFW) {
    warnings.push(`MZFW exceeded: ${zeroFuelMass.toFixed(1)} kg > ${limits.MZFW} kg`);
  }
  if (inputs.lhNoseKg > baggageLimits.lhNose) {
    warnings.push(`LH Nose over limit: ${inputs.lhNoseKg} kg > ${baggageLimits.lhNose} kg`);
  }
  if (inputs.rhNoseKg > baggageLimits.rhNose) {
    warnings.push(`RH Nose over limit: ${inputs.rhNoseKg} kg > ${baggageLimits.rhNose} kg`);
  }
  if (inputs.mode === "cargo" && inputs.rearFKg > baggageLimits.rearF) {
    warnings.push(`Rear F over limit: ${inputs.rearFKg} kg > ${baggageLimits.rearF} kg`);
  }
  const rearTotal = inputs.mode === "cargo" ? inputs.rearFKg : 0;
  if (rearTotal > baggageLimits.rearTotal) {
    warnings.push(`Rear total over limit: ${rearTotal} kg > ${baggageLimits.rearTotal} kg`);
  }

  return {
    stations,
    totalMass,
    totalMoment,
    cg,
    zeroFuelMass,
    zeroFuelMoment,
    zeroFuelCg,
    warnings,
  };
}

/** Ray-casting point-in-polygon test */
export function isInsideEnvelope(
  cx: number,
  cy: number,
  polygon: { x: number; y: number }[],
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect =
      yi > cy !== yj > cy && cx < ((xj - xi) * (cy - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
