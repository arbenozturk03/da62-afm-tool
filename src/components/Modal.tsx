import { useState, useEffect, useRef, type KeyboardEvent } from "react";

interface ModalProps {
  title: string;
  value: number;
  unit?: string;
  max?: number;
  onSave: (v: number) => void;
  onClose: () => void;
}

export default function Modal({ title, value, unit = "kg", max, onSave, onClose }: ModalProps) {
  const [local, setLocal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const clamped = max != null ? Math.min(Math.max(0, local), max) : Math.max(0, local);
    onSave(clamped);
  }, [local, max, onSave]);

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  const handleChange = (v: number) => {
    let val = Math.max(0, v);
    if (max != null) val = Math.min(val, max);
    setLocal(val);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={handleKey}
    >
      <div
        className="w-72 rounded-xl p-5 shadow-2xl bg-[var(--panel-bg)] border border-[var(--panel-border)]"
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

        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="number"
            min={0}
            max={max}
            step={0.1}
            value={local}
            onChange={(e) => handleChange(parseFloat(e.target.value) || 0)}
            onFocus={(e) => e.target.select()}
            className="flex-1 rounded-lg px-3 py-2 text-center text-lg font-mono
                       bg-[var(--result-bg)] border border-[var(--result-border)]
                       outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-[var(--text-muted)] w-8">{unit}</span>
        </div>

        {max != null && (
          <p className="text-xs text-[var(--text-muted)] mt-2 text-center">
            Max: {max} {unit}
          </p>
        )}
      </div>
    </div>
  );
}
