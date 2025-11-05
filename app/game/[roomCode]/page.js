'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ref, onValue, update } from 'firebase/database';
import { db, auth } from '../../../lib/firebase';

export default function GamePage() {
  const { roomCode } = useParams();
  const [roomData, setRoomData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomCode) return;

    const roomRef = ref(db, 'rooms/' + roomCode);

    const unsubscribe = onValue(roomRef, (snapshot) => {
      if (!snapshot.exists()) {
        setError('Stanza non trovata o eliminata');
        setRoomData(null);
        setLoading(false);
        return;
      }

      setRoomData(snapshot.val());
      setError('');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roomCode]);

  async function startGame() {
    if (!roomCode || !roomData) return;

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError('Utente non autenticato');
        return;
      }

      if (currentUser.uid !== roomData.hostId) {
        setError('Solo l’host può avviare la partita');
        return;
      }

      await update(ref(db, 'rooms/' + roomCode), {
        status: 'playing',
        startedAt: Date.now(),
        round: 1,
        currentRange: { min: 1, max: 10 }
      });
    } catch (err) {
      console.error('Errore Firebase:', err);
      setError(`Errore nell'avviare la partita: ${err.message}`);
    }
  }

  if (loading) return <p>Caricamento stanza...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  if (!roomData) return null;

  const currentUser = auth.currentUser;
  const isHost = currentUser && roomData.hostId === currentUser.uid;

  return (
    <div style={{ padding: 20 }}>
      <h1>Partita: {roomCode}</h1>
      <p>Stato: {roomData.status}</p>

      <h2>Giocatori ({Object.keys(roomData.players || {}).length}):</h2>
      <ul>
        {roomData.players &&
          Object.entries(roomData.players).map(([id, player]) => (
            <li key={id}>{player.name || 'Guest'}</li>
          ))}
      </ul>

      {isHost && roomData.status === 'waiting' && (
        <button onClick={startGame}>Avvia Partita</button>
      )}

      {roomData.status === 'playing' && <p>La partita è in corso...</p>}
    </div>
  );
}
