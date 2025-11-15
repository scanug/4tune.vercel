'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';

export default function MusicHostPage() {
  const params = useSearchParams();
  const playlistId = params.get('playlist');
  const playlistTitle = params.get('title') || 'Playlist personalizzata';

  const [maxRounds, setMaxRounds] = useState(5);
  const [roundMs, setRoundMs] = useState(15000);
  const [prepMs, setPrepMs] = useState(3000);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 'min(640px, 94vw)', border: '2px solid rgba(17,24,39,0.2)', borderRadius: 18, background: '#fff', padding: 28, boxShadow: '0 20px 40px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <Link href="/music/categories" className="btn-3d" style={{ textDecoration: 'none' }}>Categorie</Link>
          <h1 style={{ margin: 0, color: '#111827' }}>Crea stanza musicale</h1>
          <span />
        </div>

        <div style={{ marginTop: 20, border: '1px solid rgba(17,24,39,0.15)', borderRadius: 12, padding: 16, background: 'rgba(99,102,241,0.05)' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', color: '#6b7280' }}>Playlist selezionata</h2>
          <p style={{ margin: '6px 0', color: '#111827', fontWeight: 700 }}>{playlistTitle}</p>
          {playlistId && <code style={{ fontSize: 12, color: '#6b7280' }}>{playlistId}</code>}
        </div>

        <div style={{ marginTop: 20, display: 'grid', gap: 16 }}>
          <label>
            <span style={{ display: 'block', marginBottom: 6, color: '#111827', fontWeight: 600 }}>Numero di round: {maxRounds}</span>
            <input type="range" min={1} max={20} value={maxRounds} onChange={(e) => setMaxRounds(Number(e.target.value))} style={{ width: '100%' }} />
          </label>
          <label>
            <span style={{ display: 'block', marginBottom: 6, color: '#111827', fontWeight: 600 }}>Durata round (ms): {roundMs}</span>
            <input type="range" min={5000} max={30000} step={1000} value={roundMs} onChange={(e) => setRoundMs(Number(e.target.value))} style={{ width: '100%' }} />
          </label>
          <label>
            <span style={{ display: 'block', marginBottom: 6, color: '#111827', fontWeight: 600 }}>Countdown iniziale (ms): {prepMs}</span>
            <input type="range" min={1000} max={10000} step={500} value={prepMs} onChange={(e) => setPrepMs(Number(e.target.value))} style={{ width: '100%' }} />
          </label>
        </div>

        <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn-3d" style={{ minWidth: 200 }} disabled>
            Crea stanza (WIP)
          </button>
          <Link href="/music/join" className="btn-3d" style={{ textDecoration: 'none' }}>
            Hai già un codice?
          </Link>
        </div>
      </div>
    </main>
  );
}
