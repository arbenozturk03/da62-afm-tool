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

/**
 * Coordinates in the ORIGINAL (pre-rotation) SVG space.
 * viewBox = "0 0 3406.606 581.918"
 *
 * Nose → RIGHT (high x)   Tail → LEFT (low x)
 * LH  → TOP (low y)       RH  → BOTTOM (high y)
 *
 * After -90° CCW rotation the nose points UP.
 */

const SEAT_ZONES: Zone[] = [
  { id: "seat_1_left", label: "Seat 1 (L)", x: 1975, y: 76, w: 275, h: 174, type: "seat", stateKey: "seat1" },
  { id: "seat_2_right", label: "Seat 2 (R)", x: 1975, y: 337, w: 275, h: 174, type: "seat", stateKey: "seat2" },

  { id: "seat_3_left", label: "Seat 3 (L)", x: 1598, y: 35, w: 275, h: 170, type: "seat", stateKey: "seat3" },
  { id: "seat_4_middle", label: "Seat 4 (M)", x: 1598, y: 205, w: 275, h: 170, type: "seat", stateKey: "seat4" },
  { id: "seat_5_right", label: "Seat 5 (R)", x: 1598, y: 375, w: 275, h: 170, type: "seat", stateKey: "seat5" },

  { id: "seat_6_left", label: "Seat 6 (L)", x: 1218, y: 122, w: 275, h: 174, type: "seat", stateKey: "seat6" },
  { id: "seat_7_right", label: "Seat 7 (R)", x: 1218, y: 296, w: 275, h: 174, type: "seat", stateKey: "seat7" },
];

// Nose baggage: path-based (not rect) to follow the curved fuselage skin
const NOSE_BAG_ZONES: NoseBagZone[] = [
  { id: "bag_lh_nose", label: "LH Nose", d: NOSE_BAG_LH, labelX: 2870, labelY: 170, stateKey: "lhNoseKg", max: aircraftConfig.baggageLimits.lhNose },
  { id: "bag_rh_nose", label: "RH Nose", d: NOSE_BAG_RH, labelX: 2870, labelY: 420, stateKey: "rhNoseKg", max: aircraftConfig.baggageLimits.rhNose },
];

// Rear baggage only (nose bags handled separately via paths)
const RECT_BAGGAGE_ZONES: Zone[] = [
  { id: "bag_rear_f", label: "Rear Cargo F", x: 1218, y: 122, w: 275, h: 348, type: "baggage", stateKey: "rearFKg", max: aircraftConfig.baggageLimits.rearF },
];

// Fuel / De-Ice overlays removed from the cabin view – navigation only via top tabs
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

/* ── Component ────────────────────────────────────────────── */

export default function CabinSvg() {
  const { state, dispatch } = useAircraft();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<string | null>(null);
  const [editingZone, setEditingZone] = useState<Zone | NoseBagZone | null>(null);
  const [svgError, setSvgError] = useState(false);

  const isCargoMode = state.mode === "cargo";

  /* ── rect-based zones (seats, rear bag) ── */
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

  const fillForZone = (zone: Zone, isHover: boolean): string => {
    const disabled = disabledZoneIds.has(zone.id);
    if (disabled) return "rgba(100,100,100,0.25)";
    const val = zoneValue(zone);
    if (zone.type === "navigate")
      return isHover ? "rgba(59,130,246,0.30)" : "rgba(59,130,246,0.10)";
    if (val > 0)
      return isHover ? "rgba(34,197,94,0.40)" : "rgba(34,197,94,0.20)";
    return isHover ? "rgba(59,130,246,0.30)" : "rgba(59,130,246,0.08)";
  };

  const noseBagFill = (zone: NoseBagZone, isHover: boolean): string => {
    const val = zoneValue(zone);
    if (val > 0)
      return isHover ? "rgba(34,197,94,0.40)" : "rgba(34,197,94,0.20)";
    return isHover ? "rgba(59,130,246,0.30)" : "rgba(59,130,246,0.08)";
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
      <div className="mx-auto lg:mx-0 max-h-[60vh] lg:max-h-none overflow-y-auto overflow-x-hidden rounded-lg w-full max-w-[300px] lg:max-w-none">
        <svg
          viewBox={VIEW_BOX}
          preserveAspectRatio="xMidYMid meet"
          className="block w-full h-auto"
        >
          <g transform={TRANSFORM}>
            <image
              href="/cabin.svg"
              x="0"
              y="0"
              width={ORIG_W}
              height={ORIG_H}
              onError={() => setSvgError(true)}
            />

            {/* ── Nose baggage: path-based ── */}
            {NOSE_BAG_ZONES.map((nb) => {
              const isHover = hovered === nb.id;
              const val = zoneValue(nb);

              return (
                <g key={nb.id}>
                  {/* Invisible hit area (generous stroke for easier clicking) */}
                  <path
                    d={nb.d}
                    fill="transparent"
                    stroke="transparent"
                    strokeWidth={20}
                    pointerEvents="stroke"
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHovered(nb.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => handleNoseBagClick(nb)}
                  />

                  {/* Visible highlight */}
                  <path
                    d={nb.d}
                    fill={noseBagFill(nb, isHover)}
                    stroke={isHover ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.15)"}
                    strokeWidth={isHover ? 4 : 2}
                    pointerEvents="fill"
                    style={{ cursor: "pointer", transition: "fill 0.15s, stroke 0.15s" }}
                    onMouseEnter={() => setHovered(nb.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => handleNoseBagClick(nb)}
                  />

                  {/* Debug: red outline */}
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

                  {/* Debug label */}
                  {state.showDebugLabels && (
                    <text
                      x={nb.labelX}
                      y={nb.labelY - 16}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="yellow"
                      fontSize={24}
                      fontWeight={700}
                      pointerEvents="none"
                    >
                      {nb.id}
                    </text>
                  )}

                  {/* Value label */}
                  {val > 0 && (
                    <text
                      x={nb.labelX}
                      y={nb.labelY + (state.showDebugLabels ? 16 : 0)}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="white"
                      fontSize={28}
                      fontWeight={600}
                      pointerEvents="none"
                      style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}
                    >
                      {val} kg
                    </text>
                  )}
                </g>
              );
            })}

            {/* ── Rect-based zones (seats, rear bag, nav) ── */}
            {visibleRectZones.map((zone) => {
              const isHover = hovered === zone.id;
              const disabled = disabledZoneIds.has(zone.id);

              return (
                <g key={zone.id}>
                  <rect
                    x={zone.x}
                    y={zone.y}
                    width={zone.w}
                    height={zone.h}
                    rx={14}
                    ry={14}
                    fill={fillForZone(zone, isHover)}
                    stroke={isHover ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.15)"}
                    strokeWidth={isHover ? 4 : 2}
                    style={{
                      cursor: disabled ? "not-allowed" : "pointer",
                      transition: "fill 0.15s, stroke 0.15s",
                    }}
                    onMouseEnter={() => setHovered(zone.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => handleRectClick(zone)}
                  />

                  {state.showDebugLabels && (
                    <text
                      x={zone.x + zone.w / 2}
                      y={zone.y + zone.h / 2 - 10}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="yellow"
                      fontSize={24}
                      fontWeight={700}
                      pointerEvents="none"
                    >
                      {zone.id}
                    </text>
                  )}

                  {zoneValue(zone) > 0 && (
                    <text
                      x={zone.x + zone.w / 2}
                      y={zone.y + zone.h / 2 + (state.showDebugLabels ? 16 : 0)}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="white"
                      fontSize={28}
                      fontWeight={600}
                      pointerEvents="none"
                      style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}
                    >
                      {zoneValue(zone)} kg
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
