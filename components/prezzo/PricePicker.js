'use client';

import { useEffect, useRef, useState } from 'react';
import { SLIDER_STEPS, bigFontSize, formatPrice, priceToSlider, sliderToPrice, stepPrice } from '@/lib/prezzo';

const STEPS = [
  { pct: -0.1, label: '−10%' },
  { pct: -0.01, label: '−1%' },
  { pct: 0.01, label: '+1%' },
  { pct: 0.1, label: '+10%' },
];

function buzz(ms = 8) {
  try { navigator.vibrate?.(ms); } catch { /* non supportato */ }
}

// Slider in scala logaritmica per avvicinarsi in fretta (da pochi euro a
// miliardi), pulsanti ±1%/±10% per rifinire. Controllato: il valore lo tiene
// la pagina, che lo invia alla conferma.
export default function PricePicker({ range, unit, value, onChange, disabled }) {
  const [bump, setBump] = useState(0);
  const holdRef = useRef(null);

  function stopHold() {
    if (holdRef.current) { clearTimeout(holdRef.current); holdRef.current = null; }
  }
  useEffect(() => stopHold, []);
  useEffect(() => { if (disabled) stopHold(); }, [disabled]);

  // Durante la pressione prolungata la closure del timer vedrebbe un `value`
  // vecchio: si legge sempre quello aggiornato da qui.
  const valueRef = useRef(value);
  valueRef.current = value;
  function stepLatest(pct) {
    const next = stepPrice(valueRef.current, pct, range);
    if (next !== valueRef.current) { valueRef.current = next; onChange(next); buzz(); setBump((b) => b + 1); }
  }

  // Tenendo premuto un pulsante il valore continua a scorrere.
  function startHold(pct) {
    stopHold();
    stepLatest(pct);
    holdRef.current = setTimeout(function repeat() {
      stepLatest(pct);
      holdRef.current = setTimeout(repeat, 90);
    }, 380);
  }

  function onKeyDown(e) {
    const map = { ArrowLeft: -0.01, ArrowDown: -0.01, ArrowRight: 0.01, ArrowUp: 0.01, PageDown: -0.1, PageUp: 0.1 };
    if (map[e.key]) { e.preventDefault(); stepLatest(map[e.key]); }
  }

  const shown = formatPrice(value, unit);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
      <div key={bump} className={`anno-year-big prezzo-big${bump ? ' bump' : ''}`} style={{ fontSize: bigFontSize(shown) }} aria-live="polite">{shown}</div>
      <div>
        <input
          className="anno-slider"
          type="range"
          min={0}
          max={SLIDER_STEPS}
          step={1}
          value={priceToSlider(value, range)}
          disabled={disabled}
          aria-label="Prezzo"
          aria-valuetext={formatPrice(value, unit)}
          onChange={(e) => onChange(sliderToPrice(Number(e.target.value), range))}
          onKeyDown={onKeyDown}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6b7280', marginTop: 6 }}>
          <span>{formatPrice(range.min, unit)}</span>
          <span>{formatPrice(range.max, unit)}</span>
        </div>
      </div>
      <div className="anno-steps prezzo-steps">
        {STEPS.map(({ pct, label }) => (
          <button
            key={pct}
            type="button"
            className="btn-3d"
            disabled={disabled || (pct < 0 ? value <= range.min : value >= range.max)}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.currentTarget.setPointerCapture?.(e.pointerId);
              startHold(pct);
            }}
            onPointerUp={stopHold}
            onPointerCancel={stopHold}
            onLostPointerCapture={stopHold}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stepLatest(pct); } }}
            onContextMenu={(e) => e.preventDefault()}
            style={{ background: pct < 0 ? '#111827' : undefined, touchAction: 'manipulation', userSelect: 'none', WebkitUserSelect: 'none' }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
