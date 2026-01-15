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
        alive: true,
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
      
      // Inizializza il primo round
      const playerIds = players.map(p => p.id);
      const firstTurnPlayerId = playerIds[0];
      
      // Inizializza le mani (vuote per ora, Cloud Functions popoleranno con le carte)
      const initialHands = {};
      playerIds.forEach(playerId => {
        initialHands[playerId] = [];
      });
      
      // Inizializza wildcards (Cloud Function assegnerà 0-2 per player)
      const initialWildcards = [];
      
      const nowTimestamp = Date.now();
      
      await update(roomRef, {
        status: 'playing',
        round: 0,
        current: {
          phase: 'turn',
          turn: {
            currentPlayerId: firstTurnPlayerId,
            lastClaim: null,
          },
          hands: initialHands,
          wildcards: initialWildcards,
          timeline: [],
          declarationMode: roomData.declarationMode,
          roundStartedAt: nowTimestamp,
          roundResetting: false,
        },
        turnEndTime: nowTimestamp + 60000, // 1 minuto per dichiarare
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
      {/* VIDEO BACKGROUND */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="video-background"
      >
        <source src="/background_ll.mp4" type="video/mp4" />
      </video>
      <div className="video-overlay"></div>

      <header className="lobby-header">
        <h1>🎭 Lobby - {roomCode}</h1>
      </header>

      <main className="lobby-main">
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

      </main>

      <style jsx>{`
        .liar-lobby {
          min-height: 100vh;
          font-family: 'Press Start 2P', 'Courier New', monospace;
          color: #f1f5f9;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        /* VIDEO BACKGROUND */
        .video-background {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 0;
        }

        .video-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          z-index: 1;
        }

        /* HEADER */
        .lobby-header {
          background: rgba(15, 23, 42, 0.95);
          border-bottom: 3px solid #8b5cf6;
          padding: 2rem;
          position: relative;
          z-index: 50;
          text-align: center;
        }

        .lobby-header h1 {
          margin: 0;
          font-size: 1.75rem;
          font-weight: 900;
          color: #c4b5fd;
          letter-spacing: 1px;
        }

        /* MAIN */
        .lobby-main {
          position: relative;
          z-index: 10;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2rem;
          padding: 2rem;
          max-width: 1000px;
          margin: 0 auto;
          width: 100%;
        }

        /* SECTIONS */
        section {
          background: rgba(30, 41, 59, 0.98);
          border: 2px solid #8b5cf6;
          border-radius: 12px;
          padding: 2rem;
          backdrop-filter: blur(10px);
          box-shadow: 0 4px 20px rgba(139, 92, 246, 0.2);
        }

        section h2 {
          margin: 0 0 1.5rem 0;
          font-size: 1.25rem;
          font-weight: 700;
          color: #c4b5fd;
          border-bottom: 2px solid #8b5cf6;
          padding-bottom: 0.75rem;
          letter-spacing: 0.5px;
        }

        /* CONFIG */
        .config-items {
          display: flex;
          gap: 1.5rem;
          flex-wrap: wrap;
        }

        .config-item {
          flex: 1;
          min-width: 150px;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 1rem;
          background: rgba(15, 23, 42, 0.7);
          border: 2px solid #334155;
          border-radius: 8px;
        }

        .config-item span {
          font-size: 0.75rem;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 700;
        }

        .config-item strong {
          font-size: 1.2rem;
          font-weight: 700;
          color: #60a5fa;
          font-family: 'Courier New', monospace;
        }

        /* PLAYERS */
        .players-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .player-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          background: rgba(15, 23, 42, 0.7);
          border: 2px solid #334155;
          border-radius: 8px;
          transition: all 0.3s ease;
        }

        .player-card:hover {
          border-color: #8b5cf6;
          background: rgba(15, 23, 42, 0.85);
        }

        .player-info {
          flex: 1;
        }

        .player-name {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          color: #e2e8f0;
          font-family: 'Press Start 2P', monospace;
          font-size: 0.9rem;
        }

        .host-badge {
          font-size: 0.65rem;
          background: #f59e0b;
          color: #000;
          padding: 0.35rem 0.75rem;
          border-radius: 4px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        .player-credits {
          font-size: 0.85rem;
          color: #94a3b8;
          font-family: 'Courier New', monospace;
        }

        .player-status {
          text-align: right;
        }

        .ready {
          color: #4ade80;
          font-weight: 700;
          font-family: 'Press Start 2P', monospace;
          font-size: 0.85rem;
        }

        .not-ready {
          color: #fbbf24;
          font-weight: 700;
          font-family: 'Press Start 2P', monospace;
          font-size: 0.85rem;
        }

        /* ACTIONS */
        .actions {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 2rem;
          background: rgba(30, 41, 59, 0.98);
          border: 2px solid #8b5cf6;
          border-radius: 12px;
          backdrop-filter: blur(10px);
        }

        button {
          padding: 1rem;
          font-size: 0.95rem;
          font-weight: 700;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
          color: #fff;
          font-family: 'Press Start 2P', monospace;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .btn-ready {
          background: #64748b;
          border: 2px solid #94a3b8;
        }

        .btn-ready:hover:not(:disabled) {
          background: #475569;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(100, 116, 139, 0.4);
        }

        .btn-ai {
          background: linear-gradient(135deg, #8b5cf6, #a78bfa);
          border: 2px solid #c4b5fd;
        }

        .btn-ai:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4);
        }

        .btn-start {
          background: linear-gradient(135deg, #10b981, #059669);
          border: 2px solid #34d399;
        }

        .btn-start:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
        }

        .btn-start:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        button:disabled {
          cursor: not-allowed;
        }

        /* RESPONSIVE */
        @media (max-width: 768px) {
          .lobby-header {
            padding: 1.5rem 1rem;
          }

          .lobby-header h1 {
            font-size: 1.25rem;
          }

          .lobby-main {
            padding: 1rem;
            gap: 1.5rem;
          }

          section {
            padding: 1.5rem;
          }

          .config-items {
            flex-direction: column;
          }

          .config-item {
            min-width: 100%;
          }

          .player-card {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }

          .player-status {
            text-align: left;
            width: 100%;
          }
        }

        @media (max-width: 480px) {
          .lobby-header {
            padding: 1rem 0.5rem;
          }

          .lobby-header h1 {
            font-size: 1rem;
            letter-spacing: 0;
          }

          .lobby-main {
            padding: 0.75rem;
          }

          section {
            padding: 1rem;
            border-width: 2px;
          }

          section h2 {
            font-size: 0.9rem;
          }

          .player-name {
            font-size: 0.75rem;
          }

          button {
            font-size: 0.8rem;
            padding: 0.75rem;
          }
        }
      `}</style>
    </div>
  );
}
