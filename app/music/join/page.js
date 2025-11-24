'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ref, get, update } from 'firebase/database';
import { signInAnonymously } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export default function MusicJoinPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (!u) {
        signInAnonymously(auth).catch(() => {});
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('playerName');
    if (stored) setName(stored);
  }, []);

  const avatar = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('playerAvatar') || null;
  }, []);

  async function handleJoin() {
    const roomCode = code.trim().toUpperCase();
    if (roomCode.length !== 4) {
      setError('Il codice deve avere 4 caratteri');
      return;
    }
    if (!name.trim()) {
      setError('Inserisci un nickname');
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
      if (!user) throw new Error('Autenticazione fallita, riprova');

      const roomRef = ref(db, `rooms_music/${roomCode}`);
      const snap = await get(roomRef);
      if (!snap.exists()) throw new Error('Stanza non trovata');
      const data = snap.val();
      if (data.status === 'finished') throw new Error('Partita già conclusa');

      await update(ref(db, `rooms_music/${roomCode}/players`), {
        [user.uid]: { name: name.trim(), avatar },
      });
      try {
        localStorage.setItem('playerName', name.trim());
        if (avatar) localStorage.setItem('playerAvatar', avatar);
      } catch {}
      router.push(`/music/game/${roomCode}`);
    } catch (err) {
      setError(err.message || 'Errore durante l\'ingresso in stanza');
    } finally {
      setLoading(false);
    }
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

      <div style={{ width: 'min(520px, 92vw)', border: '2px solid rgba(17,24,39,0.2)', borderRadius: 16, background: 'rgba(255,255,255,0.92)', padding: 28, boxShadow: '0 16px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <Link href="/music" className="btn-3d" style={{ textDecoration: 'none' }}>Landing</Link>
          <h1 style={{ margin: 0, color: '#111827' }}>Entra nella stanza GTS</h1>
          <Link href="/music/host" className="btn-3d" style={{ textDecoration: 'none' }}>Crea stanza</Link>
        </div>

        <div style={{ marginTop: 24, display: 'grid', gap: 12 }}>
          <label style={{ fontWeight: 600, color: '#111827' }}>Nickname</label>
          <input
            type="text"
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            style={{ fontSize: '1.1rem', padding: '0.5rem', borderRadius: 10, border: '1px solid rgba(17,24,39,0.2)', color: '#111827' }}
          />
          <label style={{ fontWeight: 600, color: '#111827' }}>Codice stanza</label>
          <input
            type="text"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            style={{ fontSize: '2rem', textAlign: 'center', padding: '0.5rem', borderRadius: 10, border: '1px solid rgba(17,24,39,0.2)', color: '#111827' }}
          />
          <button className="btn-3d" onClick={handleJoin} style={{ minWidth: 160 }} disabled={loading}>
            {loading ? 'Accesso...' : 'Entra'}
          </button>
          {error && <p style={{ color: '#dc2626' }}>{error}</p>}
        </div>
      </div>
    </main>
  );
}
