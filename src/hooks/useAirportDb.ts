/**
 * Hook to load and cache the worldwide airport database.
 *
 * Fetches /airports.txt once, parses it with parseAirportsTxt(),
 * and caches the result at module level so subsequent mounts
 * (or multiple components) share the same Map.
 */

import { useState, useEffect } from "react";
import { parseAirportsTxt, type AirportData } from "../core/airportDb";

// ── Module-level cache (shared across all hook instances) ──────

let cachedDb: Map<string, AirportData> | null = null;
let loadPromise: Promise<Map<string, AirportData>> | null = null;

async function loadDb(): Promise<Map<string, AirportData>> {
  if (cachedDb) return cachedDb;

  if (!loadPromise) {
    loadPromise = (async () => {
      const res = await fetch("/airports.txt");
      if (!res.ok) throw new Error(`Failed to fetch airports.txt (HTTP ${res.status})`);
      const text = await res.text();
      const db = parseAirportsTxt(text);
      cachedDb = db;
      return db;
    })();
  }

  return loadPromise;
}

// ── Hook ───────────────────────────────────────────────────────

export function useAirportDb() {
  const [db, setDb] = useState<Map<string, AirportData> | null>(cachedDb);
  const [loading, setLoading] = useState(!cachedDb);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedDb) {
      setDb(cachedDb);
      setLoading(false);
      return;
    }

    let cancelled = false;

    loadDb()
      .then((result) => {
        if (!cancelled) {
          setDb(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load airport database.",
          );
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { db, loading, error } as const;
}
