'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ref, onValue, update } from 'firebase/database';
import { db, auth } from '@/lib/firebase';

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
        setError('Solo l\'host può avviare la partita');
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

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ textAlign: 'center', background: '#fff', border: '2px solid rgba(99,102,241,0.5)', borderRadius: 16, padding: 24, width: 'min(760px, 92vw)', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
          <p style={{ color: '#111827' }}>Caricamento stanza...</p>
        </div>
      </main>
    );
  }

  if (error && !roomData) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ textAlign: 'center', background: '#fff', border: '2px solid rgba(239, 68, 68, 0.5)', borderRadius: 16, padding: 24, width: 'min(760px, 92vw)', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
          <h1 className="text-2xl font-bold" style={{ marginBottom: 16, color: '#dc2626' }}>Errore</h1>
          <p style={{ marginBottom: 20, color: '#111827' }}>{error}</p>
          <Link href="/" className="btn-3d" style={{ textDecoration: 'none' }}>Torna alla Home</Link>
        </div>
      </main>
    );
  }

  if (!roomData) return null;

  const currentUser = auth.currentUser;
  const isHost = currentUser && roomData.hostId === currentUser.uid;
  const playersCount = Object.keys(roomData.players || {}).length;
  const statusText = roomData.status === 'waiting' ? 'In attesa' : roomData.status === 'playing' ? 'In corso' : roomData.status;

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ textAlign: 'center', background: '#fff', border: '2px solid rgba(99,102,241,0.5)', borderRadius: 16, padding: 24, width: 'min(760px, 92vw)', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Link href="/" className="btn-3d" style={{ textDecoration: 'none' }}>Home</Link>
          <h1 className="text-2xl font-bold" style={{ margin: 0, color: '#111827' }}>Partita: {roomCode}</h1>
          <span style={{ width: '80px' }}></span>
        </div>

        {error && (
          <div className="fade-up" style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#dc2626' }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 999, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', marginBottom: 16 }}>
            <span className="bubble" style={{ background: roomData.status === 'waiting' ? 'rgba(234,179,8,0.18)' : 'rgba(16,185,129,0.18)', color: roomData.status === 'waiting' ? '#f59e0b' : '#10b981', border: `1px solid ${roomData.status === 'waiting' ? 'rgba(234,179,8,0.35)' : 'rgba(16,185,129,0.35)'}` }}>
              Stato: {statusText}
            </span>
          </div>
        </div>

        <div style={{ marginBottom: 20, textAlign: 'left' }}>
          <h2 style={{ marginBottom: 12, color: '#111827', fontSize: '1.2rem' }}>Giocatori ({playersCount}):</h2>
          {playersCount === 0 ? (
            <p style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(0,0,0,0.05)', color: '#6b7280' }}>Nessun giocatore ancora...</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
              {Object.entries(roomData.players || {}).map(([id, player]) => (
                <li 
                  key={id} 
                  className="fade-up" 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '12px 16px', 
                    borderRadius: 10, 
                    background: id === currentUser?.uid ? 'rgba(99,102,241,0.1)' : 'rgba(0,0,0,0.05)', 
                    border: `1px solid ${id === currentUser?.uid ? 'rgba(99,102,241,0.3)' : 'rgba(0,0,0,0.1)'}`,
                    color: '#111827'
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{player.name || 'Guest'}</span>
                  {id === roomData.hostId && (
                    <span className="bubble" style={{ background: 'rgba(99,102,241,0.18)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.35)' }}>
                      Host
                    </span>
                  )}
                  {id === currentUser?.uid && id !== roomData.hostId && (
                    <span className="bubble" style={{ background: 'rgba(16,185,129,0.18)', color: '#10b981', border: '1px solid rgba(16,185,129,0.35)' }}>
                      Tu
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {isHost && roomData.status === 'waiting' && (
            <button className="btn-3d" onClick={startGame} style={{ minWidth: 200 }}>
              Avvia Partita
            </button>
          )}

          {roomData.status === 'playing' && (
            <div style={{ width: '100%', padding: '16px', borderRadius: 10, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <p style={{ color: '#10b981', fontWeight: 700, margin: 0 }}>🎮 La partita è in corso...</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
