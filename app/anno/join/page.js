'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { gameChannel, getNickname, setNickname } from '@/lib/gameClient';

const { emitAck, getStoredPlayer, storePlayer } = gameChannel('anno');

export default function AnnoJoinPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { setName(getNickname()); }, []);

  async function handleJoin(e) {
    e?.preventDefault();
    const roomCode = code.trim().toUpperCase();
    const nick = name.trim();
    if (roomCode.length !== 4) { setError('Il codice deve avere 4 caratteri'); return; }
    if (!nick) { setError('Inserisci un nickname'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await emitAck('room:join', { code: roomCode, name: nick, playerId: getStoredPlayer(roomCode) });
      setNickname(nick);
      storePlayer(res.code, res.playerId);
      router.push(`/anno/game/${res.code}`);
    } catch (err) {
      setError(err.message || "Errore durante l'ingresso in stanza");
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 'min(520px, 92vw)', border: '2px solid rgba(17,24,39,0.2)', borderRadius: 16, background: 'rgba(255,255,255,0.92)', padding: 28, boxShadow: '0 16px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <Link href="/anno" className="btn-3d" style={{ textDecoration: 'none' }}>Indietro</Link>
          <h1 style={{ margin: 0, color: '#111827' }}>Entra in stanza</h1>
          <Link href="/anno/host" className="btn-3d" style={{ textDecoration: 'none' }}>Crea</Link>
        </div>

        <form onSubmit={handleJoin} style={{ marginTop: 24, display: 'grid', gap: 12 }}>
          <label style={{ fontWeight: 600, color: '#111827' }}>Nickname</label>
          <input className="input-modern" type="text" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="Come ti chiami?" />
          <label style={{ fontWeight: 600, color: '#111827' }}>Codice stanza</label>
          <input
            className="input-modern"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            style={{ fontSize: '2rem', textAlign: 'center', letterSpacing: '0.3em' }}
          />
          <button className="btn-3d" type="submit" style={{ minWidth: 160 }} disabled={loading}>
            {loading ? 'Accesso...' : 'Entra'}
          </button>
          {error && <p style={{ color: '#dc2626', margin: 0 }}>{error}</p>}
        </form>
      </div>
    </main>
  );
}
