'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { ref, get, update } from 'firebase/database';

export default function LiarJoinPage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleJoinRoom = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!auth.currentUser) {
        router.push('/auth');
        return;
      }

      const code = roomCode.toUpperCase().trim();

      if (!code || code.length < 4) {
        setError('Inserisci un codice stanza valido');
        setLoading(false);
        return;
      }

      // Verifica che stanza esista
      const roomRef = ref(db, `rooms_liar/${code}`);
      const roomSnapshot = await get(roomRef);

      if (!roomSnapshot.exists()) {
        setError('Stanza non trovata');
        setLoading(false);
        return;
      }

      // Aggiungi giocatore
      const playersRef = ref(db, `rooms_liar/${code}/players/${auth.currentUser.uid}`);
      await update(playersRef, {
        name: auth.currentUser.displayName || 'Player',
        alive: true,
      });

      // Naviga alla lobby
      router.push(`/liar/${code}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="liar-join">
      <h1>🎯 Entra in Stanza</h1>

      {error && <div className="error">{error}</div>}

      <div className="form">
        <label>
          <span>Codice Stanza:</span>
          <input
            type="text"
            placeholder="Es: ABC123"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            disabled={loading}
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleJoinRoom();
            }}
          />
        </label>

        <button onClick={handleJoinRoom} disabled={loading}>
          {loading ? 'Ingresso...' : 'Entra'}
        </button>
      </div>
    </div>
  );
}
