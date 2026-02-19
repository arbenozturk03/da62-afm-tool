export const aircraftConfig = {
  limits: {
    MTOW: 2300,
    MZFW: 2036,
  },

  densities: {
    fuel: 0.84,
    deice: 1.10,
  },

  arms: {
    frontSeats: 2.30,
    rearRow1: 3.25,
    rearRow2: 4.15,
    fuelMain: 2.63,
    fuelAux: 3.20,
    deice: 0.90,
    lhNose: 0.47,
    rhNose: 0.05,
    rearBaggageF: 4.18,
  },

  baggageLimits: {
    lhNose: 30,
    rhNose: 30,
    rearF: 40,
    rearTotal: 46,
  },

  defaults: {
    emptyMass: 1600,
    emptyCg: 2.43,
    deiceEnabled: false,
    deiceLiters: 9.09,
  },
};
