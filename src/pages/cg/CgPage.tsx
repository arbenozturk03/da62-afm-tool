import CabinSvg from "../../components/CabinSvg";
import EnvelopeChart from "../../components/EnvelopeChart";
import { useAircraft } from "../../context/AircraftContext";
import { aircraftConfig } from "../../data/aircraftConfig";

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

export default function CgPage() {
  const { state, dispatch, result, insideEnvelope, zfInsideEnvelope } = useAircraft();
  const { limits } = aircraftConfig;

  return (
    <div className="max-w-[1400px] mx-auto px-3 py-4">
      {/* Mode switch */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm font-semibold text-[var(--text-muted)]">Cabin mode:</span>
        <div className="flex rounded-lg overflow-hidden border border-[var(--panel-border)]">
          <button
            onClick={() => dispatch({ type: "SET_MODE", mode: "passenger" })}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              state.mode === "passenger"
                ? "bg-[var(--result-bg)] text-blue-400 border-r border-[var(--result-border)]"
                : "bg-[var(--panel-bg)] text-[var(--text-muted)] border-r border-[var(--panel-border)] hover:text-white"
            }`}
          >
            Passenger
          </button>
          <button
            onClick={() => dispatch({ type: "SET_MODE", mode: "cargo" })}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              state.mode === "cargo"
                ? "bg-[var(--result-bg)] text-blue-400"
                : "bg-[var(--panel-bg)] text-[var(--text-muted)] hover:text-white"
            }`}
          >
            Cargo
          </button>
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
          {/* Results */}
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

          {/* Zero fuel */}
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

          {/* Warnings */}
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

          {/* Envelope */}
          <Card title="CG Envelope">
            <EnvelopeChart />
          </Card>

          {/* Baggage info */}
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

          {/* Station breakdown */}
          <Card title="Station Breakdown">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[var(--text-muted)] text-left">
                    <th className="pb-1 pr-4 font-medium">Station</th>
                    <th className="pb-1 pr-4 font-medium text-right">Mass (kg)</th>
                    <th className="pb-1 pr-4 font-medium text-right">Arm (m)</th>
                    <th className="pb-1 font-medium text-right">Moment (kg·m)</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {result.stations.map((st, i) => (
                    <tr key={i} className="border-t border-[var(--panel-border)]">
                      <td className="py-1 pr-4 font-sans">{st.label}</td>
                      <td className="py-1 pr-4 text-right">{st.mass.toFixed(1)}</td>
                      <td className="py-1 pr-4 text-right">{st.arm.toFixed(2)}</td>
                      <td className="py-1 text-right">{st.moment.toFixed(1)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[var(--result-border)] font-bold">
                    <td className="py-1 pr-4 font-sans">Total</td>
                    <td className="py-1 pr-4 text-right">{result.totalMass.toFixed(1)}</td>
                    <td className="py-1 pr-4 text-right">{result.cg.toFixed(3)}</td>
                    <td className="py-1 text-right">{result.totalMoment.toFixed(1)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
