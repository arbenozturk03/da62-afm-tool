import { useEffect, useMemo, useState } from "react";
import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { computeClimbProfile } from "../lib/perf/climb/compute";
import type { ClimbFlaps, ClimbProfileMode, ClimbSegment } from "../lib/perf/climb/types";
import { useAircraft } from "../context/AircraftContext";
import { usePerformance } from "../context/PerformanceContext";
import { useAirportDb } from "../hooks/useAirportDb";

type UIMode = "auto" | "manual";

const DEFAULT_TRANSITION_DELTA_FT = 3000;

const DEFAULTS = {
  uiMode: "auto" as UIMode,
  manualSubMode: "manual_initial" as "manual_initial" | "manual_enroute",
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
  const { result: cgResult } = useAircraft();
  const { state: perfState } = usePerformance();
  const takeoffState = perfState.takeoff;
  const takeoffPA = takeoffState.PA;
  const takeoffOAT = takeoffState.OAT;

  const { db: airportDb } = useAirportDb();
  const selectedIcao = takeoffState.selectedAirport;
  const climbAirport = selectedIcao !== "CUSTOM" ? airportDb?.get(selectedIcao) ?? null : null;
  const airportLabel = selectedIcao !== "CUSTOM"
    ? (climbAirport?.name ?? selectedIcao)
    : null;

  const [uiMode, setUiMode] = useState<UIMode>(DEFAULTS.uiMode);
  const [manualSubMode, setManualSubMode] = useState<"manual_initial" | "manual_enroute">(DEFAULTS.manualSubMode);
  const [flaps, setFlaps] = useState<ClimbFlaps>(DEFAULTS.flaps);
  const [weightKg, setWeightKg] = useState<number>(DEFAULTS.weightKg);
  const [fieldPAft, setFieldPAft] = useState<number>(takeoffPA);
  const [fieldOATc, setFieldOATc] = useState<number>(takeoffOAT);
  const [targetPAft, setTargetPAft] = useState<number>(DEFAULTS.targetPAft);
  const [transitionAltitudeFt, setTransitionAltitudeFt] = useState<number>(
    takeoffPA + DEFAULT_TRANSITION_DELTA_FT,
  );
  const [transitionAltitudeInput, setTransitionAltitudeInput] = useState<string>(
    String(takeoffPA + DEFAULT_TRANSITION_DELTA_FT),
  );
  const [transitionManuallySet, setTransitionManuallySet] = useState(false);

  useEffect(() => {
    setFieldPAft(takeoffPA);
    setFieldOATc(takeoffOAT);
    const defAlt = takeoffPA + DEFAULT_TRANSITION_DELTA_FT;
    setTransitionAltitudeFt(defAlt);
    setTransitionAltitudeInput(String(defAlt));
    setTransitionManuallySet(false);
  }, [takeoffPA, takeoffOAT]);

  useEffect(() => {
    if (!transitionManuallySet) {
      const defAlt = fieldPAft + DEFAULT_TRANSITION_DELTA_FT;
      setTransitionAltitudeFt(defAlt);
      setTransitionAltitudeInput(String(defAlt));
    }
  }, [fieldPAft, transitionManuallySet]);

  const effectiveMode: ClimbProfileMode = uiMode === "auto" ? "auto" : manualSubMode;

  const profile = useMemo(
    () =>
      computeClimbProfile({
        mode: effectiveMode,
        flaps: effectiveMode === "manual_enroute" ? "UP" : flaps,
        weightStartKg: weightKg,
        fieldPAft,
        fieldOATc,
        targetPAft,
        transitionAltitudeFt: effectiveMode === "auto" ? transitionAltitudeFt : undefined,
      }),
    [effectiveMode, flaps, weightKg, fieldPAft, fieldOATc, targetPAft, transitionAltitudeFt],
  );

  const chartData = useMemo(() => buildChartData(profile.segments), [profile.segments]);

  const vyKias = useMemo(() => {
    const seg = profile.segments.find((s) => s.phase === "initial" && s.speedKias != null);
    return seg?.speedKias ?? null;
  }, [profile.segments]);

  const vclimbKias = useMemo(() => {
    const seg = profile.segments.find((s) => s.phase === "enroute" && s.speedKias != null);
    return seg?.speedKias ?? null;
  }, [profile.segments]);

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
          <div className="field-value" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="number"
              min={0}
              value={weightKg}
              onChange={(e) => setWeightKg(Number(e.target.value) || 0)}
              onFocus={selectOnFocus}
              style={{ width: 80 }}
            />
            <button
              type="button"
              onClick={() => setWeightKg(Math.round(cgResult.totalMass))}
              style={{
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 600,
                border: "1px solid var(--panel-border)",
                borderRadius: 6,
                background: "var(--panel-bg)",
                color: "var(--text-primary)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              title="Use current W&B takeoff weight"
            >
              From W&B
            </button>
          </div>
        </div>

        <div className="field">
          <span className="field-label">Field PA (ft)</span>
          <div className="field-value">
            <input
              type="number"
              value={fieldPAft}
              onChange={(e) => setFieldPAft(Number(e.target.value) || 0)}
              onFocus={selectOnFocus}
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
              type="number"
              value={fieldOATc}
              onChange={(e) => setFieldOATc(Number(e.target.value) || 0)}
              onFocus={selectOnFocus}
            />
          </div>
          {airportLabel && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              From Takeoff: {airportLabel}
            </span>
          )}
        </div>

        <div className="field">
          <span className="field-label">Flaps (initial climb)</span>
          <div className="field-value">
            <select
              value={flaps}
              onChange={(e) => setFlaps(e.target.value as ClimbFlaps)}
              disabled={effectiveMode === "manual_enroute"}
              style={effectiveMode === "manual_enroute" ? { opacity: 0.7 } : undefined}
            >
              <option value="UP">UP</option>
              <option value="T/O">T/O</option>
            </select>
            {effectiveMode === "manual_enroute" && (
              <span style={{ fontSize: 11, marginLeft: 6, color: "var(--text-muted)" }}>En-route: UP only</span>
            )}
          </div>
        </div>

        <div className="field">
          <span className="field-label">Target PA (ft)</span>
          <div className="field-value">
            <input
              type="number"
              value={targetPAft}
              onChange={(e) => setTargetPAft(Number(e.target.value) || 0)}
              onFocus={selectOnFocus}
            />
          </div>
        </div>
      </div>

      {/* Mode: Auto vs Manual (Advanced) */}
      <div
        style={{
          marginBottom: 16,
          padding: "10px 14px",
          border: "1px solid var(--panel-border)",
          borderRadius: 8,
          backgroundColor: "var(--panel-bg)",
        }}
      >
        <div className="field" style={{ marginBottom: 8 }}>
          <span className="field-label">Mode</span>
          <div className="field-value">
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginRight: 16 }}>
              <input
                type="radio"
                name="climbMode"
                checked={uiMode === "auto"}
                onChange={() => setUiMode("auto")}
              />
              <span>Auto (Recommended): Vy → Vclimb</span>
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <input
                type="radio"
                name="climbMode"
                checked={uiMode === "manual"}
                onChange={() => setUiMode("manual")}
              />
              <span>Manual (Advanced)</span>
            </label>
          </div>
        </div>
        {uiMode === "auto" && (
          <div className="field" style={{ paddingLeft: 20, borderLeft: "3px solid var(--panel-border)" }}>
            <span className="field-label">Acceleration altitude (ft)</span>
            <div className="field-value">
              <input
                type="number"
                value={transitionAltitudeInput}
                onChange={(e) => {
                  const v = e.target.value;
                  setTransitionAltitudeInput(v);
                  const asNumber = Number(v);
                  if (v.trim() !== "" && Number.isFinite(asNumber)) {
                    setTransitionAltitudeFt(asNumber);
                    setTransitionManuallySet(true);
                  }
                }}
                onFocus={selectOnFocus}
                style={{
                  border: "1px solid var(--panel-border)",
                  borderRadius: 4,
                  padding: "4px 6px",
                }}
                onBlur={() => {
                  if (transitionAltitudeInput.trim() === "") {
                    const defAlt = fieldPAft + DEFAULT_TRANSITION_DELTA_FT;
                    setTransitionManuallySet(false);
                    setTransitionAltitudeFt(defAlt);
                    setTransitionAltitudeInput(String(defAlt));
                  }
                }}
              />
            </div>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Default: Acceleration altitude = Field PA + 3000 ft
            </span>
          </div>
        )}
        {uiMode === "manual" && (
          <div className="field" style={{ paddingLeft: 20, borderLeft: "3px solid var(--panel-border)" }}>
            <span className="field-label">Manual climb</span>
            <div className="field-value">
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginRight: 12 }}>
                <input
                  type="radio"
                  name="manualSub"
                  checked={manualSubMode === "manual_initial"}
                  onChange={() => setManualSubMode("manual_initial")}
                />
                <span>Initial climb only (Vy)</span>
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <input
                  type="radio"
                  name="manualSub"
                  checked={manualSubMode === "manual_enroute"}
                  onChange={() => setManualSubMode("manual_enroute")}
                />
                <span>En-route climb only (Vclimb)</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* ISA note */}
      <p
        style={{
          marginBottom: 16,
          fontSize: 12,
          color: "var(--text-muted)",
          fontStyle: "italic",
        }}
      >
        Temperature aloft estimated using ISA lapse rate (~2°C/1000 ft). OAT correction (+10% time/fuel/distance per 10°C above ISA) is applied by default.
      </p>

      {/* Summary totals */}
      <div
        style={{
          marginBottom: 20,
          padding: "12px 14px",
          border: "1px solid var(--result-border)",
          borderRadius: 8,
          backgroundColor: "var(--result-bg)",
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          fontSize: 14,
        }}
      >
        <div><strong>Total time:</strong> {profile.totals.totalTimeMin.toFixed(1)} min</div>
        <div><strong>Total fuel:</strong> {profile.totals.totalFuelUsGal.toFixed(2)} US gal</div>
        <div><strong>Total distance:</strong> {profile.totals.totalDistanceNm.toFixed(1)} NM</div>
        <div><strong>Final weight:</strong> {profile.totals.finalWeightKg.toFixed(0)} kg</div>
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
              {uiMode === "auto" && (
                <ReferenceLine
                  x={transitionAltitudeFt}
                  stroke="#f97316"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{ value: "Vy → Vclimb", position: "top", fill: "#f97316", fontSize: 11 }}
                />
              )}
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
          {(vyKias != null || vclimbKias != null) && (
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
              {vyKias != null && <div>Vy&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= {vyKias.toFixed(0)} KIAS</div>}
              {vclimbKias != null && <div>Vclimb = {vclimbKias.toFixed(0)} KIAS</div>}
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
              {uiMode === "auto" && (
                <ReferenceLine
                  x={transitionAltitudeFt}
                  stroke="#f97316"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{ value: "Vy → Vclimb", position: "top", fill: "#f97316", fontSize: 11 }}
                />
              )}
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
          {(vyKias != null || vclimbKias != null) && (
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
              {vyKias != null && <div>Vy&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= {vyKias.toFixed(0)} KIAS</div>}
              {vclimbKias != null && <div>Vclimb = {vclimbKias.toFixed(0)} KIAS</div>}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
