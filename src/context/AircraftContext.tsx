import {
  createContext,
  useContext,
  useReducer,
  useMemo,
  type ReactNode,
} from "react";
import { computeCg, isInsideEnvelope, type CabinMode, type CgResult } from "../core/cg";
import { aircraftConfig } from "../data/aircraftConfig";
import { envelope } from "../data/envelope";

/* ── State shape ──────────────────────────────────────────── */

export interface AircraftState {
  emptyMass: number;
  emptyCg: number;
  deiceEnabled: boolean;
  deiceLiters: number;

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

  mode: CabinMode;
  showDebugLabels: boolean;
  debugZones: boolean;
}

const initialState: AircraftState = {
  emptyMass: aircraftConfig.defaults.emptyMass,
  emptyCg: aircraftConfig.defaults.emptyCg,
  deiceEnabled: aircraftConfig.defaults.deiceEnabled,
  deiceLiters: aircraftConfig.defaults.deiceLiters,

  seat1: 0,
  seat2: 0,
  seat3: 0,
  seat4: 0,
  seat5: 0,
  seat6: 0,
  seat7: 0,

  lhNoseKg: 0,
  rhNoseKg: 0,
  rearFKg: 0,

  mainFuelL: 0,
  auxFuelL: 0,

  mode: "passenger",
  showDebugLabels: false,
  debugZones: false,
};

/* ── Actions ──────────────────────────────────────────────── */

type Action =
  | { type: "SET_FIELD"; field: keyof AircraftState; value: number | boolean | CabinMode }
  | { type: "SET_MODE"; mode: CabinMode }
  | { type: "RESET" };

function reducer(state: AircraftState, action: Action): AircraftState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_MODE": {
      const next = { ...state, mode: action.mode };
      if (action.mode === "cargo") {
        next.seat6 = 0;
        next.seat7 = 0;
      } else {
        next.rearFKg = 0;
      }
      return next;
    }
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

/* ── Context value ────────────────────────────────────────── */

interface AircraftContextValue {
  state: AircraftState;
  dispatch: React.Dispatch<Action>;
  result: CgResult;
  insideEnvelope: boolean;
  zfInsideEnvelope: boolean;
}

const AircraftContext = createContext<AircraftContextValue | null>(null);

export function AircraftProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const result = useMemo(
    () => computeCg(state),
    [
      state.emptyMass, state.emptyCg,
      state.seat1, state.seat2, state.seat3, state.seat4,
      state.seat5, state.seat6, state.seat7,
      state.lhNoseKg, state.rhNoseKg, state.rearFKg,
      state.mainFuelL, state.auxFuelL,
      state.deiceEnabled, state.deiceLiters,
      state.mode,
    ],
  );

  const insideEnvelope = useMemo(
    () => result.totalMass > 0 && isInsideEnvelope(result.cg, result.totalMass, envelope.polygon),
    [result.cg, result.totalMass],
  );

  const zfInsideEnvelope = useMemo(
    () =>
      result.zeroFuelMass > 0 &&
      isInsideEnvelope(result.zeroFuelCg, result.zeroFuelMass, envelope.polygon),
    [result.zeroFuelCg, result.zeroFuelMass],
  );

  const value = useMemo(
    () => ({ state, dispatch, result, insideEnvelope, zfInsideEnvelope }),
    [state, result, insideEnvelope, zfInsideEnvelope],
  );

  return (
    <AircraftContext.Provider value={value}>
      {children}
    </AircraftContext.Provider>
  );
}

export function useAircraft(): AircraftContextValue {
  const ctx = useContext(AircraftContext);
  if (!ctx) throw new Error("useAircraft must be used within AircraftProvider");
  return ctx;
}
