import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { computeClimbProfile } from "../lib/perf/climb/compute";
import type { ClimbFlaps, ClimbSegment } from "../lib/perf/climb/types";
import { useAircraft } from "../context/AircraftContext";
import { usePerformance } from "../context/PerformanceContext";
import { useAirportDb } from "../hooks/useAirportDb";
import { getCruiseInputsFromTOC } from "../core/cruisePerformance";
import { parseDecimalInput, toDecimalString } from "../utils/decimalInput";

const L_PER_US_GAL = 3.785411784;

const DEFAULTS = {
  flaps: "UP" as ClimbFlaps,
  weightKg: 1900,
  fieldPAft: 2000,
  fieldOATc: 11,
  targetPAft: 16000,
};

interface ChartPoint {
  altMidFt: number;
  rocFpm: number | null;
  gradientPercent: number | null;
  phase: string;
  speedKias: number | null;
  tasKtas: number | null;
  fuelUsGal: number | null;
  weightStartKg: number;
  weightEndKg: number;
}

function buildChartData(segments: ClimbSegment[]): ChartPoint[] {
  return segments.map((seg) => ({
    altMidFt: (seg.altStartFt + seg.altEndFt) / 2,
    rocFpm: seg.rocFpm,
    gradientPercent: seg.gradientPercent,
    phase: seg.phase === "initial" ? "Vy" : "Vclimb",
    speedKias: seg.speedKias,
    tasKtas: seg.tasKtas,
    fuelUsGal: seg.fuelUsGal,
    weightStartKg: seg.weightStartKg,
    weightEndKg: seg.weightEndKg,
  }));
}

function RocTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartPoint }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 6,
        border: "1px solid var(--panel-border)",
        backgroundColor: "var(--panel-bg)",
        fontSize: 12,
        minWidth: 160,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Alt {p.altMidFt.toFixed(0)} ft</div>
      <div>Phase: <strong>{p.phase}</strong></div>
      <div>Speed: {p.speedKias != null ? `${p.speedKias} KIAS` : "—"}</div>
      <div>TAS: {p.tasKtas != null ? `${p.tasKtas.toFixed(1)} KTAS` : "—"}</div>
      <div>ROC: {p.rocFpm != null ? `${p.rocFpm.toFixed(0)} fpm` : "—"}</div>
      <div>Gradient: {p.gradientPercent != null ? `${p.gradientPercent.toFixed(2)}%` : "—"}</div>
    </div>
  );
}

function GradientTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartPoint }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 6,
        border: "1px solid var(--panel-border)",
        backgroundColor: "var(--panel-bg)",
        fontSize: 12,
        minWidth: 160,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Alt {p.altMidFt.toFixed(0)} ft</div>
      <div>Phase: <strong>{p.phase}</strong></div>
      <div>Speed: {p.speedKias != null ? `${p.speedKias} KIAS` : "—"}</div>
      <div>TAS: {p.tasKtas != null ? `${p.tasKtas.toFixed(1)} KTAS` : "—"}</div>
      <div>ROC: {p.rocFpm != null ? `${p.rocFpm.toFixed(0)} fpm` : "—"}</div>
      <div>Gradient: {p.gradientPercent != null ? `${p.gradientPercent.toFixed(2)}%` : "—"}</div>
    </div>
  );
}


export default function ClimbCalculator() {
  const { result: cgResult, state: aircraftState } = useAircraft();
  const { state: perfState, setCruisePrefill, setClimbWeight } = usePerformance();
  const takeoffState = perfState.takeoff;
  const climbWeightStored = perfState.climbWeightKg;
  const takeoffPA = takeoffState.PA;
  const takeoffOAT = takeoffState.OAT;
  const navigate = useNavigate();

  const { db: airportDb } = useAirportDb();
  const selectedIcao = takeoffState.selectedAirport;
  const climbAirport = selectedIcao !== "CUSTOM" ? airportDb?.get(selectedIcao) ?? null : null;
  const airportLabel = selectedIcao !== "CUSTOM"
    ? (climbAirport?.name ?? selectedIcao)
    : null;

  const [flaps, setFlaps] = useState<ClimbFlaps>(DEFAULTS.flaps);
  const derivedWeightKg =
    aircraftState.wbModified ? Math.round(cgResult.totalMass) : DEFAULTS.weightKg;
  const weightKg = climbWeightStored ?? derivedWeightKg;
  const [weightInputStr, setWeightInputStr] = useState(() => toDecimalString(weightKg, 0));
  useEffect(() => {
    if (weightInputStr === "") return;
    if (climbWeightStored != null) return;
    setWeightInputStr(toDecimalString(weightKg, 0));
  }, [weightKg, climbWeightStored, weightInputStr]);
  const effectiveWeightKg =
    weightInputStr.trim() !== "" ? parseDecimalInput(weightInputStr) : weightKg;

  const [fieldPAftInput, setFieldPAftInput] = useState<string>(() =>
    toDecimalString(takeoffPA, 0),
  );
  const [fieldOATcInput, setFieldOATcInput] = useState<string>(() =>
    toDecimalString(takeoffOAT, 1),
  );
  const [targetPAftInput, setTargetPAftInput] = useState<string>(() =>
    String(DEFAULTS.targetPAft),
  );
  const [showVyReference, setShowVyReference] = useState(false);

  const effectiveFieldPAft =
    fieldPAftInput.trim() === "" ? takeoffPA : parseDecimalInput(fieldPAftInput);
  const effectiveFieldOATc =
    fieldOATcInput.trim() === "" ? takeoffOAT : parseDecimalInput(fieldOATcInput);
  const effectiveTargetPAft =
    targetPAftInput.trim() === ""
      ? DEFAULTS.targetPAft
      : parseDecimalInput(targetPAftInput);

  /** Sync field PA/OAT from Takeoff when they change so Climb reflects Takeoff (e.g. after filling Takeoff). */
  useEffect(() => {
    setFieldPAftInput(toDecimalString(takeoffPA, 0));
    setFieldOATcInput(toDecimalString(takeoffOAT, 1));
  }, [takeoffPA, takeoffOAT]);

  /** TOC from AFM 5.3.10 Time/Fuel/Distance-to-Climb (Vclimb only). */
  const profile = useMemo(
    () =>
      computeClimbProfile({
        mode: "manual_enroute",
        flaps: "UP",
        weightStartKg: effectiveWeightKg,
        fieldPAft: effectiveFieldPAft,
        fieldOATc: effectiveFieldOATc,
        targetPAft: effectiveTargetPAft,
      }),
    [effectiveWeightKg, effectiveFieldPAft, effectiveFieldOATc, effectiveTargetPAft],
  );

  /** Vy profile for optional Best ROC reference (ROC only; not used for TOC totals). */
  const vyProfile = useMemo(
    () =>
      showVyReference
        ? computeClimbProfile({
            mode: "manual_initial",
            flaps,
            weightStartKg: effectiveWeightKg,
            fieldPAft: effectiveFieldPAft,
            fieldOATc: effectiveFieldOATc,
            targetPAft: effectiveTargetPAft,
          })
        : null,
    [
      showVyReference,
      flaps,
      effectiveWeightKg,
      effectiveFieldPAft,
      effectiveFieldOATc,
      effectiveTargetPAft,
    ],
  );

  const chartData = useMemo(() => buildChartData(profile.segments), [profile.segments]);

  const vclimbKias = useMemo(() => {
    const seg = profile.segments.find((s) => s.phase === "enroute" && s.speedKias != null);
    return seg?.speedKias ?? null;
  }, [profile.segments]);

  const vyKiasReference = useMemo(() => {
    if (!vyProfile?.segments.length) return null;
    const seg = vyProfile.segments.find((s) => s.speedKias != null);
    return seg?.speedKias ?? null;
  }, [vyProfile]);

  /** Keep cruise prefill in sync with climb so Cruise page is always up to date without "Continue to Cruise". */
  useEffect(() => {
    const tocPressureAltFt = profile.inputs.targetPAft;
    const tocWeightKg =
      profile.segments.length > 0
        ? profile.totals.finalWeightKg
        : effectiveWeightKg;
    const totalFuelUsGal =
      profile.segments.length > 0 ? profile.totals.totalFuelUsGal : 0;
    const LAPSE_C_PER_1000FT = 2.0;
    const tocOatC =
      profile.segments.length > 0
        ? (profile.segments[profile.segments.length - 1]?.oatEndC ?? null)
        : effectiveFieldOATc -
          (LAPSE_C_PER_1000FT / 1000) *
            Math.max(0, profile.inputs.targetPAft - profile.inputs.fieldPAft);
    const cruiseInputs = getCruiseInputsFromTOC({
      tocPressureAltFt,
      tocOatC: tocOatC ?? undefined,
      tocIsaDeviationC: null,
      tocWeightKg,
    });
    const totalFuelL = aircraftState.mainFuelL + aircraftState.auxFuelL;
    const totalFuelUsGalFromTanks = totalFuelL / L_PER_US_GAL;
    const fuelRemainingGal = Math.max(
      0,
      totalFuelUsGalFromTanks - totalFuelUsGal,
    );
    setCruisePrefill({
      tocPressureAltFt: cruiseInputs.pressureAltitudeFt,
      tocOatC: tocOatC ?? null,
      tocIsaDeviationC: cruiseInputs.isaDeviationC,
      tocWeightKg: cruiseInputs.weightKg,
      fuelRemainingGal,
    });
  }, [
    profile.segments,
    profile.totals.finalWeightKg,
    profile.totals.totalFuelUsGal,
    profile.inputs.targetPAft,
    effectiveWeightKg,
    effectiveFieldOATc,
    aircraftState.mainFuelL,
    aircraftState.auxFuelL,
    setCruisePrefill,
  ]);

  const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

  return (
    <div style={{ padding: "16px 12px", maxWidth: 1000, margin: "0 auto" }}>
      <h1 className="perf-title">DA-62 Climb Performance</h1>

      {/* Inputs — single flow */}
      <div
        className="takeoff-inputs"
        style={{
          marginBottom: 16,
          border: "1px solid var(--panel-border)",
          borderRadius: 8,
          padding: "10px 14px 14px",
          backgroundColor: "var(--panel-bg)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 10,
        }}
      >
        <div className="field">
          <span className="field-label">Weight (kg)</span>
          <div className="field-value">
            <input
              type="text"
              inputMode="decimal"
              value={weightInputStr}
              onChange={(e) => {
                const v = e.target.value.replace(/,/g, ".");
                setWeightInputStr(v);
                if (v.trim() === "") {
                  setClimbWeight(null);
                } else {
                  setClimbWeight(parseDecimalInput(v));
                }
              }}
              onFocus={selectOnFocus}
              style={{ width: 80 }}
              placeholder=""
            />
          </div>
        </div>

        <div className="field">
          <span className="field-label">Field Elev. (ft)</span>
          <div className="field-value">
            <input
              type="text"
              inputMode="decimal"
              value={fieldPAftInput}
              onChange={(e) => setFieldPAftInput(e.target.value.replace(/,/g, "."))}
              onFocus={selectOnFocus}
              placeholder=""
            />
          </div>
          {airportLabel && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              From Takeoff: {airportLabel}
            </span>
          )}
        </div>

        <div className="field">
          <span className="field-label">Field OAT (°C)</span>
          <div className="field-value">
            <input
              type="text"
              inputMode="decimal"
              value={fieldOATcInput}
              onChange={(e) => setFieldOATcInput(e.target.value.replace(/,/g, "."))}
              onFocus={selectOnFocus}
              placeholder=""
            />
          </div>
          {airportLabel && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              From Takeoff: {airportLabel}
            </span>
          )}
        </div>

        <div className="field">
          <span className="field-label">Flaps (for Best ROC reference)</span>
          <div className="field-value">
            <select
              value={flaps}
              onChange={(e) => setFlaps(e.target.value as ClimbFlaps)}
            >
              <option value="UP">UP</option>
              <option value="T/O">T/O</option>
            </select>
          </div>
        </div>

        <div className="field">
          <span className="field-label">Target Altitude (ft)</span>
          <div className="field-value">
            <input
              type="text"
              inputMode="decimal"
              value={targetPAftInput}
              onChange={(e) => setTargetPAftInput(e.target.value.replace(/,/g, "."))}
              onFocus={selectOnFocus}
              placeholder=""
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
        Weight and airport inputs are auto-filled here after configuring W&amp;B and Takeoff.
      </p>

      {/* ISA note */}
      <p
        style={{
          marginBottom: 16,
          fontSize: 12,
          color: "var(--text-muted)",
          fontStyle: "italic",
        }}
      >
        Temperature aloft estimated using ISA lapse rate (~2°C/1000 ft).
      </p>

      {/* Summary totals / TOC parameters */}
      <div
        style={{
          marginBottom: 20,
          padding: "12px 14px",
          border: "1px solid var(--result-border)",
          borderRadius: 8,
          backgroundColor: "var(--result-bg)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 16,
          fontSize: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-secondary)" }}>
            TOC Parameters
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
            Still-air (no-wind) assumption for climb segment
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
          <div><strong>Total time:</strong> {profile.totals.totalTimeMin.toFixed(1)} min</div>
          <div><strong>Total fuel:</strong> {profile.totals.totalFuelUsGal.toFixed(2)} US gal</div>
          <div><strong>Total distance:</strong> {profile.totals.totalDistanceNm.toFixed(1)} NM</div>
          <div><strong>Final weight:</strong> {profile.totals.finalWeightKg.toFixed(0)} kg</div>
        </div>
        {profile.segments.length > 0 && (
          <div style={{ marginLeft: "auto" }}>
            <button
              type="button"
              onClick={() => {
                const lastSeg = profile.segments[profile.segments.length - 1];
                const tocPressureAltFt = profile.inputs.targetPAft;
                const tocOatC = lastSeg?.oatEndC ?? null;
                const tocWeightKg = profile.totals.finalWeightKg;
                const cruiseInputs = getCruiseInputsFromTOC({
                  tocPressureAltFt,
                  tocOatC,
                  tocIsaDeviationC: null,
                  tocWeightKg,
                });
                const totalFuelL = aircraftState.mainFuelL + aircraftState.auxFuelL;
                const totalFuelUsGal = totalFuelL / L_PER_US_GAL;
                const fuelRemainingGal = Math.max(0, totalFuelUsGal - profile.totals.totalFuelUsGal);
                setCruisePrefill({
                  tocPressureAltFt: cruiseInputs.pressureAltitudeFt,
                  tocOatC,
                  tocIsaDeviationC: cruiseInputs.isaDeviationC,
                  tocWeightKg: cruiseInputs.weightKg,
                  fuelRemainingGal,
                });
                navigate("/cruise");
              }}
              style={{
                padding: "6px 12px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 6,
                border: "1px solid var(--panel-border)",
                backgroundColor: "var(--panel-bg)",
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              Continue to Cruise
            </button>
          </div>
        )}
      </div>

      {/* Charts */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            borderRadius: 8,
            border: "1px solid var(--panel-border)",
            backgroundColor: "var(--panel-bg)",
            padding: 8,
            minHeight: 280,
            position: "relative",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, margin: "4px 8px 8px" }}>ROC vs Altitude</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={chartData}
              margin={{ top: 24, right: 16, left: 0, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
              <XAxis
                dataKey="altMidFt"
                type="number"
                tickFormatter={(v) => `${v}`}
                label={{ value: "Altitude (ft)", position: "insideBottom", offset: -4, fill: "var(--text-secondary)", fontSize: 11 }}
              />
              <YAxis
                dataKey="rocFpm"
                tickFormatter={(v) => `${v}`}
                label={{ value: "ROC (ft/min)", angle: -90, position: "insideLeft", offset: 10, fill: "var(--text-secondary)", fontSize: 11 }}
              />
              <Tooltip content={<RocTooltip />} />
              <Line
                type="monotone"
                dataKey="rocFpm"
                name="ROC"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
          {vclimbKias != null && (
            <div
              style={{
                position: "absolute",
                top: 10,
                right: 20,
                fontSize: 11,
                fontFamily: "monospace",
                color: "var(--text-primary)",
                lineHeight: 1.7,
                textAlign: "left",
                pointerEvents: "none",
                backgroundColor: "var(--panel-bg)",
                border: "1px solid var(--panel-border)",
                borderRadius: 4,
                padding: "4px 8px",
                zIndex: 2,
              }}
            >
              <div>Vclimb = {vclimbKias.toFixed(0)} KIAS</div>
            </div>
          )}
        </div>

        <div
          style={{
            borderRadius: 8,
            border: "1px solid var(--panel-border)",
            backgroundColor: "var(--panel-bg)",
            padding: 8,
            minHeight: 280,
            position: "relative",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, margin: "4px 8px 8px" }}>Gradient vs Altitude</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={chartData}
              margin={{ top: 24, right: 16, left: 0, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
              <XAxis
                dataKey="altMidFt"
                type="number"
                tickFormatter={(v) => `${v}`}
                label={{ value: "Altitude (ft)", position: "insideBottom", offset: -4, fill: "var(--text-secondary)", fontSize: 11 }}
              />
              <YAxis
                dataKey="gradientPercent"
                tickFormatter={(v) => `${v}`}
                label={{ value: "Gradient (%)", angle: -90, position: "insideLeft", offset: 10, fill: "var(--text-secondary)", fontSize: 11 }}
              />
              <Tooltip content={<GradientTooltip />} />
              <Line
                type="monotone"
                dataKey="gradientPercent"
                name="Gradient"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
          {vclimbKias != null && (
            <div
              style={{
                position: "absolute",
                top: 10,
                right: 20,
                fontSize: 11,
                fontFamily: "monospace",
                color: "var(--text-primary)",
                lineHeight: 1.7,
                textAlign: "left",
                pointerEvents: "none",
                backgroundColor: "var(--panel-bg)",
                border: "1px solid var(--panel-border)",
                borderRadius: 4,
                padding: "4px 8px",
                zIndex: 2,
              }}
            >
              <div>Vclimb = {vclimbKias.toFixed(0)} KIAS</div>
            </div>
          )}
        </div>
      </div>

      {/* Best Rate of Climb (Vy) – Reference (optional; ROC only, does not affect TOC totals) */}
      <div
        style={{
          marginBottom: 20,
          border: "1px solid var(--panel-border)",
          borderRadius: 8,
          backgroundColor: "var(--panel-bg)",
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={() => setShowVyReference((v) => !v)}
          style={{
            width: "100%",
            padding: "10px 14px",
            textAlign: "left",
            border: "none",
            background: "transparent",
            color: "inherit",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>Best Rate of Climb (Vy) – Reference</span>
          <span style={{ fontSize: 18, lineHeight: 1 }}>{showVyReference ? "−" : "+"}</span>
        </button>
        {showVyReference && (
          <div style={{ padding: "0 14px 14px", borderTop: "1px solid var(--panel-border)" }}>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 0 10px", fontStyle: "italic" }}>
              Vy table provides ROC only. AFM does not provide fuel/distance for Vy, so TOC fuel/distance totals are not recomputed.
            </p>
            {vyProfile && vyProfile.segments.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    borderRadius: 8,
                    border: "1px solid var(--panel-border)",
                    backgroundColor: "var(--panel-bg)",
                    padding: 8,
                    minHeight: 260,
                    position: "relative",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, margin: "4px 8px 8px" }}>ROC vs Altitude (Vy)</div>
                  {vyKiasReference != null && (
                    <div
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 20,
                        fontSize: 11,
                        fontFamily: "monospace",
                        color: "var(--text-primary)",
                        lineHeight: 1.7,
                        textAlign: "left",
                        pointerEvents: "none",
                        backgroundColor: "var(--panel-bg)",
                        border: "1px solid var(--panel-border)",
                        borderRadius: 4,
                        padding: "4px 8px",
                        zIndex: 2,
                      }}
                    >
                      <div>Vy = {vyKiasReference.toFixed(0)} KIAS</div>
                    </div>
                  )}
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart
                      data={buildChartData(vyProfile.segments)}
                      margin={{ top: 24, right: 16, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
                      <XAxis
                        dataKey="altMidFt"
                        type="number"
                        tickFormatter={(v) => `${v}`}
                        label={{ value: "Altitude (ft)", position: "insideBottom", offset: -4, fill: "var(--text-secondary)", fontSize: 11 }}
                      />
                      <YAxis
                        dataKey="rocFpm"
                        tickFormatter={(v) => `${v}`}
                        label={{ value: "ROC (ft/min)", angle: -90, position: "insideLeft", offset: 10, fill: "var(--text-secondary)", fontSize: 11 }}
                      />
                      <Tooltip content={<RocTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="rocFpm"
                        name="ROC"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div
                  style={{
                    borderRadius: 8,
                    border: "1px solid var(--panel-border)",
                    backgroundColor: "var(--panel-bg)",
                    padding: 8,
                    minHeight: 260,
                    position: "relative",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, margin: "4px 8px 8px" }}>Gradient vs Altitude (Vy)</div>
                  {vyKiasReference != null && (
                    <div
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 20,
                        fontSize: 11,
                        fontFamily: "monospace",
                        color: "var(--text-primary)",
                        lineHeight: 1.7,
                        textAlign: "left",
                        pointerEvents: "none",
                        backgroundColor: "var(--panel-bg)",
                        border: "1px solid var(--panel-border)",
                        borderRadius: 4,
                        padding: "4px 8px",
                        zIndex: 2,
                      }}
                    >
                      <div>Vy = {vyKiasReference.toFixed(0)} KIAS</div>
                    </div>
                  )}
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart
                      data={buildChartData(vyProfile.segments)}
                      margin={{ top: 24, right: 16, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" />
                      <XAxis
                        dataKey="altMidFt"
                        type="number"
                        tickFormatter={(v) => `${v}`}
                        label={{ value: "Altitude (ft)", position: "insideBottom", offset: -4, fill: "var(--text-secondary)", fontSize: 11 }}
                      />
                      <YAxis
                        dataKey="gradientPercent"
                        tickFormatter={(v) => `${v}`}
                        label={{ value: "Gradient (%)", angle: -90, position: "insideLeft", offset: 10, fill: "var(--text-secondary)", fontSize: 11 }}
                      />
                      <Tooltip content={<GradientTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="gradientPercent"
                        name="Gradient"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
