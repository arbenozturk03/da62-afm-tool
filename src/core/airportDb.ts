/**
 * Worldwide airport database parsed from /airports.txt.
 *
 * File format (comma-separated):
 *   A,ICAO,NAME,LAT,LON,ELEV_FT,...          ← airport header
 *   R,IDENT,HDG,LEN_FT,WID_FT,?,ILS,?,LAT,LON,ELEV_FT,...  ← runway end
 *   P,...  L,...  X,...                        ← ignored
 *
 * Pairs reciprocal runway ends (same length+width, heading ≈180° apart)
 * to compute per-end signed slope percentage.
 */

const FT_TO_M = 0.3048;

// ── Exported types (used by Landing / Takeoff UI) ──────────────

export interface RunwayPreset {
  id: string;
  heading: number;
  /** Signed slope: +ve = uphill from this threshold, −ve = downhill */
  slopePercent: number;
  length: { ft: number; m: number };
  width: { ft: number; m: number };
  /** Threshold elevation (ft) — used as pressure-altitude proxy */
  pressureAltitude: number;
  /** ILS frequency (MHz) when available */
  ilsFreq?: number;
}

export interface RunwayPairInfo {
  ident: string;         // e.g. "03/21"
  end1Id: string;
  end2Id: string;
  lengthFt: number;
  lengthM: number;
  widthFt: number;
  widthM: number;
  end1ElevFt: number;
  end2ElevFt: number;
  slopePercent: number;  // absolute
  slopeDeg: number;      // absolute
  end1Ils?: number;
  end2Ils?: number;
}

export interface AirportData {
  icao: string;
  name: string;
  surface: "PAVED" | "GRASS" | "GRASS_SOFT";
  pressureAltitude: number;
  runwayLength: { ft: number; m: number };
  runwayWidth: { ft: number; m: number };
  runways: RunwayPreset[];
  pairs: RunwayPairInfo[];
  lat: number;
  lon: number;
}

// ── Internal raw types ─────────────────────────────────────────

interface RawEnd {
  id: string;
  heading: number;
  lengthFt: number;
  widthFt: number;
  thrLat: number;
  thrLon: number;
  thrElevFt: number;
  ilsFreq: number | null;
}

interface RawPair {
  a: RawEnd;
  b: RawEnd;
  absSlopePct: number;
  absSlopeDeg: number;
}

// ── Public entry point ─────────────────────────────────────────

export function parseAirportsTxt(text: string): Map<string, AirportData> {
  const db = new Map<string, AirportData>();
  const lines = text.split("\n");

  let icao: string | null = null;
  let apName = "";
  let apLat = 0;
  let apLon = 0;
  let apElev = 0;
  let ends: RawEnd[] = [];

  function flush() {
    if (!icao || ends.length === 0) {
      icao = null;
      ends = [];
      return;
    }

    // Pair reciprocal runway ends
    const rawPairs = pairEnds(ends);

    // Build RunwayPreset per end (with signed slope from pair)
    const runways: RunwayPreset[] = ends.map((end) => {
      let slopePct = 0;
      for (const p of rawPairs) {
        if (p.a === end || p.b === end) {
          const other = p.a === end ? p.b : p.a;
          slopePct =
            end.lengthFt > 0
              ? ((other.thrElevFt - end.thrElevFt) / end.lengthFt) * 100
              : 0;
          break;
        }
      }
      return {
        id: end.id,
        heading: end.heading,
        slopePercent: round2(slopePct),
        length: { ft: end.lengthFt, m: Math.round(end.lengthFt * FT_TO_M) },
        width: { ft: end.widthFt, m: Math.round(end.widthFt * FT_TO_M) },
        pressureAltitude: end.thrElevFt,
        ...(end.ilsFreq ? { ilsFreq: end.ilsFreq } : {}),
      };
    });

    // Airport-level pressure altitude = max threshold elevation
    const maxElev = ends.reduce(
      (mx, e) => Math.max(mx, e.thrElevFt),
      apElev,
    );

    // Airport-level dimensions from the longest runway
    const longest = ends.reduce(
      (mx, e) => (e.lengthFt > mx.lengthFt ? e : mx),
      ends[0],
    );

    // Build pair info for Runway-Info panel
    const pairs: RunwayPairInfo[] = rawPairs.map((p) => ({
      ident: `${p.a.id}/${p.b.id}`,
      end1Id: p.a.id,
      end2Id: p.b.id,
      lengthFt: p.a.lengthFt,
      lengthM: Math.round(p.a.lengthFt * FT_TO_M),
      widthFt: p.a.widthFt,
      widthM: Math.round(p.a.widthFt * FT_TO_M),
      end1ElevFt: p.a.thrElevFt,
      end2ElevFt: p.b.thrElevFt,
      slopePercent: p.absSlopePct,
      slopeDeg: p.absSlopeDeg,
      ...(p.a.ilsFreq ? { end1Ils: p.a.ilsFreq } : {}),
      ...(p.b.ilsFreq ? { end2Ils: p.b.ilsFreq } : {}),
    }));

    db.set(icao, {
      icao,
      name: `${icao} – ${apName}`,
      surface: "PAVED",
      pressureAltitude: maxElev,
      runwayLength: {
        ft: longest.lengthFt,
        m: Math.round(longest.lengthFt * FT_TO_M),
      },
      runwayWidth: {
        ft: longest.widthFt,
        m: Math.round(longest.widthFt * FT_TO_M),
      },
      runways,
      pairs,
      lat: apLat,
      lon: apLon,
    });

    icao = null;
    ends = [];
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const parts = line.split(",");
    const tag = parts[0]?.trim();

    if (tag === "A") {
      flush();
      if (parts.length < 6) continue;
      icao = parts[1]?.trim() || null;
      apName = parts[2]?.trim() || "";
      apLat = parseFloat(parts[3]) || 0;
      apLon = parseFloat(parts[4]) || 0;
      apElev = parseInt(parts[5]) || 0;
      ends = [];
    } else if (tag === "R" && icao) {
      if (parts.length < 11) continue;
      const id = parts[1]?.trim() || "";
      const heading = Math.round(parseFloat(parts[2]) || 0);
      const lengthFt = parseInt(parts[3]) || 0;
      const widthFt = parseInt(parts[4]) || 0;
      const ilsRaw = parseFloat(parts[6]) || 0;
      const thrLat = parseFloat(parts[8]) || 0;
      const thrLon = parseFloat(parts[9]) || 0;
      const thrElevFt = parseInt(parts[10]) || 0;
      if (!id || lengthFt <= 0) continue;
      ends.push({
        id,
        heading,
        lengthFt,
        widthFt,
        thrLat,
        thrLon,
        thrElevFt,
        ilsFreq: ilsRaw > 0 ? ilsRaw : null,
      });
    }
    // X, P, L lines are silently skipped
  }

  flush(); // last airport block
  return db;
}

// ── Runway pairing ─────────────────────────────────────────────

function pairEnds(ends: RawEnd[]): RawPair[] {
  const pairs: RawPair[] = [];
  const used = new Set<number>();

  for (let i = 0; i < ends.length; i++) {
    if (used.has(i)) continue;
    for (let j = i + 1; j < ends.length; j++) {
      if (used.has(j)) continue;

      const a = ends[i];
      const b = ends[j];

      // Must share identical physical runway (same length & width)
      if (a.lengthFt !== b.lengthFt || a.widthFt !== b.widthFt) continue;

      // Headings must be approximately opposite (within ±20° of 180°)
      let hdgDiff = Math.abs(a.heading - b.heading);
      if (hdgDiff > 180) hdgDiff = 360 - hdgDiff;
      if (Math.abs(hdgDiff - 180) > 20) continue;

      // Compute absolute slope
      const deltaElev = Math.abs(a.thrElevFt - b.thrElevFt);
      const absSlopePct =
        a.lengthFt > 0
          ? round2((deltaElev / a.lengthFt) * 100)
          : 0;
      const absSlopeDeg =
        a.lengthFt > 0
          ? round2(Math.atan(deltaElev / a.lengthFt) * (180 / Math.PI))
          : 0;

      pairs.push({ a, b, absSlopePct, absSlopeDeg });
      used.add(i);
      used.add(j);
      break; // each end pairs at most once
    }
  }

  return pairs;
}

// ── Helpers ────────────────────────────────────────────────────

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
