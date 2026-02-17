/**
 * React hook for fetching and caching METAR data.
 *
 * Usage:
 *   const { loading, error, metar, refresh } = useMetar("LTAC");
 *
 * - Automatically fetches when `icao` changes.
 * - Caches results in memory for 5 minutes.
 * - `refresh()` bypasses the cache.
 * - Stale in-flight requests are ignored when `icao` changes.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchMetarJson, type NormalizedMetar } from "../services/metar";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  metar: NormalizedMetar;
  fetchedAt: number;
}

const cache: Record<string, CacheEntry> = {};

export function useMetar(icao: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metar, setMetar] = useState<NormalizedMetar | null>(null);

  // Monotonically-increasing counter to ignore stale requests
  const reqId = useRef(0);

  const doFetch = useCallback(
    async (bypassCache = false) => {
      if (!icao || icao === "CUSTOM") {
        setMetar(null);
        setError(null);
        setLoading(false);
        return;
      }

      const key = icao.toUpperCase();

      // Return cached value if still fresh
      if (!bypassCache && cache[key]) {
        const age = Date.now() - cache[key].fetchedAt;
        if (age < CACHE_TTL_MS) {
          setMetar(cache[key].metar);
          setError(null);
          setLoading(false);
          return;
        }
      }

      const id = ++reqId.current;
      setLoading(true);
      setError(null);

      try {
        const result = await fetchMetarJson(key);

        // Discard if a newer request has been issued
        if (reqId.current !== id) return;

        if (result) {
          cache[key] = { metar: result, fetchedAt: Date.now() };
          setMetar(result);
          setError(null);
        } else {
          setError(
            `No METAR report found for ${key}. ` +
            `This airport may not have a weather station, or no recent observation is available.`
          );
          setMetar(null);
        }
      } catch (err) {
        if (reqId.current !== id) return;
        setError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while fetching METAR data."
        );
      } finally {
        if (reqId.current === id) setLoading(false);
      }
    },
    [icao],
  );

  // Fetch on mount and whenever icao changes
  useEffect(() => {
    doFetch();
  }, [doFetch]);

  // Public refresh (bypasses cache)
  const refresh = useCallback(() => doFetch(true), [doFetch]);

  return { loading, error, metar, refresh } as const;
}
