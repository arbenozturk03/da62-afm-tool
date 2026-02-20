import { useState } from "react";
import CabinSvg from "../../components/CabinSvg";
import EnvelopeChart from "../../components/EnvelopeChart";
import { useAircraft } from "../../context/AircraftContext";
import { aircraftConfig } from "../../data/aircraftConfig";

type FuelMode = "metric" | "imperial";
const FUEL_DENSITY = aircraftConfig.densities.fuel;
const KG_TO_LBS = 2.20462;
const L_PER_US_GAL = 3.785411784;

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

/* ── fuel conversion helpers ── */

function litersToGal(liters: number): number {
  return liters / L_PER_US_GAL;
}
function galToLiters(gal: number): number {
  return gal * L_PER_US_GAL;
}
function litersToKg(liters: number): number {
  return liters * FUEL_DENSITY;
}
function litersToLbs(liters: number): number {
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
  const [fuelMode, setFuelMode] = useState<FuelMode>("metric");

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "16px 12px" }}>
      <div className="cg-layout">
        {/* Cabin SVG */}
        <div style={{ minWidth: 0 }}>
          <CabinSvg />
        </div>

        {/* Right: cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Fuel */}
          <div style={cardStyle}>
            <div style={sectionTitle}>Fuel</div>

            {/* Metric / Imperial toggle */}
            <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid var(--panel-border)", width: "fit-content", marginBottom: 10 }}>
              {(["metric", "imperial"] as FuelMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFuelMode(mode)}
                  style={{
                    background: fuelMode === mode ? "#2563eb" : "var(--panel-bg)",
                    color: fuelMode === mode ? "#fff" : "var(--text-muted)",
                    padding: "4px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {mode === "metric" ? "L / kg" : "gal / lbs"}
                </button>
              ))}
            </div>

            {fuelMode === "metric" ? (
              <>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 2 }}>Main fuel</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <input
                      type="number"
                      value={state.mainFuelL === 0 ? "" : parseFloat(state.mainFuelL.toFixed(1))}
                      min={0}
                      step={1}
                      onChange={(e) =>
                        dispatch({
                          type: "SET_FIELD",
                          field: "mainFuelL",
                          value: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      onFocus={(e) => e.target.select()}
                      style={inputStyle}
                      placeholder="0"
                    />
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>L</span>
                    {state.mainFuelL > 0 && (
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        / {litersToKg(state.mainFuelL).toFixed(1)} kg
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 2 }}>Aux fuel</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <input
                      type="number"
                      value={state.auxFuelL === 0 ? "" : parseFloat(state.auxFuelL.toFixed(1))}
                      min={0}
                      step={1}
                      onChange={(e) =>
                        dispatch({
                          type: "SET_FIELD",
                          field: "auxFuelL",
                          value: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      onFocus={(e) => e.target.select()}
                      style={inputStyle}
                      placeholder="0"
                    />
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>L</span>
                    {state.auxFuelL > 0 && (
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        / {litersToKg(state.auxFuelL).toFixed(1)} kg
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ borderTop: "1px solid var(--panel-border)", marginTop: 6, paddingTop: 6 }}>
                  <div style={rowStyle}>
                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Total</span>
                    <span style={{ ...monoVal, fontSize: 12 }}>
                      {(state.mainFuelL + state.auxFuelL).toFixed(1)} L
                      {(state.mainFuelL + state.auxFuelL) > 0 && (
                        <span style={{ ...unitSpan, marginLeft: 6 }}>
                          / {litersToKg(state.mainFuelL + state.auxFuelL).toFixed(1)} kg
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 2 }}>Main fuel</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <input
                      type="number"
                      value={state.mainFuelL === 0 ? "" : parseFloat(litersToGal(state.mainFuelL).toFixed(1))}
                      min={0}
                      step={0.1}
                      onChange={(e) =>
                        dispatch({
                          type: "SET_FIELD",
                          field: "mainFuelL",
                          value: Math.max(0, galToLiters(parseFloat(e.target.value) || 0)),
                        })
                      }
                      onFocus={(e) => e.target.select()}
                      style={inputStyle}
                      placeholder="0"
                    />
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>gal</span>
                    {state.mainFuelL > 0 && (
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        / {litersToLbs(state.mainFuelL).toFixed(1)} lbs
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 2 }}>Aux fuel</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <input
                      type="number"
                      value={state.auxFuelL === 0 ? "" : parseFloat(litersToGal(state.auxFuelL).toFixed(1))}
                      min={0}
                      step={0.1}
                      onChange={(e) =>
                        dispatch({
                          type: "SET_FIELD",
                          field: "auxFuelL",
                          value: Math.max(0, galToLiters(parseFloat(e.target.value) || 0)),
                        })
                      }
                      onFocus={(e) => e.target.select()}
                      style={inputStyle}
                      placeholder="0"
                    />
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>gal</span>
                    {state.auxFuelL > 0 && (
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        / {litersToLbs(state.auxFuelL).toFixed(1)} lbs
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ borderTop: "1px solid var(--panel-border)", marginTop: 6, paddingTop: 6 }}>
                  <div style={rowStyle}>
                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Total</span>
                    <span style={{ ...monoVal, fontSize: 12 }}>
                      {litersToGal(state.mainFuelL + state.auxFuelL).toFixed(1)} gal
                      {(state.mainFuelL + state.auxFuelL) > 0 && (
                        <span style={{ ...unitSpan, marginLeft: 6 }}>
                          / {litersToLbs(state.mainFuelL + state.auxFuelL).toFixed(1)} lbs
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* CG Envelope */}
          <div style={cardStyle}>
            <div style={sectionTitle}>CG Envelope</div>
            <EnvelopeChart />
          </div>

          {/* Results */}
          <div style={resultCardStyle}>
            <div style={sectionTitle}>Results</div>
            <Stat label="Takeoff weight" value={result.totalMass.toFixed(1)} unit="kg" warn={result.totalMass > limits.MTOW} />
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
              <Stat label="Rear Baggage" value={`${state.rearFKg}`} unit={`/ ${aircraftConfig.baggageLimits.rearF} kg`} warn={state.rearFKg > aircraftConfig.baggageLimits.rearF} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
