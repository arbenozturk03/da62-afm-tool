/**
 * Netlify Function: /.netlify/functions/metar?ids=LTFM,LTAC
 *
 * Fetches the most recent METAR from NOAA AviationWeather Data API.
 *
 * Uses a single request with hours=24 and sorts the returned array
 * to pick the newest report.  Sort priority: reportTime → obsTime →
 * receiptTime (all converted to epoch ms for comparison).
 *
 * Response format:
 *   { ids: string[], latest: object|null, hoursUsed: number }
 */

const NOAA_BASE = "https://aviationweather.gov/api/data/metar";
const HOURS = 24;

const CORS_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=60",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "Content-Type",
};

/**
 * Return a comparable epoch-ms timestamp from a METAR object.
 * Prefer reportTime (ISO string), fall back to obsTime (Unix s),
 * then receiptTime (ISO string).  Returns 0 when nothing is available.
 */
function toEpoch(m) {
  if (m.reportTime) {
    const t = Date.parse(m.reportTime);
    if (!isNaN(t)) return t;
  }
  if (typeof m.obsTime === "number") return m.obsTime * 1000;
  if (m.receiptTime) {
    const t = Date.parse(m.receiptTime);
    if (!isNaN(t)) return t;
  }
  return 0;
}

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
        hoursUsed: 0,
        error: "Missing or empty 'ids' query parameter.",
      });
    }

    // ── Single request with the full 24-hour window ───────────
    const idsParam = encodeURIComponent(ids.join(","));
    const url = `${NOAA_BASE}?ids=${idsParam}&format=json&hours=${HOURS}`;

    let resp;
    try {
      resp = await fetch(url);
    } catch (err) {
      return respond(502, {
        ids,
        latest: null,
        hoursUsed: HOURS,
        error: `Upstream request failed: ${err.message || err}`,
      });
    }

    if (resp.status === 204 || !resp.ok) {
      return respond(200, {
        ids,
        latest: null,
        hoursUsed: HOURS,
        error: `No METAR found for ${ids.join(", ")} within the last ${HOURS} hours.`,
      });
    }

    let data;
    try {
      data = await resp.json();
    } catch {
      return respond(502, {
        ids,
        latest: null,
        hoursUsed: HOURS,
        error: "Malformed JSON from upstream METAR API.",
      });
    }

    if (!Array.isArray(data) || data.length === 0) {
      return respond(200, {
        ids,
        latest: null,
        hoursUsed: HOURS,
        error: `No METAR found for ${ids.join(", ")} within the last ${HOURS} hours.`,
      });
    }

    // ── Pick the most recent report ───────────────────────────
    data.sort((a, b) => toEpoch(b) - toEpoch(a));
    const latest = data[0];

    return respond(200, { ids, latest, hoursUsed: HOURS });
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
