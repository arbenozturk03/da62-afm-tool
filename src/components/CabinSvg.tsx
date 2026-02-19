import { useState, useCallback, useRef, useMemo } from "react";
import { useAircraft, type AircraftState } from "../context/AircraftContext";
import { aircraftConfig } from "../data/aircraftConfig";
import Modal from "./Modal";

const SVG_W = 1063;
const SVG_H = 3792;
const CROP_Y = 50;
const CROP_H = 2750;
const VIEW_BOX = `0 ${CROP_Y} ${SVG_W} ${CROP_H}`;

/* ── Zone types ── */

interface SeatZone {
  id: string;
  label: string;
  shortLabel: string;
  stateKey: keyof AircraftState;
  cx: number;
  cy: number;
  w: number;
  h: number;
  row: number;
  max?: number;
}

interface BagZone {
  id: string;
  label: string;
  stateKey: keyof AircraftState;
  cx: number;
  cy: number;
  w: number;
  h: number;
  row: number;
  max: number;
}

/* ── Zone data (row groups: 0=front, 1=mid, 2=rear, 10=nose-bags, 11=rear-bag) ── */

const SEATS: SeatZone[] = [
  { id: "s1l", shortLabel: "1L", label: "Seat 1L", stateKey: "seat1", cx: 400, cy: 1450, w: 260, h: 240, row: 0 },
  { id: "s2r", shortLabel: "1R", label: "Seat 1R", stateKey: "seat2", cx: 700, cy: 1450, w: 260, h: 240, row: 0 },
  { id: "s3l", shortLabel: "2L", label: "Seat 2L", stateKey: "seat3", cx: 360, cy: 1850, w: 220, h: 240, row: 1 },
  { id: "s4m", shortLabel: "2C", label: "Seat 2C", stateKey: "seat4", cx: 550, cy: 1850, w: 220, h: 240, row: 1 },
  { id: "s5r", shortLabel: "2R", label: "Seat 2R", stateKey: "seat5", cx: 750, cy: 1850, w: 220, h: 240, row: 1 },
  { id: "s6l", shortLabel: "3L", label: "Seat 3L", stateKey: "seat6", cx: 450, cy: 2280, w: 240, h: 240, row: 2 },
  { id: "s7r", shortLabel: "3R", label: "Seat 3R", stateKey: "seat7", cx: 650, cy: 2280, w: 240, h: 240, row: 2 },
];

const BAGS: BagZone[] = [
  { id: "blh", label: "Left Cargo",    stateKey: "lhNoseKg", cx: 400, cy: 435, w: 220, h: 200, row: 10, max: aircraftConfig.baggageLimits.lhNose },
  { id: "brh", label: "Right Cargo",   stateKey: "rhNoseKg", cx: 688, cy: 435, w: 220, h: 200, row: 10, max: aircraftConfig.baggageLimits.rhNose },
  { id: "brf", label: "Rear Baggage",  stateKey: "rearFKg",  cx: 550, cy: 2280, w: 320, h: 240, row: 11, max: aircraftConfig.baggageLimits.rearF },
];

/* Card dimensions */
const CW = 320;
const CH = 140;
const RX = 18;
const CARD_GAP = 4;

function rowPositions(count: number, cy: number): Array<{ cardX: number; cardY: number }> {
  const totalW = count * CW + (count - 1) * CARD_GAP;
  const startX = (SVG_W - totalW) / 2;
  const cardY = cy - CH / 2;
  return Array.from({ length: count }, (_, i) => ({
    cardX: startX + i * (CW + CARD_GAP),
    cardY,
  }));
}

/* Section scroll targets */
const SECTIONS = [
  { id: "nose", label: "Nose", targetY: 200 },
  { id: "cabin", label: "Cabin", targetY: 1150 },
] as const;

/* ── Component ── */

export default function CabinSvg() {
  const { state, dispatch } = useAircraft();
  const [hovered, setHovered] = useState<string | null>(null);
  const [editingZone, setEditingZone] = useState<{ stateKey: keyof AircraftState; label: string; max?: number } | null>(null);
  const [activeSection, setActiveSection] = useState("nose");
  const viewportRef = useRef<HTMLDivElement>(null);
  const svgContentRef = useRef<HTMLDivElement>(null);

  const isCargoMode = state.mode === "cargo";

  const handleSave = useCallback(
    (v: number) => {
      if (editingZone?.stateKey) {
        dispatch({ type: "SET_FIELD", field: editingZone.stateKey, value: v });
      }
    },
    [editingZone, dispatch],
  );

  const val = (key: keyof AircraftState) => (state[key] as number) || 0;

  const visibleSeats = isCargoMode
    ? SEATS.filter((s) => s.id !== "s6l" && s.id !== "s7r")
    : SEATS;

  const visibleBags = isCargoMode
    ? BAGS
    : BAGS.filter((b) => b.id !== "brf");

  const disabledSeatIds = new Set(isCargoMode ? ["s6l", "s7r"] : []);

  /* Compute card positions per row — all cards in a row are centered and adjacent */
  const seatCardMap = useMemo(() => {
    const map = new Map<string, { cardX: number; cardY: number }>();
    const byRow = new Map<number, SeatZone[]>();
    for (const s of visibleSeats) {
      if (!byRow.has(s.row)) byRow.set(s.row, []);
      byRow.get(s.row)!.push(s);
    }
    for (const [, group] of byRow) {
      const cy = group[0].cy;
      const positions = rowPositions(group.length, cy);
      group.forEach((s, i) => map.set(s.id, positions[i]));
    }
    return map;
  }, [visibleSeats]);

  const bagCardMap = useMemo(() => {
    const map = new Map<string, { cardX: number; cardY: number }>();
    const byRow = new Map<number, BagZone[]>();
    for (const b of visibleBags) {
      if (!byRow.has(b.row)) byRow.set(b.row, []);
      byRow.get(b.row)!.push(b);
    }
    for (const [, group] of byRow) {
      const cy = group[0].cy;
      const positions = rowPositions(group.length, cy);
      group.forEach((b, i) => map.set(b.id, positions[i]));
    }
    return map;
  }, [visibleBags]);

  const jumpTo = (sectionId: string) => {
    const vp = viewportRef.current;
    const content = svgContentRef.current;
    if (!vp || !content) return;
    setActiveSection(sectionId);
    const section = SECTIONS.find((s) => s.id === sectionId);
    if (!section) return;
    const svgYNorm = (section.targetY - CROP_Y) / CROP_H;
    const contentH = content.scrollHeight;
    vp.scrollTo({ top: Math.max(0, svgYNorm * contentH - 20), behavior: "smooth" });
  };

  const handleScroll = () => {
    const vp = viewportRef.current;
    const content = svgContentRef.current;
    if (!vp || !content) return;
    const scrollCenter = vp.scrollTop + vp.clientHeight / 2;
    const svgY = (scrollCenter / content.scrollHeight) * CROP_H + CROP_Y;
    setActiveSection(svgY < 900 ? "nose" : "cabin");
  };

  return (
    <>
      {/* Controls */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid var(--panel-border)" }}>
          {SECTIONS.map((s, i) => (
            <button key={s.id} onClick={() => jumpTo(s.id)} style={{
              background: activeSection === s.id ? "var(--result-bg)" : "var(--panel-bg)",
              color: activeSection === s.id ? "#60a5fa" : "var(--text-muted)",
              padding: "5px 14px", fontSize: 12, fontWeight: 600,
              border: "none", borderRight: i < SECTIONS.length - 1 ? "1px solid var(--panel-border)" : "none",
              borderRadius: 0, cursor: "pointer",
            }}>{s.label}</button>
          ))}
        </div>
        <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid var(--panel-border)" }}>
          {(["passenger", "cargo"] as const).map((m) => (
            <button key={m} onClick={() => dispatch({ type: "SET_MODE", mode: m })} style={{
              background: state.mode === m ? "var(--result-bg)" : "var(--panel-bg)",
              color: state.mode === m ? "#60a5fa" : "var(--text-muted)",
              padding: "5px 14px", fontSize: 12, fontWeight: 600,
              border: "none", borderRight: m === "passenger" ? "1px solid var(--panel-border)" : "none",
              borderRadius: 0, cursor: "pointer",
            }}>{m === "passenger" ? "🪑 PAX" : "📦 Cargo"}</button>
          ))}
        </div>
      </div>

      {/* Viewport */}
      <div ref={viewportRef} onScroll={handleScroll} style={{
        position: "relative", overflowY: "auto", overflowX: "hidden",
        WebkitOverflowScrolling: "touch", touchAction: "pan-y",
        height: 480, maxHeight: 480, borderRadius: 10,
        border: "1px solid var(--panel-border)", background: "#111",
      }}>
        <div ref={svgContentRef} style={{ width: "100%" }}>
          <svg viewBox={VIEW_BOX} preserveAspectRatio="xMidYMid meet" style={{ display: "block", width: "100%", height: "auto" }}>
            <image href="/cabin_2.svg" x="0" y="0" width={SVG_W} height={SVG_H} />

            {/* ── Seats ── */}
            {visibleSeats.map((s) => {
              const pos = seatCardMap.get(s.id);
              if (!pos) return null;
              const { cardX, cardY } = pos;
              const isHover = hovered === s.id;
              const disabled = disabledSeatIds.has(s.id);
              const v = val(s.stateKey);
              const filled = v > 0;

              return (
                <g key={s.id} style={{ cursor: disabled ? "not-allowed" : "pointer" }}
                  onMouseEnter={() => setHovered(s.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => { if (!disabled) setEditingZone(s); }}
                >
                  <rect x={cardX} y={cardY} width={CW} height={CH}
                    fill="transparent" pointerEvents="all" />

                  <rect x={cardX} y={cardY} width={CW} height={CH} rx={RX} ry={RX}
                    fill={isHover ? "rgba(30,30,38,0.95)" : "rgba(18,18,24,0.88)"}
                    stroke={filled ? "rgba(56,189,248,0.35)" : "rgba(255,255,255,0.06)"}
                    strokeWidth={1.5}
                  />

                  <text x={cardX + CW / 2} y={cardY + 38} textAnchor="middle"
                    fontSize={30} fontWeight={800}
                    fill={filled ? "#e0f2fe" : "#666"} pointerEvents="none"
                  >{s.label}</text>

                  <text x={cardX + CW / 2} y={cardY + 88} textAnchor="middle"
                    fontSize={38} fontWeight={800}
                    fill={filled ? "#38bdf8" : "#444"} pointerEvents="none"
                  >🧑 {v.toFixed(0)} kg</text>

                  <text x={cardX + CW / 2} y={cardY + 122} textAnchor="middle"
                    fontSize={20} fill={filled ? "rgba(56,189,248,0.45)" : "rgba(255,255,255,0.15)"} pointerEvents="none"
                  >{filled ? "occupied" : "tap to set"}</text>

                  {disabled && (
                    <rect x={cardX} y={cardY} width={CW} height={CH} rx={RX} ry={RX}
                      fill="rgba(0,0,0,0.6)" pointerEvents="none" />
                  )}
                </g>
              );
            })}

            {/* ── Baggage ── */}
            {visibleBags.map((b) => {
              const pos = bagCardMap.get(b.id);
              if (!pos) return null;
              const { cardX, cardY } = pos;
              const isHover = hovered === b.id;
              const v = val(b.stateKey);
              const filled = v > 0;

              return (
                <g key={b.id} style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHovered(b.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setEditingZone(b)}
                >
                  <rect x={cardX} y={cardY} width={CW} height={CH}
                    fill="transparent" pointerEvents="all" />

                  <rect x={cardX} y={cardY} width={CW} height={CH} rx={RX} ry={RX}
                    fill={isHover ? "rgba(30,30,38,0.95)" : "rgba(18,18,24,0.88)"}
                    stroke={filled ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.06)"}
                    strokeWidth={1.5}
                  />

                  <text x={cardX + CW / 2} y={cardY + 36} textAnchor="middle"
                    fontSize={28} fontWeight={800}
                    fill={filled ? "#bbf7d0" : "#888"} pointerEvents="none"
                  >{b.label}</text>

                  <text x={cardX + CW / 2} y={cardY + 86} textAnchor="middle"
                    fontSize={38} fontWeight={800}
                    fill={filled ? "#4ade80" : "#444"} pointerEvents="none"
                  >🧳 {v.toFixed(0)} kg</text>

                  <text x={cardX + CW / 2} y={cardY + 122} textAnchor="middle"
                    fontSize={20} fill={v > b.max ? "#f87171" : "#555"} pointerEvents="none"
                  >max {b.max} kg</text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {editingZone && (
        <Modal
          title={editingZone.label}
          value={val(editingZone.stateKey)}
          max={editingZone.max}
          onSave={handleSave}
          onClose={() => setEditingZone(null)}
        />
      )}
    </>
  );
}
