import { useEffect, useState, type FocusEvent } from "react";
import { computeTakeoff, type RunwayCondition, type RunwaySurface } from "./core/takeoff";
import { applyTakeoffCorrections, type CorrectionInputs } from "./core/corrections";
import { useMetar } from "./hooks/useMetar";
import { useAirportDb } from "./hooks/useAirportDb";
import { useAircraft } from "./context/AircraftContext";
import { usePerformance } from "./context/PerformanceContext";
import MetarCard from "./MetarCard";
import AirportSearch from "./AirportSearch";

const metersToFeet = (meters: number) => Math.round(meters * 3.28084);

/** Select all text on focus so leading zeros / old values are replaced on typing */
const selectOnFocus = (e: FocusEvent<HTMLInputElement>) => e.target.select();


export default function Takeoff() {
  // ── Weight: editable; "From W&B" fills from W&B ─────────────────
  const { result: cgResult } = useAircraft();
  const { state: perfState, setTakeoff } = usePerformance();
  const t = perfState.takeoff;

  const [weightInput, setWeightInput] = useState<string>(String(t.weightKg));
  const [oatInput, setOatInput] = useState<string>(String(t.OAT));
  const [paInput, setPaInput] = useState<string>(String(t.PA));
  const W = t.weightKg;

  // ── Airport DB ────────────────────────────────────────────────
  const { db, loading: dbLoading, error: dbError } = useAirportDb();

  // ── Persisted form state (survives tab switch) ─────────────────
  const selectedAirport = t.selectedAirport;
  const selectedRunway = t.selectedRunway;
  const airport = db?.get(selectedAirport) ?? null;
  const runway =
    airport?.runways.find((r) => r.id === selectedRunway) ??
    airport?.runways[0] ??
    null;

  // ── METAR ──────────────────────────────────────────────────
  const metarIcao = selectedAirport !== "CUSTOM" ? selectedAirport : null;
  const {
    loading: metarLoading,
    error: metarError,
    metar,
    refresh: refreshMetar,
  } = useMetar(metarIcao);

  // Reset dirty flags when airport changes
  useEffect(() => {
    setTakeoff("tempDirty", false);
    setTakeoff("windSpeedDirty", false);
    setTakeoff("windDirDirty", false);
  }, [selectedAirport, setTakeoff]);

  // Auto-fill inputs from METAR (only non-dirty fields)
  useEffect(() => {
    if (!metar) return;
    if (metar.tempC != null && !t.tempDirty) setTakeoff("OAT", metar.tempC);
    if (metar.windSpeedKt != null && !t.windSpeedDirty)
      setTakeoff("windSpeed", metar.windSpeedKt);
    if (metar.windDirDeg != null && !t.windDirDirty)
      setTakeoff("windDir", metar.windDirDeg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metar]);

  const applyMetarValues = () => {
    if (!metar) return;
    if (metar.tempC != null) setTakeoff("OAT", metar.tempC);
    if (metar.windSpeedKt != null) setTakeoff("windSpeed", metar.windSpeedKt);
    if (metar.windDirDeg != null) setTakeoff("windDir", metar.windDirDeg);
    setTakeoff("tempDirty", false);
    setTakeoff("windSpeedDirty", false);
    setTakeoff("windDirDirty", false);
  };

  const hasDirtyFields = t.tempDirty || t.windSpeedDirty || t.windDirDirty;

  // ── Effective values (airport overrides when selected) ──────
  const effPA = runway?.pressureAltitude ?? airport?.pressureAltitude ?? t.PA;
  const effHeading = runway ? runway.heading : t.rwyHeading;

  // Sync effective PA to state so Climb (and others) can use it when airport/runway is selected
  useEffect(() => {
    setTakeoff("PA", effPA);
  }, [effPA, setTakeoff]);

  // Slope: raw value (positive = uphill, negative = downhill)
  // For takeoff correction: only positive (uphill) slopes cause penalty.
  const effSlope = runway ? runway.slopePercent : t.uphillSlope;
  const effUphillSlope = Math.max(0, effSlope);

  // ── Derived correction values from surface selection ────────
  const effSurface = airport ? airport.surface : t.runwaySurface;
  const isGrassLike = effSurface !== "PAVED";
  const corrSurface = isGrassLike ? "GRASS" : "PAVED";
  const corrSoftGround = effSurface === "GRASS_SOFT";

  // ── Wind component (positive = headwind, negative = tailwind) ─
  const windComponentKt =
    t.windSpeed === 0
      ? 0
      : Math.round(
          t.windSpeed *
            Math.cos(((t.windDir - effHeading) * Math.PI) / 180) *
            10
        ) / 10;

  // ── Compute base results ───────────────────────────────────
  const result = computeTakeoff({
    flaps: t.flaps,
    condition: "DRY" as RunwayCondition,
    surface: "ASPHALT" as RunwaySurface,
    W,
    PA: effPA,
    OAT: t.OAT,
  });

  // ── Apply corrections (only if base succeeded) ─────────────
  const corrInputs: CorrectionInputs = {
    windComponentKt,
    runwaySurface: corrSurface,
    grassCondition: isGrassLike ? t.condition : undefined,
    grassLengthCm: isGrassLike ? t.grassLengthCm : undefined,
    softGround: corrSoftGround,
    wetPaved: !isGrassLike && t.condition === "WET",
    slopePercent: effUphillSlope,
  };

  const corrResult =
    result.ok
      ? applyTakeoffCorrections(
          { groundRoll_m: result.GR, takeoff15m_m: result.TOD_15m },
          corrInputs
        )
      : null;

  // ── Has any correction been applied? ───────────────────────
  useEffect(() => {
    setWeightInput(String(t.weightKg));
  }, [t.weightKg]);

  useEffect(() => {
    setOatInput(String(t.OAT));
  }, [t.OAT]);

  useEffect(() => {
    setPaInput(String(t.PA));
  }, [t.PA]);

  const hasCorrections =
    corrResult?.ok === true &&
    (corrResult.breakdown.windMultiplier !== 1 ||
      corrResult.breakdown.grassMultiplier !== 1 ||
      corrResult.breakdown.wetGrassMultiplier !== 1 ||
      corrResult.breakdown.softGroundMultiplier !== 1 ||
      corrResult.breakdown.wetPavedMultiplier !== 1 ||
      corrResult.breakdown.slopeMultiplier !== 1);

  return (
    <div style={{ padding: "16px 12px", maxWidth: 480, margin: "0 auto"}}>
      <h1 className="perf-title">DA-62 Performance Calculator</h1>

      {/* ── Runway & Wind Diagram ────────────────────────────── */}
      {(() => {
        const CX = 140,
          CY = 130;
        const rwyHalf = 68;

        const fixedHeading = airport
          ? Math.min(...airport.runways.map((r) => r.heading))
          : effHeading;
        const rad = (fixedHeading * Math.PI) / 180;
        const perpX = Math.cos(rad);
        const perpY = Math.sin(rad);
        const alongX = Math.sin(rad);
        const alongY = -Math.cos(rad);

        const farX = CX + rwyHalf * alongX;
        const farY = CY + rwyHalf * alongY;
        const nearX = CX - rwyHalf * alongX;
        const nearY = CY - rwyHalf * alongY;

        const bottomNum = Math.round(fixedHeading / 10) || 36;
        const topNum = bottomNum <= 18 ? bottomNum + 18 : bottomNum - 18;

        let bottomLabel: string;
        let topLabel: string;

        if (runway && airport) {
          const opposites = airport.runways.filter(r =>
            r.id !== runway.id &&
            Math.abs((r.heading - runway.heading + 360) % 360 - 180) < 10
          );
          const pair = opposites.length === 1
            ? opposites[0]
            : opposites.find(r => r.length?.m === runway.length?.m) ?? opposites[0];

          if (runway.heading < 180) {
            bottomLabel = runway.id;
            topLabel = pair?.id ?? String(topNum).padStart(2, "0");
          } else {
            bottomLabel = pair?.id ?? String(bottomNum).padStart(2, "0");
            topLabel = runway.id;
          }
        } else {
          bottomLabel = String(bottomNum).padStart(2, "0");
          topLabel = String(topNum).padStart(2, "0");
        }

        const wRad = (t.windDir * Math.PI) / 180;
        const wOutR = 100,
          wInR = 60;
        const wX1 = CX + wOutR * Math.sin(wRad);
        const wY1 = CY - wOutR * Math.cos(wRad);
        const wX2 = CX + wInR * Math.sin(wRad);
        const wY2 = CY - wInR * Math.cos(wRad);

        const dx = wX2 - wX1,
          dy = wY2 - wY1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const ux = dx / len,
          uy = dy / len;
        const px = -uy,
          py = ux;
        const aSize = 6;
        const aBase = {
          x: wX2 - ux * aSize * 1.8,
          y: wY2 - uy * aSize * 1.8,
        };
        const aL = { x: aBase.x + px * aSize, y: aBase.y + py * aSize };
        const aR = { x: aBase.x - px * aSize, y: aBase.y - py * aSize };

        const wLblR = 106;
        const wLblX = CX + wLblR * Math.sin(wRad);
        const wLblY = CY - wLblR * Math.cos(wRad);

        const dimOff = 22;
        const lNearX = nearX - perpX * dimOff;
        const lNearY = nearY - perpY * dimOff;
        const lFarX = farX - perpX * dimOff;
        const lFarY = farY - perpY * dimOff;
        const lMidX = (lNearX + lFarX) / 2;
        const lMidY = (lNearY + lFarY) / 2;
        const lLblX = lMidX - perpX * 10;
        const lLblY = lMidY - perpY * 10;

        const wHalf = 9;
        const wLeftX = nearX - perpX * wHalf;
        const wLeftY = nearY - perpY * wHalf;
        const wRightX = nearX + perpX * wHalf;
        const wRightY = nearY + perpY * wHalf;
        const wDimOff = 18;
        const wDimLeftX = wLeftX - alongX * wDimOff;
        const wDimLeftY = wLeftY - alongY * wDimOff;
        const wDimRightX = wRightX - alongX * wDimOff;
        const wDimRightY = wRightY - alongY * wDimOff;
        const wDimMidX = (wDimLeftX + wDimRightX) / 2;
        const wDimMidY = (wDimLeftY + wDimRightY) / 2;
        const wLbl2X = wDimMidX - alongX * 10;
        const wLbl2Y = wDimMidY - alongY * 10;

        const rwyLen = runway?.length ?? airport?.runwayLength;
        const rwyWid = runway?.width ?? airport?.runwayWidth;
        const hasRwyDims = rwyLen && rwyWid;

        return (
          <svg
            viewBox="0 0 300 260"
            width="100%"
            style={{
              maxWidth: 300,
              marginBottom: 16,
              display: "block",
              marginLeft: "auto",
              marginRight: "auto",
              border: "1px solid var(--border-color)",
              borderRadius: 8,
              backgroundColor: "var(--diagram-bg)",
            }}
          >
            <circle
              cx={CX}
              cy={CY}
              r={98}
              fill="none"
              stroke="var(--border-color)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={CX}
              y={CY - 104}
              textAnchor="middle"
              fontSize={11}
              fill="var(--text-muted)"
              fontWeight="bold"
            >
              N
            </text>

            <g transform={`rotate(${fixedHeading}, ${CX}, ${CY})`}>
              <rect
                x={CX - 9}
                y={CY - rwyHalf}
                width={18}
                height={rwyHalf * 2}
                rx={2}
                fill="#555"
              />
              <line
                x1={CX}
                y1={CY - rwyHalf + 20}
                x2={CX}
                y2={CY + rwyHalf - 20}
                stroke="#fff"
                strokeWidth={0.8}
                strokeDasharray="6 5"
              />
              {[-5, -3, -1, 1, 3, 5].map((offset) => (
                <line
                  key={`tt${offset}`}
                  x1={CX + offset * 1.4}
                  y1={CY - rwyHalf + 3}
                  x2={CX + offset * 1.4}
                  y2={CY - rwyHalf + 10}
                  stroke="#fff"
                  strokeWidth={1}
                />
              ))}
              <text
                x={CX}
                y={CY - rwyHalf + 19}
                textAnchor="middle"
                fontSize={7}
                fill="#fff"
                fontWeight="bold"
                letterSpacing={1}
                transform={`rotate(180, ${CX}, ${CY - rwyHalf + 16})`}
              >
                {topLabel}
              </text>
              {[-5, -3, -1, 1, 3, 5].map((offset) => (
                <line
                  key={`bt${offset}`}
                  x1={CX + offset * 1.4}
                  y1={CY + rwyHalf - 3}
                  x2={CX + offset * 1.4}
                  y2={CY + rwyHalf - 10}
                  stroke="#fff"
                  strokeWidth={1}
                />
              ))}
              <text
                x={CX}
                y={CY + rwyHalf - 12}
                textAnchor="middle"
                fontSize={7}
                fill="#fff"
                fontWeight="bold"
                letterSpacing={1}
              >
                {bottomLabel}
              </text>
            </g>

            {hasRwyDims && (
              <>
                <line
                  x1={lNearX}
                  y1={lNearY}
                  x2={lFarX}
                  y2={lFarY}
                  stroke="#42a5f5"
                  strokeWidth={1}
                />
                <line
                  x1={lNearX + perpX * 3}
                  y1={lNearY + perpY * 3}
                  x2={lNearX - perpX * 3}
                  y2={lNearY - perpY * 3}
                  stroke="#42a5f5"
                  strokeWidth={1}
                />
                <line
                  x1={lFarX + perpX * 3}
                  y1={lFarY + perpY * 3}
                  x2={lFarX - perpX * 3}
                  y2={lFarY - perpY * 3}
                  stroke="#42a5f5"
                  strokeWidth={1}
                />
                <text
                  x={lLblX}
                  y={lLblY}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#42a5f5"
                  fontWeight="bold"
                >
                  <tspan x={lLblX} dy="0">
                    {rwyLen!.ft.toLocaleString()} ft
                  </tspan>
                  <tspan x={lLblX} dy="11">
                    {rwyLen!.m.toLocaleString()} m
                  </tspan>
                </text>

                <line
                  x1={wDimLeftX}
                  y1={wDimLeftY}
                  x2={wDimRightX}
                  y2={wDimRightY}
                  stroke="#42a5f5"
                  strokeWidth={1}
                />
                <line
                  x1={wDimLeftX + alongX * 3}
                  y1={wDimLeftY + alongY * 3}
                  x2={wDimLeftX - alongX * 3}
                  y2={wDimLeftY - alongY * 3}
                  stroke="#42a5f5"
                  strokeWidth={1}
                />
                <line
                  x1={wDimRightX + alongX * 3}
                  y1={wDimRightY + alongY * 3}
                  x2={wDimRightX - alongX * 3}
                  y2={wDimRightY - alongY * 3}
                  stroke="#42a5f5"
                  strokeWidth={1}
                />
                <text
                  x={wLbl2X}
                  y={wLbl2Y}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#42a5f5"
                  fontWeight="bold"
                >
                  <tspan x={wLbl2X} dy="0">
                    {rwyWid!.ft} ft
                  </tspan>
                  <tspan x={wLbl2X} dy="11">
                    {rwyWid!.m} m
                  </tspan>
                </text>
              </>
            )}

            {t.windSpeed > 0 && (
              <>
                <line
                  x1={wX1}
                  y1={wY1}
                  x2={wX2}
                  y2={wY2}
                  stroke="#ef5350"
                  strokeWidth={2.5}
                />
                <polygon
                  points={`${wX2},${wY2} ${aL.x},${aL.y} ${aR.x},${aR.y}`}
                  fill="#ef5350"
                />
                <text
                  x={wLblX}
                  y={wLblY + 4}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#ef5350"
                  fontWeight="bold"
                >
                  {t.windSpeed}kt
                </text>
              </>
            )}
          </svg>
        );
      })()}

      {/* ── METAR Card ──────────────────────────────────────── */}
      <MetarCard
        icao={metarIcao}
        metar={metar}
        loading={metarLoading}
        error={metarError}
        onRefresh={refreshMetar}
        onApplyValues={applyMetarValues}
        hasDirtyFields={hasDirtyFields}
      />

      {/* ── Inputs ────────────────────────────────────────────── */}
      <div
        className="takeoff-inputs"
        style={{
          marginBottom: 20,
          border: "1px solid var(--panel-border)",
          borderRadius: 8,
          padding: "8px 14px 16px",
          backgroundColor: "var(--panel-bg)",
        }}
      >
        {/* Airport */}
        <AirportSearch
          db={db}
          dbLoading={dbLoading}
          dbError={dbError}
          selectedIcao={selectedAirport}
          onSelect={(icao) => {
            setTakeoff("selectedAirport", icao);
            const ap = db?.get(icao);
            if (ap && ap.runways.length > 0) {
              setTakeoff("selectedRunway", ap.runways[0].id);
            } else {
              setTakeoff("selectedRunway", "");
            }
          }}
        />

        {/* Runway */}
        {airport && airport.runways.length > 0 && (
          <div className="field">
            <span className="field-label">Runway</span>
            <div className="field-value">
              <select
                value={selectedRunway}
                onChange={(e) => setTakeoff("selectedRunway", e.target.value)}
              >
                {airport.runways.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Flaps */}
        <div className="field">
          <span className="field-label">Flaps</span>
          <div className="field-value">
            <select
              value={t.flaps}
              onChange={(e) => setTakeoff("flaps", e.target.value as "TO" | "UP")}
            >
              <option value="TO">T/O</option>
              <option value="UP">UP</option>
            </select>
          </div>
        </div>

        {/* Condition */}
        <div className="field">
          <span className="field-label">Condition</span>
          <div className="field-value">
            <select
              value={t.condition}
              onChange={(e) => setTakeoff("condition", e.target.value as "DRY" | "WET")}
            >
              <option value="DRY">Dry</option>
              <option value="WET">Wet</option>
            </select>
          </div>
        </div>

        {/* Surface */}
        <div className="field">
          <span className="field-label">Surface</span>
          <div className="field-value">
            <select
              value={effSurface}
              disabled={!!airport}
              onChange={(e) =>
                setTakeoff(
                  "runwaySurface",
                  e.target.value as "PAVED" | "GRASS" | "GRASS_SOFT"
                )
              }
              style={airport ? { opacity: 0.6 } : undefined}
            >
              <option value="PAVED">Paved</option>
              <option value="GRASS">Grass</option>
              <option value="GRASS_SOFT">Grass (Soft Ground)</option>
            </select>
          </div>
        </div>

        {/* Grass Length (only when grass) */}
        {(effSurface === "GRASS" || effSurface === "GRASS_SOFT") && (
          <div className="field">
            <span className="field-label">Grass Length (cm)</span>
            <div className="field-value">
              <input
                type="number"
                min={0}
                max={25}
                value={t.grassLengthCm}
                onChange={(e) => setTakeoff("grassLengthCm", Number(e.target.value))}
                onFocus={selectOnFocus}
              />
              {t.grassLengthCm === 0 && (
                <span style={{ fontSize: 12, color: "var(--gravel-color)", fontWeight: "bold" }}>
                  Gravel
                </span>
              )}
              {t.grassLengthCm > 25 && (
                <span style={{ fontSize: 12, color: "#ef5350", fontWeight: "bold" }}>
                  Not permitted (&gt;25 cm)
                </span>
              )}
            </div>
          </div>
        )}

        {/* Weight — editable; button fills from W&B */}
        <div className="field">
          <span className="field-label">Weight (kg)</span>
          <div className="field-value" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="number"
              min={0}
              value={weightInput}
              onChange={(e) => {
                const v = e.target.value;
                setWeightInput(v);
                const n = Number(v);
                if (v.trim() !== "" && Number.isFinite(n)) {
                  setTakeoff("weightKg", n);
                }
              }}
              onBlur={() => {
                if (weightInput.trim() === "") {
                  setWeightInput("0");
                  setTakeoff("weightKg", 0);
                }
              }}
              onFocus={selectOnFocus}
              style={{ width: 70 }}
            />
            <button
              type="button"
              onClick={() => setTakeoff("weightKg", Math.round(cgResult.totalMass))}
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

        {/* Pressure Altitude */}
        <div className="field">
          <span className="field-label">Press. Alt (ft)</span>
          <div className="field-value">
            <input
              type="number"
              value={airport ? effPA : paInput}
              disabled={!!airport}
              onChange={(e) => {
                if (airport) return;
                const v = e.target.value;
                setPaInput(v);
                const n = Number(v);
                if (v.trim() !== "" && Number.isFinite(n)) {
                  setTakeoff("PA", n);
                }
              }}
              onBlur={() => {
                if (!airport && paInput.trim() === "") {
                  setPaInput("0");
                  setTakeoff("PA", 0);
                }
              }}
              onFocus={selectOnFocus}
              style={airport ? { opacity: 0.6 } : undefined}
            />
          </div>
        </div>

        {/* OAT */}
        <div className="field">
          <span className="field-label">OAT (°C)</span>
          <div className="field-value">
            <input
              type="number"
              value={oatInput}
              onChange={(e) => {
                const v = e.target.value;
                setOatInput(v);
                const n = Number(v);
                if (v.trim() !== "" && Number.isFinite(n)) {
                  setTakeoff("OAT", n);
                  setTakeoff("tempDirty", true);
                }
              }}
              onBlur={() => {
                if (oatInput.trim() === "") {
                  setOatInput("0");
                  setTakeoff("OAT", 0);
                  setTakeoff("tempDirty", true);
                }
              }}
              onFocus={selectOnFocus}
            />
          </div>
        </div>

        {/* Wind */}
        <div className="field">
          <span className="field-label">Wind</span>
          <div className="field-value">
            <input
              type="number"
              min={0}
              value={t.windSpeed}
              onChange={(e) => { setTakeoff("windSpeed", Number(e.target.value)); setTakeoff("windSpeedDirty", true); }}
              onFocus={selectOnFocus}
              style={{ width: 55 }}
            />
            <span>kt /</span>
            <input
              type="number"
              min={0}
              max={360}
              value={t.windDir}
              onChange={(e) => { setTakeoff("windDir", Number(e.target.value)); setTakeoff("windDirDirty", true); }}
              onFocus={selectOnFocus}
              style={{ width: 55 }}
            />
            <span>°</span>
          </div>
        </div>

        {/* Wind component display */}
        {t.windSpeed > 0 && (
          <div
            className="field"
            style={{
              justifyContent: "flex-end",
              borderBottom: "none",
              paddingTop: 0,
            }}
          >
            <span style={{ fontSize: 12, color: "var(--hw-tw-color)" }}>
              {windComponentKt >= 0 ? "Headwind" : "Tailwind"}{" "}
              {Math.abs(windComponentKt)} kt
            </span>
          </div>
        )}

        {/* Runway Heading (custom only) */}
        {!airport && (
          <div className="field">
            <span className="field-label">Rwy Heading (°)</span>
            <div className="field-value">
              <input
                type="number"
                min={0}
                max={360}
                value={t.rwyHeading}
                onChange={(e) => setTakeoff("rwyHeading", Number(e.target.value))}
                onFocus={selectOnFocus}
              />
            </div>
          </div>
        )}

        {/* Slope */}
        <div className="field">
          <span className="field-label">Slope (%)</span>
          <div className="field-value">
            <input
              type="number"
              step={0.5}
              value={effSlope}
              disabled={!!airport}
              onChange={(e) => setTakeoff("uphillSlope", Number(e.target.value))}
              onFocus={selectOnFocus}
              style={airport ? { opacity: 0.6 } : undefined}
            />
          </div>
        </div>
        {effSlope !== 0 && (
          <div
            className="field"
            style={{
              justifyContent: "flex-end",
              borderBottom: "none",
              paddingTop: 0,
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: effSlope > 0 ? "#ef5350" : "var(--text-secondary)",
              }}
            >
              {effSlope > 0
                ? `Uphill ${effSlope}% → +${(effSlope * 10).toFixed(0)}% GR`
                : `Downhill ${Math.abs(effSlope)}% → no penalty`}
            </span>
          </div>
        )}
      </div>

      {/* ── Meta & speeds panel ─────────────────────────────── */}
      <div
        style={{
          marginBottom: 20,
          padding: "12px 16px",
          border: "1px solid var(--panel-border)",
          borderRadius: 8,
          backgroundColor: "var(--panel-bg)",
        }}
      >
        <div style={{ marginBottom: 4 }}>
          <strong>Flaps:</strong>{" "}
          {result.ok ? (result.meta?.flaps ?? "—") : "—"}
        </div>
        <div style={{ marginBottom: 4 }}>
          <strong>Power:</strong>{" "}
          {result.ok ? (result.meta?.power ?? "—") : "—"}
        </div>
        <div style={{ marginBottom: 4 }}>
          <strong>Runway:</strong>{" "}
          {effSurface === "PAVED"
            ? "Paved"
            : effSurface === "GRASS_SOFT"
              ? `Grass (Soft) ${t.grassLengthCm} cm`
              : `Grass ${t.grassLengthCm} cm`}
          {", "}
          {t.condition === "WET" ? "Wet" : "Dry"}
        </div>
        <div style={{ marginBottom: 4 }}>
          <strong>VR:</strong>{" "}
          {result.ok && result.VR_kias != null ? `${result.VR_kias} KIAS` : "—"}
        </div>
        <div>
          <strong>V50ft:</strong>{" "}
          {result.ok && result.V50_kias != null ? `${result.V50_kias} KIAS` : "—"}
        </div>
      </div>

      {/* ── Results ──────────────────────────────────────────── */}
      {result.ok ? (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            border: "1px solid var(--result-border)",
            borderRadius: 8,
            backgroundColor: "var(--result-bg)",
          }}
        >
          <strong
            style={{ display: "block", marginBottom: 8, fontSize: 18 }}
          >
            Results
          </strong>

          {(() => {
            const groundRollM =
              corrResult?.ok && hasCorrections
                ? corrResult.correctedGroundRoll
                : result.GR;
            const groundRollFt = metersToFeet(groundRollM);

            const takeoff50M =
              corrResult?.ok && hasCorrections
                ? corrResult.correctedTakeoff15m
                : result.TOD_15m;
            const takeoff50Ft = metersToFeet(takeoff50M);

            return (
              <>
                <p style={{ margin: "6px 0" }}>
                  Ground Roll:{" "}
                  <strong>
                    {groundRollFt}ft / {groundRollM.toFixed(0)}m
                  </strong>
                </p>
                <p style={{ margin: "6px 0" }}>
                  Takeoff Distance 50 ft:{" "}
                  <strong>
                    {takeoff50Ft}ft / {takeoff50M.toFixed(0)}m
                  </strong>
                </p>
              </>
            );
          })()}

          {corrResult?.ok && hasCorrections && (
            <details
              style={{
                marginTop: 6,
                fontSize: 13,
                color: "var(--text-secondary)",
              }}
            >
              <summary style={{ cursor: "pointer" }}>
                Corrections
              </summary>
              <ul style={{ margin: "4px 0", paddingLeft: 18 }}>
                {corrResult.breakdown.windMultiplier !== 1 && (
                  <li>
                    Wind: ×{corrResult.breakdown.windMultiplier.toFixed(3)}
                  </li>
                )}
                {corrResult.breakdown.grassMultiplier !== 1 && (
                  <li>
                    Grass (dry): ×{corrResult.breakdown.grassMultiplier.toFixed(2)}
                  </li>
                )}
                {corrResult.breakdown.wetGrassMultiplier !== 1 && (
                  <li>
                    Wet grass: ×{corrResult.breakdown.wetGrassMultiplier.toFixed(2)}
                  </li>
                )}
                {corrResult.breakdown.wetPavedMultiplier !== 1 && (
                  <li>
                    Wet paved: ×{corrResult.breakdown.wetPavedMultiplier.toFixed(2)}
                  </li>
                )}
                {corrResult.breakdown.softGroundMultiplier !== 1 && (
                  <li>
                    Soft ground: ×{corrResult.breakdown.softGroundMultiplier.toFixed(2)}
                  </li>
                )}
                {corrResult.breakdown.slopeMultiplier !== 1 && (
                  <li>
                    Slope: ×{corrResult.breakdown.slopeMultiplier.toFixed(2)}
                  </li>
                )}
              </ul>
            </details>
          )}

          {corrResult && !corrResult.ok && (
            <p style={{ color: "#ef5350", fontWeight: "bold", marginTop: 10 }}>
              {corrResult.error}
            </p>
          )}
        </div>
      ) : (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            border: "1px solid #c62828",
            borderRadius: 8,
            backgroundColor: "rgba(198, 40, 40, 0.1)",
          }}
        >
          <p style={{ color: "#ef5350", fontWeight: "bold", margin: 0 }}>
            {result.error}
          </p>
        </div>
      )}

      <p
        style={{
          marginTop: 20,
          fontSize: 11,
          color: "var(--text-muted)",
          fontStyle: "italic",
        }}
      >
        All coefficients and speeds are based on the DA-62 AFM (Aircraft
        Flight Manual).
      </p>
    </div>
  );
}
