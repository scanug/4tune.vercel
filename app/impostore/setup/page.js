'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CLASSICA_WORDS } from '@/lib/impostoreWords';

export default function ImpostoreSetupPage() {
  const router = useRouter();

  const [mode, setMode] = useState('classica'); // 'classica' | 'ocane'
  const [playerName, setPlayerName] = useState('');
  const [players, setPlayers] = useState([]);
  const [impostorCount, setImpostorCount] = useState(1);
  const [impostorHint, setImpostorHint] = useState(false);
  const [timerSecs, setTimerSecs] = useState(120);
  const [customWords, setCustomWords] = useState('');
  const [error, setError] = useState('');

  function addPlayer() {
    const name = playerName.trim();
    if (!name) return;
    if (players.includes(name)) { setError('Nome già presente'); return; }
    setPlayers([...players, name]);
    setPlayerName('');
    setError('');
  }

  function removePlayer(idx) {
    setPlayers(players.filter((_, i) => i !== idx));
  }

  function startGame() {
    setError('');
    if (players.length < 3) { setError('Servono almeno 3 giocatori'); return; }
    if (impostorCount >= players.length) { setError('Troppi impostori per il numero di giocatori'); return; }

    let wordPool;
    if (mode === 'ocane') {
      wordPool = customWords.split('\n').map((w) => w.trim()).filter((w) => w.length > 0);
      if (wordPool.length < 1) { setError('Inserisci almeno 1 parola personalizzata'); return; }
    } else {
      wordPool = CLASSICA_WORDS;
    }

    const config = {
      mode,
      players,
      impostorCount,
      impostorHint,
      timerSecs,
      wordPool,
    };

    localStorage.setItem('impostore_config', JSON.stringify(config));
    router.push('/impostore/play');
  }

  const maxImpostors = Math.max(1, Math.floor((players.length - 1) / 2));

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="panel" style={{ width: 'min(720px, 94vw)', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <Link href="/impostore" className="btn-3d" style={{ textDecoration: 'none' }}>Indietro</Link>
          <h1 style={{ margin: 0, color: '#111827' }}>Configura Partita</h1>
          <span />
        </div>

        <div style={{ marginTop: 24, display: 'grid', gap: 20 }}>

          {/* Mode selection */}
          <div>
            <label style={{ fontWeight: 700, color: '#111827', display: 'block', marginBottom: 8 }}>Modalità</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn-3d"
                onClick={() => setMode('classica')}
                style={{ flex: 1, background: mode === 'classica' ? '#4f46e5' : '#111827', color: '#fff' }}
              >
                📚 Classica
              </button>
              <button
                className="btn-3d"
                onClick={() => setMode('ocane')}
                style={{ flex: 1, background: mode === 'ocane' ? '#4f46e5' : '#111827', color: '#fff' }}
              >
                🐕 Ocane
              </button>
            </div>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '6px 0 0' }}>
              {mode === 'classica' ? 'Parole casuali da un set predefinito.' : 'Parole personalizzate scelte da te!'}
            </p>
          </div>

          {/* Custom words for Ocane */}
          {mode === 'ocane' && (
            <div>
              <label style={{ fontWeight: 700, color: '#111827', display: 'block', marginBottom: 8 }}>
                Parole personalizzate (una per riga)
              </label>
              <textarea
                value={customWords}
                onChange={(e) => setCustomWords(e.target.value)}
                placeholder={'Es:\nProf di mate\nKebabbaro sotto casa\nLa macchina di Marco'}
                rows={5}
                style={{ width: '100%', fontSize: '1rem', padding: 10, borderRadius: 10, border: '1px solid rgba(17,24,39,0.2)', color: '#111827', resize: 'vertical' }}
              />
            </div>
          )}

          {/* Players */}
          <div>
            <label style={{ fontWeight: 700, color: '#111827', display: 'block', marginBottom: 8 }}>
              Giocatori ({players.length})
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
                maxLength={20}
                placeholder="Nome giocatore..."
                style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(17,24,39,0.2)', fontSize: '1rem', color: '#111827' }}
              />
              <button className="btn-3d" onClick={addPlayer}>Aggiungi</button>
            </div>
            {players.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {players.map((name, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: '#111827', color: '#fff', fontSize: 14 }}>
                    {name}
                    <button
                      onClick={() => removePlayer(idx)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 700, fontSize: 16, padding: 0, lineHeight: 1 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Settings row */}
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div>
              <label style={{ fontWeight: 600, color: '#111827' }}>Impostori</label>
              <select
                value={impostorCount}
                onChange={(e) => setImpostorCount(Number(e.target.value))}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, borderRadius: 8, border: '1px solid rgba(17,24,39,0.2)', color: '#111827' }}
              >
                {Array.from({ length: maxImpostors }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n} impostor{n > 1 ? 'i' : 'e'}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontWeight: 600, color: '#111827' }}>Timer discussione</label>
              <select
                value={timerSecs}
                onChange={(e) => setTimerSecs(Number(e.target.value))}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, borderRadius: 8, border: '1px solid rgba(17,24,39,0.2)', color: '#111827' }}
              >
                {[30, 60, 90, 120, 180, 240, 300].map((n) => (
                  <option key={n} value={n}>{n >= 60 ? `${Math.floor(n / 60)}m${n % 60 ? ` ${n % 60}s` : ''}` : `${n}s`}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 20 }}>
              <input
                type="checkbox"
                id="hint"
                checked={impostorHint}
                onChange={(e) => setImpostorHint(e.target.checked)}
                style={{ width: 20, height: 20, accentColor: '#4f46e5' }}
              />
              <label htmlFor="hint" style={{ fontWeight: 600, color: '#111827', cursor: 'pointer' }}>
                Indizio per l&apos;impostore
              </label>
            </div>
          </div>

          <button className="btn-3d" onClick={startGame} style={{ marginTop: 8, fontSize: '1.1rem', padding: '12px 0' }}>
            Inizia Partita ({players.length} giocatori)
          </button>
          {error && <p style={{ color: '#dc2626', margin: 0 }}>{error}</p>}
        </div>
      </div>
    </main>
  );
}
