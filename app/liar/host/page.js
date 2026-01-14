'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { ref, set } from 'firebase/database';

export default function LiarHostPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [maxRounds, setMaxRounds] = useState(7);
  const [declarationMode, setDeclarationMode] = useState('assisted');
  const [wager, setWager] = useState(50);
  const [error, setError] = useState(null);

  const handleCreateRoom = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!auth.currentUser) {
        router.push('/auth');
        return;
      }

      // Genera room code
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Crea stanza in Firebase
      const roomRef = ref(db, `rooms_liar/${roomCode}`);
      await set(roomRef, {
        hostId: auth.currentUser.uid,
        status: 'waiting',
        createdAt: Date.now(),
        maxRounds,
        declarationMode,
        wager,
        players: {
          [auth.currentUser.uid]: {
            name: auth.currentUser.displayName || 'Player',
            credits: 200,
            isReady: true,
          },
        },
      });

      // Naviga alla lobby
      router.push(`/liar/${roomCode}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="liar-host">
      <h1>🎤 Crea Stanza</h1>

      {error && <div className="error">{error}</div>}

      <div className="form">
        <label>
          <span>Round:</span>
          <input
            type="number"
            min="3"
            max="20"
            value={maxRounds}
            onChange={(e) => setMaxRounds(parseInt(e.target.value))}
            disabled={loading}
          />
        </label>

        <label>
          <span>Modalità Dichiarazione:</span>
          <select
            value={declarationMode}
            onChange={(e) => setDeclarationMode(e.target.value)}
            disabled={loading}
          >
            <option value="assisted">Guidata (Consigliata)</option>
            <option value="free">Libera (Esperti)</option>
          </select>
        </label>

        <label>
          <span>Posta:</span>
          <input
            type="number"
            min="10"
            max="500"
            value={wager}
            onChange={(e) => setWager(parseInt(e.target.value))}
            disabled={loading}
          />
        </label>

        <button onClick={handleCreateRoom} disabled={loading}>
          {loading ? 'Creazione...' : 'Crea Stanza'}
        </button>
      </div>
    </div>
  );
}
