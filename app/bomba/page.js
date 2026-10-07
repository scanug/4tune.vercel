'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PixelIcon from '@/components/PixelIcon';
import { BOMBA_CATEGORIES, BOMBA_SYLLABLES, BOMBA_FUSES } from '@/lib/bombaPrompts';
import { isAudioMuted } from '@/lib/chiptune';
import { recordBombaRound } from '@/lib/stats';
import { useMusicSuppressed } from '@/components/MusicController';

const STORAGE_KEY = 'bomba_config';

const MODES = [
  { id: 'categorie', label: 'Categorie' },
  { id: 'sillabe', label: 'Sillabe' },
];
const FUSES = [
  { id: 'corta', label: 'Corta' },
  { id: 'media', label: 'Media' },
  { id: 'lunga', label: 'Lunga' },
];

// Una voce per riga, senza doppioni né righe vuote.
function parseLines(text, upper) {
  const seen = new Set();
  return String(text || '').split('\n')
    .map((l) => l.trim().slice(0, 60))
    .map((l) => (upper ? l.toUpperCase() : l))
    .filter((l) => l && !seen.has(l.toLowerCase()) && seen.add(l.toLowerCase()))
    .slice(0, 200);
}

function shuffledIndexes(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Suoni 8-bit con WebAudio: il contesto nasce al primo tocco (serve su iOS).
function useBombaAudio() {
  const ctxRef = useRef(null);

  const unlock = useCallback(() => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctxRef.current = new AC();
    }
    ctxRef.current?.resume?.();
  }, []);

  const tick = useCallback((urgent) => {
    const ctx = ctxRef.current;
    if (!ctx || isAudioMuted()) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = urgent ? 1320 : 880;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  }, []);

  const boom = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || isAudioMuted()) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 1.4);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + 1.3);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(t);

    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.8);
    og.gain.setValueAtTime(0.25, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    osc.connect(og).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.85);
  }, []);

  useEffect(() => () => { ctxRef.current?.close?.(); }, []);

  return { unlock, tick, boom };
}

export default function BombaPage() {
  const [phase, setPhase] = useState('setup'); // 'setup' | 'ticking' | 'boom'
  const [mode, setMode] = useState('categorie');
  const [fuse, setFuse] = useState('media');
  const [players, setPlayers] = useState([]);
  const [scores, setScores] = useState({});
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loser, setLoser] = useState(null);
  const [wobble, setWobble] = useState(700);
  const [loaded, setLoaded] = useState(false);
  const [custom, setCustom] = useState({ categorie: '', sillabe: '' }); // testo scritto dall'utente
  const [customOnly, setCustomOnly] = useState(false);
  const [startError, setStartError] = useState('');
  const roundRef = useRef({}); // dati del round in corso per le statistiche

  const bagRef = useRef({ pool: null, order: [] });
  const { unlock, tick, boom } = useBombaAudio();
  useMusicSuppressed(phase !== 'setup');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved) {
        if (MODES.some((m) => m.id === saved.mode)) setMode(saved.mode);
        if (BOMBA_FUSES[saved.fuse]) setFuse(saved.fuse);
        if (Array.isArray(saved.players)) setPlayers(saved.players.filter((p) => typeof p === 'string').slice(0, 20));
        if (saved.custom && typeof saved.custom === 'object') {
          setCustom({ categorie: String(saved.custom.categorie || ''), sillabe: String(saved.custom.sillabe || '') });
        }
        setCustomOnly(!!saved.customOnly);
      }
    } catch { /* storage non disponibile: si parte dai default */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, fuse, players, custom, customOnly })); } catch { /* ignora */ }
  }, [loaded, mode, fuse, players, custom, customOnly]);

  // Le voci dell'utente si aggiungono a quelle incluse, oppure le sostituiscono
  const mine = useMemo(() => parseLines(custom[mode], mode === 'sillabe'), [custom, mode]);
  const pool = useMemo(() => {
    const base = mode === 'sillabe' ? BOMBA_SYLLABLES : BOMBA_CATEGORIES;
    if (customOnly) return mine;
    const known = new Set(base.map((b) => b.toLowerCase()));
    return [...base, ...mine.filter((m) => !known.has(m.toLowerCase()))];
  }, [mode, mine, customOnly]);

  // Pesca senza ripetere finché il mazzo non è finito
  const nextPrompt = useCallback(() => {
    const bag = bagRef.current;
    if (bag.pool !== pool || bag.order.length === 0) bagRef.current = { pool, order: shuffledIndexes(pool.length) };
    return pool[bagRef.current.order.pop()];
  }, [pool]);

  // La miccia: durata casuale nascosta, i tic accelerano verso la fine.
  useEffect(() => {
    if (phase !== 'ticking') return;
    const [min, max] = BOMBA_FUSES[fuse];
    const total = (min + Math.random() * (max - min)) * 1000;
    const start = performance.now();
    let tickTimer;
    const loop = () => {
      const p = Math.min(1, (performance.now() - start) / total);
      const interval = Math.round(700 - 520 * p * p);
      tick(p > 0.75);
      setWobble(interval);
      tickTimer = setTimeout(loop, interval);
    };
    loop();
    const boomTimer = setTimeout(() => {
      boom();
      recordBombaRound({ fuseSeconds: total / 1000, fuse, ...roundRef.current });
      try { navigator.vibrate?.([400, 80, 300]); } catch { /* ignora */ }
      setPhase('boom');
    }, total);
    return () => { clearTimeout(tickTimer); clearTimeout(boomTimer); };
  }, [phase, fuse, tick, boom]);

  function addPlayer(e) {
    e?.preventDefault();
    const name = playerName.trim().slice(0, 20);
    if (!name) return;
    if (players.includes(name)) { setError('Nome già presente'); return; }
    if (players.length >= 20) { setError('Massimo 20 giocatori'); return; }
    setPlayers([...players, name]);
    setPlayerName('');
    setError('');
  }

  function removePlayer(name) {
    setPlayers(players.filter((p) => p !== name));
    setScores((s) => {
      const next = { ...s };
      delete next[name];
      return next;
    });
  }

  function light() {
    if (pool.length === 0) {
      setStartError(mode === 'sillabe' ? 'Scrivi almeno una sillaba tua, o usa anche quelle incluse' : 'Scrivi almeno una categoria tua, o usa anche quelle incluse');
      return;
    }
    setStartError('');
    unlock();
    setLoser(null);
    const next = nextPrompt();
    roundRef.current = { mode, custom: mine.includes(next), players: players.length };
    setPrompt(next);
    setPhase('ticking');
  }

  function blame(name) {
    setScores((s) => ({ ...s, [name]: (s[name] || 0) + 1 }));
    setLoser(name);
  }

  const showScores = players.length > 0 && Object.keys(scores).length > 0;
  const ranking = players
    .map((name) => ({ name, booms: scores[name] || 0 }))
    .sort((a, b) => a.booms - b.booms);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(12px, 3vw, 20px)' }}>
      <div className="panel" style={{ width: 'min(620px, 96vw)', padding: 'clamp(18px, 4vw, 28px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          {phase === 'setup'
            ? <Link href="/" className="btn-3d" style={{ textDecoration: 'none' }}>Hub Giochi</Link>
            : <button type="button" className="btn-3d" onClick={() => setPhase('setup')} style={{ background: '#fff', color: '#111827' }}>Ferma</button>}
          <span />
        </div>

        {phase === 'setup' && (
          <div style={{ marginTop: 20, display: 'grid', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <PixelIcon name="bomb" size={56} />
              <h1 style={{ margin: 0, color: '#111827', fontSize: 'clamp(18px, 4.4vw, 26px)' }}>Passa la Bomba</h1>
            </div>

            <ol style={{ margin: 0, paddingLeft: 26, listStyle: 'decimal', display: 'grid', gap: 6, color: '#111827', fontFamily: 'var(--font-pixel-body), var(--font-pixel), sans-serif', fontSize: 17 }}>
              <li>Esce una categoria o una sillaba.</li>
              <li>Dì una parola giusta e passa il telefono.</li>
              <li>Quando scoppia, chi ha la bomba perde il round.</li>
            </ol>

            <div>
              <div style={{ fontSize: 11, color: '#111827', marginBottom: 8 }}>Modalità</div>
              <div className="anno-segment" role="radiogroup" aria-label="Modalità">
                {MODES.map((m) => (
                  <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>{m.label}</button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: '#111827', marginBottom: 8 }}>Miccia</div>
              <div className="anno-segment" role="radiogroup" aria-label="Durata della miccia">
                {FUSES.map((f) => (
                  <button key={f.id} type="button" role="radio" aria-checked={fuse === f.id} className={fuse === f.id ? 'on' : ''} onClick={() => setFuse(f.id)}>{f.label}</button>
                ))}
              </div>
            </div>

            <details className="bomba-custom" open={mine.length > 0 || customOnly}>
              <summary>{mode === 'sillabe' ? 'Le tue sillabe' : 'Le tue categorie'}{mine.length > 0 ? ` (${mine.length})` : ''}</summary>
              <textarea
                className="input-modern"
                rows={5}
                value={custom[mode]}
                onChange={(e) => setCustom((c) => ({ ...c, [mode]: e.target.value }))}
                placeholder={mode === 'sillabe' ? 'Una per riga, es.\nCHE\nTRA' : 'Una per riga, es.\nCose che si trovano in cantina\nNomi dei nostri prof'}
                aria-label={mode === 'sillabe' ? 'Le tue sillabe, una per riga' : 'Le tue categorie, una per riga'}
                style={{ resize: 'vertical', fontFamily: 'var(--font-pixel-body), var(--font-pixel), sans-serif', fontSize: 16, marginTop: 10 }}
              />
              <div className="anno-segment" role="radiogroup" aria-label="Come usarle" style={{ marginTop: 10 }}>
                <button type="button" role="radio" aria-checked={!customOnly} className={!customOnly ? 'on' : ''} onClick={() => setCustomOnly(false)}>Con le incluse</button>
                <button type="button" role="radio" aria-checked={customOnly} className={customOnly ? 'on' : ''} onClick={() => setCustomOnly(true)}>Solo le mie</button>
              </div>
            </details>

            <div>
              <label htmlFor="bomba-player" style={{ display: 'block', fontSize: 11, color: '#111827', marginBottom: 8 }}>
                Giocatori <span style={{ color: '#6b7280' }}>(facoltativo, per il punteggio)</span>
              </label>
              <form onSubmit={addPlayer} style={{ display: 'flex', gap: 10 }}>
                <input id="bomba-player" className="input-modern" value={playerName} maxLength={20} onChange={(e) => setPlayerName(e.target.value)} placeholder="Nome" autoComplete="off" />
                <button type="submit" className="btn-3d" style={{ flexShrink: 0 }}>+</button>
              </form>
              {error && <p style={{ margin: '8px 0 0', color: '#dc2626', fontSize: 11 }}>{error}</p>}
              {players.length > 0 && (
                <div className="bomba-chips" style={{ marginTop: 12 }}>
                  {players.map((p) => (
                    <span key={p} className="bomba-chip">
                      {p}
                      <button type="button" onClick={() => removePlayer(p)} aria-label={`Rimuovi ${p}`}>✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {showScores && (
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontSize: 11, color: '#111827' }}>Esplosioni</div>
                <ul className="bomba-score">
                  {ranking.map((r) => <li key={r.name}><span>{r.name}</span><span>{'💥'.repeat(Math.min(r.booms, 5))}{r.booms > 5 ? ` ×${r.booms}` : ''}{r.booms === 0 ? '—' : ''}</span></li>)}
                </ul>
                <button type="button" onClick={() => setScores({})} style={{ justifySelf: 'start', border: 0, background: 'none', color: '#6b7280', fontSize: 10, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Azzera punteggi</button>
              </div>
            )}

            {startError && <p role="alert" style={{ margin: 0, color: '#dc2626', fontSize: 11, lineHeight: 1.5 }}>{startError}</p>}
            <button type="button" className="btn-3d" onClick={light} style={{ background: 'var(--neon-orange)', fontSize: 'clamp(13px, 3vw, 16px)', padding: '16px 20px' }}>
              Accendi la miccia
            </button>
          </div>
        )}

        {phase !== 'setup' && (
          <div className="bomba-stage" style={{ marginTop: 20 }}>
            <p className="bomba-prompt-label">{mode === 'sillabe' ? 'Una parola che contiene' : 'Categoria'}</p>
            <p className={`bomba-prompt${mode === 'sillabe' ? ' big' : ''}`} aria-live="polite">{prompt}</p>
            <div className="bomba-bomb lit" style={{ '--wobble': `${wobble}ms` }}>
              <PixelIcon name="bomb" size={200} title="Bomba accesa" />
              <span className="bomba-spark" aria-hidden="true" />
            </div>
            <p className="bomba-hint">Dì una parola e passa il telefono!</p>
          </div>
        )}
      </div>

      {phase === 'boom' && (
        <div className="bomba-boom" role="alertdialog" aria-modal="true" aria-labelledby="bomba-boom-title">
          <div style={{ display: 'grid', justifyItems: 'center', gap: 20, width: 'min(480px, 100%)' }}>
            <h2 id="bomba-boom-title" className="bomba-boom-title">BOOM!</h2>
            <div className="panel" style={{ width: '100%', padding: 20, display: 'grid', gap: 14 }}>
              {players.length > 0 && !loser && (
                <>
                  <div style={{ fontSize: 12, color: '#111827', textAlign: 'center' }}>Chi aveva la bomba?</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                    {players.map((p, i) => (
                      <button key={p} type="button" className="btn-3d" autoFocus={i === 0} onClick={() => blame(p)} style={{ background: 'var(--neon-red)' }}>{p}</button>
                    ))}
                  </div>
                  <button type="button" onClick={() => setLoser('')} style={{ border: 0, background: 'none', color: '#6b7280', fontSize: 10, cursor: 'pointer', textDecoration: 'underline' }}>Salta</button>
                </>
              )}
              {(players.length === 0 || loser !== null) && (
                <>
                  {loser && <div style={{ fontSize: 12, color: '#111827', textAlign: 'center' }}>{loser} salta in aria! 💥</div>}
                  {players.length > 0 && (
                    <ul className="bomba-score">
                      {ranking.map((r) => <li key={r.name}><span>{r.name}</span><span>{r.booms}</span></li>)}
                    </ul>
                  )}
                  <button type="button" className="btn-3d" autoFocus onClick={light} style={{ background: 'var(--neon-orange)' }}>Altro round</button>
                  <button type="button" className="btn-3d" onClick={() => setPhase('setup')} style={{ background: '#fff', color: '#111827' }}>Menu</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
