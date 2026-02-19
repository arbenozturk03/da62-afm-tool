import { useMemo } from "react";
import { envelope } from "../data/envelope";
import { useAircraft } from "../context/AircraftContext";

const PAD = { top: 30, right: 30, bottom: 50, left: 65 };
const W = 460;
const H = 320;
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

function scaleX(v: number): number {
  return PAD.left + ((v - envelope.xMin) / (envelope.xMax - envelope.xMin)) * INNER_W;
}

function scaleY(v: number): number {
  return PAD.top + (1 - (v - envelope.yMin) / (envelope.yMax - envelope.yMin)) * INNER_H;
}

export default function EnvelopeChart() {
  const { result, insideEnvelope, zfInsideEnvelope } = useAircraft();

  const polyPoints = useMemo(
    () => envelope.polygon.map((p) => `${scaleX(p.x)},${scaleY(p.y)}`).join(" "),
    [],
  );

  const xTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let v = Math.ceil(envelope.xMin * 100) / 100; v <= envelope.xMax; v = Math.round((v + 0.05) * 100) / 100) {
      ticks.push(v);
    }
    return ticks;
  }, []);

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let v = Math.ceil(envelope.yMin / 100) * 100; v <= envelope.yMax; v += 100) {
      ticks.push(v);
    }
    return ticks;
  }, []);

  const cgX = scaleX(result.cg);
  const cgY = scaleY(result.totalMass);
  const zfX = scaleX(result.zeroFuelCg);
  const zfY = scaleY(result.zeroFuelMass);

  const showCg = result.totalMass > 0;
  const showZf = result.zeroFuelMass > 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <rect width={W} height={H} rx={8} fill="var(--panel-bg)" />

      {/* Grid lines */}
      {xTicks.map((v) => (
        <line
          key={`xg${v}`}
          x1={scaleX(v)} y1={PAD.top}
          x2={scaleX(v)} y2={PAD.top + INNER_H}
          stroke="var(--panel-border)" strokeWidth={0.5}
        />
      ))}
      {yTicks.map((v) => (
        <line
          key={`yg${v}`}
          x1={PAD.left} y1={scaleY(v)}
          x2={PAD.left + INNER_W} y2={scaleY(v)}
          stroke="var(--panel-border)" strokeWidth={0.5}
        />
      ))}

      {/* Envelope polygon */}
      <polygon
        points={polyPoints}
        fill="rgba(34,197,94,0.12)"
        stroke="#22c55e"
        strokeWidth={2}
      />

      {/* Axes */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + INNER_H} stroke="var(--text-muted)" strokeWidth={1} />
      <line x1={PAD.left} y1={PAD.top + INNER_H} x2={PAD.left + INNER_W} y2={PAD.top + INNER_H} stroke="var(--text-muted)" strokeWidth={1} />

      {/* X-axis labels */}
      {xTicks.map((v) => (
        <text
          key={`xl${v}`}
          x={scaleX(v)} y={PAD.top + INNER_H + 18}
          textAnchor="middle" fontSize={10} fill="var(--text-muted)"
        >
          {v.toFixed(2)}
        </text>
      ))}
      <text
        x={PAD.left + INNER_W / 2} y={H - 6}
        textAnchor="middle" fontSize={11} fill="var(--text-secondary)"
      >
        {envelope.xLabel}
      </text>

      {/* Y-axis labels */}
      {yTicks.map((v) => (
        <text
          key={`yl${v}`}
          x={PAD.left - 8} y={scaleY(v) + 3}
          textAnchor="end" fontSize={10} fill="var(--text-muted)"
        >
          {v}
        </text>
      ))}
      <text
        x={14} y={PAD.top + INNER_H / 2}
        textAnchor="middle" fontSize={11} fill="var(--text-secondary)"
        transform={`rotate(-90, 14, ${PAD.top + INNER_H / 2})`}
      >
        {envelope.yLabel}
      </text>

      {/* Zero-fuel point */}
      {showZf && (
        <>
          <circle cx={zfX} cy={zfY} r={5} fill={zfInsideEnvelope ? "#3b82f6" : "#ef4444"} stroke="white" strokeWidth={1.5} />
          <text x={zfX + 10} y={zfY - 8} fontSize={10} fill={zfInsideEnvelope ? "#93c5fd" : "#fca5a5"}>
            ZFW
          </text>
        </>
      )}

      {/* CG point (takeoff) */}
      {showCg && (
        <>
          <circle cx={cgX} cy={cgY} r={6} fill={insideEnvelope ? "#22c55e" : "#ef4444"} stroke="white" strokeWidth={2} />
          <text x={cgX + 10} y={cgY - 8} fontSize={11} fontWeight={600} fill={insideEnvelope ? "#86efac" : "#fca5a5"}>
            T/O
          </text>
        </>
      )}
    </svg>
  );
}
