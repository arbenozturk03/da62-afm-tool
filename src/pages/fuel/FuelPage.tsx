import { useAircraft } from "../../context/AircraftContext";
import { aircraftConfig } from "../../data/aircraftConfig";

export default function FuelPage() {
  const { state, dispatch } = useAircraft();

  const mainKg = state.mainFuelL * aircraftConfig.densities.fuel;
  const auxKg = state.auxFuelL * aircraftConfig.densities.fuel;
  const totalKg = mainKg + auxKg;
  const totalL = state.mainFuelL + state.auxFuelL;

  return (
    <div className="max-w-lg mx-auto px-3 py-6 space-y-4">
      <h1 className="text-xl font-bold mb-4">Fuel</h1>

      {/* Main fuel */}
      <div className="rounded-xl p-4 border bg-[var(--panel-bg)] border-[var(--panel-border)]">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)] mb-3">
          Main Fuel
        </h2>
        <div className="flex items-center justify-between gap-3">
          <label className="text-sm text-[var(--text-secondary)]">Volume</label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={state.mainFuelL}
              min={0}
              step={1}
              onChange={(e) =>
                dispatch({ type: "SET_FIELD", field: "mainFuelL", value: Math.max(0, parseFloat(e.target.value) || 0) })
              }
              onFocus={(e) => e.target.select()}
              className="w-24 rounded-lg px-2 py-1.5 text-right text-sm font-mono
                         bg-[var(--result-bg)] border border-[var(--result-border)]
                         outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-[var(--text-muted)] w-8">L</span>
          </div>
        </div>
        <div className="flex justify-between items-baseline pt-2 mt-2 border-t border-[var(--panel-border)]">
          <span className="text-sm text-[var(--text-secondary)]">Mass</span>
          <span className="font-mono text-sm font-semibold">
            {mainKg.toFixed(1)}
            <span className="text-xs text-[var(--text-muted)] ml-1">kg</span>
          </span>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Arm: {aircraftConfig.arms.fuelMain} m
        </p>
      </div>

      {/* Aux fuel */}
      <div className="rounded-xl p-4 border bg-[var(--panel-bg)] border-[var(--panel-border)]">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)] mb-3">
          Auxiliary Fuel
        </h2>
        <div className="flex items-center justify-between gap-3">
          <label className="text-sm text-[var(--text-secondary)]">Volume</label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={state.auxFuelL}
              min={0}
              step={1}
              onChange={(e) =>
                dispatch({ type: "SET_FIELD", field: "auxFuelL", value: Math.max(0, parseFloat(e.target.value) || 0) })
              }
              onFocus={(e) => e.target.select()}
              className="w-24 rounded-lg px-2 py-1.5 text-right text-sm font-mono
                         bg-[var(--result-bg)] border border-[var(--result-border)]
                         outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-[var(--text-muted)] w-8">L</span>
          </div>
        </div>
        <div className="flex justify-between items-baseline pt-2 mt-2 border-t border-[var(--panel-border)]">
          <span className="text-sm text-[var(--text-secondary)]">Mass</span>
          <span className="font-mono text-sm font-semibold">
            {auxKg.toFixed(1)}
            <span className="text-xs text-[var(--text-muted)] ml-1">kg</span>
          </span>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Arm: {aircraftConfig.arms.fuelAux} m
        </p>
      </div>

      {/* Total */}
      <div className="rounded-xl p-4 border bg-[var(--result-bg)] border-[var(--result-border)]">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">
          Total Fuel
        </h2>
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-[var(--text-secondary)]">Volume</span>
          <span className="font-mono text-sm font-semibold">
            {totalL.toFixed(1)}
            <span className="text-xs text-[var(--text-muted)] ml-1">L</span>
          </span>
        </div>
        <div className="flex justify-between items-baseline mt-1">
          <span className="text-sm text-[var(--text-secondary)]">Mass</span>
          <span className="font-mono text-lg font-bold">
            {totalKg.toFixed(1)}
            <span className="text-xs text-[var(--text-muted)] ml-1">kg</span>
          </span>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-2">
          Density: {aircraftConfig.densities.fuel} kg/L
        </p>
      </div>
    </div>
  );
}
