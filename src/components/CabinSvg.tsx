import { useCallback, useRef, useMemo, useEffect, useState } from "react";
import { useAircraft, type AircraftState } from "../context/AircraftContext";
import { aircraftConfig } from "../data/aircraftConfig";
import Modal from "./Modal";

const SVG_W = 1063;
const CROP_Y = 50;
const CROP_H = 2750;
const VIEW_BOX = `0 ${CROP_Y} ${SVG_W} ${CROP_H}`;

/** Aspect ratio of the cropped cabin view (width / height) for overlay alignment */
const CABIN_ASPECT = SVG_W / CROP_H;

/** Horizontal offset for cabin background (if aircraft drawing is off-center). Negative = move aircraft right. */
const CABIN_IMAGE_OFFSET_X = -5.3;

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

/* ── Row weight limits (AFM) ── */
const ROW_LIMITS: Record<number, number> = { 0: 240, 1: 240, 2: 190 };

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

const VIEWPORT_H = 480;

export default function CabinSvg() {
  const { state, dispatch } = useAircraft();
  const [hovered, setHovered] = useState<string | null>(null);
  const [editingZone, setEditingZone] = useState<{ stateKey: keyof AircraftState; label: string; max?: number; maxWarning?: string } | null>(null);
  const [cabinImageLoaded, setCabinImageLoaded] = useState(false);
  const activeSection = state.cabinSection;
  const viewScrollTop = state.cabinScrollTop;
  const setActiveSection = (s: string) => dispatch({ type: "SET_FIELD", field: "cabinSection", value: s as unknown as number });
  const setViewScrollTop = useCallback((v: number) => dispatch({ type: "SET_FIELD", field: "cabinScrollTop", value: v }), [dispatch]);
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

  const seatMaxForZone = (seat: SeatZone): number => {
    const rowLimit = ROW_LIMITS[seat.row];
    if (rowLimit == null) return Infinity;
    const othersInRow = SEATS.filter((s) => s.row === seat.row && s.id !== seat.id);
    const othersWeight = othersInRow.reduce((sum, s) => sum + val(s.stateKey), 0);
    return Math.max(0, rowLimit - othersWeight);
  };

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
    const content = svgContentRef.current;
    if (!content) return;
    setActiveSection(sectionId);
    const section = SECTIONS.find((s) => s.id === sectionId);
    if (!section) return;
    const svgYNorm = (section.targetY - CROP_Y) / CROP_H;
    const contentH = content.offsetHeight;
    const target = Math.max(0, svgYNorm * contentH - 20);
    const maxScroll = Math.max(0, contentH - VIEWPORT_H);
    setViewScrollTop(Math.min(target, maxScroll));
  };

  /* Initial view: show Nose if cabinScrollTop hasn't been set yet (-1) */
  useEffect(() => {
    if (viewScrollTop >= 0) return;
    const content = svgContentRef.current;
    if (!content) return;
    const applyNose = () => {
      const contentH = content.offsetHeight;
      if (contentH <= 0) return;
      const noseSection = SECTIONS.find((s) => s.id === "nose");
      if (!noseSection) return;
      const svgYNorm = (noseSection.targetY - CROP_Y) / CROP_H;
      const target = Math.max(0, svgYNorm * contentH - 20);
      const maxScroll = Math.max(0, contentH - VIEWPORT_H);
      setViewScrollTop(Math.min(target, maxScroll));
    };
    applyNose();
    const ro = new ResizeObserver(applyNose);
    ro.observe(content);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewScrollTop]);


  return (
    <>
      {/* Controls — GPU-only animation (opacity + transform) for smooth mobile */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
        marginBottom: 6,
        contain: "layout",
      }}>
        {/* Nose / Cabin */}
        <div style={{
          display: "flex",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid var(--panel-border)",
          flexShrink: 0,
        }}>
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

      </div>

      {/* Viewport — no scroll; only Nose/Cabin buttons move the view via transform */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          height: VIEWPORT_H,
          borderRadius: 10,
          border: "1px solid var(--panel-border)",
          background: "#111",
        }}
      >
        <div
          ref={svgContentRef}
          style={{
            width: "100%",
            transform: `translateY(-${viewScrollTop}px)`,
            transition: "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <div style={{ position: "relative", width: "100%", aspectRatio: CABIN_ASPECT }}>
            <img
              src="/cabin-desktop.webp"
              srcSet="/cabin-mobile.webp 900w, /cabin-desktop.webp 1400w"
              sizes="(max-width: 768px) 900px, 1400px"
              alt=""
              decoding="async"
              fetchPriority="high"
              onLoad={() => setCabinImageLoaded(true)}
              style={{
                display: "block",
                width: "100%",
                height: "auto",
                verticalAlign: "middle",
                objectFit: "cover",
                objectPosition: `${CABIN_IMAGE_OFFSET_X}px 0`,
                opacity: cabinImageLoaded ? 1 : 0,
                transition: "opacity 0.4s ease-out",
              }}
            />
            <svg
              viewBox={VIEW_BOX}
              preserveAspectRatio="xMidYMid meet"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                display: "block",
                pointerEvents: "none",
              }}
            >
              <g style={{ pointerEvents: "auto" }}>
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
                  onClick={() => {
                    if (!disabled) {
                      const rowLimit = ROW_LIMITS[s.row];
                      setEditingZone({
                        ...s,
                        max: seatMaxForZone(s),
                        maxWarning: rowLimit != null ? `Max ${rowLimit} kg for this row` : undefined,
                      });
                    }
                  }}
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

            {/* ── Rear seats: Installed / Folded toggle (centered on SVG) ── */}
            {(() => {
              const centerX = SVG_W / 2;
              const tw = 340;
              const th = 60;
              const halfW = tw / 2;
              const ty = 2120;
              const r = 14;
              const leftX = centerX - halfW;
              const rightX = centerX;
              return (
                <g>
                  <text x={centerX} y={ty - 12} textAnchor="middle"
                    fontSize={30} fontWeight={800} fill="#888" pointerEvents="none"
                  >Rear seats</text>
                  <g style={{ cursor: "pointer" }}
                    onClick={() => dispatch({ type: "SET_MODE", mode: "passenger" })}
                  >
                    <rect x={leftX} y={ty} width={halfW} height={th} rx={r} ry={r}
                      fill={!isCargoMode ? "#1a2a3a" : "rgba(30,30,38,0.92)"}
                      stroke={!isCargoMode ? "rgba(96,165,250,0.6)" : "rgba(255,255,255,0.1)"}
                      strokeWidth={2}
                    />
                    <rect x={rightX - r} y={ty} width={r} height={th}
                      fill={!isCargoMode ? "#1a2a3a" : "rgba(30,30,38,0.92)"}
                    />
                    <text x={centerX - halfW / 2} y={ty + th / 2 + 10} textAnchor="middle"
                      fontSize={30} fontWeight={800}
                      fill={!isCargoMode ? "#60a5fa" : "#666"} pointerEvents="none"
                    >Installed</text>
                  </g>
                  <g style={{ cursor: "pointer" }}
                    onClick={() => dispatch({ type: "SET_MODE", mode: "cargo" })}
                  >
                    <rect x={rightX} y={ty} width={halfW} height={th} rx={r} ry={r}
                      fill={isCargoMode ? "#1a2a3a" : "rgba(30,30,38,0.92)"}
                      stroke={isCargoMode ? "rgba(251,191,36,0.6)" : "rgba(255,255,255,0.1)"}
                      strokeWidth={2}
                    />
                    <rect x={rightX} y={ty} width={r} height={th}
                      fill={isCargoMode ? "#1a2a3a" : "rgba(30,30,38,0.92)"}
                    />
                    <text x={centerX + halfW / 2} y={ty + th / 2 + 12} textAnchor="middle"
                      fontSize={30} fontWeight={800}
                      fill={isCargoMode ? "#fbbf24" : "#666"} pointerEvents="none"
                    >Folded</text>
                  </g>
                </g>
              );
            })()}
              </g>
            </svg>
          </div>
        </div>
      </div>

      {editingZone && (
        <Modal
          title={editingZone.label}
          value={val(editingZone.stateKey)}
          max={editingZone.max}
          maxWarning={editingZone.maxWarning}
          onSave={handleSave}
          onClose={() => setEditingZone(null)}
        />
      )}
    </>
  );
}
