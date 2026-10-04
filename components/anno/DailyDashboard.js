'use client';

import { useCallback, useEffect, useState } from 'react';
import { daily } from '@/lib/gameClient';

const TABS = [
  { id: 'today', label: 'Oggi' },
  { id: 'all', label: 'Di sempre' },
  { id: 'me', label: 'Io' },
];

function Tile({ label, value, hint }) {
  return (
    <div style={{ padding: '12px 10px', borderRadius: 12, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#312e81' }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 10, color: '#4b5563' }}>{label}</div>
      {hint && <div style={{ marginTop: 4, fontSize: 9, color: '#6b7280' }}>{hint}</div>}
    </div>
  );
}

// Punti degli ultimi giorni giocati: una sola serie, barre sottili ancorate
// alla base, valore al passaggio del dito/mouse e nell'etichetta accessibile.
function HistoryBars({ history, maxScore }) {
  const [hover, setHover] = useState(null);
  const items = [...history].reverse(); // dal più vecchio al più recente
  if (items.length === 0) return null;
  const active = hover !== null ? items[hover] : items[items.length - 1];
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, fontSize: 10, color: '#4b5563' }}>
        <span>Ultime {items.length} sfide</span>
        <span style={{ color: '#111827', fontWeight: 700 }}>#{active.number}: {active.score} pt</span>
      </div>
      <div
        role="list"
        aria-label="Punteggi delle ultime sfide"
        style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 90, padding: '0 2px', borderBottom: '1px solid rgba(17,24,39,0.15)' }}
        onMouseLeave={() => setHover(null)}
      >
        {items.map((h, i) => (
          <div
            key={h.day}
            role="listitem"
            aria-label={`Sfida numero ${h.number}: ${h.score} punti`}
            onMouseEnter={() => setHover(i)}
            onTouchStart={() => setHover(i)}
            style={{ flex: '1 1 0', maxWidth: 18, height: '100%', display: 'flex', alignItems: 'flex-end', cursor: 'default' }}
          >
            <div
              style={{
                width: '100%',
                height: `${Math.max(3, (h.score / maxScore) * 100)}%`,
                borderRadius: '4px 4px 0 0',
                background: hover === i || (hover === null && i === items.length - 1) ? '#4f46e5' : '#a5b4fc',
                transition: 'background 120ms ease',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Board({ data, showDays }) {
  if (!data) return <p style={{ color: '#6b7280', fontSize: 12, textAlign: 'center' }}>Caricamento...</p>;
  if (data.rows.length === 0) {
    return <p style={{ color: '#6b7280', fontSize: 12, textAlign: 'center', margin: '16px 0' }}>Ancora nessuno in classifica. Sii il primo!</p>;
  }
  const meVisible = data.rows.some((r) => r.me);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 4 }}>
      <p style={{ margin: '0 0 6px', fontSize: 10, color: '#6b7280' }}>{data.players} {data.players === 1 ? 'giocatore' : 'giocatori'}</p>
      {data.rows.map((r) => (
        <Row key={`${r.rank}-${r.name}`} rank={r.rank} name={r.name} score={r.score} days={showDays ? r.days : null} me={r.me} />
      ))}
      {data.me && !meVisible && (
        <>
          <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>⋯</div>
          <Row rank={data.me.rank} name="Tu" score={data.me.score} days={showDays ? data.me.days : null} me />
        </>
      )}
    </div>
  );
}

function Row({ rank, name, score, days, me }) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, fontSize: 12, color: '#111827',
      background: me ? 'rgba(99,102,241,0.12)' : 'rgba(17,24,39,0.04)',
      border: me ? '2px solid #4f46e5' : '2px solid transparent',
    }}>
      <span style={{ width: 30, textAlign: 'center' }}>{medal || `${rank}.`}</span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: me ? 700 : 500 }}>{name}</span>
      {days !== null && <span style={{ fontSize: 10, color: '#6b7280' }}>{days} {days === 1 ? 'giorno' : 'giorni'}</span>}
      <span style={{ fontWeight: 800, color: '#4f46e5', minWidth: 56, textAlign: 'right' }}>{score}</span>
    </div>
  );
}

export default function DailyDashboard({ hasIdentity, refreshKey = 0 }) {
  const [tab, setTab] = useState('today');
  const [data, setData] = useState({});
  const [error, setError] = useState('');

  const load = useCallback(async (which) => {
    setError('');
    try {
      const payload = which === 'me' ? await daily.stats() : await daily.leaderboard(which);
      setData((d) => ({ ...d, [which]: payload }));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (tab === 'me' && !hasIdentity) return undefined;
    load(tab);
    // Aggiornamento periodico finché la pagina è aperta e visibile.
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(tab); }, 30_000);
    return () => clearInterval(t);
  }, [tab, refreshKey, hasIdentity, load]);

  const tabs = hasIdentity ? TABS : TABS.filter((t) => t.id !== 'me');
  const stats = data.me;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
      <div className="anno-segment" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <p style={{ margin: 0, color: '#dc2626', fontSize: 12 }}>{error}</p>}

      {tab === 'today' && <Board data={data.today} showDays={false} />}
      {tab === 'all' && <Board data={data.all} showDays />}
      {tab === 'me' && (
        !stats ? <p style={{ color: '#6b7280', fontSize: 12, textAlign: 'center' }}>Caricamento...</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              <Tile label="Sfide giocate" value={stats.daysPlayed} />
              <Tile label="Serie attuale" value={`${stats.currentStreak}${stats.currentStreak ? ' 🔥' : ''}`} />
              <Tile label="Serie migliore" value={stats.bestStreak} />
              <Tile label="Record" value={stats.bestScore} hint={`su ${stats.maxScore}`} />
              <Tile label="Media" value={stats.average} />
              <Tile label="Totale" value={stats.total} />
            </div>
            <HistoryBars history={stats.history} maxScore={stats.maxScore} />
          </div>
        )
      )}
    </div>
  );
}
