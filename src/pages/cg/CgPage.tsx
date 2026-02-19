import { useState } from "react";
import CabinSvg from "../../components/CabinSvg";
import EnvelopeChart from "../../components/EnvelopeChart";
import { useAircraft } from "../../context/AircraftContext";
import { aircraftConfig } from "../../data/aircraftConfig";

type FuelUnit = "L" | "kg" | "lbs";
const FUEL_DENSITY = aircraftConfig.densities.fuel;
const KG_TO_LBS = 2.20462;

/* ── shared inline styles (matching Takeoff/Landing) ── */

const cardStyle: React.CSSProperties = {
  border: "1px solid var(--panel-border)",
  borderRadius: 8,
  padding: "8px 14px 16px",
  backgroundColor: "var(--panel-bg)",
};

const resultCardStyle: React.CSSProperties = {
  ...cardStyle,
  backgroundColor: "var(--result-bg)",
  borderColor: "var(--result-border)",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-muted)",
  marginBottom: 8,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  padding: "3px 0",
  fontSize: 13,
};

const monoVal: React.CSSProperties = {
  fontWeight: 600,
};

const unitSpan: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  marginLeft: 4,
};

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--panel-border)",
  borderRadius: 2,
  padding: "2px 4px",
  fontSize: 13,
  width: 80,
  background: "transparent",
  color: "inherit",
};

/* ── helpers ── */

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

/* ── components ── */

function Stat({ label, value, unit, warn }: { label: string; value: string; unit?: string; warn?: boolean }) {
  return (
    <div style={rowStyle}>
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ ...monoVal, color: warn ? "#f87171" : "inherit" }}>
        {value}
        {unit && <span style={unitSpan}>{unit}</span>}
      </span>
    </div>
  );
}

export default function CgPage() {
  const { state, dispatch, result, insideEnvelope, zfInsideEnvelope } = useAircraft();
  const { limits } = aircraftConfig;
  const [fuelUnit, setFuelUnit] = useState<FuelUnit>("L");

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "16px 12px" }}>
      {/* Mode switch */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid var(--panel-border)" }}>
          {(["passenger", "cargo"] as const).map((m) => (
            <button
              key={m}
              onClick={() => dispatch({ type: "SET_MODE", mode: m })}
              style={{
                background: state.mode === m ? "var(--result-bg)" : "var(--panel-bg)",
                color: state.mode === m ? "#60a5fa" : "var(--text-muted)",
                padding: "5px 14px",
                fontSize: 12,
                fontWeight: 600,
                border: "none",
                borderRight: m === "passenger" ? "1px solid var(--panel-border)" : "none",
                borderRadius: 0,
                cursor: "pointer",
              }}
            >
              {m === "passenger" ? "🪑 Passenger" : "📦 Cargo"}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {state.mode === "passenger" ? "Rear seats installed" : "Rear seats folded → cargo"}
        </span>
      </div>

      <div className="cg-layout">
        {/* Cabin SVG */}
        <div>
          <div style={{ maxWidth: 180, margin: "0 auto" }}>
            <CabinSvg />
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, textAlign: "center" }}>
            Click a zone to enter weight
          </p>
        </div>

        {/* Right: cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Fuel */}
          <div style={cardStyle}>
            <div style={sectionTitle}>Fuel</div>

            {/* Unit selector */}
            <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid var(--panel-border)", width: "fit-content", marginBottom: 8 }}>
              {(["L", "kg", "lbs"] as FuelUnit[]).map((u) => (
                <button
                  key={u}
                  onClick={() => setFuelUnit(u)}
                  style={{
                    background: fuelUnit === u ? "#2563eb" : "var(--panel-bg)",
                    color: fuelUnit === u ? "#fff" : "var(--text-muted)",
                    padding: "3px 10px",
                    fontSize: 12,
                    fontWeight: 600,
                    border: "none",
                    borderRadius: 0,
                    cursor: "pointer",
                  }}
                >
                  {u}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 6 }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 2 }}>Main fuel</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
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
                  style={inputStyle}
                />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{fuelUnit}</span>
              </span>
            </div>

            <div style={{ marginBottom: 6 }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 2 }}>Aux fuel</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
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
                  style={inputStyle}
                />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{fuelUnit}</span>
              </span>
            </div>

            <div style={{ borderTop: "1px solid var(--panel-border)", marginTop: 6, paddingTop: 6 }}>
              <div style={rowStyle}>
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Total</span>
                <span style={{ ...monoVal, fontSize: 12 }}>
                  {litersToDisplay(state.mainFuelL + state.auxFuelL, fuelUnit).toFixed(1)} {fuelUnit}
                </span>
              </div>
            </div>
          </div>

          {/* CG Envelope */}
          <div style={cardStyle}>
            <div style={sectionTitle}>CG Envelope</div>
            <EnvelopeChart />
          </div>

          {/* Results */}
          <div style={resultCardStyle}>
            <div style={sectionTitle}>Results</div>
            <Stat label="Total weight" value={result.totalMass.toFixed(1)} unit="kg" warn={result.totalMass > limits.MTOW} />
            <Stat label="CG" value={result.cg.toFixed(3)} unit="m" />
            <Stat label="Total moment" value={result.totalMoment.toFixed(1)} unit="kg·m" />
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: insideEnvelope ? "#22c55e" : "#ef4444",
              }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: insideEnvelope ? "#22c55e" : "#ef4444" }}>
                {insideEnvelope ? "Within envelope" : "OUTSIDE envelope"}
              </span>
            </div>
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div style={{ ...cardStyle, borderColor: "#c62828", backgroundColor: "rgba(198,40,40,0.1)" }}>
              <div style={sectionTitle}>Warnings</div>
              {result.warnings.map((w, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 13, color: "#f87171", marginBottom: 4 }}>
                  <span style={{ marginTop: 1, flexShrink: 0 }}>⚠</span>
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* Zero fuel */}
          <div style={cardStyle}>
            <div style={sectionTitle}>Zero Fuel</div>
            <Stat label="ZFW" value={result.zeroFuelMass.toFixed(1)} unit="kg" warn={result.zeroFuelMass > limits.MZFW} />
            <Stat label="ZF CG" value={result.zeroFuelCg.toFixed(3)} unit="m" />
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: zfInsideEnvelope ? "#3b82f6" : "#ef4444",
              }} />
              <span style={{ fontSize: 12, color: zfInsideEnvelope ? "#60a5fa" : "#f87171" }}>
                {zfInsideEnvelope ? "ZFW within envelope" : "ZFW outside envelope"}
              </span>
            </div>
          </div>

          {/* Baggage */}
          <div style={cardStyle}>
            <div style={sectionTitle}>Baggage</div>
            <Stat label="LH Nose" value={`${state.lhNoseKg}`} unit={`/ ${aircraftConfig.baggageLimits.lhNose} kg`} warn={state.lhNoseKg > aircraftConfig.baggageLimits.lhNose} />
            <Stat label="RH Nose" value={`${state.rhNoseKg}`} unit={`/ ${aircraftConfig.baggageLimits.rhNose} kg`} warn={state.rhNoseKg > aircraftConfig.baggageLimits.rhNose} />
            {state.mode === "cargo" && (
              <Stat label="Rear F" value={`${state.rearFKg}`} unit={`/ ${aircraftConfig.baggageLimits.rearF} kg`} warn={state.rearFKg > aircraftConfig.baggageLimits.rearF} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
