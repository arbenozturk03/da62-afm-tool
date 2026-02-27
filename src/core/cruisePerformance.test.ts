import { describe, expect, it } from "vitest";
import {
  computeCruisePerformance,
  cruiseAfmData,
  getCell,
  interpolate1D,
  bracketValue,
  bilinear,
  type CruisePerformanceInputs,
} from "./cruisePerformance";

const lowWeightTable = cruiseAfmData.cruise_performance[0];
const highWeightTable = cruiseAfmData.cruise_performance[1];

function baseInputs(partial: Partial<CruisePerformanceInputs> = {}): CruisePerformanceInputs {
  return {
    pressureAltitudeFt: 2000,
    isaDeviationC: 0,
    weightKg: 1900,
    cruiseSetting: "MED",
    ...partial,
  };
}

describe("helper utilities", () => {
  it("interpolate1D matches endpoints and midpoints", () => {
    expect(interpolate1D(0, 0, 10, 0, 10)).toBeCloseTo(0);
    expect(interpolate1D(10, 0, 10, 0, 10)).toBeCloseTo(10);
    expect(interpolate1D(5, 0, 10, 0, 10)).toBeCloseTo(5);
  });

  it("bracketValue finds correct indices and t", () => {
    const grid = [0, 10, 20];
    expect(bracketValue(0, grid)).toEqual({ i0: 0, i1: 0, t: 0 });
    expect(bracketValue(20, grid)).toEqual({ i0: 2, i1: 2, t: 0 });

    const mid = bracketValue(5, grid);
    expect(mid).not.toBeNull();
    expect(mid!.i0).toBe(0);
    expect(mid!.i1).toBe(1);
    expect(mid!.t).toBeCloseTo(0.5);
  });

  it("bilinear interpolates correctly in unit square", () => {
    // Simple plane v = x + y over [0,1]x[0,1]
    const v = bilinear(0.5, 0.5, 0, 1, 1, 2);
    expect(v).toBeCloseTo(1);
  });
});

describe("computeCruisePerformance basic lookups", () => {
  it("returns exact grid point without interpolation", () => {
    const res = computeCruisePerformance(
      baseInputs({
        pressureAltitudeFt: lowWeightTable.data[0].press_alt_ft,
        isaDeviationC: 0,
        cruiseSetting: "MED",
      }),
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const cell = getCell(lowWeightTable, 0, "MED", "isa");
    expect(cell).not.toBeNull();
    expect(res.tasKt).toBeCloseTo(cell!.tas, 6);
    expect(res.fuelFlowGph).toBeCloseTo(cell!.ff, 6);
  });

  it("performs altitude-only interpolation when ISA matches a column", () => {
    const alt0 = lowWeightTable.data[0].press_alt_ft;
    const alt1 = lowWeightTable.data[1].press_alt_ft;
    const midAlt = (alt0 + alt1) / 2;

    const cell0 = getCell(lowWeightTable, 0, "MED", "isa");
    const cell1 = getCell(lowWeightTable, 1, "MED", "isa");
    expect(cell0).not.toBeNull();
    expect(cell1).not.toBeNull();

    const expectedTas = interpolate1D(midAlt, alt0, alt1, cell0!.tas, cell1!.tas);

    const res = computeCruisePerformance(
      baseInputs({
        pressureAltitudeFt: midAlt,
        isaDeviationC: 0,
        cruiseSetting: "MED",
      }),
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.tasKt).toBeCloseTo(expectedTas, 6);
  });

  it("performs ISA-only interpolation when altitude matches a grid point", () => {
    const alt0 = lowWeightTable.data[0].press_alt_ft;
    const cellM10 = getCell(lowWeightTable, 0, "MED", "isa_m10");
    const cell0 = getCell(lowWeightTable, 0, "MED", "isa");
    expect(cellM10).not.toBeNull();
    expect(cell0).not.toBeNull();

    const expectedTas = interpolate1D(-5, -10, 0, cellM10!.tas, cell0!.tas);

    const res = computeCruisePerformance(
      baseInputs({
        pressureAltitudeFt: alt0,
        isaDeviationC: -5,
        cruiseSetting: "MED",
      }),
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.tasKt).toBeCloseTo(expectedTas, 6);
  });

  it("performs full bilinear interpolation when both axes are between grid points", () => {
    const alt0 = lowWeightTable.data[0].press_alt_ft;
    const alt1 = lowWeightTable.data[1].press_alt_ft;
    const aMid = (alt0 + alt1) / 2;

    const cell00 = getCell(lowWeightTable, 0, "MED", "isa_m10");
    const cell10 = getCell(lowWeightTable, 1, "MED", "isa_m10");
    const cell01 = getCell(lowWeightTable, 0, "MED", "isa");
    const cell11 = getCell(lowWeightTable, 1, "MED", "isa");
    expect(cell00 && cell10 && cell01 && cell11).toBeTruthy();

    const tAlt = (aMid - alt0) / (alt1 - alt0);
    const tIsa = 0.5; // between -10 and 0

    const expectedTas = bilinear(
      tAlt,
      tIsa,
      cell00!.tas,
      cell10!.tas,
      cell01!.tas,
      cell11!.tas,
    );

    const res = computeCruisePerformance(
      baseInputs({
        pressureAltitudeFt: aMid,
        isaDeviationC: -5,
        cruiseSetting: "MED",
      }),
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.tasKt).toBeCloseTo(expectedTas, 6);
  });
});

describe("weight blending and bounds", () => {
  it("blends TAS and fuel flow between weight categories", () => {
    const alt = 6000;
    const isa = 0;
    const wLow = 1999;
    const wHigh = 2300;
    const wMid = (wLow + wHigh) / 2;

    const lowRes = computeCruisePerformance(
      baseInputs({
        weightKg: wLow,
        pressureAltitudeFt: alt,
        isaDeviationC: isa,
      }),
    );
    const highRes = computeCruisePerformance(
      baseInputs({
        weightKg: wHigh,
        pressureAltitudeFt: alt,
        isaDeviationC: isa,
      }),
    );
    const midRes = computeCruisePerformance(
      baseInputs({
        weightKg: wMid,
        pressureAltitudeFt: alt,
        isaDeviationC: isa,
      }),
    );

    expect(lowRes.ok && highRes.ok && midRes.ok).toBe(true);
    if (!lowRes.ok || !highRes.ok || !midRes.ok) return;

    const blendRatio = (wMid - wLow) / (wHigh - wLow);
    const expectedTas = lowRes.tasKt * (1 - blendRatio) + highRes.tasKt * blendRatio;
    const expectedFf = lowRes.fuelFlowGph * (1 - blendRatio) + highRes.fuelFlowGph * blendRatio;

    expect(midRes.tasKt).toBeCloseTo(expectedTas, 6);
    expect(midRes.fuelFlowGph).toBeCloseTo(expectedFf, 6);
  });

  it("rejects weights outside AFM range", () => {
    const tooLow = computeCruisePerformance(baseInputs({ weightKg: 0.1 }));
    const tooHigh = computeCruisePerformance(baseInputs({ weightKg: 2500 }));

    expect(tooLow.ok).toBe(false);
    expect(tooHigh.ok).toBe(false);
    if (tooLow.ok || tooHigh.ok) return;
    expect(tooLow.error).toMatch(/Weight out of AFM range/);
    expect(tooHigh.error).toMatch(/Weight out of AFM range/);
  });
});

describe("null / missing handling", () => {
  it("errors when required AFM cells are null", () => {
    const res = computeCruisePerformance(
      baseInputs({
        pressureAltitudeFt: 16000,
        isaDeviationC: 30,
        cruiseSetting: "HIGH",
      }),
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/Not available in AFM/);
  });

  it("errors when cruise setting row is missing at an altitude", () => {
    const res = computeCruisePerformance(
      baseInputs({
        pressureAltitudeFt: highWeightTable.data[highWeightTable.data.length - 1].press_alt_ft,
        isaDeviationC: 0,
        cruiseSetting: "LOW",
      }),
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/Cruise setting not available at this altitude in AFM/);
  });
});

