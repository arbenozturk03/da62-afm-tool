import { useEffect, useMemo, useState } from "react";
import { usePerformance } from "../../context/PerformanceContext";
import type { CruisePrefillState } from "../../context/PerformanceContext";
import { computeCruisePerformance, type CruiseSetting } from "../../core/cruisePerformance";
import { parseDecimalInput } from "../../utils/decimalInput";

/** OAT display: tam sayıda .0 gösterme (-17), ondalık varsa göster (17.5). */
function formatOatDisplay(c: number): string {
  return c.toFixed(1).replace(/\.0$/, "");
}

function oatStringFromPrefill(p: CruisePrefillState | null): string {
  if (!p) return "15";
  if (p.tocOatC != null) return formatOatDisplay(p.tocOatC);
  if (p.tocIsaDeviationC != null) {
    const isa = 15 - 1.98 * (p.tocPressureAltFt / 1000);
    return formatOatDisplay(isa + p.tocIsaDeviationC);
  }
  return formatOatDisplay(15 - 1.98 * (p.tocPressureAltFt / 1000));
}

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
  width: 100,
  background: "transparent",
  color: "inherit",
};

const resultRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  padding: "3px 0",
  fontSize: 13,
};

type FuelDisplayMode = "liters" | "gallons";

const L_PER_US_GAL = 3.785411784;
const FUEL_MAX_L = 189;

export default function CruisePage() {
  const { state: perfState } = usePerformance();
  const cruisePrefill = perfState.cruisePrefill;

  const [pressureAltInput, setPressureAltInput] = useState<string>(() =>
    cruisePrefill ? String(Math.round(cruisePrefill.tocPressureAltFt)) : "16000",
  );
  const [oatInput, setOatInput] = useState<string>(() => oatStringFromPrefill(cruisePrefill));
  const [weightInput, setWeightInput] = useState<string>(() =>
    cruisePrefill ? cruisePrefill.tocWeightKg.toFixed(0) : "1600",
  );
  const [fuelInput, setFuelInput] = useState<string>("");
  const [setting, setSetting] = useState<CruiseSetting>("MED");
  const [fuelMode, setFuelMode] = useState<FuelDisplayMode>("liters");

  useEffect(() => {
    if (!cruisePrefill) return;

    setPressureAltInput(String(Math.round(cruisePrefill.tocPressureAltFt)));
    setOatInput(oatStringFromPrefill(cruisePrefill));
    setWeightInput(cruisePrefill.tocWeightKg.toFixed(0));
    if (cruisePrefill.fuelRemainingGal != null) {
      const fuelGal = cruisePrefill.fuelRemainingGal;
      if (fuelMode === "gallons") {
        setFuelInput(fuelGal.toFixed(1));
      } else {
        setFuelInput((fuelGal * L_PER_US_GAL).toFixed(1));
      }
    }
  }, [cruisePrefill, fuelMode]);

  const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

  const hasRequiredInputs =
    pressureAltInput.trim() !== "" &&
    oatInput.trim() !== "" &&
    weightInput.trim() !== "";

  const parsed = useMemo(() => {
    if (!hasRequiredInputs) return null;

    const pressureAltitudeFt = parseDecimalInput(pressureAltInput);
    const oatC = parseDecimalInput(oatInput);
    const weightKg = parseDecimalInput(weightInput);
    const rawFuel = fuelInput.trim() === "" ? undefined : parseDecimalInput(fuelInput);

    if (
      !Number.isFinite(pressureAltitudeFt) ||
      !Number.isFinite(oatC) ||
      !Number.isFinite(weightKg)
    ) {
      return null;
    }

    const isaTempC = 15 - 1.98 * (pressureAltitudeFt / 1000);
    const isaDeviationC = oatC - isaTempC;

    const fuelRemainingGal =
      rawFuel != null && Number.isFinite(rawFuel)
        ? fuelMode === "gallons"
          ? rawFuel
          : rawFuel / L_PER_US_GAL
        : undefined;

    return {
      pressureAltitudeFt,
      isaDeviationC,
      weightKg,
      cruiseSetting: setting,
      fuelRemainingGal,
    };
  }, [fuelInput, fuelMode, hasRequiredInputs, oatInput, pressureAltInput, setting, weightInput]);

  const result = parsed ? computeCruisePerformance(parsed) : null;

  const ok = result && result.ok ? result : null;
  const err = result && !result.ok ? result : null;

  return (
    <div style={{ padding: "16px 12px", maxWidth: 520, margin: "0 auto" }}>
      <h1 className="perf-title" style={{ marginBottom: 16 }}>
        DA-62 Cruise Performance
      </h1>

      <div style={cardStyle}>
        <div style={sectionTitle}>Inputs</div>

        <div style={fieldStyle}>
          <span style={labelStyle}>Cruise Altitude (ft)</span>
          <input
            type="text"
            inputMode="decimal"
            value={pressureAltInput}
            onChange={(e) => setPressureAltInput(e.target.value.replace(/,/g, "."))}
            onFocus={selectOnFocus}
            style={inputStyle}
          />
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>
            OAT at altitude (°C)
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={oatInput}
            onChange={(e) => setOatInput(e.target.value.replace(/,/g, "."))}
            onFocus={selectOnFocus}
            style={inputStyle}
          />
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            ISA deviation is computed automatically from OAT.
          </div>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>Weight at TOC (kg)</span>
          <input
            type="text"
            inputMode="decimal"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value.replace(/,/g, "."))}
            onFocus={selectOnFocus}
            style={inputStyle}
          />
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>Cruise Setting</span>
          <div
            style={{
              display: "inline-flex",
              borderRadius: 6,
              overflow: "hidden",
              border: "1px solid var(--panel-border)",
            }}
          >
            {(["HIGH", "MED", "ECO", "LOW"] as CruiseSetting[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSetting(s)}
                style={{
                  backgroundColor: setting === s ? "#2563eb" : "var(--panel-bg)",
                  color: setting === s ? "#fff" : "var(--text-muted)",
                  padding: "4px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>Fuel Remaining at TOC</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid var(--panel-border)", width: "fit-content" }}>
              {(["liters", "gallons"] as FuelDisplayMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
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
                  {mode === "liters" ? "L" : "gal"}
                </button>
              ))}
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={fuelInput}
              onChange={(e) => {
                const raw = e.target.value.replace(/,/g, ".");
                if (raw.trim() === "") {
                  setFuelInput("");
                  return;
                }
                const n = parseDecimalInput(raw);
                if (!Number.isFinite(n)) {
                  setFuelInput(raw);
                  return;
                }
                if (fuelMode === "liters") {
                  const clamped = Math.max(0, Math.min(FUEL_MAX_L, n));
                  setFuelInput(clamped.toString());
                } else {
                  const maxGal = FUEL_MAX_L / L_PER_US_GAL;
                  const clamped = Math.max(0, Math.min(maxGal, n));
                  setFuelInput(clamped.toFixed(1).replace(/\.0$/, ""));
                }
              }}
              onFocus={selectOnFocus}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      <p
        style={{
          margin: "-10px 1px 5px",
          fontSize: 12,
          color: "#60a5fa",
          fontWeight: 600,
        }}
      >
        All inputs are auto-filled from TOC data after configuring the Climb page.
      </p>

      {err && (
        <div
          style={{
            marginTop: 8,
            marginBottom: 16,
            padding: "10px 14px",
            border: "1px solid #c62828",
            borderRadius: 8,
            backgroundColor: "rgba(198, 40, 40, 0.1)",
            fontSize: 13,
          }}
        >
          <p style={{ color: "#ef5350", fontWeight: 600, margin: 0 }}>
            {err.error}
          </p>
        </div>
      )}

      {ok && (
        <div
          style={{
            ...cardStyle,
            backgroundColor: "var(--result-bg)",
            borderColor: "var(--result-border)",
          }}
        >
          <div style={sectionTitle}>Results</div>
          <div style={resultRow}>
            <span style={{ color: "var(--text-secondary)" }}>TAS</span>
            <span style={{ fontWeight: 600 }}>
              {ok.tasKt.toFixed(1)}
              <span style={{ marginLeft: 4, fontSize: 11, color: "var(--text-muted)" }}>
                kt
              </span>
            </span>
          </div>
          <div style={resultRow}>
            <span style={{ color: "var(--text-secondary)" }}>Fuel Flow</span>
            <span style={{ fontWeight: 600 }}>
              {ok.fuelFlowGph.toFixed(1)}
              <span style={{ marginLeft: 4, fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>
                US gal/h
              </span>
              <span style={{ marginLeft: 12, fontWeight: 600 }}>
                {(ok.fuelFlowGph * L_PER_US_GAL).toFixed(1)}
              </span>
              <span style={{ marginLeft: 4, fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>
                L/h
              </span>
            </span>
          </div>
          <div style={resultRow}>
            <span style={{ color: "var(--text-secondary)" }}>% Power (AFM)</span>
            <span style={{ fontWeight: 600 }}>
              {ok.pwrPercent.toFixed(0)}
              <span style={{ marginLeft: 4, fontSize: 11, color: "var(--text-muted)" }}>
                %
              </span>
            </span>
          </div>
          <div style={resultRow}>
            <span style={{ color: "var(--text-secondary)" }}>Specific Range</span>
            <span style={{ fontWeight: 600 }}>
              {ok.specificRangeNmPerGal.toFixed(2)}
              <span style={{ marginLeft: 4, fontSize: 11, color: "var(--text-muted)" }}>
                NM/gal
              </span>
            </span>
          </div>

          {ok.enduranceHr != null && ok.rangeNm != null && (
            <>
              <div
                style={{
                  borderTop: "1px solid var(--panel-border)",
                  marginTop: 6,
                  paddingTop: 6,
                }}
              />
              <div style={resultRow}>
                <span style={{ color: "var(--text-secondary)" }}>Endurance</span>
                {(() => {
                  const totalMinutes = ok.enduranceHr * 60;
                  const hours = Math.floor(totalMinutes / 60);
                  const minutes = Math.round(totalMinutes - hours * 60);
                  const label =
                    hours <= 0
                      ? `${minutes} min`
                      : `${hours}h ${minutes.toString().padStart(2, "0")} min`;
                  return (
                    <span style={{ fontWeight: 600 }}>
                      {label}
                    </span>
                  );
                })()}
              </div>
              <div style={resultRow}>
                <span style={{ color: "var(--text-secondary)" }}>Still-air Range</span>
                <span style={{ fontWeight: 600 }}>
                  {ok.rangeNm.toFixed(0)}
                  <span
                    style={{ marginLeft: 4, fontSize: 11, color: "var(--text-muted)" }}
                  >
                    NM
                  </span>
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

