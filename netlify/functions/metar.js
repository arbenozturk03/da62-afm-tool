/**
 * Netlify Function: /.netlify/functions/metar?ids=LTFM,LTAC
 *
 * Fetches the most recent METAR from NOAA AviationWeather Data API.
 *
 * Fallback window logic:
 *   The API's "hours" parameter limits results to the last N hours.
 *   We try progressively wider windows (1 → 3 → 6 → 12 → 24 h)
 *   and stop as soon as at least one valid METAR is returned.
 *   Within each window the results are sorted by observation time
 *   (newest first) and only the single most recent report is returned.
 *
 * Response format:
 *   { ids: string[], latest: object|null, fallbackHoursUsed: number }
 */

const NOAA_BASE = "https://aviationweather.gov/api/data/metar";
const FALLBACK_HOURS = [1, 3, 6, 12, 24];

const CORS_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=60",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "Content-Type",
};

export async function handler(event) {
  // ── CORS preflight ──────────────────────────────────────────
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  try {
    // ── Parse & validate ICAO ids ─────────────────────────────
    const idsRaw = event.queryStringParameters?.ids || "";
    const ids = idsRaw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 10);

    if (ids.length === 0) {
      return respond(400, {
        ids: [],
        latest: null,
        fallbackHoursUsed: 0,
        error: "Missing or empty 'ids' query parameter.",
      });
    }

    // ── Progressive fallback: try wider time windows until we
    //    get at least one METAR back from the API ──────────────
    const idsParam = encodeURIComponent(ids.join(","));
    let latest = null;
    let fallbackHoursUsed = 0;

    for (const hours of FALLBACK_HOURS) {
      const url = `${NOAA_BASE}?ids=${idsParam}&format=json&hours=${hours}`;

      let resp;
      try {
        resp = await fetch(url);
      } catch {
        // Network failure (DNS, timeout, etc.) — try next window
        continue;
      }

      // 204 No Content or any non-2xx → widen the window
      if (resp.status === 204 || !resp.ok) continue;

      let data;
      try {
        data = await resp.json();
      } catch {
        // Malformed JSON — try next window
        continue;
      }

      if (!Array.isArray(data) || data.length === 0) continue;

      // ── Sort by newest observation time (obsTime = Unix sec) ─
      data.sort((a, b) => (b.obsTime ?? 0) - (a.obsTime ?? 0));

      latest = data[0];
      fallbackHoursUsed = hours;
      break; // found a valid METAR — stop widening
    }

    // ── Build response ────────────────────────────────────────
    if (!latest) {
      return respond(200, {
        ids,
        latest: null,
        fallbackHoursUsed: 0,
        error: `No METAR found for ${ids.join(", ")} within the last 24 hours.`,
      });
    }

    return respond(200, { ids, latest, fallbackHoursUsed });
  } catch (err) {
    return respond(500, { error: String(err) });
  }
}

/** Small helper to keep return statements concise. */
function respond(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}
