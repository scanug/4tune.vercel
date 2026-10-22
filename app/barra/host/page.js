'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, gameChannel, getNickname, setNickname } from '@/lib/gameClient';

const { emitAck, storePlayer } = gameChannel('barra');

const ROUND_OPTIONS = [5, 10, 15, 20];
const TIME_OPTIONS = [10, 15, 20, 30];
const GROUPS = [
  ['collections', 'collectionIds', 'Raccolte'],
  ['genres', 'genreIds', 'Generi'],
  ['artists', 'artistIds', 'Artisti'],
];

export default function BarraHostPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [catalog, setCatalog] = useState(null); // { collections, genres, artists, summary }
  const [filters, setFilters] = useState({ collectionIds: [], genreIds: [], artistIds: [] });
  const [maxRounds, setMaxRounds] = useState(10);
  const [roundSecs, setRoundSecs] = useState(15);
  const [speedBonus, setSpeedBonus] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setName(getNickname()); }, []);

  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);
  useEffect(() => {
    let cancelled = false;
    api.barraCatalog(filters)
      .then((data) => { if (!cancelled) { setCatalog(data); setError(''); } })
      .catch((err) => { if (!cancelled) { setCatalog((c) => c || { collections: [], genres: [], artists: [], summary: null }); setError(err.message); } });
    return () => { cancelled = true; };
  }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(key, id) {
    setFilters((f) => ({ ...f, [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id] }));
  }

  const summary = catalog?.summary;
  const notEnough = summary && summary.challenges > 0 && summary.songs < maxRounds;

  async function createRoom() {
    const nick = name.trim();
    if (!nick) { setError('Inserisci un nickname'); return; }
    setCreating(true);
    setError('');
    try {
      const res = await emitAck('room:create', {
        name: nick,
        maxRounds,
        roundMs: roundSecs * 1000,
        speedBonus,
        filters,
      });
      setNickname(nick);
      storePlayer(res.code, res.playerId);
      router.push(`/barra/game/${res.code}`);
    } catch (err) {
      setError(err.message || 'Errore nella creazione della stanza');
      setCreating(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="panel" style={{ width: 'min(720px, 94vw)', padding: 'clamp(16px, 4vw, 28px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <Link href="/barra" className="btn-3d" style={{ textDecoration: 'none' }}>Indietro</Link>
          <h1 style={{ margin: 0, color: '#111827' }}>Crea stanza</h1>
          <Link href="/barra/join" className="btn-3d" style={{ textDecoration: 'none' }}>Ho un codice</Link>
        </div>

        <div style={{ marginTop: 20, display: 'grid', gap: 20 }}>
          <label>
            <span style={{ display: 'block', marginBottom: 6, color: '#111827', fontWeight: 600 }}>Il tuo nickname</span>
            <input className="input-modern" type="text" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="Come ti chiami?" />
          </label>

          {catalog === null ? (
            <p style={{ margin: 0, color: '#6b7280', fontSize: 12 }}>Caricamento catalogo...</p>
          ) : (
            GROUPS.map(([listKey, filterKeyName, label]) => (catalog[listKey]?.length > 0 && (
              <div key={listKey}>
                <span style={{ display: 'block', marginBottom: 8, color: '#111827', fontWeight: 600 }}>{label}</span>
                <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                  {catalog[listKey].map((item) => {
                    const on = filters[filterKeyName].includes(item.id);
                    return (
                      <button key={item.id} type="button" className={`anno-toggle${on ? ' on' : ''}`} onClick={() => toggle(filterKeyName, item.id)} aria-pressed={on}>
                        <span style={{ flex: 1 }}>
                          {item.name}
                          <span style={{ display: 'block', fontSize: 10, color: '#6b7280', marginTop: 4 }}>{item.songs} brani</span>
                        </span>
                        <span style={{ fontSize: 16 }}>{on ? '✅' : '⬜'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )))
          )}
          {catalog && (
            <p style={{ margin: '-8px 0 0', fontSize: 11, color: '#6b7280' }}>
              Nessun filtro = tutto il catalogo. Più filtri si sommano: basta che un brano ne soddisfi uno.
            </p>
          )}

          <div>
            <span style={{ display: 'block', marginBottom: 8, color: '#111827', fontWeight: 600 }}>Round</span>
            <div className="anno-segment">
              {ROUND_OPTIONS.map((n) => (
                <button key={n} type="button" className={maxRounds === n ? 'on' : ''} onClick={() => setMaxRounds(n)}>{n}</button>
              ))}
            </div>
          </div>

          <div>
            <span style={{ display: 'block', marginBottom: 8, color: '#111827', fontWeight: 600 }}>Tempo per rispondere</span>
            <div className="anno-segment">
              {TIME_OPTIONS.map((n) => (
                <button key={n} type="button" className={roundSecs === n ? 'on' : ''} onClick={() => setRoundSecs(n)}>{n}s</button>
              ))}
            </div>
          </div>

          <button type="button" className={`anno-toggle${speedBonus ? ' on' : ''}`} onClick={() => setSpeedBonus((v) => !v)} aria-pressed={speedBonus}>
            <span style={{ fontSize: 22 }}>⚡</span>
            <span style={{ flex: 1 }}>
              Bonus velocità
              <span style={{ display: 'block', fontSize: 10, color: '#6b7280', marginTop: 4 }}>Fino a +20 punti a chi risponde giusto prima (a scaglioni)</span>
            </span>
            <span style={{ fontSize: 16 }}>{speedBonus ? '✅' : '⬜'}</span>
          </button>

          {summary && (
            <p style={{ margin: 0, fontSize: 12, color: summary.challenges === 0 ? '#dc2626' : notEnough ? '#92400e' : '#065f46' }}>
              {summary.challenges === 0
                ? 'Nessuna sfida pubblicata corrisponde ai filtri scelti.'
                : `${summary.songs} brani e ${summary.challenges} sfide disponibili.`}
              {notEnough && ` Per ${maxRounds} round alcuni brani si ripeteranno.`}
            </p>
          )}
        </div>

        <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn-3d" style={{ minWidth: 200 }} onClick={createRoom} disabled={creating || !summary || summary.challenges === 0}>
            {creating ? 'Creazione...' : 'Crea stanza'}
          </button>
        </div>

        {error && <p style={{ marginTop: 16, color: '#dc2626' }}>{error}</p>}
      </div>
    </main>
  );
}
