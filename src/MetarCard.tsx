/**
 * Compact METAR display card.
 *
 * Shows the raw METAR string, observation time, decoded values,
 * and source attribution.  Provides Refresh and "Use METAR values"
 * buttons.
 *
 * Freshness tiers (based on observation age):
 *   0 – 75 min   → Green  (fresh)
 *   75 min – 3 h  → Orange (caution)
 *   > 3 h         → Red    (stale) + warning banner
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

// ── Freshness tiers ───────────────────────────────────────────

type FreshnessTier = "fresh" | "caution" | "stale";

interface Freshness {
  tier: FreshnessTier;
  color: string;
  borderColor: string;
  bgTint: string;
  ageMin: number;
  label: string;
}

const FRESH_MIN = 75;       // minutes
const CAUTION_MIN = 180;    // 3 hours

function getFreshness(observedAt: string | null): Freshness {
  if (!observedAt) {
    return {
      tier: "stale",
      color: "#ef5350",
      borderColor: "#ef5350",
      bgTint: "rgba(239,83,80,0.08)",
      ageMin: Infinity,
      label: "Unknown age",
    };
  }

  const ageMs = Date.now() - new Date(observedAt).getTime();
  const ageMin = Math.max(0, Math.round(ageMs / 60_000));

  if (ageMin <= FRESH_MIN) {
    return {
      tier: "fresh",
      color: "#66bb6a",
      borderColor: "#66bb6a",
      bgTint: "rgba(102,187,106,0.08)",
      ageMin,
      label: `${ageMin} min ago`,
    };
  }
  if (ageMin <= CAUTION_MIN) {
    return {
      tier: "caution",
      color: "#ffa726",
      borderColor: "#ffa726",
      bgTint: "rgba(255,167,38,0.08)",
      ageMin,
      label: ageMin < 120
        ? `${ageMin} min ago`
        : `${(ageMin / 60).toFixed(1)} h ago`,
    };
  }

  const ageH = ageMin / 60;
  return {
    tier: "stale",
    color: "#ef5350",
    borderColor: "#ef5350",
    bgTint: "rgba(239,83,80,0.08)",
    ageMin,
    label: ageH < 24 ? `${ageH.toFixed(1)} h ago` : `${Math.round(ageH)} h ago`,
  };
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

  // Freshness tier (only meaningful when we have a METAR)
  const freshness = metar ? getFreshness(metar.observedAt) : null;

  // Border / background colours — freshness-aware when METAR is present
  const borderColor = error && !metar
    ? "#c62828"
    : freshness
      ? freshness.borderColor
      : "var(--panel-border)";

  const bgColor = error && !metar
    ? "rgba(198,40,40,0.08)"
    : freshness
      ? freshness.bgTint
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
      {metar && !loading && freshness && (
        <>
          {/* Stale data warning */}
          {freshness.tier === "stale" && (
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 4,
                backgroundColor: "rgba(239,83,80,0.12)",
                border: "1px solid rgba(239,83,80,0.3)",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>⚠</span>
              <span style={{ color: "#ef5350", fontSize: 11.5, fontWeight: 600, lineHeight: 1.3 }}>
                METAR data is stale ({freshness.label}).
                Weather values may no longer be accurate — verify before use.
              </span>
            </div>
          )}

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

          {/* Decoded summary — colored by freshness tier */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "4px 14px",
              fontSize: 12,
              color: freshness.color,
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

          {/* Obs time + freshness badge + source */}
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginBottom: hasDirtyFields ? 6 : 0,
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <span>Obs: {fmtUtc(metar.observedAt)}</span>
            <span
              style={{
                display: "inline-block",
                fontSize: 10,
                fontWeight: 700,
                padding: "1px 6px",
                borderRadius: 3,
                backgroundColor: freshness.color,
                color: "#fff",
                letterSpacing: 0.3,
                lineHeight: "16px",
              }}
            >
              {freshness.tier === "fresh"
                ? "FRESH"
                : freshness.tier === "caution"
                  ? "CAUTION"
                  : "STALE"}
            </span>
            <span style={{ opacity: 0.7 }}>{freshness.label}</span>
            <span>· Source: NOAA AviationWeather</span>
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
