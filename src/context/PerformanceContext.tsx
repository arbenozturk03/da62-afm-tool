import {
  createContext,
  useContext,
  useReducer,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";

/* ── Takeoff form state (persisted across tab switches) ───────── */

export interface TakeoffFormState {
  selectedAirport: string;
  selectedRunway: string;
  flaps: "TO" | "UP";
  condition: "DRY" | "WET";
  runwaySurface: "PAVED" | "GRASS" | "GRASS_SOFT";
  weightKg: number;
  PA: number;
  OAT: number;
  windSpeed: number;
  windDir: number;
  rwyHeading: number;
  grassLengthCm: number;
  uphillSlope: number;
  tempDirty: boolean;
  windSpeedDirty: boolean;
  windDirDirty: boolean;
}

export const initialTakeoffState: TakeoffFormState = {
  selectedAirport: "CUSTOM",
  selectedRunway: "",
  flaps: "TO",
  condition: "DRY",
  runwaySurface: "PAVED",
  weightKg: 0,
  PA: 0,
  OAT: 15,
  windSpeed: 0,
  windDir: 0,
  rwyHeading: 0,
  grassLengthCm: 5,
  uphillSlope: 0,
  tempDirty: false,
  windSpeedDirty: false,
  windDirDirty: false,
};

/* ── Landing form state ───────────────────────────────────────── */

export interface LandingFormState {
  selectedAirport: string;
  selectedRunway: string;
  flaps: "LDG" | "TO" | "UP";
  weightKg: number;
  PA: number;
  OAT: number;
  windSpeed: number;
  windDir: number;
  rwyHeading: number;
  condition: "DRY" | "WET";
  runwaySurface: "PAVED" | "GRASS" | "GRASS_SOFT";
  grassLengthCm: number;
  downhillSlope: number;
  tempDirty: boolean;
  windSpeedDirty: boolean;
  windDirDirty: boolean;
}

export const initialLandingState: LandingFormState = {
  selectedAirport: "CUSTOM",
  selectedRunway: "",
  flaps: "LDG",
  weightKg: 0,
  PA: 0,
  OAT: 15,
  windSpeed: 0,
  windDir: 0,
  rwyHeading: 0,
  condition: "DRY",
  runwaySurface: "PAVED",
  grassLengthCm: 5,
  downhillSlope: 0,
  tempDirty: false,
  windSpeedDirty: false,
  windDirDirty: false,
};

/* ── Performance state ───────────────────────────────────────── */

export interface CruisePrefillState {
  tocPressureAltFt: number;
  tocOatC: number | null;
  tocIsaDeviationC: number | null;
  tocWeightKg: number;
  fuelRemainingGal: number | null;
}

export interface PerformanceState {
  /** Weight (kg) used for takeoff/landing. null = use live W&B totalMass. */
  perfWeight: number | null;
  /** Climb weight (kg) when user has set it on Climb page; null = derive from W&B or default. */
  climbWeightKg: number | null;
  takeoff: TakeoffFormState;
  landing: LandingFormState;
  cruisePrefill: CruisePrefillState | null;
}

const initialState: PerformanceState = {
  perfWeight: null,
  climbWeightKg: null,
  takeoff: initialTakeoffState,
  landing: initialLandingState,
  cruisePrefill: null,
};

/* ── Actions ─────────────────────────────────────────────────── */

type Action =
  | { type: "UPLINK_WEIGHT"; kg: number }
  | { type: "SET_CLIMB_WEIGHT"; kg: number | null }
  | { type: "SET_TAKEOFF"; field: keyof TakeoffFormState; value: TakeoffFormState[keyof TakeoffFormState] }
  | { type: "SET_LANDING"; field: keyof LandingFormState; value: LandingFormState[keyof LandingFormState] }
  | { type: "SET_CRUISE_PREFILL"; payload: CruisePrefillState | null };

function reducer(state: PerformanceState, action: Action): PerformanceState {
  switch (action.type) {
    case "UPLINK_WEIGHT":
      return { ...state, perfWeight: action.kg };
    case "SET_CLIMB_WEIGHT":
      return { ...state, climbWeightKg: action.kg };
    case "SET_TAKEOFF":
      return {
        ...state,
        takeoff: { ...state.takeoff, [action.field]: action.value },
      };
    case "SET_LANDING":
      return {
        ...state,
        landing: { ...state.landing, [action.field]: action.value },
      };
    case "SET_CRUISE_PREFILL":
      return {
        ...state,
        cruisePrefill: action.payload,
      };
    default:
      return state;
  }
}

/* ── Context ─────────────────────────────────────────────────── */

interface PerformanceContextValue {
  state: PerformanceState;
  uplinkWeight: (kg: number) => void;
  setClimbWeight: (kg: number | null) => void;
  setTakeoff: <K extends keyof TakeoffFormState>(field: K, value: TakeoffFormState[K]) => void;
  setLanding: <K extends keyof LandingFormState>(field: K, value: LandingFormState[K]) => void;
  setCruisePrefill: (payload: CruisePrefillState | null) => void;
}

const PerformanceContext = createContext<PerformanceContextValue | null>(null);

export function PerformanceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const uplinkWeight = useCallback((kg: number) => dispatch({ type: "UPLINK_WEIGHT", kg }), []);
  const setClimbWeight = useCallback(
    (kg: number | null) => dispatch({ type: "SET_CLIMB_WEIGHT", kg }),
    [],
  );
  const setTakeoff = useCallback(
    <K extends keyof TakeoffFormState>(field: K, value: TakeoffFormState[K]) =>
      dispatch({ type: "SET_TAKEOFF", field, value }),
    [],
  );
  const setLanding = useCallback(
    <K extends keyof LandingFormState>(field: K, value: LandingFormState[K]) =>
      dispatch({ type: "SET_LANDING", field, value }),
    [],
  );

  const setCruisePrefill = useCallback(
    (payload: CruisePrefillState | null) => dispatch({ type: "SET_CRUISE_PREFILL", payload }),
    [],
  );

  const value = useMemo(
    () => ({ state, uplinkWeight, setClimbWeight, setTakeoff, setLanding, setCruisePrefill }),
    [state, uplinkWeight, setClimbWeight, setTakeoff, setLanding, setCruisePrefill],
  );

  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  );
}

export function usePerformance(): PerformanceContextValue {
  const ctx = useContext(PerformanceContext);
  if (!ctx) throw new Error("usePerformance must be used within PerformanceProvider");
  return ctx;
}
