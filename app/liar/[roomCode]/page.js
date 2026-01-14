'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';

export default function LiarLobbyPage() {
  const router = useRouter();
  const params = useParams();
  const roomCode = params.roomCode;
  const [userId, setUserId] = useState(null);
  const [roomData, setRoomData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [startingGame, setStartingGame] = useState(false);
  const unsubscribeRef = useRef(null);

  // ========================================
  // AUTH CHECK
  // ========================================
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        router.push('/auth');
      }
    });

    return () => unsubscribe();
  }, [router]);

  // ========================================
  // SUBSCRIBE TO ROOM DATA
  // ========================================
  useEffect(() => {
    if (!userId || !roomCode) return;

    const roomRef = ref(db, `rooms_liar/${roomCode}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setRoomData(data);
        setIsHost(data.hostId === userId);

        // Convert players object to array
        if (data.players) {
          const playersArray = Object.entries(data.players).map(([id, player]) => ({
            id,
            ...player,
          }));
          setPlayers(playersArray);
        }

        setLoading(false);

        // Auto redirect quando il gioco inizia
        if (data.status === 'playing') {
          router.push(`/liar/game/${roomCode}`);
        }
      } else {
        setLoading(false);
      }
    });

    unsubscribeRef.current = unsubscribe;
    return () => unsubscribe();
  }, [userId, roomCode, router]);

  // ========================================
  // TOGGLE READY STATUS
  // ========================================
  const handleToggleReady = async () => {
    if (!userId || !roomCode) return;

    try {
      const playerRef = ref(db, `rooms_liar/${roomCode}/players/${userId}`);
      const currentPlayer = players.find((p) => p.id === userId);
      await update(playerRef, {
        isReady: !currentPlayer?.isReady,
      });
    } catch (err) {
      console.error('Error toggling ready:', err);
    }
  };

  // ========================================
  // ADD AI PLAYER (TESTING ONLY)
  // ========================================
  const handleAddAIPlayer = async () => {
    if (!isHost || !roomCode) return;

    try {
      const aiId = `ai_${Date.now()}`;
      const aiRef = ref(db, `rooms_liar/${roomCode}/players/${aiId}`);
      await update(aiRef, {
        name: 'Bot AI',
        credits: 200,
        isReady: true,
        isAI: true,
      });
    } catch (err) {
      console.error('Error adding AI:', err);
    }
  };

  // ========================================
  // START GAME (HOST ONLY)
  // ========================================
  const handleStartGame = async () => {
    if (!isHost || players.length < 2 || startingGame) return;

    try {
      setStartingGame(true);
      const roomRef = ref(db, `rooms_liar/${roomCode}`);
      await update(roomRef, {
        status: 'playing',
      });
      // Router redirect happens automatically via onValue subscription
    } catch (err) {
      console.error('Error starting game:', err);
      setStartingGame(false);
    }
  };

  // ========================================
  // RENDER
  // ========================================
  if (loading) {
    return <div className="liar-lobby">Caricamento...</div>;
  }

  if (!roomData) {
    return <div className="liar-lobby">Stanza non trovata</div>;
  }

  const currentPlayer = players.find((p) => p.id === userId);
  const canStartGame = isHost && players.length >= 2;

  return (
    <div className="liar-lobby">
      <h1>🎭 Lobby - {roomCode}</h1>

      {/* CONFIG */}
      <section className="config">
        <h2>Configurazione</h2>
        <div className="config-items">
          <div className="config-item">
            <span>Round:</span>
            <strong>{roomData.maxRounds}</strong>
          </div>
          <div className="config-item">
            <span>Modalità:</span>
            <strong>
              {roomData.declarationMode === 'assisted'
                ? 'Guidata'
                : 'Libera'}
            </strong>
          </div>
          <div className="config-item">
            <span>Posta:</span>
            <strong>{roomData.wager} crediti</strong>
          </div>
        </div>
      </section>

      {/* PLAYERS LIST */}
      <section className="players">
        <h2>Giocatori ({players.length})</h2>
        <div className="players-list">
          {players.map((player) => (
            <div key={player.id} className="player-card">
              <div className="player-info">
                <div className="player-name">
                  {player.name}
                  {player.id === roomData.hostId && (
                    <span className="host-badge">HOST</span>
                  )}
                </div>
                <div className="player-credits">{player.credits} crediti</div>
              </div>
              <div className="player-status">
                {player.isReady ? (
                  <span className="ready">✅ Pronto</span>
                ) : (
                  <span className="not-ready">⏳ Non pronto</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ACTIONS */}
      <section className="actions">
        {!isHost && (
          <button
            className="btn-ready"
            onClick={handleToggleReady}
            style={{
              backgroundColor: currentPlayer?.isReady ? '#4ade80' : '#64748b',
            }}
          >
            {currentPlayer?.isReady ? '✅ Pronto' : '⏳ Non Pronto'}
          </button>
        )}

        {isHost && (
          <>
            <button
              className="btn-ai"
              onClick={handleAddAIPlayer}
            >
              🤖 Aggiungi AI (Test)
            </button>
            <button
              className="btn-start"
              onClick={handleStartGame}
              disabled={!canStartGame || startingGame}
              style={{
                opacity: canStartGame ? 1 : 0.5,
                cursor: canStartGame ? 'pointer' : 'not-allowed',
              }}
            >
              {startingGame ? 'Avvio...' : '🎬 Inizia Partita'}
            </button>
          </>
        )}
      </section>

      <style jsx>{`
        .liar-lobby {
          max-width: 600px;
          margin: 0 auto;
          padding: 2rem;
          min-height: 100vh;
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          color: #f1f5f9;
          font-family: system-ui, -apple-system, sans-serif;
        }

        h1 {
          text-align: center;
          margin-bottom: 2rem;
          font-size: 2rem;
          font-weight: bold;
        }

        h2 {
          font-size: 1.25rem;
          margin-bottom: 1rem;
          font-weight: 600;
          border-bottom: 2px solid #64748b;
          padding-bottom: 0.5rem;
        }

        section {
          margin-bottom: 2rem;
          background: #1e293b;
          padding: 1.5rem;
          border-radius: 0.75rem;
          border: 1px solid #334155;
        }

        /* CONFIG */
        .config-items {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .config-item {
          flex: 1;
          min-width: 150px;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          padding: 0.75rem;
          background: #0f172a;
          border-radius: 0.5rem;
          border: 1px solid #334155;
        }

        .config-item span {
          font-size: 0.875rem;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .config-item strong {
          font-size: 1.25rem;
          font-weight: 700;
          color: #60a5fa;
        }

        /* PLAYERS */
        .players-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .player-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          background: #0f172a;
          border-radius: 0.5rem;
          border: 1px solid #334155;
          transition: border-color 0.2s;
        }

        .player-card:hover {
          border-color: #64748b;
        }

        .player-info {
          flex: 1;
        }

        .player-name {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
        }

        .host-badge {
          font-size: 0.75rem;
          background: #f59e0b;
          color: #000;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-weight: 700;
        }

        .player-credits {
          font-size: 0.875rem;
          color: #94a3b8;
        }

        .player-status {
          text-align: right;
        }

        .ready {
          color: #4ade80;
          font-weight: 600;
        }

        .not-ready {
          color: #fbbf24;
          font-weight: 600;
        }

        /* ACTIONS */
        .actions {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 1.5rem;
        }

        button {
          padding: 0.75rem 1.5rem;
          font-size: 1rem;
          font-weight: 600;
          border: none;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
          color: #fff;
        }

        .btn-ready {
          background: #64748b;
        }

        .btn-ready:hover:not(:disabled) {
          background: #475569;
        }

        .btn-ai {
          background: #8b5cf6;
        }

        .btn-ai:hover:not(:disabled) {
          background: #7c3aed;
        }

        .btn-start {
          background: #10b981;
        }

        .btn-start:hover:not(:disabled) {
          background: #059669;
        }

        .btn-start:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        button:disabled {
          cursor: not-allowed;
        }

        @media (max-width: 640px) {
          .liar-lobby {
            padding: 1rem;
          }

          h1 {
            font-size: 1.5rem;
          }

          .config-items {
            flex-direction: column;
          }

          .config-item {
            min-width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
