'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

function generateRoomCode(length = 4) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function GTSHostInner() {
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
  const [uid, setUid] = useState(null);

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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/'); return; }
      setUid(session.user.id);
      setPageLoading(false);
    });
  }, [router]);

  async function createRoom() {
    if (!playlistId) { setError('Seleziona una playlist dalla pagina categorie'); return; }
    if (!playlistData || playlistLoading) { setError('Playlist in caricamento, riprova tra poco'); return; }
    setLoading(true);
    setError('');
    try {
      if (!uid) throw new Error('Utente non autenticato');

      // Fetch user name
      const { data: profile } = await supabase.from('profiles').select('name, avatar_url').eq('id', uid).single();
      const userName = profile?.name || 'Player';
      const userAvatar = profile?.avatar_url || null;

      const tracks = playlistData.tracks.slice(0, 80);
      if (tracks.length < 4) throw new Error('La playlist ha meno di 4 brani utilizzabili');

      const code = generateRoomCode();
      const { error: roomErr } = await supabase.from('rooms').insert({
        code,
        game_type: 'gts',
        host_id: uid,
        status: 'waiting',
        round_index: 0,
        max_rounds: maxRounds,
        round_ms: roundMs,
        prep_ms: prepMs,
        playlist: { id: playlistData.id, name: playlistData.name, image: playlistData.image, provider: 'deezer', tracks },
        scoreboard: {},
      });
      if (roomErr) throw roomErr;

      // Get room id
      const { data: newRoom } = await supabase.from('rooms').select('id').eq('code', code).single();

      // Add host as player
      await supabase.from('room_players').insert({
        room_id: newRoom.id,
        user_id: uid,
        name: userName,
        avatar_url: userAvatar,
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
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 'min(720px, 94vw)', border: '2px solid rgba(17,24,39,0.2)', borderRadius: 18, background: 'rgba(255,255,255,0.92)', padding: 28, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <Link href="/gts/categories" className="btn-3d" style={{ textDecoration: 'none' }}>Categorie</Link>
          <h1 style={{ margin: 0, color: '#111827' }}>Crea stanza GTS</h1>
          <Link href="/gts/join" className="btn-3d" style={{ textDecoration: 'none' }}>Entra</Link>
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
          <Link href="/gts/join" className="btn-3d" style={{ textDecoration: 'none' }}>Hai già un codice?</Link>
        </div>

        {error && <p style={{ marginTop: 16, color: '#dc2626' }}>{error}</p>}

        {roomCode && (
          <div className="fade-up" style={{ marginTop: 24, border: '2px dashed rgba(99,102,241,0.4)', borderRadius: 16, padding: 20, textAlign: 'center' }}>
            <p style={{ margin: 0, color: '#6b7280' }}>Stanza creata</p>
            <h2 style={{ margin: '8px 0', fontSize: '3rem', letterSpacing: '0.2em', color: '#4f46e5' }}>{roomCode}</h2>
            <p style={{ color: '#6b7280' }}>Condividi il codice e clicca qui sotto per entrare.</p>
            <Link href={`/gts/game/${roomCode}`} className="btn-3d" style={{ textDecoration: 'none' }}>
              Entra nella stanza
            </Link>
          </div>
        )}
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
