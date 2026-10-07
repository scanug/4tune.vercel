'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, emitAck, getNickname, setNickname, storePlayer } from '@/lib/gameClient';

function GTSHostInner() {
  const router = useRouter();
  const params = useSearchParams();
  const playlistId = params.get('playlist');
  const playlistTitle = params.get('title') || 'Playlist personalizzata';

  const [name, setName] = useState('');
  const [maxRounds, setMaxRounds] = useState(5);
  const [roundSecs, setRoundSecs] = useState(15);
  const [prepSecs, setPrepSecs] = useState(3);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [playlist, setPlaylist] = useState(null);
  const [playlistLoading, setPlaylistLoading] = useState(false);

  useEffect(() => { setName(getNickname()); }, []);

  useEffect(() => {
    if (!playlistId) return;
    let cancelled = false;
    setPlaylistLoading(true);
    setError('');
    api.playlist(playlistId)
      .then((data) => {
        if (cancelled) return;
        if (data.trackCount >= 4) setPlaylist(data);
        else setError('La playlist selezionata ha meno di 4 brani con anteprima audio.');
      })
      .catch((err) => { if (!cancelled) setError(err.message || 'Errore nel recuperare la playlist'); })
      .finally(() => { if (!cancelled) setPlaylistLoading(false); });
    return () => { cancelled = true; };
  }, [playlistId]);

  async function createRoom() {
    if (!playlistId) { setError('Seleziona una playlist dalla pagina categorie'); return; }
    if (!playlist) { setError('Playlist non ancora pronta'); return; }
    const nick = name.trim();
    if (!nick) { setError('Inserisci un nickname'); return; }
    setCreating(true);
    setError('');
    try {
      const res = await emitAck('room:create', {
        name: nick,
        playlistId,
        maxRounds,
        roundMs: roundSecs * 1000,
        prepMs: prepSecs * 1000,
      });
      setNickname(nick);
      storePlayer(res.code, res.playerId);
      router.push(`/gts/game/${res.code}`);
    } catch (err) {
      setError(err.message || 'Errore nella creazione della stanza');
      setCreating(false);
    }
  }

  const effectiveRounds = playlist ? Math.min(maxRounds, playlist.trackCount) : maxRounds;

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="panel" style={{ width: 'min(720px, 94vw)', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <Link href="/gts/categories" className="btn-3d" style={{ textDecoration: 'none' }}>Playlist</Link>
          <h1 style={{ margin: 0, color: '#111827' }}>Crea stanza</h1>
          <Link href="/gts/join" className="btn-3d" style={{ textDecoration: 'none' }}>Ho un codice</Link>
        </div>

        <div style={{ marginTop: 20, border: '1px solid rgba(17,24,39,0.15)', borderRadius: 12, padding: 16, background: 'rgba(99,102,241,0.05)', display: 'flex', gap: 14, alignItems: 'center' }}>
          {playlist?.image && <img src={playlist.image} alt="" style={{ width: 72, height: 72, borderRadius: 10, objectFit: 'cover' }} />}
          <div>
            <h2 style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280' }}>Playlist selezionata</h2>
            <p style={{ margin: '6px 0', color: '#111827', fontWeight: 700 }}>{playlist?.name || playlistTitle}</p>
            {playlistLoading && <p style={{ margin: 0, color: '#6b7280', fontSize: 12 }}>Caricamento playlist...</p>}
            {playlist && <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{playlist.trackCount} brani con anteprima</p>}
            {!playlistId && <p style={{ margin: 0, fontSize: 12, color: '#dc2626' }}>Nessuna playlist scelta</p>}
          </div>
        </div>

        <div style={{ marginTop: 20, display: 'grid', gap: 16 }}>
          <label>
            <span style={{ display: 'block', marginBottom: 6, color: '#111827', fontWeight: 600 }}>Il tuo nickname</span>
            <input className="input-modern" type="text" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="Come ti chiami?" />
          </label>
          <label>
            <span style={{ display: 'block', marginBottom: 6, color: '#111827', fontWeight: 600 }}>
              Round: {maxRounds}{playlist && effectiveRounds < maxRounds ? ` (la playlist ne permette ${effectiveRounds})` : ''}
            </span>
            <input type="range" min={1} max={20} value={maxRounds} onChange={(e) => setMaxRounds(Number(e.target.value))} style={{ width: '100%' }} />
          </label>
          <label>
            <span style={{ display: 'block', marginBottom: 6, color: '#111827', fontWeight: 600 }}>Durata round: {roundSecs}s</span>
            <input type="range" min={5} max={30} step={1} value={roundSecs} onChange={(e) => setRoundSecs(Number(e.target.value))} style={{ width: '100%' }} />
          </label>
          <label>
            <span style={{ display: 'block', marginBottom: 6, color: '#111827', fontWeight: 600 }}>Countdown prima della clip: {prepSecs}s</span>
            <input type="range" min={1} max={10} step={1} value={prepSecs} onChange={(e) => setPrepSecs(Number(e.target.value))} style={{ width: '100%' }} />
          </label>
        </div>

        <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn-3d" style={{ minWidth: 200 }} onClick={createRoom} disabled={creating || playlistLoading || !playlist}>
            {creating ? 'Creazione...' : 'Crea stanza'}
          </button>
        </div>

        {error && <p style={{ marginTop: 16, color: '#dc2626' }}>{error}</p>}
      </div>
    </main>
  );
}

export default function GTSHostPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Caricamento...</main>}>
      <GTSHostInner />
    </Suspense>
  );
}
