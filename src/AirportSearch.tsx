/**
 * Searchable ICAO airport selector.
 *
 * Renders a text input + autocomplete dropdown.  The user types an
 * ICAO code (or part of a name) and matching airports appear.
 * Selecting one fires `onSelect(icao)`.
 */

import { useState, useEffect, useMemo } from "react";
import type { AirportData } from "./core/airportDb";

interface Props {
  db: Map<string, AirportData> | null;
  dbLoading: boolean;
  dbError: string | null;
  selectedIcao: string;
  onSelect: (icao: string) => void;
}

export default function AirportSearch({
  db,
  dbLoading,
  dbError,
  selectedIcao,
  onSelect,
}: Props) {
  const [query, setQuery] = useState(
    selectedIcao === "CUSTOM" ? "" : selectedIcao,
  );
  const [open, setOpen] = useState(false);

  // Sync query when parent resets selectedIcao externally
  useEffect(() => {
    setQuery(selectedIcao === "CUSTOM" ? "" : selectedIcao);
  }, [selectedIcao]);

  // ── Search results (max 8) ────────────────────────────────
  const matches = useMemo(() => {
    if (!db || query.length < 2) return [];
    const q = query.toUpperCase();
    const results: AirportData[] = [];
    // Prefer ICAO-prefix matches first
    for (const [icao, ap] of db) {
      if (icao.startsWith(q)) {
        results.push(ap);
        if (results.length >= 8) return results;
      }
    }
    // Then name-contains matches
    for (const [icao, ap] of db) {
      if (
        !icao.startsWith(q) &&
        ap.name.toUpperCase().includes(q)
      ) {
        results.push(ap);
        if (results.length >= 8) return results;
      }
    }
    return results;
  }, [query, db]);

  // ── Handlers ──────────────────────────────────────────────
  const handleInputChange = (v: string) => {
    const upper = v.toUpperCase();
    setQuery(upper);
    setOpen(upper.length >= 2);

    // Exact ICAO match → auto-select
    if (db?.has(upper)) {
      onSelect(upper);
      setOpen(false);
    } else if (upper === "") {
      onSelect("CUSTOM");
    }
  };

  const handlePick = (icao: string) => {
    setQuery(icao);
    onSelect(icao);
    setOpen(false);
  };

  // ── Render ────────────────────────────────────────────────
  const airport = db?.get(selectedIcao) ?? null;

  return (
    <>
      <div className="field">
        <span className="field-label">Airport</span>
        <div className="field-value" style={{ position: "relative" }}>
          <input
            type="text"
            value={query}
            placeholder={
              dbLoading
                ? "Loading airports…"
                : dbError
                  ? "DB error"
                  : "Type ICAO code…"
            }
            disabled={dbLoading}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              if (query.length >= 2) setOpen(true);
            }}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
            style={dbLoading ? { opacity: 0.6 } : undefined}
          />

          {/* Autocomplete dropdown */}
          {open && matches.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                zIndex: 20,
                backgroundColor: "var(--panel-bg)",
                border: "1px solid var(--panel-border)",
                borderRadius: "0 0 6px 6px",
                maxHeight: 220,
                overflowY: "auto",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              }}
            >
              {matches.map((a) => (
                <div
                  key={a.icao}
                  onMouseDown={() => handlePick(a.icao)}
                  style={{
                    padding: "6px 10px",
                    cursor: "pointer",
                    fontSize: 12,
                    borderBottom: "1px solid rgba(128,128,128,0.15)",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "rgba(128,128,128,0.15)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <strong>{a.icao}</strong>{" "}
                  <span style={{ color: "var(--text-muted)" }}>
                    {a.name.split("–")[1]?.trim() ?? a.name}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Selected airport label */}
          {selectedIcao !== "CUSTOM" && airport && (
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                marginTop: 2,
              }}
            >
              {airport.name}
              {airport.pairs.length > 0 && (
                <span>
                  {" · "}
                  {airport.pairs.map((p) => p.ident).join(", ")}
                </span>
              )}
            </div>
          )}

          {/* DB error */}
          {dbError && (
            <div style={{ fontSize: 11, color: "#ef5350", marginTop: 2 }}>
              {dbError}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
