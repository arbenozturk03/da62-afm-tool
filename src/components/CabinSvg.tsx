import { useState, useCallback } from "react";
import { useAircraft, type AircraftState } from "../context/AircraftContext";
import { aircraftConfig } from "../data/aircraftConfig";
import Modal from "./Modal";

/* ── cabin_2.svg: viewBox = "0 0 1063 3792", nose-up, no rotation needed ── */

const SVG_W = 1063;
const SVG_H = 3792;

/* Crop: nose tip to just past rear seats */
const CROP_Y = 50;
const CROP_H = 3150;
const VIEW_BOX = `0 ${CROP_Y} ${SVG_W} ${CROP_H}`;

/* ── Zone definitions ─────────────────────────────────────── */

interface SeatZone {
  id: string;
  label: string;
  stateKey: keyof AircraftState;
  cx: number;   // center x of seat in SVG coords
  cy: number;   // center y of seat in SVG coords
  w: number;
  h: number;
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
  max: number;
}

/*
 * cabin_2.svg is 1063 wide × 3792 tall, nose UP.
 * Approximate seat centers from the SVG layout:
 *   Row 1 (front): ~y 1700,  left ~x 310, right ~x 750
 *   Row 2 (mid):   ~y 2150,  left ~x 220, mid ~x 530, right ~x 840
 *   Row 3 (rear):  ~y 2650,  left ~x 340, right ~x 720
 */

const SEATS: SeatZone[] = [
  { id: "s1l", label: "Seat 1 (L)", stateKey: "seat1", cx: 310, cy: 1700, w: 280, h: 250 },
  { id: "s2r", label: "Seat 2 (R)", stateKey: "seat2", cx: 750, cy: 1700, w: 280, h: 250 },

  { id: "s3l", label: "Seat 3 (L)", stateKey: "seat3", cx: 220, cy: 2150, w: 250, h: 250 },
  { id: "s4m", label: "Seat 4 (M)", stateKey: "seat4", cx: 530, cy: 2150, w: 250, h: 250 },
  { id: "s5r", label: "Seat 5 (R)", stateKey: "seat5", cx: 840, cy: 2150, w: 250, h: 250 },

  { id: "s6l", label: "Seat 6 (L)", stateKey: "seat6", cx: 340, cy: 2650, w: 280, h: 250 },
  { id: "s7r", label: "Seat 7 (R)", stateKey: "seat7", cx: 720, cy: 2650, w: 280, h: 250 },
];

const BAGS: BagZone[] = [
  { id: "blh", label: "LH Nose", stateKey: "lhNoseKg", cx: 310, cy: 820, w: 250, h: 200, max: aircraftConfig.baggageLimits.lhNose },
  { id: "brh", label: "RH Nose", stateKey: "rhNoseKg", cx: 750, cy: 820, w: 250, h: 200, max: aircraftConfig.baggageLimits.rhNose },
  { id: "brf", label: "Rear Cargo", stateKey: "rearFKg", cx: 530, cy: 2650, w: 350, h: 250, max: aircraftConfig.baggageLimits.rearF },
];

/* ── Label card dimensions (SVG units) ── */
const CARD_W = 200;
const CARD_H = 70;
const CARD_RX = 12;

/* ── Component ────────────────────────────────────────────── */

export default function CabinSvg() {
  const { state, dispatch } = useAircraft();
  const [hovered, setHovered] = useState<string | null>(null);
  const [editingZone, setEditingZone] = useState<{ stateKey: keyof AircraftState; label: string; max?: number } | null>(null);
  const [debugClicks, setDebugClicks] = useState<{x: number; y: number}[]>([]);
  const DEBUG = true; // TEMPORARY — set to false to disable

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

  return (
    <>
      <div style={{ width: "100%" }}>
        <svg
          viewBox={VIEW_BOX}
          preserveAspectRatio="xMidYMid meet"
          style={{ display: "block", width: "100%", height: "auto" }}
        >
          {/* cabin image */}
          <image
            href="/cabin_2.svg"
            x="0"
            y="0"
            width={SVG_W}
            height={SVG_H}
          />

          {/* DEBUG: click anywhere to read SVG coordinates */}
          {DEBUG && (
            <rect
              x="0" y="0" width={SVG_W} height={SVG_H}
              fill="transparent"
              pointerEvents="all"
              style={{ cursor: "crosshair" }}
              onClick={(e) => {
                const svg = e.currentTarget.ownerSVGElement;
                if (!svg) return;
                const pt = svg.createSVGPoint();
                pt.x = e.clientX;
                pt.y = e.clientY;
                const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
                const coord = { x: Math.round(svgPt.x), y: Math.round(svgPt.y) };
                setDebugClicks((prev) => [...prev, coord]);
                console.log(`CLICK: (${coord.x}, ${coord.y})`);
              }}
            />
          )}

          {/* DEBUG: show clicked points */}
          {DEBUG && debugClicks.map((c, i) => (
            <g key={i}>
              <circle cx={c.x} cy={c.y} r={8} fill="red" />
              <text x={c.x + 12} y={c.y + 5} fontSize={16} fill="yellow" fontWeight={700}>
                {i + 1}: ({c.x},{c.y})
              </text>
            </g>
          ))}

          {/* DEBUG: show current zone outlines */}
          {DEBUG && [...SEATS, ...BAGS].map((z) => (
            <rect
              key={z.id + "-dbg"}
              x={z.cx - z.w / 2} y={z.cy - z.h / 2}
              width={z.w} height={z.h}
              rx={10} ry={10}
              fill="none" stroke="red" strokeWidth={3} strokeDasharray="10 5"
              pointerEvents="none"
            />
          ))}

          {/* ── Seat zones ── */}
          {visibleSeats.map((s) => {
            const isHover = hovered === s.id;
            const disabled = disabledSeatIds.has(s.id);
            const v = val(s.stateKey);
            const x = s.cx - s.w / 2;
            const y = s.cy - s.h / 2;
            const cardX = s.cx - CARD_W / 2;
            const cardY = s.cy + s.h / 2 - CARD_H - 8;

            return (
              <g
                key={s.id}
                style={{ cursor: disabled ? "not-allowed" : "pointer" }}
                onMouseEnter={() => setHovered(s.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => {
                  if (!disabled) setEditingZone(s);
                }}
              >
                {/* Invisible hit area */}
                <rect
                  x={x} y={y} width={s.w} height={s.h}
                  rx={16} ry={16}
                  fill="transparent"
                  stroke={isHover ? "rgba(255,255,255,0.12)" : "transparent"}
                  strokeWidth={2}
                  pointerEvents="all"
                />

                {/* Dark label card */}
                <rect
                  x={cardX} y={cardY}
                  width={CARD_W} height={CARD_H}
                  rx={CARD_RX} ry={CARD_RX}
                  fill="rgba(20,20,25,0.82)"
                  stroke={v > 0 ? "rgba(56,189,248,0.25)" : "rgba(255,255,255,0.08)"}
                  strokeWidth={1}
                />

                {/* Person icon + weight */}
                <text
                  x={cardX + 14} y={cardY + 28}
                  fontSize={20} fill="#888" pointerEvents="none"
                >
                  🧑
                </text>
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
                {/* Invisible hit area */}
                <rect
                  x={x} y={y} width={b.w} height={b.h}
                  rx={14} ry={14}
                  fill="transparent"
                  stroke={isHover ? "rgba(255,255,255,0.12)" : "transparent"}
                  strokeWidth={2}
                  pointerEvents="all"
                />

                {/* Dark label card */}
                <rect
                  x={cardX} y={cardY}
                  width={CARD_W} height={CARD_H}
                  rx={CARD_RX} ry={CARD_RX}
                  fill="rgba(20,20,25,0.82)"
                  stroke={v > 0 ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.08)"}
                  strokeWidth={1}
                />

                {/* Bag icon + weight */}
                <text
                  x={cardX + 14} y={cardY + 28}
                  fontSize={18} fill="#888" pointerEvents="none"
                >
                  🧳
                </text>
                <text
                  x={cardX + 42} y={cardY + 30}
                  fontSize={19} fontWeight={600}
                  fill={v > 0 ? "#4ade80" : "#888"}
                  pointerEvents="none"
                >
                  {v.toFixed(1)} kg
                </text>

                {/* Max info */}
                <text
                  x={cardX + 14} y={cardY + 55}
                  fontSize={13} fill="#555" pointerEvents="none"
                >
                  max {b.max} kg
                </text>
              </g>
            );
          })}
        </svg>
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
