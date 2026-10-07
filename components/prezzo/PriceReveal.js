'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Confetti from '@/components/anno/Confetti';
import { bigFontSize, formatOff, formatPrice } from '@/lib/prezzo';

// Come il reveal di Indovina l'Anno, ma su un asse logaritmico:
//   0     i nomi dei giocatori cadono sui loro prezzi
//   1300  il prezzo vero sale dal bordo sinistro
//   2600  la bandierina atterra con uno scossone, il più vicino si illumina, coriandoli
//   3300  nota, fonte e punti
const STAGE_AT = [0, 1300, 2600, 3300];
const COUNT_MS = 1200;

const LANE_H = 24;      // distanza verticale tra le corsie delle etichette
const AXIS_BOTTOM = 26; // spazio per le tacche sotto l'asse
const LABEL_GAP = 4;    // px minimi tra due etichette sulla stessa corsia
const MAX_LANES = 6;
const TICK_PX = 80;     // spazio minimo per l'etichetta di una tacca ("500 mln")

// Tacche "1, 2, 5" per decade; se sono troppe solo le potenze di dieci,
// e se sono ancora troppe una sì e una no.
function logTicks(min, max, maxTicks) {
  const all = [];
  for (let exp = Math.floor(Math.log10(min)); 10 ** exp <= max; exp++) {
    for (const m of [1, 2, 5]) {
      const v = Number((m * 10 ** exp).toPrecision(6));
      if (v >= min && v <= max) all.push({ v, m });
    }
  }
  if (all.length <= maxTicks) return all.map((t) => t.v);
  let decades = all.filter((t) => t.m === 1).map((t) => t.v);
  while (decades.length > maxTicks) decades = decades.filter((_, i) => i % 2 === 0);
  return decades;
}

// Larghezza stimata di un'etichetta (font 10px grassetto + padding): basta a
// decidere le corsie senza misurare il DOM a ogni render.
function labelWidth(text) {
  return Math.ceil(text.length * 6.3) + 16;
}

// Posizione orizzontale di un'etichetta centrata su `x` ma tenuta dentro
// [0, width]. Restituisce il bordo sinistro e lo spostamento rispetto al centro.
function placeLabel(x, w, width) {
  const left = Math.min(Math.max(x - w / 2, 0), Math.max(0, width - w));
  return { left, shift: left - (x - w / 2) };
}

function buzz(pattern) {
  try { navigator.vibrate?.(pattern); } catch { /* non supportato */ }
}

export default function PriceReveal({ reveal, players, playerId }) {
  const { range, price, unit, results, winnerIds } = reveal;
  const logSpan = Math.log(range.max / range.min);
  const pctOf = (v) => (Math.log(v / range.min) / logSpan) * 100;

  const [stage, setStage] = useState(0);
  const [counter, setCounter] = useState(range.min);
  const [width, setWidth] = useState(320);
  const axisRef = useRef(null);

  useEffect(() => {
    const el = axisRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width || 320));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setStage(3); return undefined; }
    const timers = STAGE_AT.slice(1).map((ms, i) => setTimeout(() => setStage(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  // Il prezzo che sale: parte dal bordo sinistro e rallenta arrivando a quello
  // vero. Sale in scala logaritmica, come l'asse.
  useEffect(() => {
    if (stage !== 1) return undefined;
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / COUNT_MS);
      const eased = 1 - (1 - k) ** 3;
      setCounter(range.min * (price / range.min) ** eased);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage, range.min, price]);

  const iWon = winnerIds.includes(playerId);
  useEffect(() => {
    if (stage === 2 && iWon) buzz([30, 60, 30]);
  }, [stage, iWon]);

  const nameOf = useMemo(() => {
    const map = new Map(players.map((p) => [p.id, p.name]));
    return (id) => map.get(id) || 'Giocatore';
  }, [players]);

  // Etichette su più corsie quando si toccherebbero.
  const markers = useMemo(() => {
    const sorted = [...results].sort((a, b) => a.guess - b.guess);
    const laneRight = [];
    return sorted.map((r, i) => {
      const pct = pctOf(r.guess);
      const text = `${nameOf(r.playerId).slice(0, 10)} · ${formatPrice(r.guess)}`;
      // Spazio per la corona già riservato: compare solo quando atterra la bandierina.
      const w = labelWidth(text) + (winnerIds.includes(r.playerId) ? 16 : 0);
      const { left, shift } = placeLabel((pct / 100) * width, w, width);
      let lane = laneRight.findIndex((right) => right + LABEL_GAP <= left);
      if (lane === -1) {
        if (laneRight.length < MAX_LANES) lane = laneRight.length;
        else lane = laneRight.indexOf(Math.min(...laneRight));
      }
      laneRight[lane] = left + w;
      return { ...r, pct, lane, order: i, text, shift };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, winnerIds, range.min, range.max, width, nameOf]);

  const lanes = Math.max(1, ...markers.map((m) => m.lane + 1));
  const poleHeight = 12 + lanes * LANE_H + 18;
  const height = AXIS_BOTTOM + 4 + poleHeight + 30;

  // Le etichette delle tacche sui bordi uscirebbero dallo schermo.
  const ticks = logTicks(range.min, range.max, Math.max(2, Math.floor(width / TICK_PX))).filter((v) => pctOf(v) >= 5 && pctOf(v) <= 95);
  const pricePct = pctOf(price);
  const exactPrice = formatPrice(price, unit, { exact: true });
  // Nel contatore grande milioni e miliardi a tre cifre ("36,9 mln €"): la
  // cifra esatta sta sulla bandierina e nella nota.
  const landedPrice = formatPrice(price, unit, { exact: price < 1e6 });
  const counterText = stage === 0 ? '???' : stage >= 2 ? landedPrice : formatPrice(counter, unit);
  const flag = placeLabel((pricePct / 100) * width, labelWidth(`📍 ${exactPrice}`) + 8, width);

  const answeredIds = new Set(results.map((r) => r.playerId));
  const silent = players.filter((p) => !answeredIds.has(p.id));
  const landed = stage >= 2;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
      <div style={{ marginTop: 4, fontSize: bigFontSize(counterText, 48) }} className={`anno-counter prezzo-counter${landed ? ' landed' : ''}`} key={landed ? 'landed' : 'rolling'}>
        {counterText}
      </div>

      <div className={landed ? 'anno-shake' : ''} style={{ padding: '0 4px', overflowX: 'clip' }}>
        <div className="anno-timeline" ref={axisRef} style={{ height }}>
          <div className="anno-axis" style={{ bottom: AXIS_BOTTOM }} />
          {ticks.map((v) => (
            <span key={v} className="anno-tick" style={{ left: `${pctOf(v)}%`, bottom: 4 }}>{formatPrice(v)}</span>
          ))}

          {markers.map((m) => {
            const win = landed && winnerIds.includes(m.playerId);
            const dim = landed && !win;
            return (
              <div
                key={m.playerId}
                className={`anno-marker${m.playerId === playerId ? ' me' : ''}${win ? ' win' : ''}${dim ? ' dim' : ''}`}
                style={{ left: `${m.pct}%`, bottom: AXIS_BOTTOM + 4, animationDelay: `${m.order * 90}ms` }}
              >
                <span className="label" style={{ '--shift': `${m.shift}px` }}>{win ? '👑 ' : ''}{m.text}</span>
                <span className="stem" style={{ height: 8 + m.lane * LANE_H }} />
              </div>
            );
          })}

          {landed && (
            <>
              <div className="anno-pin" style={{ left: `${pricePct}%`, bottom: AXIS_BOTTOM }}>
                <span className="flag" style={{ '--shift': `${flag.shift}px` }}>📍 {exactPrice}</span>
                <span className="pole" style={{ height: poleHeight }} />
              </div>
              <span className="anno-ring" style={{ left: `${pricePct}%`, bottom: AXIS_BOTTOM - 13 }} />
            </>
          )}
        </div>
      </div>

      {landed && winnerIds.length > 0 && <Confetti count={iWon ? 90 : 40} />}

      {stage >= 3 && (
        <div className="fade-up" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
          <div className="prezzo-note">
            <p className="title">{reveal.title}</p>
            {reveal.note && <p className="text">{reveal.note}</p>}
            {reveal.source && <p className="source">Fonte: {reveal.source}</p>}
          </div>

          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6 }}>
            {results.map((r, i) => (
              <li
                key={r.playerId}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, fontSize: 12,
                  background: r.winner ? 'rgba(251,191,36,0.22)' : 'rgba(17,24,39,0.04)',
                  border: r.playerId === playerId ? '2px solid #4f46e5' : '2px solid transparent',
                  color: '#111827',
                }}
              >
                <span style={{ width: 22, textAlign: 'center' }}>{r.winner ? '👑' : `${i + 1}.`}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {nameOf(r.playerId)}{r.playerId === playerId ? ' (tu)' : ''}
                  </span>
                  <span className="prezzo-result-guess">
                    {formatPrice(r.guess, unit)} ·{' '}
                    <span style={{ color: r.exact ? '#059669' : r.offPct > 0 ? '#b45309' : '#2563eb', fontWeight: 700 }}>
                      {r.exact ? '🎯 esatto' : formatOff(r.guess, price)}
                    </span>
                  </span>
                </span>
                <span className="anno-points" style={{ width: 48, textAlign: 'right', fontWeight: 800, color: r.points ? '#4f46e5' : '#9ca3af', animationDelay: `${i * 80}ms` }}>
                  +{r.points}
                </span>
              </li>
            ))}
            {silent.map((p) => (
              <li key={p.id} style={{ display: 'flex', gap: 8, padding: '6px 10px', fontSize: 11, color: '#9ca3af' }}>
                <span style={{ width: 22 }} />
                <span style={{ flex: 1 }}>{p.name}{p.id === playerId ? ' (tu)' : ''}</span>
                <span>non ha risposto</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
