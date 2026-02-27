import { useAircraft } from "../../context/AircraftContext";
import { aircraftConfig } from "../../data/aircraftConfig";

const cardStyle: React.CSSProperties = {
  border: "1px solid var(--panel-border)",
  borderRadius: 8,
  padding: "8px 14px 16px",
  backgroundColor: "var(--panel-bg)",
  marginBottom: 16,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-muted)",
  marginBottom: 8,
};

const fieldStyle: React.CSSProperties = { marginBottom: 8 };

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 2,
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-secondary)",
};

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--panel-border)",
  borderRadius: 2,
  padding: "2px 4px",
  fontSize: 16,
  width: 90,
  background: "transparent",
  color: "inherit",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  width: "100%",
  textAlign: "left",
};

const outputRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  padding: "4px 0",
  fontSize: 13,
};

/** Normalize decimal separator to period so iOS/locale shows "2.43" not "2,43" */
function parseDecimal(s: string): number {
  const normalized = s.trim().replace(",", ".");
  return parseFloat(normalized) || 0;
}

function Field({
  label,
  value,
  onChange,
  unit,
  step = 1,
  min,
  max,
  decimalPlaces,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  /** If set, use text input with fixed decimals so iOS shows "2.43" not "2,43" */
  decimalPlaces?: number;
}) {
  const isDecimal = decimalPlaces != null;
  const displayValue = isDecimal ? value.toFixed(decimalPlaces) : String(value);

  return (
    <div style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <input
          type={isDecimal ? "text" : "number"}
          inputMode={isDecimal ? "decimal" : "numeric"}
          value={displayValue}
          step={step}
          min={min}
          max={max}
          onChange={(e) =>
            onChange(isDecimal ? parseDecimal(e.target.value) : parseFloat(e.target.value) || 0)
          }
          onFocus={(e) => e.target.select()}
          style={inputStyle}
        />
        {unit && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{unit}</span>}
      </span>
    </div>
  );
}

export default function ConfigPage() {
  const { state, dispatch } = useAircraft();

  const deiceMass = state.deiceEnabled
    ? (state.deiceLiters * aircraftConfig.densities.deice).toFixed(2)
    : "0.00";

  return (
    <div style={{ padding: "16px 12px", maxWidth: 480, margin: "0 auto" }}>
      <h1 className="perf-title" style={{ marginBottom: 16 }}>Aircraft Configuration</h1>

      {/* Basic aircraft */}
      <div style={cardStyle}>
        <div style={sectionTitle}>Basic Aircraft</div>
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
          decimalPlaces={2}
        />
      </div>

      {/* Deicing */}
      <div id="deicing" style={cardStyle}>
        <div style={sectionTitle}>De-Icing System</div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={state.deiceEnabled}
            onChange={(e) =>
              dispatch({ type: "SET_FIELD", field: "deiceEnabled", value: e.target.checked })
            }
            style={{ accentColor: "#3b82f6", width: 16, height: 16 }}
          />
          <span style={{ fontSize: 13 }}>TKS De-Ice enabled</span>
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
            <div style={{ ...outputRow, borderTop: "1px solid var(--panel-border)", marginTop: 8, paddingTop: 6 }}>
              <span style={{ color: "var(--text-secondary)" }}>Fluid mass</span>
              <span style={{ fontWeight: 600 }}>
                {deiceMass}
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>kg</span>
              </span>
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              Density: {aircraftConfig.densities.deice} kg/L &nbsp;|&nbsp; Arm: {aircraftConfig.arms.deice} m
            </p>
          </>
        )}
      </div>

      {/* Aircraft presets */}
      <div style={cardStyle}>
        <div style={sectionTitle}>Aircraft Presets</div>
        <select style={selectStyle} defaultValue="default">
          <option value="default">DA-62 (TC-YTT)</option>
        </select>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
          More presets coming soon. Configure manually above.
        </p>
      </div>

      {/* Reference */}
      <div style={cardStyle}>
        <div style={sectionTitle}>Reference Values</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.8 }}>
          <div>MTOW = {aircraftConfig.limits.MTOW} kg</div>
          <div>MZFW = {aircraftConfig.limits.MZFW} kg</div>
          <div>Fuel density = {aircraftConfig.densities.fuel} kg/L</div>
        </div>
      </div>
    </div>
  );
}
