/**
 * Best-effort METAR raw text parser.
 * Used as fallback when the NOAA API's pre-parsed fields are missing.
 *
 * Handles common patterns:
 *   Wind:  18012KT, 18012G20KT, VRB03KT, 00000KT
 *   Temp:  18/12, M05/M10, 05/M02  (M = minus)
 *   QNH:   Q1013 (hPa),  A3032 (inHg × 100)
 *   Vis:   9999, 0800, CAVOK
 *
 * Returns nulls for any field it cannot parse — never throws.
 */

export interface ParsedMetarFields {
  windDirDeg: number | null;
  windSpeedKt: number | null;
  windGustKt: number | null;
  tempC: number | null;
  dewpointC: number | null;
  qnhHpa: number | null;
  visibilityM: number | null;
}

// ── Wind ──────────────────────────────────────────────────────

function parseWind(raw: string) {
  const m = raw.match(/\b(\d{3}|VRB)(\d{2,3})(G(\d{2,3}))?KT\b/);
  if (!m) return { dir: null as number | null, speed: null as number | null, gust: null as number | null };

  const dir = m[1] === "VRB" ? 0 : parseInt(m[1], 10);
  const speed = parseInt(m[2], 10);
  const gust = m[4] ? parseInt(m[4], 10) : null;
  return { dir, speed, gust };
}

// ── Temperature / Dewpoint ────────────────────────────────────

function parseTempToken(s: string): number {
  return s.startsWith("M") ? -parseInt(s.slice(1), 10) : parseInt(s, 10);
}

function parseTemp(raw: string) {
  const m = raw.match(/\b(M?\d{2})\/(M?\d{2})\b/);
  if (!m) return { temp: null as number | null, dewpoint: null as number | null };
  return { temp: parseTempToken(m[1]), dewpoint: parseTempToken(m[2]) };
}

// ── QNH ───────────────────────────────────────────────────────

function parseQNH(raw: string): number | null {
  // European Q-code (hPa)
  const qm = raw.match(/\bQ(\d{4})\b/);
  if (qm) return parseInt(qm[1], 10);

  // US A-code (inHg × 100) → convert to hPa
  const am = raw.match(/\bA(\d{4})\b/);
  if (am) return Math.round((parseInt(am[1], 10) / 100) * 33.8639);

  return null;
}

// ── Visibility ────────────────────────────────────────────────

function parseVisibility(raw: string): number | null {
  if (/\bCAVOK\b/.test(raw)) return 9999;

  // 4-digit meter group that sits right after the wind group
  const windMatch = raw.match(/\b(?:\d{3}|VRB)\d{2,3}(?:G\d{2,3})?KT\b/);
  if (windMatch) {
    const afterWind = raw.slice(raw.indexOf(windMatch[0]) + windMatch[0].length);
    const vm = afterWind.match(/\b(\d{4})\b/);
    if (vm) return parseInt(vm[1], 10);
  }

  return null;
}

// ── Public entry point ────────────────────────────────────────

export function parseMetarRawText(raw: string): ParsedMetarFields {
  const wind = parseWind(raw);
  const temp = parseTemp(raw);

  return {
    windDirDeg: wind.dir,
    windSpeedKt: wind.speed,
    windGustKt: wind.gust,
    tempC: temp.temp,
    dewpointC: temp.dewpoint,
    qnhHpa: parseQNH(raw),
    visibilityM: parseVisibility(raw),
  };
}
