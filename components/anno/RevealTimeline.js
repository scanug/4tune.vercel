'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Confetti from './Confetti';

// Sequenza del reveal (ms dal montaggio):
//   0     i nomi dei giocatori cadono sui loro anni
//   1300  l'anno vero rulla da un estremo all'altro
//   2600  la bandierina atterra con uno scossone, il più vicino si illumina, coriandoli
//   3300  foto, descrizione e punti
const STAGE_AT = [0, 1300, 2600, 3300];
const COUNT_MS = 1200;

const LANE_H = 24;      // distanza verticale tra le corsie delle etichette
const AXIS_BOTTOM = 26; // spazio per le tacche sotto l'asse
const LABEL_GAP = 4;    // px minimi tra due etichette sulla stessa corsia
const MAX_LANES = 6;

function tickStep(span) {
  return [5, 10, 20, 25, 50, 100].find((s) => span / s <= 6) || 100;
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

export default function RevealTimeline({ reveal, players, playerId }) {
  const { range, year, results, winnerIds } = reveal;
  const span = range.max - range.min;
  const pctOf = (y) => ((y - range.min) / span) * 100;

  const [stage, setStage] = useState(0);
  const [counter, setCounter] = useState(range.min);
  const [photoOk, setPhotoOk] = useState(true);
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

  // L'anno che rulla: parte dal bordo sinistro e rallenta arrivando a quello vero.
  useEffect(() => {
    if (stage !== 1) return undefined;
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / COUNT_MS);
      const eased = 1 - (1 - k) ** 3;
      setCounter(Math.round(range.min + (year - range.min) * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage, range.min, year]);

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
      const text = `${nameOf(r.playerId).slice(0, 10)} · ${r.guess}`;
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

  const step = tickStep(span);
  const ticks = [];
  for (let y = Math.ceil(range.min / step) * step; y <= range.max; y += step) {
    // Le etichette delle tacche sui bordi uscirebbero dallo schermo.
    const pct = pctOf(y);
    if (pct >= 5 && pct <= 95) ticks.push(y);
  }
  const yearPct = pctOf(year);
  const flag = placeLabel((yearPct / 100) * width, labelWidth(`📍 ${year}`) + 8, width);

  const answeredIds = new Set(results.map((r) => r.playerId));
  const silent = players.filter((p) => !answeredIds.has(p.id));
  const landed = stage >= 2;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
      <div style={{ marginTop: 4 }} className={`anno-counter${landed ? ' landed' : ''}`} key={landed ? 'landed' : 'rolling'}>
        {stage === 0 ? '????' : landed ? year : counter}
      </div>

      <div className={landed ? 'anno-shake' : ''} style={{ padding: '0 4px', overflowX: 'clip' }}>
        <div className="anno-timeline" ref={axisRef} style={{ height }}>
          <div className="anno-axis" style={{ bottom: AXIS_BOTTOM }} />
          {ticks.map((y) => (
            <span key={y} className="anno-tick" style={{ left: `${pctOf(y)}%`, bottom: 4 }}>{y}</span>
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
              <div className="anno-pin" style={{ left: `${yearPct}%`, bottom: AXIS_BOTTOM }}>
                <span className="flag" style={{ '--shift': `${flag.shift}px` }}>📍 {year}</span>
                <span className="pole" style={{ height: poleHeight }} />
              </div>
              <span className="anno-ring" style={{ left: `${yearPct}%`, bottom: AXIS_BOTTOM - 13 }} />
            </>
          )}
        </div>
      </div>

      {landed && winnerIds.length > 0 && <Confetti count={iWon ? 90 : 40} />}

      {stage >= 3 && (
        <div className="fade-up" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 12, borderRadius: 12, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}>
            {reveal.image && photoOk && (
              <a href={reveal.image.credit} target="_blank" rel="noreferrer" title="Foto da Wikimedia Commons" style={{ flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="anno-photo"
                  src={reveal.image.url}
                  alt={reveal.title}
                  onError={() => setPhotoOk(false)}
                  style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 12, background: '#e5e7eb', display: 'block' }}
                />
              </a>
            )}
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 700, color: '#111827', fontSize: 13 }}>{reveal.title}</p>
              {reveal.description && (
                <p style={{ margin: '6px 0 0', color: '#4b5563', fontSize: 12, fontFamily: 'var(--font-geist-sans), Arial, sans-serif', letterSpacing: 0 }}>{reveal.description}</p>
              )}
              {reveal.wikiUrl && (
                <a href={reveal.wikiUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 6, fontSize: 10, color: '#4f46e5' }}>Leggi su Wikipedia ↗</a>
              )}
            </div>
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
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {nameOf(r.playerId)}{r.playerId === playerId ? ' (tu)' : ''}
                </span>
                <span style={{ color: '#4b5563' }}>{r.guess}</span>
                <span style={{ width: 64, textAlign: 'right', color: r.exact ? '#059669' : '#6b7280' }}>
                  {r.exact ? '🎯 esatto' : `±${r.distance}`}
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
