'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ref, get, set, update } from 'firebase/database';
import { signInAnonymously } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

function generateRoomCode(length = 4) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function MusicHostInner() {
  const params = useSearchParams();
  const playlistId = params.get('playlist');
  const playlistTitle = params.get('title') || 'Playlist personalizzata';

  const [maxRounds, setMaxRounds] = useState(5);
  const [roundMs, setRoundMs] = useState(15000);
  const [prepMs, setPrepMs] = useState(3000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [playlistData, setPlaylistData] = useState(null);
  const [playlistLoading, setPlaylistLoading] = useState(false);

  useEffect(() => {
    if (!playlistId) return;
    setPlaylistLoading(true);
    fetch(`/api/deezer/playlist?id=${encodeURIComponent(playlistId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.tracks?.length >= 4) {
          setPlaylistData(data);
        } else {
          setError('La playlist selezionata non ha abbastanza preview audio.');
        }
      })
      .catch(() => setError('Errore nel recuperare la playlist da Deezer'))
      .finally(() => setPlaylistLoading(false));
  }, [playlistId]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (!u) {
        signInAnonymously(auth).catch(() => {});
      }
    });
    return () => unsub();
  }, []);

  const hostProfile = useMemo(() => {
    if (typeof window === 'undefined') return { name: 'Host', avatar: null };
    return {
      name: localStorage.getItem('playerName') || 'Host',
      avatar: localStorage.getItem('playerAvatar') || null,
    };
  }, []);

  async function createRoom() {
    if (!playlistId) {
      setError('Seleziona una playlist dalla pagina categorie');
      return;
    }
    if (!playlistData || playlistLoading) {
      setError('Playlist in caricamento, riprova tra poco');
      return;
    }
    setLoading(true);
    setError('');
    try {
      let user = auth.currentUser;
      if (!user) {
        await signInAnonymously(auth);
        user = auth.currentUser;
      }
      if (!user) throw new Error('Impossibile autenticare l’host');

      const tracks = playlistData.tracks.slice(0, 80);
      if (tracks.length < 4) throw new Error('La playlist ha meno di 4 brani utilizzabili');
      const code = generateRoomCode();
      const roomRef = ref(db, `rooms_music/${code}`);
      const snap = await get(roomRef);
      if (snap.exists()) {
        setLoading(false);
        createRoom();
        return;
      }
      await set(roomRef, {
        hostId: user.uid,
        createdAt: Date.now(),
        status: 'waiting',
        roundIndex: 0,
        maxRounds,
        roundMs,
        prepMs,
        startAt: null,
        playlist: {
          id: playlistData.id,
          name: playlistData.name,
          image: playlistData.image,
          provider: 'deezer',
          tracks,
        },
        scoreboard: {},
        current: null,
        players: {
          [user.uid]: { name: hostProfile.name, avatar: hostProfile.avatar },
        },
      });
      setRoomCode(code);
    } catch (err) {
      setError(err.message || 'Errore nella creazione della stanza');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 'min(720px, 94vw)', border: '2px solid rgba(17,24,39,0.2)', borderRadius: 18, background: '#fff', padding: 28, boxShadow: '0 20px 40px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <Link href="/music/categories" className="btn-3d" style={{ textDecoration: 'none' }}>Categorie</Link>
          <h1 style={{ margin: 0, color: '#111827' }}>Crea stanza musicale</h1>
          <Link href="/music/join" className="btn-3d" style={{ textDecoration: 'none' }}>Entra</Link>
        </div>

        <div style={{ marginTop: 20, border: '1px solid rgba(17,24,39,0.15)', borderRadius: 12, padding: 16, background: 'rgba(99,102,241,0.05)' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', color: '#6b7280' }}>Playlist selezionata</h2>
          <p style={{ margin: '6px 0', color: '#111827', fontWeight: 700 }}>{playlistTitle}</p>
          {playlistId && <code style={{ fontSize: 12, color: '#6b7280' }}>{playlistId}</code>}
          {playlistLoading && <p style={{ color: '#6b7280' }}>Caricamento playlist...</p>}
          {playlistData && <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{playlistData.tracks.length} tracce utilizzabili</p>}
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

        <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn-3d" style={{ minWidth: 200 }} onClick={createRoom} disabled={loading || playlistLoading}>
            {loading ? 'Creazione...' : 'Crea stanza'}
          </button>
          <Link href="/music/join" className="btn-3d" style={{ textDecoration: 'none' }}>
            Hai già un codice?
          </Link>
        </div>

        {error && <p style={{ marginTop: 16, color: '#dc2626' }}>{error}</p>}

        {roomCode && (
          <div className="fade-up" style={{ marginTop: 24, border: '2px dashed rgba(99,102,241,0.4)', borderRadius: 16, padding: 20, textAlign: 'center' }}>
            <p style={{ margin: 0, color: '#6b7280' }}>Stanza creata</p>
            <h2 style={{ margin: '8px 0', fontSize: '3rem', letterSpacing: '0.2em', color: '#4f46e5' }}>{roomCode}</h2>
            <p style={{ color: '#6b7280' }}>Condividi il codice e clicca qui sotto per entrare.</p>
            <Link href={`/music/game/${roomCode}`} className="btn-3d" style={{ textDecoration: 'none' }}>
              Entra nella stanza
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

export default function MusicHostPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Caricamento...</main>}>
      <MusicHostInner />
    </Suspense>
  );
}
