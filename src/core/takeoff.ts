import gridTO from "../data/takeoff_dry_to.json";
import gridUP from "../data/takeoff_dry_up.json";
import { trilinearFromGrid, interp1D, type Grid } from "./interp";

export type TakeoffGrid = Grid & {
  meta?: {
    config_name: string;
    flaps: string;
    power: string;
    runway: string;
    units: {
      W: string;
      PA: string;
      OAT: string;
      dist: string;
      speed: string;
    };
  };
  speeds?: {
    axisW: number[];
    VR_kias: (number | null)[];
    V50_kias: (number | null)[];
  };
};

export type TakeoffResult =
  | {
      ok: true;
      GR: number;
      TOD_15m: number;
      VR_kias?: number;
      V50_kias?: number;
      meta?: TakeoffGrid["meta"];
      flags?: {
        clampedW: boolean;
        clampedPA: boolean;
        clampedOAT: boolean;
      };
    }
  | { ok: false; error: string };

export type RunwayCondition = "DRY" | "WET";
export type RunwaySurface = "ASPHALT" | "GRAVEL";

/** Grid lookup table keyed by  condition → surface → flaps */
const grids: Record<string, TakeoffGrid | undefined> = {
  "DRY_ASPHALT_TO": gridTO as TakeoffGrid,
  "DRY_ASPHALT_UP": gridUP as TakeoffGrid,
  // Future entries:
  // "WET_ASPHALT_TO": gridWetTO as TakeoffGrid,
  // "WET_ASPHALT_UP": gridWetUP as TakeoffGrid,
  // "DRY_GRAVEL_TO":  gridGravelTO as TakeoffGrid,
  // ...
};

export function computeTakeoff(input: {
  flaps: "TO" | "UP";
  condition: RunwayCondition;
  surface: RunwaySurface;
  W: number;
  PA: number;
  OAT: number;
}): TakeoffResult {

  // Grid selection by condition + surface + flaps
  const key = `${input.condition}_${input.surface}_${input.flaps}`;
  const grid = grids[key];

  if (!grid) {
    return {
      ok: false,
      error: `No data available for ${input.condition} / ${input.surface} / Flaps ${input.flaps}. Coming soon.`,
    };
  }

  if (!grid.axes?.W || !grid.values?.GR) {
    return {
      ok: false,
      error: "Takeoff data not loaded.",
    };
  }

  const grResult = trilinearFromGrid(
    grid,
    input.W,
    input.PA,
    input.OAT,
    "GR"
  );
  if (!grResult.ok) {
    return { ok: false, error: grResult.error ?? "GR interpolation failed" };
  }

  const todResult = trilinearFromGrid(
    grid,
    input.W,
    input.PA,
    input.OAT,
    "TOD_15m"
  );
  if (!todResult.ok) {
    return {
      ok: false,
      error: todResult.error ?? "TOD_15m interpolation failed",
    };
  }

  const result: TakeoffResult = {
    ok: true,
    GR: Math.round(grResult.value!),
    TOD_15m: Math.round(todResult.value!),
  };

  if (grResult.flags) result.flags = grResult.flags;

  // 🔥 SPEED INTERPOLATION (Weight based)
  if (grid.speeds) {
    const wAxis = grid.speeds.axisW;
    if (input.W < wAxis[0] || input.W > wAxis[wAxis.length - 1]) {
      return {
        ok: false,
        error: `Weight ${input.W} kg is outside the speed table range (${wAxis[0]}–${wAxis[wAxis.length - 1]} kg).`,
      };
    }

    const vr = interp1D(
      grid.speeds.axisW,
      grid.speeds.VR_kias,
      input.W
    );
    if (vr.ok) result.VR_kias = Math.round(vr.value);

    const v50 = interp1D(
      grid.speeds.axisW,
      grid.speeds.V50_kias,
      input.W
    );
    if (v50.ok) result.V50_kias = Math.round(v50.value);
  }

  if (grid.meta) result.meta = grid.meta;

  return result;
}
