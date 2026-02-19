import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAircraft, type AircraftState } from "../context/AircraftContext";
import { aircraftConfig } from "../data/aircraftConfig";
import { NOSE_BAG_LH, NOSE_BAG_RH } from "./baggagePaths";
import Modal from "./Modal";

/* ── Zone definitions ─────────────────────────────────────── */

type ZoneType = "seat" | "baggage" | "navigate";

interface Zone {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: ZoneType;
  stateKey?: keyof AircraftState;
  navTo?: string;
  max?: number;
}

interface NoseBagZone {
  id: string;
  label: string;
  d: string;
  labelX: number;
  labelY: number;
  stateKey: keyof AircraftState;
  max: number;
}

const SEAT_ZONES: Zone[] = [
  { id: "seat_1_left", label: "Seat 1 (L)", x: 1975, y: 76, w: 275, h: 174, type: "seat", stateKey: "seat1" },
  { id: "seat_2_right", label: "Seat 2 (R)", x: 1975, y: 337, w: 275, h: 174, type: "seat", stateKey: "seat2" },
  { id: "seat_3_left", label: "Seat 3 (L)", x: 1598, y: 35, w: 275, h: 170, type: "seat", stateKey: "seat3" },
  { id: "seat_4_middle", label: "Seat 4 (M)", x: 1598, y: 205, w: 275, h: 170, type: "seat", stateKey: "seat4" },
  { id: "seat_5_right", label: "Seat 5 (R)", x: 1598, y: 375, w: 275, h: 170, type: "seat", stateKey: "seat5" },
  { id: "seat_6_left", label: "Seat 6 (L)", x: 1218, y: 122, w: 275, h: 174, type: "seat", stateKey: "seat6" },
  { id: "seat_7_right", label: "Seat 7 (R)", x: 1218, y: 296, w: 275, h: 174, type: "seat", stateKey: "seat7" },
];

const NOSE_BAG_ZONES: NoseBagZone[] = [
  { id: "bag_lh_nose", label: "LH Nose", d: NOSE_BAG_LH, labelX: 3030, labelY: 160, stateKey: "lhNoseKg", max: aircraftConfig.baggageLimits.lhNose },
  { id: "bag_rh_nose", label: "RH Nose", d: NOSE_BAG_RH, labelX: 3030, labelY: 415, stateKey: "rhNoseKg", max: aircraftConfig.baggageLimits.rhNose },
];

const RECT_BAGGAGE_ZONES: Zone[] = [
  { id: "bag_rear_f", label: "Rear Cargo F", x: 1218, y: 122, w: 275, h: 348, type: "baggage", stateKey: "rearFKg", max: aircraftConfig.baggageLimits.rearF },
];

const NAV_ZONES: Zone[] = [];

/* ── Rotation / crop ──────────────────────────────────────── */

const ORIG_W = 3406.606;
const ORIG_H = 581.918;

const CROP_X_MIN = 1050;
const CROP_X_MAX = 3350;
const CROP_RANGE = CROP_X_MAX - CROP_X_MIN;
const VB_Y_START = ORIG_W - CROP_X_MAX;

const VIEW_BOX = `0 ${VB_Y_START} ${ORIG_H} ${CROP_RANGE}`;
const TRANSFORM = `translate(0, ${ORIG_W}) rotate(-90)`;

/* ── Dark-cockpit seat palette ────────────────────────────── */

const SEAT = {
  empty:       { fill: "rgba(0,0,0,0.35)",       stroke: "rgba(255,255,255,0.04)" },
  emptyHover:  { fill: "rgba(0,0,0,0.30)",       stroke: "rgba(255,255,255,0.08)" },
  filled:      { fill: "rgba(22,101,52,0.35)",   stroke: "rgba(34,197,94,0.25)" },
  filledHover: { fill: "rgba(22,101,52,0.45)",   stroke: "rgba(34,197,94,0.35)" },
  disabled:    { fill: "rgba(0,0,0,0.45)",        stroke: "rgba(255,255,255,0.02)" },
};

/* ── Component ────────────────────────────────────────────── */

export default function CabinSvg() {
  const { state, dispatch } = useAircraft();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<string | null>(null);
  const [editingZone, setEditingZone] = useState<Zone | NoseBagZone | null>(null);
  const [svgError, setSvgError] = useState(false);

  const isCargoMode = state.mode === "cargo";

  const visibleRectZones = (() => {
    const zones: Zone[] = [...NAV_ZONES];
    if (isCargoMode) {
      zones.push(
        ...SEAT_ZONES.filter((z) => z.id !== "seat_6_left" && z.id !== "seat_7_right"),
        ...RECT_BAGGAGE_ZONES,
      );
    } else {
      zones.push(
        ...SEAT_ZONES,
        ...RECT_BAGGAGE_ZONES.filter((z) => z.id !== "bag_rear_f"),
      );
    }
    return zones;
  })();

  const disabledZoneIds = new Set(
    isCargoMode ? ["seat_6_left", "seat_7_right"] : ["bag_rear_f"],
  );

  const handleRectClick = useCallback(
    (zone: Zone) => {
      if (disabledZoneIds.has(zone.id)) return;
      if (zone.type === "navigate" && zone.navTo) {
        navigate(zone.navTo);
        return;
      }
      setEditingZone(zone);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate, isCargoMode],
  );

  const handleNoseBagClick = useCallback(
    (zone: NoseBagZone) => setEditingZone(zone),
    [],
  );

  const handleSave = useCallback(
    (v: number) => {
      if (editingZone?.stateKey) {
        dispatch({ type: "SET_FIELD", field: editingZone.stateKey, value: v });
      }
    },
    [editingZone, dispatch],
  );

  const zoneValue = (zone: { stateKey?: keyof AircraftState }): number => {
    if (!zone.stateKey) return 0;
    return state[zone.stateKey] as number;
  };

  const seatColors = (zone: Zone, isHover: boolean) => {
    if (disabledZoneIds.has(zone.id)) return SEAT.disabled;
    const val = zoneValue(zone);
    if (val > 0) return isHover ? SEAT.filledHover : SEAT.filled;
    return isHover ? SEAT.emptyHover : SEAT.empty;
  };

  if (svgError) {
    return (
      <div className="flex items-center justify-center h-48 rounded-xl border-2 border-dashed border-[var(--panel-border)] text-[var(--text-muted)]">
        Provide cabin.svg file
      </div>
    );
  }

  return (
    <>
      <div style={{ width: "100%" }}>
        <svg
          viewBox={VIEW_BOX}
          preserveAspectRatio="xMidYMid meet"
          className="block w-full h-auto"
        >
          <defs>
            <filter id="seat-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="blur" />
              <feFlood floodColor="#22c55e" floodOpacity="0.25" result="color" />
              <feComposite in="color" in2="blur" operator="in" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g transform={TRANSFORM}>
            <image
              href="/cabin.svg"
              x="0"
              y="0"
              width={ORIG_W}
              height={ORIG_H}
              onError={() => setSvgError(true)}
            />

            {/* ── Nose baggage: dot indicators ── */}
            {NOSE_BAG_ZONES.map((nb) => {
              const isHover = hovered === nb.id;
              const val = zoneValue(nb);
              const dotR = 22;
              const dotColor = val > 0 ? "#22c55e" : "#60a5fa";

              return (
                <g key={nb.id}>
                  <path
                    d={nb.d}
                    fill="transparent"
                    stroke="transparent"
                    strokeWidth={30}
                    pointerEvents="all"
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHovered(nb.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => handleNoseBagClick(nb)}
                  />
                  <circle
                    cx={nb.labelX}
                    cy={nb.labelY}
                    r={isHover ? dotR + 4 : dotR}
                    fill={dotColor}
                    opacity={isHover ? 0.9 : 0.7}
                    pointerEvents="all"
                    style={{ cursor: "pointer", transition: "r 0.15s, opacity 0.15s" }}
                    onMouseEnter={() => setHovered(nb.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => handleNoseBagClick(nb)}
                  />
                  <text
                    x={nb.labelX}
                    y={nb.labelY + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize={18}
                    fontWeight={700}
                    pointerEvents="none"
                  >
                    {val > 0 ? val : "0"}
                  </text>

                  {state.debugZones && (
                    <path
                      d={nb.d}
                      fill="none"
                      stroke="red"
                      strokeWidth={3}
                      strokeDasharray="12 6"
                      pointerEvents="none"
                    />
                  )}
                </g>
              );
            })}

            {/* ── Rect-based zones (seats, rear bag) ── */}
            {visibleRectZones.map((zone) => {
              const isHover = hovered === zone.id;
              const disabled = disabledZoneIds.has(zone.id);
              const val = zoneValue(zone);
              const c = seatColors(zone, isHover);
              const useGlow = val > 0 && !disabled;

              return (
                <g key={zone.id} filter={useGlow ? "url(#seat-glow)" : undefined}>
                  <rect
                    x={zone.x}
                    y={zone.y}
                    width={zone.w}
                    height={zone.h}
                    rx={14}
                    ry={14}
                    fill={c.fill}
                    stroke={c.stroke}
                    strokeWidth={isHover ? 2.5 : 1.5}
                    style={{
                      cursor: disabled ? "not-allowed" : "pointer",
                      transition: "fill 0.2s, stroke 0.2s, stroke-width 0.2s",
                    }}
                    onMouseEnter={() => setHovered(zone.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => handleRectClick(zone)}
                  />

                  {val > 0 && (
                    <text
                      x={zone.x + zone.w / 2}
                      y={zone.y + zone.h / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="rgba(187,247,208,0.90)"
                      fontSize={26}
                      fontWeight={600}
                      pointerEvents="none"
                    >
                      {val}
                    </text>
                  )}

                  {zone.type === "navigate" && (
                    <text
                      x={zone.x + zone.w / 2}
                      y={zone.y + zone.h / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="rgba(147,197,253,0.9)"
                      fontSize={zone.id === "zone_fuel" ? 18 : 22}
                      fontWeight={600}
                      pointerEvents="none"
                    >
                      {zone.label} →
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {editingZone && (
        <Modal
          title={editingZone.label}
          value={zoneValue(editingZone)}
          max={editingZone.max}
          onSave={handleSave}
          onClose={() => setEditingZone(null)}
        />
      )}
    </>
  );
}
