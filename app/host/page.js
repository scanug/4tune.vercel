'use client';

import { useState } from 'react';
import { ref, get, set } from 'firebase/database';
import { db, auth } from '../lib/firebase';

 // assicurati che auth sia esportato in lib/firebase.js

function generateRoomCode(length = 4) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function HostPage() {
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function createRoom() {
    setLoading(true);
    setError('');

    let code = generateRoomCode();

    try {
      const roomRef = ref(db, 'rooms/' + code);
      const snapshot = await get(roomRef);

      if (snapshot.exists()) {
        // Codice già usato → rigenera
        setLoading(false);
        createRoom();
        return;
      }

      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError('Utente non autenticato. Riprova.');
        setLoading(false);
        return;
      }

      await set(roomRef, {
        createdAt: Date.now(),
        players: {},
        status: 'waiting',
        hostId: currentUser.uid, // 🟢 serve per le regole
        round: 0,
        currentRange: { min: 1, max: 10 }
      });

      setRoomCode(code);
    } catch (err) {
      console.error('Errore Firebase:', err);
      setError('Errore nella creazione della stanza: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Crea una stanza multiplayer</h1>
      {roomCode ? (
        <>
          <p>Stanza creata con codice:</p>
          <h2 style={{ fontSize: '2rem' }}>{roomCode}</h2>
          <p>Condividi questo codice con i tuoi amici per giocare insieme.</p>
        </>
      ) : (
        <>
          <button onClick={createRoom} disabled={loading}>
            {loading ? 'Creando...' : 'Genera stanza'}
          </button>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </>
      )}
    </div>
  );
}
