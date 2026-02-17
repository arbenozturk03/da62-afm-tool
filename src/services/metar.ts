/**
 * NOAA AviationWeather METAR service.
 *
 * Fetches METAR JSON from:
 *   https://aviationweather.gov/api/data/metar?ids=<ICAO>&format=json
 *
 * The API returns pre-parsed fields (temp, wdir, wspd …) alongside the
 * raw observation text.  We prefer the API values and fall back to our
 * own regex parser (metarParse.ts) when a field is missing.
 */

import { parseMetarRawText } from "../utils/metarParse";

// In dev, Vite proxies /api/metar → https://aviationweather.gov/api/data/metar
// This avoids CORS issues since the NOAA API has no Access-Control headers.
const API_BASE = "/api/metar";

// ── Public types ──────────────────────────────────────────────

export interface NormalizedMetar {
  station: string;
  rawText: string;
  observedAt: string | null;   // ISO-8601
  tempC: number | null;
  dewpointC: number | null;
  windDirDeg: number | null;   // 0-360 (0 = variable / calm)
  windSpeedKt: number | null;
  windGustKt: number | null;
  qnhHpa: number | null;
  visibilityM: number | null;
}

// ── NOAA response shape (subset we care about) ───────────────

interface NoaaMetarItem {
  icaoId?: string;
  rawOb?: string;
  reportTime?: string;
  obsTime?: number;
  temp?: number | null;
  dewp?: number | null;
  wdir?: number | string | null;
  wspd?: number | null;
  wgst?: number | null;
  altim?: number | null;
  visib?: string | number | null;
}

// ── Fetch ─────────────────────────────────────────────────────

export async function fetchMetarJson(
  icao: string,
): Promise<NormalizedMetar | null> {
  // "hours=3" ensures the NOAA API returns observations from the last 3 h.
  // In dev (Vite proxy → NOAA directly) this prevents empty results for
  // airports that report infrequently.  In production the Netlify function
  // has its own progressive fallback and ignores this parameter.
  const url = `${API_BASE}?ids=${encodeURIComponent(icao.toUpperCase())}&format=json&hours=3`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    // Network-level failure (no internet, DNS, CORS, timeout …)
    if (err instanceof TypeError) {
      throw new Error(
        "Could not reach the METAR server. Check your internet connection.",
      );
    }
    throw new Error("Network request failed. Please try again.");
  }

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        `METAR service does not recognise "${icao}". Verify the ICAO code.`,
      );
    }
    if (res.status === 429) {
      throw new Error(
        "Too many METAR requests. Please wait a moment and try again.",
      );
    }
    if (res.status >= 500) {
      throw new Error(
        "NOAA AviationWeather server error. The service may be temporarily down — try again shortly.",
      );
    }
    throw new Error(
      `METAR service returned an unexpected error (HTTP ${res.status}).`,
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error(
      "Received an invalid response from the METAR server. Try refreshing.",
    );
  }

  // The response can arrive in two shapes:
  //  1) Raw NOAA array  – used in dev via Vite proxy
  //  2) Wrapped object { ids, latest, fallbackHoursUsed } – Netlify function
  let item: NoaaMetarItem | null = null;

  if (Array.isArray(data)) {
    // Shape 1: raw NOAA array (dev proxy) — sort newest-first
    if (data.length === 0) return null;
    data.sort(
      (a: NoaaMetarItem, b: NoaaMetarItem) =>
        (b.obsTime ?? 0) - (a.obsTime ?? 0),
    );
    item = data[0] as NoaaMetarItem;
  } else if (
    data &&
    typeof data === "object" &&
    "latest" in (data as Record<string, unknown>)
  ) {
    // Shape 2: Netlify function wrapper
    item = (data as { latest: NoaaMetarItem | null }).latest;
  }

  if (!item) return null;

  return normalizeItem(item);
}

// ── Normalize ─────────────────────────────────────────────────

function normalizeItem(item: NoaaMetarItem): NormalizedMetar {
  const raw = item.rawOb ?? "";
  const parsed = parseMetarRawText(raw);

  // Wind direction: API may return number, "VRB", or null
  const wdir =
    typeof item.wdir === "number"
      ? item.wdir
      : item.wdir === "VRB"
        ? 0
        : parsed.windDirDeg;

  // Visibility: API returns statute miles — convert to metres
  let vis: number | null = null;
  if (item.visib != null) {
    if (typeof item.visib === "number") {
      vis = Math.round(item.visib * 1609.34);
    } else {
      const clean = String(item.visib).replace("+", "");
      const n = parseFloat(clean);
      if (!isNaN(n)) vis = Math.round(n * 1609.34);
      if (String(item.visib).includes("+")) vis = 9999;
    }
  }
  if (vis == null) vis = parsed.visibilityM;

  // QNH: API returns altim in hPa
  let qnh: number | null = null;
  if (typeof item.altim === "number") qnh = Math.round(item.altim);
  if (qnh == null) qnh = parsed.qnhHpa;

  // Observation time — parse exact time from raw METAR "ddHHMMZ" group
  // (API's reportTime is often rounded to the nearest hour)
  let observedAt: string | null = null;
  const obsMatch = raw.match(/\b(\d{2})(\d{2})(\d{2})Z\b/);
  if (obsMatch) {
    const dd = parseInt(obsMatch[1], 10);
    const hh = parseInt(obsMatch[2], 10);
    const mm = parseInt(obsMatch[3], 10);

    // Year/month context from API (raw METAR only has day+time)
    const ref = item.reportTime
      ? new Date(item.reportTime)
      : item.obsTime
        ? new Date(item.obsTime * 1000)
        : new Date();

    observedAt = new Date(
      Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), dd, hh, mm, 0),
    ).toISOString();
  } else if (item.reportTime) {
    observedAt = item.reportTime;
  } else if (item.obsTime) {
    observedAt = new Date(item.obsTime * 1000).toISOString();
  }

  return {
    station: item.icaoId ?? raw.slice(0, 4).trim(),
    rawText: raw,
    observedAt,
    tempC: item.temp ?? parsed.tempC,
    dewpointC: item.dewp ?? parsed.dewpointC,
    windDirDeg: wdir,
    windSpeedKt: item.wspd ?? parsed.windSpeedKt,
    windGustKt: item.wgst ?? parsed.windGustKt,
    qnhHpa: qnh,
    visibilityM: vis,
  };
}
