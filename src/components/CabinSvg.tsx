import { useState, useCallback, useRef } from "react";
import { useAircraft, type AircraftState } from "../context/AircraftContext";
import { aircraftConfig } from "../data/aircraftConfig";
import Modal from "./Modal";

/* ── cabin_2.svg: viewBox = "0 0 1063 3792", nose-up ── */

const SVG_W = 1063;
const SVG_H = 3792;

const CROP_Y = 50;
const CROP_H = 2750;
const VIEW_BOX = `0 ${CROP_Y} ${SVG_W} ${CROP_H}`;

/* ── Zone types ── */

interface SeatZone {
  id: string;
  label: string;
  stateKey: keyof AircraftState;
  cx: number;
  cy: number;
  w: number;
  h: number;
  max?: number;
  section: "nose" | "cabin" | "rear";
}

interface BagZone {
  id: string;
  label: string;
  stateKey: keyof AircraftState;
  cx: number;
  cy: number;
  w: number;
  h: number;
  max: number;
  section: "nose" | "cabin" | "rear";
}

/* ── Zone data ── */

const SEATS: SeatZone[] = [
  { id: "s1l", label: "Seat 1 (L)", stateKey: "seat1", cx: 400, cy: 1450, w: 240, h: 220, section: "cabin" },
  { id: "s2r", label: "Seat 2 (R)", stateKey: "seat2", cx: 700, cy: 1450, w: 240, h: 220, section: "cabin" },
  { id: "s3l", label: "Seat 3 (L)", stateKey: "seat3", cx: 360, cy: 1850, w: 200, h: 220, section: "cabin" },
  { id: "s4m", label: "Seat 4 (M)", stateKey: "seat4", cx: 550, cy: 1850, w: 200, h: 220, section: "cabin" },
  { id: "s5r", label: "Seat 5 (R)", stateKey: "seat5", cx: 750, cy: 1850, w: 200, h: 220, section: "cabin" },
  { id: "s6l", label: "Seat 6 (L)", stateKey: "seat6", cx: 450, cy: 2280, w: 220, h: 220, section: "rear" },
  { id: "s7r", label: "Seat 7 (R)", stateKey: "seat7", cx: 650, cy: 2280, w: 220, h: 220, section: "rear" },
];

const BAGS: BagZone[] = [
  { id: "blh", label: "Left Cargo", stateKey: "lhNoseKg", cx: 400, cy: 435, w: 200, h: 180, max: aircraftConfig.baggageLimits.lhNose, section: "nose" },
  { id: "brh", label: "Right Cargo", stateKey: "rhNoseKg", cx: 688, cy: 435, w: 200, h: 180, max: aircraftConfig.baggageLimits.rhNose, section: "nose" },
  { id: "brf", label: "Rear Baggage", stateKey: "rearFKg", cx: 550, cy: 2280, w: 300, h: 220, max: aircraftConfig.baggageLimits.rearF, section: "rear" },
];

const CARD_W = 200;
const CARD_H = 70;
const CARD_RX = 12;

/* Section scroll targets (SVG y-coordinates) */
const SECTIONS = [
  { id: "nose", label: "Nose", targetY: 200 },
  { id: "cabin", label: "Cabin", targetY: 1300 },
  { id: "rear", label: "Rear", targetY: 2100 },
] as const;

const ZOOM_PRESETS = [1.0, 1.5, 2.0];

/* ── Component ── */

export default function CabinSvg() {
  const { state, dispatch } = useAircraft();
  const [hovered, setHovered] = useState<string | null>(null);
  const [editingZone, setEditingZone] = useState<{ stateKey: keyof AircraftState; label: string; max?: number } | null>(null);
  const [zoom, setZoom] = useState(1.4);
  const [activeSection, setActiveSection] = useState("cabin");
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

  /* Quick-jump: scroll the viewport so the target SVG-y is centered */
  const jumpTo = (sectionId: string) => {
    const vp = viewportRef.current;
    const content = svgContentRef.current;
    if (!vp || !content) return;
    setActiveSection(sectionId);

    const section = SECTIONS.find((s) => s.id === sectionId);
    if (!section) return;

    const svgYNorm = (section.targetY - CROP_Y) / CROP_H;
    const contentH = content.scrollHeight;
    const targetScroll = svgYNorm * contentH - vp.clientHeight / 2;

    vp.scrollTo({ top: Math.max(0, targetScroll), behavior: "smooth" });
  };

  const cycleZoom = () => {
    const idx = ZOOM_PRESETS.indexOf(zoom);
    const next = idx === -1 || idx === ZOOM_PRESETS.length - 1 ? ZOOM_PRESETS[0] : ZOOM_PRESETS[idx + 1];
    setZoom(next);
  };

  /* Track which section is visible while scrolling */
  const handleScroll = () => {
    const vp = viewportRef.current;
    const content = svgContentRef.current;
    if (!vp || !content) return;

    const scrollCenter = vp.scrollTop + vp.clientHeight / 2;
    const contentH = content.scrollHeight;
    const svgY = (scrollCenter / contentH) * CROP_H + CROP_Y;

    if (svgY < 900) setActiveSection("nose");
    else if (svgY < 2000) setActiveSection("cabin");
    else setActiveSection("rear");
  };

  return (
    <>
      {/* Quick-jump segmented control */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        gap: 0,
        marginBottom: 6,
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid var(--panel-border)",
        width: "fit-content",
        margin: "0 auto 6px",
      }}>
        {SECTIONS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => jumpTo(s.id)}
            style={{
              background: activeSection === s.id ? "var(--result-bg)" : "var(--panel-bg)",
              color: activeSection === s.id ? "#60a5fa" : "var(--text-muted)",
              padding: "5px 16px",
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              borderRight: i < SECTIONS.length - 1 ? "1px solid var(--panel-border)" : "none",
              borderRadius: 0,
              cursor: "pointer",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Scrollable viewport */}
      <div
        ref={viewportRef}
        onScroll={handleScroll}
        style={{
          position: "relative",
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-y",
          maxHeight: "calc(100dvh - 160px)",
          borderRadius: 10,
          border: "1px solid var(--panel-border)",
          background: "#111",
        }}
      >
        <div
          ref={svgContentRef}
          style={{
            width: `${zoom * 100}%`,
            margin: "0 auto",
            transformOrigin: "top center",
          }}
        >
          <svg
            viewBox={VIEW_BOX}
            preserveAspectRatio="xMidYMid meet"
            style={{ display: "block", width: "100%", height: "auto" }}
          >
            <image
              href="/cabin_2.svg"
              x="0" y="0"
              width={SVG_W} height={SVG_H}
            />

            {/* ── Seat zones ── */}
            {visibleSeats.map((s) => {
              const isHover = hovered === s.id;
              const disabled = disabledSeatIds.has(s.id);
              const v = val(s.stateKey);
              const x = s.cx - s.w / 2;
              const y = s.cy - s.h / 2;
              const cardX = s.cx - CARD_W / 2;
              const cardY = s.cy - CARD_H / 2;

              return (
                <g
                  key={s.id}
                  style={{ cursor: disabled ? "not-allowed" : "pointer" }}
                  onMouseEnter={() => setHovered(s.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => { if (!disabled) setEditingZone(s); }}
                >
                  <rect
                    x={x} y={y} width={s.w} height={s.h}
                    rx={16} ry={16}
                    fill="transparent"
                    stroke={isHover ? "rgba(255,255,255,0.12)" : "transparent"}
                    strokeWidth={2}
                    pointerEvents="all"
                  />
                  <rect
                    x={cardX} y={cardY}
                    width={CARD_W} height={CARD_H}
                    rx={CARD_RX} ry={CARD_RX}
                    fill="rgba(20,20,25,0.82)"
                    stroke={v > 0 ? "rgba(56,189,248,0.25)" : "rgba(255,255,255,0.08)"}
                    strokeWidth={1}
                  />
                  <text x={cardX + 14} y={cardY + 28} fontSize={20} fill="#888" pointerEvents="none">🧑</text>
                  <text
                    x={cardX + 42} y={cardY + 30}
                    fontSize={19} fontWeight={600}
                    fill={v > 0 ? "#38bdf8" : "#888"}
                    pointerEvents="none"
                  >
                    {v.toFixed(1)} kg
                  </text>

                  {disabled && (
                    <rect
                      x={x} y={y} width={s.w} height={s.h}
                      rx={16} ry={16}
                      fill="rgba(0,0,0,0.50)"
                      pointerEvents="none"
                    />
                  )}
                </g>
              );
            })}

            {/* ── Baggage zones ── */}
            {visibleBags.map((b) => {
              const isHover = hovered === b.id;
              const v = val(b.stateKey);
              const x = b.cx - b.w / 2;
              const y = b.cy - b.h / 2;
              const cardX = b.cx - CARD_W / 2;
              const cardY = b.cy - CARD_H / 2;

              return (
                <g
                  key={b.id}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHovered(b.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setEditingZone(b)}
                >
                  <rect
                    x={x} y={y} width={b.w} height={b.h}
                    rx={14} ry={14}
                    fill="transparent"
                    stroke={isHover ? "rgba(255,255,255,0.12)" : "transparent"}
                    strokeWidth={2}
                    pointerEvents="all"
                  />
                  <rect
                    x={cardX} y={cardY}
                    width={CARD_W} height={CARD_H}
                    rx={CARD_RX} ry={CARD_RX}
                    fill="rgba(20,20,25,0.82)"
                    stroke={v > 0 ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.08)"}
                    strokeWidth={1}
                  />
                  <text x={cardX + 14} y={cardY + 28} fontSize={18} fill="#888" pointerEvents="none">🧳</text>
                  <text
                    x={cardX + 42} y={cardY + 30}
                    fontSize={19} fontWeight={600}
                    fill={v > 0 ? "#4ade80" : "#888"}
                    pointerEvents="none"
                  >
                    {v.toFixed(1)} kg
                  </text>
                  <text x={cardX + 14} y={cardY + 55} fontSize={13} fill="#555" pointerEvents="none">
                    max {b.max} kg
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Zoom controls — fixed bottom-right of viewport */}
      <div style={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 4,
        marginTop: 4,
        paddingRight: 4,
      }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", marginRight: 4 }}>
          {zoom.toFixed(1)}x
        </span>
        <button
          onClick={() => setZoom((z) => Math.max(0.8, z - 0.2))}
          style={zoomBtnStyle}
          aria-label="Zoom out"
        >−</button>
        <button
          onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
          style={zoomBtnStyle}
          aria-label="Zoom in"
        >+</button>
        <button
          onClick={cycleZoom}
          style={{ ...zoomBtnStyle, fontSize: 11, width: "auto", padding: "0 8px" }}
          aria-label="Reset zoom"
        >Reset</button>
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

const zoomBtnStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 6,
  border: "1px solid var(--panel-border)",
  background: "var(--panel-bg)",
  color: "var(--text-muted)",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
};
