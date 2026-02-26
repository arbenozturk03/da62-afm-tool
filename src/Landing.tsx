import { useEffect, useState, type FocusEvent } from "react";
import { computeLanding } from "./core/landing";
import { useMetar } from "./hooks/useMetar";
import { useAirportDb } from "./hooks/useAirportDb";
import { usePerformance } from "./context/PerformanceContext";
import MetarCard from "./MetarCard";
import AirportSearch from "./AirportSearch";

const metersToFeet = (meters: number) => Math.round(meters * 3.28084);

/** Select all text on focus so leading zeros / old values are replaced on typing */
const selectOnFocus = (e: FocusEvent<HTMLInputElement>) => e.target.select();


export default function Landing() {
  // ── Weight: manual entry only (no auto-fill from W&B) ─────────────
  const { state: perfState, setLanding } = usePerformance();

  // ── Persisted form state (survives tab switch) ─────────────────
  const L = perfState.landing;
  const [weightInput, setWeightInput] = useState<string>(String(L.weightKg));
  const [oatInput, setOatInput] = useState<string>(String(L.OAT));
  const [paInput, setPaInput] = useState<string>(String(L.PA));

  // ── Airport DB ────────────────────────────────────────────────
  const { db, loading: dbLoading, error: dbError } = useAirportDb();
  const W = L.weightKg;
  const selectedAirport = L.selectedAirport;
  const selectedRunway = L.selectedRunway;
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
    setLanding("tempDirty", false);
    setLanding("windSpeedDirty", false);
    setLanding("windDirDirty", false);
  }, [selectedAirport, setLanding]);

  // Auto-fill inputs from METAR (only non-dirty fields)
  useEffect(() => {
    if (!metar) return;
    if (metar.tempC != null && !L.tempDirty) setLanding("OAT", metar.tempC);
    if (metar.windSpeedKt != null && !L.windSpeedDirty)
      setLanding("windSpeed", metar.windSpeedKt);
    if (metar.windDirDeg != null && !L.windDirDirty)
      setLanding("windDir", metar.windDirDeg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metar]);

  const applyMetarValues = () => {
    if (!metar) return;
    if (metar.tempC != null) setLanding("OAT", metar.tempC);
    if (metar.windSpeedKt != null) setLanding("windSpeed", metar.windSpeedKt);
    if (metar.windDirDeg != null) setLanding("windDir", metar.windDirDeg);
    setLanding("tempDirty", false);
    setLanding("windSpeedDirty", false);
    setLanding("windDirDirty", false);
  };

  const hasDirtyFields = L.tempDirty || L.windSpeedDirty || L.windDirDirty;

  // ── Effective values (airport overrides when selected) ──────
  const effPA = runway?.pressureAltitude ?? airport?.pressureAltitude ?? L.PA;
  const effHeading = runway ? runway.heading : L.rwyHeading;

  // Slope: raw value (positive = uphill, negative = downhill)
  // For landing correction: only negative (downhill) slopes cause penalty.
  const effSlope = runway ? runway.slopePercent : L.downhillSlope;
  const effDownhillSlope = Math.max(0, -effSlope);

  useEffect(() => {
    setWeightInput(String(L.weightKg));
  }, [L.weightKg]);

  useEffect(() => {
    setOatInput(String(L.OAT));
  }, [L.OAT]);

  useEffect(() => {
    setPaInput(String(L.PA));
  }, [L.PA]);

  // ── Derived correction values from surface selection ────────
  const effSurface = airport ? airport.surface : L.runwaySurface;
  const isGrassLike = effSurface !== "PAVED";
  const corrSurface = isGrassLike ? "GRASS" : "PAVED";
  const corrSoftGround = effSurface === "GRASS_SOFT";

  // ── Wind component (positive = headwind, negative = tailwind) ─
  const windComponentKt =
    L.windSpeed === 0
      ? 0
      : Math.round(
          L.windSpeed *
            Math.cos(((L.windDir - effHeading) * Math.PI) / 180) *
            10
        ) / 10;

  // ── Derive config from flaps ────────────────────────────────
  const configKey = L.flaps === "LDG" ? "normal_flaps_ldg" : "abnormal_flaps_to_up";
  const abnormalMode = L.flaps === "LDG" ? undefined : L.flaps;

  // ── Compute ─────────────────────────────────────────────────
  const result = computeLanding({
    configKey,
    abnormalMode,
    W,
    PA: effPA,
    OAT: L.OAT,
    windComponentKt,
    runwaySurface: corrSurface,
    grassCondition: isGrassLike ? L.condition : undefined,
    grassLengthCm: isGrassLike ? L.grassLengthCm : undefined,
    softGround: corrSoftGround,
    wetPaved: !isGrassLike && L.condition === "WET",
    downhillSlopePercent: effDownhillSlope,
  });

  const hasCorrections =
    result.ok &&
    (result.breakdown.windMultiplier !== 1 ||
      result.breakdown.grassMultiplier !== 1 ||
      result.breakdown.wetMultiplier !== 1 ||
      result.breakdown.softGroundMultiplier !== 1 ||
      result.breakdown.slopeMultiplier !== 1);

  return (
    <div style={{ padding: "16px 12px", maxWidth: 480, margin: "0 auto" }}>
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

        const wRad = (L.windDir * Math.PI) / 180;
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

            {L.windSpeed > 0 && (
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
                  {L.windSpeed}kt
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
            setLanding("selectedAirport", icao);
            const ap = db?.get(icao);
            if (ap && ap.runways.length > 0) {
              setLanding("selectedRunway", ap.runways[0].id);
            } else {
              setLanding("selectedRunway", "");
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
                onChange={(e) => setLanding("selectedRunway", e.target.value)}
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
              value={L.flaps}
              onChange={(e) => setLanding("flaps", e.target.value as "LDG" | "TO" | "UP")}
            >
              <option value="LDG">LDG</option>
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
              value={L.condition}
              onChange={(e) => setLanding("condition", e.target.value as "DRY" | "WET")}
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
                setLanding(
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
                max={30}
                value={L.grassLengthCm}
                onChange={(e) => setLanding("grassLengthCm", Number(e.target.value))}
                onFocus={selectOnFocus}
              />
              {L.grassLengthCm === 0 && (
                <span style={{ fontSize: 12, color: "var(--gravel-color)", fontWeight: "bold" }}>
                  Gravel
                </span>
              )}
            </div>
          </div>
        )}

        {/* Weight — manual entry */}
        <div className="field">
          <span className="field-label">Weight (kg)</span>
          <div className="field-value">
            <input
              type="number"
              min={0}
              value={weightInput}
              onChange={(e) => {
                const v = e.target.value;
                setWeightInput(v);
                const n = Number(v);
                if (v.trim() !== "" && Number.isFinite(n)) {
                  setLanding("weightKg", n);
                }
              }}
              onBlur={() => {
                if (weightInput.trim() === "") {
                  setWeightInput("0");
                  setLanding("weightKg", 0);
                }
              }}
              onFocus={selectOnFocus}
              style={{ width: 70 }}
            />
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
                  setLanding("PA", n);
                }
              }}
              onBlur={() => {
                if (!airport && paInput.trim() === "") {
                  setPaInput("0");
                  setLanding("PA", 0);
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
                  setLanding("OAT", n);
                  setLanding("tempDirty", true);
                }
              }}
              onBlur={() => {
                if (oatInput.trim() === "") {
                  setOatInput("0");
                  setLanding("OAT", 0);
                  setLanding("tempDirty", true);
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
              value={L.windSpeed}
              onChange={(e) => { setLanding("windSpeed", Number(e.target.value)); setLanding("windSpeedDirty", true); }}
              onFocus={selectOnFocus}
              style={{ width: 55 }}
            />
            <span>kt /</span>
            <input
              type="number"
              min={0}
              max={360}
              value={L.windDir}
              onChange={(e) => { setLanding("windDir", Number(e.target.value)); setLanding("windDirDirty", true); }}
              onFocus={selectOnFocus}
              style={{ width: 55 }}
            />
            <span>°</span>
          </div>
        </div>

        {/* Wind component display */}
        {L.windSpeed > 0 && (
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
                value={L.rwyHeading}
                onChange={(e) => setLanding("rwyHeading", Number(e.target.value))}
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
              onChange={(e) => setLanding("downhillSlope", Number(e.target.value))}
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
                color: effSlope < 0 ? "#ef5350" : "var(--text-secondary)",
              }}
            >
              {effSlope > 0
                ? `Uphill ${effSlope}% → no penalty`
                : `Downhill ${Math.abs(effSlope)}% → +${(Math.abs(effSlope) * 20).toFixed(0)}% GR`}
            </span>
          </div>
        )}
      </div>

      {/* ── Meta & VREF panel ─────────────────────────────────── */}
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
              ? `Grass (Soft) ${L.grassLengthCm} cm`
              : `Grass ${L.grassLengthCm} cm`}
          {", "}
          {L.condition === "WET" ? "Wet" : "Dry"}
        </div>
        <div>
          <strong>VREF:</strong>{" "}
          {result.ok ? `${result.vref_kias} KIAS` : "—"}
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
            const groundRollM = hasCorrections ? result.correctedGR_m : result.baseGR_m;
            const groundRollFt = metersToFeet(groundRollM);

            const landing50M = hasCorrections ? result.correctedLD15_m : result.baseLD15_m;
            const landing50Ft = metersToFeet(landing50M);

            return (
              <>
                <p style={{ margin: "6px 0" }}>
                  Ground Roll:{" "}
                  <strong>
                    {groundRollFt}ft / {groundRollM.toFixed(0)}m
                  </strong>
                </p>
                <p style={{ margin: "6px 0" }}>
                  Landing Distance 50 ft:{" "}
                  <strong>
                    {landing50Ft}ft / {landing50M.toFixed(0)}m
                  </strong>
                </p>
              </>
            );
          })()}

          {hasCorrections && (
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
                {result.breakdown.windMultiplier !== 1 && (
                  <li>
                    Wind: ×{result.breakdown.windMultiplier.toFixed(3)}
                  </li>
                )}
                {result.breakdown.grassMultiplier !== 1 && (
                  <li>
                    Grass (dry): ×{result.breakdown.grassMultiplier.toFixed(2)}
                  </li>
                )}
                {result.breakdown.wetMultiplier !== 1 && (
                  <li>
                    Wet: ×{result.breakdown.wetMultiplier.toFixed(2)}
                  </li>
                )}
                {result.breakdown.softGroundMultiplier !== 1 && (
                  <li>
                    Soft ground: ×{result.breakdown.softGroundMultiplier.toFixed(2)}
                  </li>
                )}
                {result.breakdown.slopeMultiplier !== 1 && (
                  <li>
                    Slope: ×{result.breakdown.slopeMultiplier.toFixed(2)}
                  </li>
                )}
              </ul>
            </details>
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
