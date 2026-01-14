'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ref, get, set, update, runTransaction, onValue } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
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
  const router = useRouter();
  const params = useSearchParams();
  const playlistId = params.get('playlist');
  const playlistTitle = params.get('title') || 'Playlist personalizzata';

  const [pageLoading, setPageLoading] = useState(true);
  const [maxRounds, setMaxRounds] = useState(5);
  const [roundMs, setRoundMs] = useState(15000);
  const [prepMs, setPrepMs] = useState(3000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [playlistData, setPlaylistData] = useState(null);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [credits, setCredits] = useState(0);
  const [wager, setWager] = useState(10);
  const unsubscribeUserRef = useRef(null);

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
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.push("/");
        setPageLoading(false);
        return;
      }
      setPageLoading(false);
      const r = ref(db, `users/${u.uid}`);
      const unsubscribeUser = onValue(r, (snap) => {
        const val = snap.val();
        if (val && typeof val.credits === 'number') setCredits(val.credits);
      });
      unsubscribeUserRef.current = unsubscribeUser;
    });
    return () => {
      unsub();
      if (unsubscribeUserRef.current) {
        unsubscribeUserRef.current();
      }
    };
  }, [router]);

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
    if (wager < 10) {
      setError('Scommessa minima 10 crediti');
      return;
    }
    if (credits < wager) {
      setError('Crediti insufficienti per la scommessa');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const user = auth.currentUser;
      if (!user) {
        setError('Utente non autenticato. Accedi per creare una stanza.');
        setLoading(false);
        return;
      }

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
      // Detrai la scommessa dall'host
      const wagerAmount = Math.min(wager, credits);
      const credRef = ref(db, `users/${user.uid}/credits`);
      await runTransaction(credRef, (current) => {
        const c = Number(current || 0);
        if (c < wagerAmount) return; // abort
        return c - wagerAmount;
      });

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
        wagers: {
          [user.uid]: wagerAmount,
        },
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

  if (pageLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Caricamento...</div>
      </div>
    );
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative' }}>
      <video
        autoPlay
        muted
        loop
        playsInline
        className="fixed top-0 left-0 w-full h-full object-cover -z-10"
      >
        <source src="/background_gts.mp4" type="video/mp4" />
      </video>
      <div className="fixed inset-0 bg-black/60 -z-10"></div>

      <div style={{ width: 'min(720px, 94vw)', border: '2px solid rgba(17,24,39,0.2)', borderRadius: 18, background: 'rgba(255,255,255,0.92)', padding: 28, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
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
          <div>
            <span style={{ display: 'block', marginBottom: 6, color: '#111827', fontWeight: 600 }}>Scommessa (min 10, max {credits})</span>
            <input
              type="range"
              min={10}
              max={Math.max(10, credits)}
              value={wager}
              onChange={(e) => setWager(Math.min(Math.max(10, Number(e.target.value)), credits))}
              style={{ width: '100%' }}
            />
            <div style={{ marginTop: 4, color: '#111827' }}>{wager} crediti</div>
          </div>
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

