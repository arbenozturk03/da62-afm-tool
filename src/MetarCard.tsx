/**
 * Compact METAR display card.
 *
 * Shows the raw METAR string, observation time, decoded values,
 * and source attribution.  Provides Refresh and "Use METAR values"
 * buttons.
 */

import type { NormalizedMetar } from "./services/metar";

interface MetarCardProps {
  icao: string | null;
  metar: NormalizedMetar | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onApplyValues: () => void;
  hasDirtyFields: boolean;
}

/** Format ISO date → compact UTC string for pilots */
function fmtUtc(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const day = d.getUTCDate().toString().padStart(2, "0");
    const mon = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ][d.getUTCMonth()];
    const hh = d.getUTCHours().toString().padStart(2, "0");
    const mm = d.getUTCMinutes().toString().padStart(2, "0");
    return `${day} ${mon} ${hh}:${mm}Z`;
  } catch {
    return iso;
  }
}

export default function MetarCard({
  icao,
  metar,
  loading,
  error,
  onRefresh,
  onApplyValues,
  hasDirtyFields,
}: MetarCardProps) {
  // Hide entirely when no airport is selected
  if (!icao || icao === "CUSTOM") return null;

  // Border / background colours based on state
  const borderColor = error && !metar
    ? "#c62828"
    : metar
      ? "var(--result-border)"
      : "var(--panel-border)";

  const bgColor = error && !metar
    ? "rgba(198,40,40,0.08)"
    : metar
      ? "var(--result-bg)"
      : "var(--panel-bg)";

  return (
    <div
      style={{
        marginBottom: 16,
        padding: "10px 14px",
        border: `1px solid ${borderColor}`,
        borderRadius: 8,
        backgroundColor: bgColor,
        fontSize: 13,
      }}
    >
      {/* ── Header row ──────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <strong style={{ fontSize: 14 }}>
          METAR
          {metar ? ` (${metar.station})` : ` (${icao})`}
        </strong>
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            padding: "3px 10px",
            fontSize: 11,
            borderRadius: 4,
            border: "1px solid var(--border-color)",
            background: "var(--panel-bg)",
            color: "inherit",
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? "Fetching…" : "Refresh"}
        </button>
      </div>

      {/* ── Loading state ───────────────────────────────────── */}
      {loading && (
        <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
          Fetching METAR for {icao}…
        </div>
      )}

      {/* ── Error state ─────────────────────────────────────── */}
      {error && !loading && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 4,
            backgroundColor: "rgba(239,83,80,0.1)",
            border: "1px solid rgba(239,83,80,0.25)",
            marginBottom: metar ? 8 : 0,
          }}
        >
          <div style={{ color: "#ef5350", fontWeight: 600, fontSize: 12, marginBottom: 2 }}>
            ⚠ METAR Unavailable
          </div>
          <div style={{ color: "#ef5350", fontSize: 12, lineHeight: 1.4 }}>
            {error}
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 4 }}>
            Weather inputs are still editable — enter values manually.
          </div>
        </div>
      )}

      {/* ── METAR content ───────────────────────────────────── */}
      {metar && !loading && (
        <>
          {/* Raw METAR text */}
          <div
            style={{
              fontFamily: "\"Cascadia Code\", \"Fira Code\", monospace",
              fontSize: 11.5,
              padding: "6px 8px",
              backgroundColor: "rgba(0,0,0,0.15)",
              borderRadius: 4,
              marginBottom: 6,
              wordBreak: "break-all",
              lineHeight: 1.5,
              letterSpacing: 0.3,
            }}
          >
            {metar.rawText || "—"}
          </div>

          {/* Decoded summary */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "4px 14px",
              fontSize: 12,
              color: "var(--text-secondary)",
              marginBottom: 6,
            }}
          >
            {metar.tempC != null && (
              <span>
                Temp <strong>{metar.tempC}°C</strong>
              </span>
            )}
            {metar.windSpeedKt != null && (
              <span>
                Wind{" "}
                <strong>
                  {metar.windDirDeg != null ? `${metar.windDirDeg}°/` : ""}
                  {metar.windSpeedKt}kt
                  {metar.windGustKt != null ? `G${metar.windGustKt}` : ""}
                </strong>
              </span>
            )}
            {metar.qnhHpa != null && (
              <span>
                QNH <strong>{metar.qnhHpa} hPa</strong>
              </span>
            )}
          </div>

          {/* Obs time + source */}
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginBottom: hasDirtyFields ? 6 : 0,
            }}
          >
            Obs: {fmtUtc(metar.observedAt)} · Source: NOAA AviationWeather
          </div>

          {/* "Use METAR values" button — only when user has overridden */}
          {hasDirtyFields && (
            <button
              onClick={onApplyValues}
              style={{
                marginTop: 2,
                padding: "3px 10px",
                fontSize: 11,
                borderRadius: 4,
                border: "1px solid var(--result-border)",
                background: "transparent",
                color: "#42a5f5",
                cursor: "pointer",
              }}
            >
              ↩ Use METAR values
            </button>
          )}
        </>
      )}
    </div>
  );
}
