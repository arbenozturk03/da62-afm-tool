import { useState, useEffect, useRef, type KeyboardEvent, type FormEvent, type RefObject } from "react";

interface ModalProps {
  title: string;
  value: number;
  unit?: string;
  max?: number;
  maxWarning?: string;
  onSave: (v: number) => void;
  onClose: () => void;
  /** Ref attached to inner content div so scroll lock can allow touch inside modal. */
  contentRef?: RefObject<HTMLDivElement | null>;
}

export default function Modal({ title, value, unit = "kg", max, maxWarning, onSave, onClose, contentRef }: ModalProps) {
  const [local, setLocal] = useState(value);
  const [hitLimit, setHitLimit] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
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
    if (max != null) {
      if (val > max) {
        setHitLimit(true);
        val = max;
      } else {
        setHitLimit(false);
      }
    }
    setLocal(val);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        padding: 20,
        touchAction: "none",
      }}
      onClick={onClose}
      onKeyDown={handleKey}
    >
      <div
        ref={contentRef}
        style={{
          width: "100%",
          maxWidth: 240,
          borderRadius: 14,
          padding: 16,
          background: "var(--panel-bg)",
          border: "1px solid var(--panel-border)",
          boxShadow: "0 12px 40px rgba(0,0,0,.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, opacity: 0.7 }}>
          {title}
          {max != null && !maxWarning && (
            <span style={{ fontWeight: 400, opacity: 0.7 }}> (max {max})</span>
          )}
        </div>
        {maxWarning && hitLimit && (
          <div style={{ fontSize: 12, color: "#f87171", fontWeight: 600, marginBottom: 8 }}>
            {maxWarning}
          </div>
        )}

        <form
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            onClose();
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              min={0}
              max={max}
              step={0.1}
              value={local}
              onChange={(e) => handleChange(parseFloat(e.target.value) || 0)}
              onFocus={(e) => e.target.select()}
              style={{
                flex: 1,
                minWidth: 0,
                height: 42,
                borderRadius: 8,
                border: "1px solid var(--result-border)",
                background: "var(--result-bg)",
                color: "inherit",
                fontSize: 18,
                fontFamily: "inherit",
                textAlign: "center",
                outline: "none",
                padding: "0 8px",
              }}
            />
            <span style={{ fontSize: 12, opacity: 0.5, flexShrink: 0 }}>{unit}</span>
          </div>

          <button
            type="submit"
            style={{
              width: "100%",
              height: 40,
              marginTop: 10,
              borderRadius: 8,
              border: "none",
              background: "#22c55e",
              color: "#fff",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              lineHeight: 1,
            }}
            aria-label="Confirm"
          >
            ✓
          </button>
        </form>
      </div>
    </div>
  );
}
