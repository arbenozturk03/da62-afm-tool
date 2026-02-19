import { useState, useEffect, useRef, type KeyboardEvent } from "react";

interface ModalProps {
  title: string;
  value: number;
  unit?: string;
  max?: number;
  onSave: (v: number) => void;
  onClose: () => void;
}

const QUICK_STEPS = [1, 5, 10];

export default function Modal({ title, value, unit = "kg", max, onSave, onClose }: ModalProps) {
  const [local, setLocal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    onSave(Math.max(0, local));
  }, [local, onSave]);

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  const adjust = (delta: number) =>
    setLocal((v) => Math.max(0, Math.round((v + delta) * 100) / 100));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={handleKey}
    >
      <div
        className="w-80 rounded-xl p-5 shadow-2xl bg-[var(--panel-bg)] border border-[var(--panel-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center
                       text-[var(--text-muted)] hover:opacity-80
                       transition-colors text-lg leading-none"
            style={{ background: "transparent", border: "none", padding: 0 }}
          >
            ×
          </button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <input
            ref={inputRef}
            type="number"
            min={0}
            max={max}
            step={0.1}
            value={local}
            onChange={(e) => setLocal(Math.max(0, parseFloat(e.target.value) || 0))}
            onFocus={(e) => e.target.select()}
            className="flex-1 rounded-lg px-3 py-2 text-center text-lg font-mono
                       bg-[var(--result-bg)] border border-[var(--result-border)]
                       outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-[var(--text-muted)] w-8">{unit}</span>
        </div>

        {max != null && (
          <p className="text-xs text-[var(--text-muted)] mb-3 text-center">
            Max: {max} {unit}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          {QUICK_STEPS.map((s) => (
            <button
              key={`m${s}`}
              onClick={() => adjust(-s)}
              style={{
                background: "rgba(239,68,68,0.15)",
                color: "#f87171",
                padding: "6px 0",
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.25)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.15)")}
            >
              − {s}
            </button>
          ))}
          {QUICK_STEPS.map((s) => (
            <button
              key={`p${s}`}
              onClick={() => adjust(s)}
              style={{
                background: "rgba(34,197,94,0.15)",
                color: "#4ade80",
                padding: "6px 0",
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(34,197,94,0.25)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(34,197,94,0.15)")}
            >
              + {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
