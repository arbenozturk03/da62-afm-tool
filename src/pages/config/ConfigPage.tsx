import { useAircraft } from "../../context/AircraftContext";
import { aircraftConfig } from "../../data/aircraftConfig";

function Field({
  label,
  value,
  onChange,
  unit,
  step = 1,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <label className="text-sm text-[var(--text-secondary)] shrink-0">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          onFocus={(e) => e.target.select()}
          className="w-24 rounded-lg px-2 py-1.5 text-right text-sm font-mono
                     bg-[var(--result-bg)] border border-[var(--result-border)]
                     outline-none focus:ring-2 focus:ring-blue-500"
        />
        {unit && <span className="text-xs text-[var(--text-muted)] w-8">{unit}</span>}
      </div>
    </div>
  );
}

export default function ConfigPage() {
  const { state, dispatch } = useAircraft();

  const deiceMass = state.deiceEnabled
    ? (state.deiceLiters * aircraftConfig.densities.deice).toFixed(2)
    : "0.00";

  return (
    <div className="max-w-lg mx-auto px-3 py-6 space-y-4">
      <h1 className="text-xl font-bold mb-4">Aircraft Configuration</h1>

      {/* Basic aircraft */}
      <div className="rounded-xl p-4 border bg-[var(--panel-bg)] border-[var(--panel-border)]">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">
          Basic Aircraft
        </h2>
        <Field
          label="Empty Mass"
          value={state.emptyMass}
          onChange={(v) => dispatch({ type: "SET_FIELD", field: "emptyMass", value: v })}
          unit="kg"
          step={1}
          min={0}
        />
        <Field
          label="Empty CG"
          value={state.emptyCg}
          onChange={(v) => dispatch({ type: "SET_FIELD", field: "emptyCg", value: v })}
          unit="m"
          step={0.01}
          min={0}
        />
      </div>

      {/* Deicing */}
      <div
        id="deicing"
        className="rounded-xl p-4 border bg-[var(--panel-bg)] border-[var(--panel-border)]"
      >
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">
          De-Icing System
        </h2>

        <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={state.deiceEnabled}
            onChange={(e) =>
              dispatch({ type: "SET_FIELD", field: "deiceEnabled", value: e.target.checked })
            }
            className="accent-blue-500 w-4 h-4"
          />
          <span className="text-sm">TKS De-Ice enabled</span>
        </label>

        {state.deiceEnabled && (
          <>
            <Field
              label="Fluid volume"
              value={state.deiceLiters}
              onChange={(v) => dispatch({ type: "SET_FIELD", field: "deiceLiters", value: v })}
              unit="L"
              step={0.1}
              min={0}
            />
            <div className="flex justify-between items-baseline pt-2 border-t border-[var(--panel-border)] mt-2">
              <span className="text-sm text-[var(--text-secondary)]">Fluid mass</span>
              <span className="font-mono text-sm font-semibold">
                {deiceMass}
                <span className="text-xs text-[var(--text-muted)] ml-1">kg</span>
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Density: {aircraftConfig.densities.deice} kg/L &nbsp;|&nbsp; Arm: {aircraftConfig.arms.deice} m
            </p>
          </>
        )}
      </div>

      {/* Aircraft presets */}
      <div className="rounded-xl p-4 border bg-[var(--panel-bg)] border-[var(--panel-border)]">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">
          Aircraft Presets
        </h2>
        <select
          className="w-full rounded-lg px-3 py-2 text-sm
                     bg-[var(--result-bg)] border border-[var(--result-border)]
                     outline-none focus:ring-2 focus:ring-blue-500"
          defaultValue="default"
        >
          <option value="default">DA-62 (Default)</option>
        </select>
        <p className="text-xs text-[var(--text-muted)] mt-2">
          More presets coming soon. Configure manually above.
        </p>
      </div>

      {/* Reference */}
      <div className="rounded-xl p-4 border bg-[var(--panel-bg)] border-[var(--panel-border)]">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">
          Reference Values
        </h2>
        <div className="text-xs text-[var(--text-secondary)] space-y-0.5 font-mono">
          <p>MTOW = {aircraftConfig.limits.MTOW} kg</p>
          <p>MZFW = {aircraftConfig.limits.MZFW} kg</p>
          <p>Fuel density = {aircraftConfig.densities.fuel} kg/L</p>
        </div>
      </div>
    </div>
  );
}
