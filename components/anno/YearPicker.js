'use client';

import { useEffect, useRef, useState } from 'react';

const STEPS = [-10, -1, 1, 10];

function buzz(ms = 8) {
  try { navigator.vibrate?.(ms); } catch { /* non supportato */ }
}

// Slider per avvicinarsi in fretta, pulsanti ±1/±10 per rifinire.
// Controllato: il valore lo tiene la pagina, che lo invia alla conferma.
export default function YearPicker({ range, value, onChange, disabled }) {
  const [bump, setBump] = useState(0);
  const holdRef = useRef(null);

  const clampYear = (y) => Math.min(range.max, Math.max(range.min, y));

  function stopHold() {
    if (holdRef.current) { clearTimeout(holdRef.current); holdRef.current = null; }
  }
  useEffect(() => stopHold, []);
  useEffect(() => { if (disabled) stopHold(); }, [disabled]);

  // Durante la pressione prolungata la closure del timer vedrebbe un `value`
  // vecchio: si legge sempre quello aggiornato da qui.
  const valueRef = useRef(value);
  valueRef.current = value;
  function stepLatest(delta) {
    const next = clampYear(valueRef.current + delta);
    if (next !== valueRef.current) { valueRef.current = next; onChange(next); buzz(); setBump((b) => b + 1); }
  }

  // Tenendo premuto un pulsante il valore continua a scorrere.
  function startHold(delta) {
    stopHold();
    stepLatest(delta);
    holdRef.current = setTimeout(function repeat() {
      stepLatest(delta);
      holdRef.current = setTimeout(repeat, 90);
    }, 380);
  }

  function onKeyDown(e) {
    const map = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 };
    if (map[e.key]) { e.preventDefault(); stepLatest(map[e.key]); }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div key={bump} className={`anno-year-big${bump ? ' bump' : ''}`} aria-live="polite">{value}</div>
      <div>
        <input
          className="anno-slider"
          type="range"
          min={range.min}
          max={range.max}
          step={1}
          value={value}
          disabled={disabled}
          aria-label="Anno"
          onChange={(e) => onChange(Number(e.target.value))}
          onKeyDown={onKeyDown}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6b7280', marginTop: 6 }}>
          <span>{range.min}</span>
          <span>{range.max}</span>
        </div>
      </div>
      <div className="anno-steps">
        {STEPS.map((d) => (
          <button
            key={d}
            type="button"
            className="btn-3d"
            disabled={disabled || (d < 0 ? value <= range.min : value >= range.max)}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.currentTarget.setPointerCapture?.(e.pointerId);
              startHold(d);
            }}
            onPointerUp={stopHold}
            onPointerCancel={stopHold}
            onLostPointerCapture={stopHold}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stepLatest(d); } }}
            onContextMenu={(e) => e.preventDefault()}
            style={{ background: d < 0 ? '#111827' : undefined, touchAction: 'manipulation', userSelect: 'none', WebkitUserSelect: 'none' }}
          >
            {d > 0 ? `+${d}` : d}
          </button>
        ))}
      </div>
    </div>
  );
}
