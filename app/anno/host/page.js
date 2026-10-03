'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, gameChannel, getNickname, setNickname } from '@/lib/gameClient';

const { emitAck, storePlayer } = gameChannel('anno');

const ROUND_OPTIONS = [5, 10, 15, 20];
const TIME_OPTIONS = [15, 20, 30, 45];

export default function AnnoHostPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [categories, setCategories] = useState(null); // [{ id, label, emoji, count }]
  const [selected, setSelected] = useState([]);
  const [maxRounds, setMaxRounds] = useState(10);
  const [roundSecs, setRoundSecs] = useState(20);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setName(getNickname()); }, []);

  useEffect(() => {
    let cancelled = false;
    api.annoCategories()
      .then(({ data }) => {
        if (cancelled) return;
        const usable = data.filter((c) => c.count > 0);
        setCategories(usable);
        setSelected(usable.map((c) => c.id));
        if (usable.length === 0) setError('Il mazzo di carte non è disponibile sul server.');
      })
      .catch((err) => { if (!cancelled) { setCategories([]); setError(err.message); } });
    return () => { cancelled = true; };
  }, []);

  function toggle(id) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id]));
  }

  const available = (categories || []).filter((c) => selected.includes(c.id)).reduce((n, c) => n + c.count, 0);

  async function createRoom() {
    const nick = name.trim();
    if (!nick) { setError('Inserisci un nickname'); return; }
    if (selected.length === 0) { setError('Scegli almeno una categoria'); return; }
    setCreating(true);
    setError('');
    try {
      const res = await emitAck('room:create', {
        name: nick,
        categories: selected,
        maxRounds,
        roundMs: roundSecs * 1000,
      });
      setNickname(nick);
      storePlayer(res.code, res.playerId);
      router.push(`/anno/game/${res.code}`);
    } catch (err) {
      setError(err.message || 'Errore nella creazione della stanza');
      setCreating(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 'min(720px, 94vw)', border: '2px solid rgba(17,24,39,0.2)', borderRadius: 18, background: 'rgba(255,255,255,0.92)', padding: 28, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <Link href="/anno" className="btn-3d" style={{ textDecoration: 'none' }}>Indietro</Link>
          <h1 style={{ margin: 0, color: '#111827' }}>Crea stanza</h1>
          <Link href="/anno/join" className="btn-3d" style={{ textDecoration: 'none' }}>Ho un codice</Link>
        </div>

        <div style={{ marginTop: 20, display: 'grid', gap: 20 }}>
          <label>
            <span style={{ display: 'block', marginBottom: 6, color: '#111827', fontWeight: 600 }}>Il tuo nickname</span>
            <input className="input-modern" type="text" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="Come ti chiami?" />
          </label>

          <div>
            <span style={{ display: 'block', marginBottom: 8, color: '#111827', fontWeight: 600 }}>Categorie</span>
            {categories === null ? (
              <p style={{ margin: 0, color: '#6b7280', fontSize: 12 }}>Caricamento categorie...</p>
            ) : (
              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                {categories.map((c) => {
                  const on = selected.includes(c.id);
                  return (
                    <button key={c.id} type="button" className={`anno-toggle${on ? ' on' : ''}`} onClick={() => toggle(c.id)} aria-pressed={on}>
                      <span style={{ fontSize: 22 }}>{c.emoji}</span>
                      <span style={{ flex: 1 }}>
                        {c.label}
                        <span style={{ display: 'block', fontSize: 10, color: '#6b7280', marginTop: 4 }}>{c.count} carte</span>
                      </span>
                      <span style={{ fontSize: 16 }}>{on ? '✅' : '⬜'}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <span style={{ display: 'block', marginBottom: 8, color: '#111827', fontWeight: 600 }}>Round</span>
            <div className="anno-segment">
              {ROUND_OPTIONS.map((n) => (
                <button key={n} type="button" className={maxRounds === n ? 'on' : ''} onClick={() => setMaxRounds(n)}>{n}</button>
              ))}
            </div>
            {categories && available > 0 && available < maxRounds && (
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#92400e' }}>Con queste categorie ci sono solo {available} carte: i round saranno {available}.</p>
            )}
          </div>

          <div>
            <span style={{ display: 'block', marginBottom: 8, color: '#111827', fontWeight: 600 }}>Tempo per rispondere</span>
            <div className="anno-segment">
              {TIME_OPTIONS.map((n) => (
                <button key={n} type="button" className={roundSecs === n ? 'on' : ''} onClick={() => setRoundSecs(n)}>{n}s</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn-3d" style={{ minWidth: 200 }} onClick={createRoom} disabled={creating || !categories || selected.length === 0}>
            {creating ? 'Creazione...' : 'Crea stanza'}
          </button>
        </div>

        {error && <p style={{ marginTop: 16, color: '#dc2626' }}>{error}</p>}
      </div>
    </main>
  );
}
