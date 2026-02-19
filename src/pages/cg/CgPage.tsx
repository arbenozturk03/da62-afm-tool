import { useState } from "react";
import CabinSvg from "../../components/CabinSvg";
import EnvelopeChart from "../../components/EnvelopeChart";
import { useAircraft } from "../../context/AircraftContext";
import { aircraftConfig } from "../../data/aircraftConfig";

type FuelUnit = "L" | "kg" | "lbs";
const FUEL_DENSITY = aircraftConfig.densities.fuel;
const KG_TO_LBS = 2.20462;

function Card({ title, children, accent }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div
      className={`rounded-xl p-4 border ${
        accent
          ? "bg-[var(--result-bg)] border-[var(--result-border)]"
          : "bg-[var(--panel-bg)] border-[var(--panel-border)]"
      }`}
    >
      <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Stat({ label, value, unit, warn }: { label: string; value: string; unit?: string; warn?: boolean }) {
  return (
    <div className="flex justify-between items-baseline py-0.5">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <span className={`font-mono text-sm font-semibold ${warn ? "text-red-400" : ""}`}>
        {value}
        {unit && <span className="text-xs text-[var(--text-muted)] ml-1">{unit}</span>}
      </span>
    </div>
  );
}

function litersFromInput(value: number, unit: FuelUnit): number {
  if (unit === "L") return value;
  if (unit === "kg") return value / FUEL_DENSITY;
  return value / KG_TO_LBS / FUEL_DENSITY;
}

function litersToDisplay(liters: number, unit: FuelUnit): number {
  if (unit === "L") return liters;
  if (unit === "kg") return liters * FUEL_DENSITY;
  return liters * FUEL_DENSITY * KG_TO_LBS;
}

export default function CgPage() {
  const { state, dispatch, result, insideEnvelope, zfInsideEnvelope } = useAircraft();
  const { limits } = aircraftConfig;
  const [fuelUnit, setFuelUnit] = useState<FuelUnit>("L");

  return (
    <div className="max-w-[1400px] mx-auto px-3 py-4">
      {/* Mode switch */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm font-semibold text-[var(--text-muted)]">Cabin mode:</span>
        <div className="flex rounded-lg overflow-hidden border border-[var(--panel-border)]">
          {(["passenger", "cargo"] as const).map((m) => (
            <button
              key={m}
              onClick={() => dispatch({ type: "SET_MODE", mode: m })}
              style={{
                background: state.mode === m ? "var(--result-bg)" : "var(--panel-bg)",
                color: state.mode === m ? "#60a5fa" : "var(--text-muted)",
                padding: "6px 16px",
                fontSize: 14,
                fontWeight: 600,
                border: "none",
                borderRight: m === "passenger" ? "1px solid var(--panel-border)" : "none",
                borderRadius: 0,
                cursor: "pointer",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {m === "passenger" ? "Passenger" : "Cargo"}
            </button>
          ))}
        </div>
        <span className="text-xs text-[var(--text-muted)] ml-1 hidden sm:inline">
          {state.mode === "passenger"
            ? "Rear seats installed"
            : "Rear seats folded → cargo"}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 items-start">
        {/* Left: Cabin SVG (sticky sidebar on desktop) */}
        <div className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto rounded-xl">
          <CabinSvg />
          <p className="text-xs text-[var(--text-muted)] mt-1 text-center px-2">
            Click a zone to enter weight
          </p>

          {/* Debug toggle */}
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer select-none mt-2 px-2 pb-2">
            <input
              type="checkbox"
              checked={state.showDebugLabels}
              onChange={(e) =>
                dispatch({ type: "SET_FIELD", field: "showDebugLabels", value: e.target.checked })
              }
              className="accent-blue-500"
            />
            Show zone labels (debug)
          </label>
        </div>

        {/* Right: cards */}
        <div className="flex flex-col gap-3">
          {/* Fuel (top) */}
          <Card title="Fuel">
            <div className="space-y-2">
              {/* Unit selector */}
              <div className="flex rounded-lg overflow-hidden border border-[var(--panel-border)] w-fit mb-1">
                {(["L", "kg", "lbs"] as FuelUnit[]).map((u) => (
                  <button
                    key={u}
                    onClick={() => setFuelUnit(u)}
                    style={{
                      background: fuelUnit === u ? "#2563eb" : "var(--panel-bg)",
                      color: fuelUnit === u ? "#fff" : "var(--text-muted)",
                      padding: "4px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      border: "none",
                      borderRadius: 0,
                      cursor: "pointer",
                      transition: "background 0.15s, color 0.15s",
                    }}
                  >
                    {u}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[var(--text-secondary)]">Main fuel</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={parseFloat(litersToDisplay(state.mainFuelL, fuelUnit).toFixed(1))}
                    min={0}
                    step={1}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_FIELD",
                        field: "mainFuelL",
                        value: Math.max(0, litersFromInput(parseFloat(e.target.value) || 0, fuelUnit)),
                      })
                    }
                    onFocus={(e) => e.target.select()}
                    className="w-20 rounded-lg px-2 py-1.5 text-right text-sm font-mono
                               bg-[var(--result-bg)] border border-[var(--result-border)]
                               outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-[var(--text-muted)] w-8">{fuelUnit}</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[var(--text-secondary)]">Aux fuel</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={parseFloat(litersToDisplay(state.auxFuelL, fuelUnit).toFixed(1))}
                    min={0}
                    step={1}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_FIELD",
                        field: "auxFuelL",
                        value: Math.max(0, litersFromInput(parseFloat(e.target.value) || 0, fuelUnit)),
                      })
                    }
                    onFocus={(e) => e.target.select()}
                    className="w-20 rounded-lg px-2 py-1.5 text-right text-sm font-mono
                               bg-[var(--result-bg)] border border-[var(--result-border)]
                               outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-[var(--text-muted)] w-8">{fuelUnit}</span>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-[var(--panel-border)] text-xs text-[var(--text-muted)]">
                <div className="flex justify-between">
                  <span>Total</span>
                  <span className="font-mono">
                    {litersToDisplay(state.mainFuelL + state.auxFuelL, fuelUnit).toFixed(1)} {fuelUnit}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* CG Envelope (second) */}
          <Card title="CG Envelope">
            <EnvelopeChart />
          </Card>

          {/* Results (third) */}
          <Card title="Results" accent>
            <Stat
              label="Total weight"
              value={result.totalMass.toFixed(1)}
              unit="kg"
              warn={result.totalMass > limits.MTOW}
            />
            <Stat label="CG" value={result.cg.toFixed(3)} unit="m" />
            <Stat label="Total moment" value={result.totalMoment.toFixed(1)} unit="kg·m" />
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`inline-block w-3 h-3 rounded-full ${
                  insideEnvelope ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className={`text-sm font-medium ${insideEnvelope ? "text-green-400" : "text-red-400"}`}>
                {insideEnvelope ? "Within envelope" : "OUTSIDE envelope"}
              </span>
            </div>
          </Card>

          {/* Warnings – keep near Results */}
          {result.warnings.length > 0 && (
            <Card title="Warnings">
              <ul className="space-y-1">
                {result.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-red-400">
                    <span className="mt-0.5 shrink-0">⚠</span>
                    {w}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Zero fuel (fourth) */}
          <Card title="Zero Fuel">
            <Stat
              label="ZFW"
              value={result.zeroFuelMass.toFixed(1)}
              unit="kg"
              warn={result.zeroFuelMass > limits.MZFW}
            />
            <Stat label="ZF CG" value={result.zeroFuelCg.toFixed(3)} unit="m" />
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full ${
                  zfInsideEnvelope ? "bg-blue-500" : "bg-red-500"
                }`}
              />
              <span className={`text-xs ${zfInsideEnvelope ? "text-blue-400" : "text-red-400"}`}>
                {zfInsideEnvelope ? "ZFW within envelope" : "ZFW outside envelope"}
              </span>
            </div>
          </Card>

          {/* Baggage (bottom) */}
          <Card title="Baggage">
            <Stat
              label="LH Nose"
              value={`${state.lhNoseKg}`}
              unit={`/ ${aircraftConfig.baggageLimits.lhNose} kg`}
              warn={state.lhNoseKg > aircraftConfig.baggageLimits.lhNose}
            />
            <Stat
              label="RH Nose"
              value={`${state.rhNoseKg}`}
              unit={`/ ${aircraftConfig.baggageLimits.rhNose} kg`}
              warn={state.rhNoseKg > aircraftConfig.baggageLimits.rhNose}
            />
            {state.mode === "cargo" && (
              <Stat
                label="Rear F"
                value={`${state.rearFKg}`}
                unit={`/ ${aircraftConfig.baggageLimits.rearF} kg`}
                warn={state.rearFKg > aircraftConfig.baggageLimits.rearF}
              />
            )}
          </Card>

        </div>
      </div>
    </div>
  );
}
