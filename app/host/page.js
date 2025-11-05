'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ref, get, set } from 'firebase/database';
import { db, auth } from '@/lib/firebase';

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
        hostId: currentUser.uid,
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
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ textAlign: 'center', background: '#fff', border: '2px solid rgba(99,102,241,0.5)', borderRadius: 16, padding: 24, width: 'min(760px, 92vw)', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Link href="/" className="btn-3d" style={{ textDecoration: 'none' }}>Home</Link>
          <h1 className="text-2xl font-bold" style={{ margin: 0, color: '#111827' }}>Crea una stanza multiplayer</h1>
          <span style={{ width: '80px' }}></span>
        </div>

        {roomCode ? (
          <div className="fade-up">
            <div style={{ marginBottom: 20 }}>
              <p style={{ marginBottom: 12, color: '#111827' }}>Stanza creata con codice:</p>
              <h2 style={{ fontSize: '3rem', fontWeight: 800, color: '#6366f1', margin: '16px 0', letterSpacing: '0.1em' }}>{roomCode}</h2>
              <p style={{ marginBottom: 20, color: '#111827' }}>Condividi questo codice con i tuoi amici per giocare insieme.</p>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href={`/game/${roomCode}`} className="btn-3d" style={{ textDecoration: 'none' }}>Entra nella stanza</Link>
              <button 
                className="btn-3d" 
                onClick={() => {
                  setRoomCode('');
                  setError('');
                }}
              >
                Crea nuova stanza
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ marginBottom: 20, color: '#111827' }}>Crea una nuova stanza multiplayer per giocare con i tuoi amici.</p>
            <button 
              className="btn-3d" 
              onClick={createRoom} 
              disabled={loading}
              style={{ minWidth: 200 }}
            >
              {loading ? 'Creando...' : 'Genera stanza'}
            </button>
            {error && (
              <div className="fade-up" style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#dc2626' }}>
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
