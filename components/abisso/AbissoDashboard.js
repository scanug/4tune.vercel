'use client';

import { useCallback, useEffect, useState } from 'react';
import { abisso } from '@/lib/gameClient';

const TABS = [
  { id: 'today', label: 'Oggi' },
  { id: 'all', label: 'Di sempre' },
  { id: 'me', label: 'Io' },
];

function formatDepth(value) {
  return `${Number(value || 0).toLocaleString('it-IT')} m`;
}

function Board({ data, showDays }) {
  if (!data) return <p className="abisso-muted">Caricamento...</p>;
  if (data.rows.length === 0) return <p className="abisso-muted">Nessuno è ancora arrivato sul fondo. Sii il primo!</p>;
  const meVisible = data.rows.some((row) => row.me);
  return (
    <div className="abisso-board">
      <p className="abisso-muted">{data.players} {data.players === 1 ? 'giocatore' : 'giocatori'}</p>
      {data.rows.map((row) => <Row key={`${row.rank}-${row.name}`} {...row} showDays={showDays} />)}
      {data.me && !meVisible && <><span className="abisso-more">···</span><Row {...data.me} name="Tu" showDays={showDays} me /></>}
    </div>
  );
}

function Row({ rank, name, depth, days, me, showDays }) {
  return (
    <div className={`abisso-board-row${me ? ' me' : ''}`}>
      <span className="abisso-rank">{rank === 1 ? '1°' : `${rank}°`}</span>
      <span className="abisso-name">{name}</span>
      {showDays && <span className="abisso-days">{days} {days === 1 ? 'giorno' : 'giorni'}</span>}
      <strong>{formatDepth(depth)}</strong>
    </div>
  );
}

function Tile({ label, value }) {
  return <div className="abisso-stat"><strong>{value}</strong><span>{label}</span></div>;
}

export default function AbissoDashboard({ hasIdentity, refreshKey = 0 }) {
  const [tab, setTab] = useState('today');
  const [data, setData] = useState({});
  const [error, setError] = useState('');

  const load = useCallback(async (which) => {
    setError('');
    try {
      const payload = which === 'me' ? await abisso.stats() : await abisso.leaderboard(which);
      setData((current) => ({ ...current, [which]: payload }));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (tab === 'me' && !hasIdentity) return undefined;
    load(tab);
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load(tab); }, 30_000);
    return () => clearInterval(timer);
  }, [tab, refreshKey, hasIdentity, load]);

  const stats = data.me;
  return (
    <div className="abisso-dashboard">
      <div className="anno-segment" role="tablist" aria-label="Classifiche e statistiche">
        {TABS.filter((item) => item.id !== 'me' || hasIdentity).map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'on' : ''} onClick={() => setTab(item.id)}>{item.label}</button>
        ))}
      </div>
      {error && <p role="alert" className="abisso-error">{error}</p>}
      {tab === 'today' && <Board data={data.today} showDays={false} />}
      {tab === 'all' && <Board data={data.all} showDays />}
      {tab === 'me' && (!stats ? <p className="abisso-muted">Caricamento...</p> : (
        <div className="abisso-stat-grid">
          <Tile label="Immersioni" value={stats.daysPlayed} />
          <Tile label="Serie attuale" value={`${stats.currentStreak} giorni`} />
          <Tile label="Serie migliore" value={`${stats.bestStreak} giorni`} />
          <Tile label="Record" value={formatDepth(stats.bestDepth)} />
          <Tile label="Media" value={formatDepth(stats.averageDepth)} />
          <Tile label="Risposte abissali" value={stats.rareAnswers} />
        </div>
      ))}
    </div>
  );
}
