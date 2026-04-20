'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function GTSJoinPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uid, setUid] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/'); return; }
      setUid(session.user.id);
      supabase.from('profiles').select('name').eq('id', session.user.id).single()
        .then(({ data }) => {
          if (data) {
            setName(data.name || '');
          }
        });
    });
  }, [router]);

  async function handleJoin() {
    const roomCode = code.trim().toUpperCase();
    if (roomCode.length !== 4) { setError('Il codice deve avere 4 caratteri'); return; }
    if (!name.trim()) { setError('Inserisci un nickname'); return; }
    setLoading(true);
    setError('');
    try {
      if (!uid) throw new Error('Utente non autenticato');

      // Find the room
      const { data: room, error: roomErr } = await supabase
        .from('rooms').select('id, status').eq('code', roomCode).single();
      if (roomErr || !room) throw new Error('Stanza non trovata');
      if (room.status === 'finished') throw new Error('Partita già conclusa');

      // Add player
      const { error: joinErr } = await supabase.from('room_players').upsert({
        room_id: room.id,
        user_id: uid,
        name: name.trim(),
      }, { onConflict: 'room_id,user_id' });
      if (joinErr) throw joinErr;

      // Update profile name if changed
      await supabase.from('profiles').update({ name: name.trim() }).eq('id', uid);

      router.push(`/gts/game/${roomCode}`);
    } catch (err) {
      setError(err.message || "Errore durante l'ingresso in stanza");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 'min(520px, 92vw)', border: '2px solid rgba(17,24,39,0.2)', borderRadius: 16, background: 'rgba(255,255,255,0.92)', padding: 28, boxShadow: '0 16px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <Link href="/gts" className="btn-3d" style={{ textDecoration: 'none' }}>Indietro</Link>
          <h1 style={{ margin: 0, color: '#111827' }}>Entra nella stanza GTS</h1>
          <Link href="/gts/host" className="btn-3d" style={{ textDecoration: 'none' }}>Crea stanza</Link>
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
