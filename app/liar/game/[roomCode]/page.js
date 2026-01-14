'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import {
  ref,
  onValue,
  update,
  set,
} from 'firebase/database';
import {
  hasAvailableWildcard,
  validateWildcardActivationInChallenge,
} from '@/lib/luckyLiarWildcard';
import {
  resolveChallenge,
  getResultHighlight,
  getWildcardDisplayData,
} from '@/lib/luckyLiarChallenge';
import {
  validateDeclarationProgression,
  generateValidDeclarations,
  parseFreeModeDeclaration,
} from '@/lib/luckyLiarDeclarations';
import {
  executeClaimAction,
  executeChallengeAction,
  executePassAction,
} from '@/lib/luckyLiarGameLogic';
import { checkGameEnd, determineWinner } from '@/lib/luckyLiarGameEnd';
import { generateBehaviorIndicators } from '@/lib/luckyLiarBehaviorMetrics';
import {
  PlayerHand,
  GamePlayerCard,
  CreditDisplay,
} from '@/components/liar/UIComponents';
import {
  DeclarationTimeline,
} from '@/LUCKY_LIAR_COMPONENTS_7_8';

export default function LiarGamePage() {
  const router = useRouter();
  const params = useParams();
  const roomCode = params.roomCode;
  const [pageLoading, setPageLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  // Game state
  const [gameState, setGameState] = useState(null);
  const [playerHands, setPlayerHands] = useState(null);
  const [wildcards, setWildcards] = useState(null);
  const [currentChallenge, setCurrentChallenge] = useState(null);
  const [challengeResult, setChallengeResult] = useState(null);

  // UI state
  const [declarationInput, setDeclarationInput] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);
  const [wildcardActivationRequested, setWildcardActivationRequested] = useState(false);
  const [animatingWildcard, setAnimatingWildcard] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Subscriptions
  const unsubscribesRef = useRef([]);

  // ========================================
  // AUTH CHECK
  // ========================================
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserId(user.uid);
        setPageLoading(false);
      } else {
        router.push('/auth');
      }
    });

    return () => unsubscribe();
  }, [router]);

  // ========================================
  // SUBSCRIBE TO GAME STATE
  // ========================================
  useEffect(() => {
    if (!userId || !roomCode) return;

    const gameRef = ref(db, `rooms_liar/${roomCode}`);
    const unsubGame = onValue(gameRef, (snapshot) => {
      if (snapshot.exists()) {
        setGameState(snapshot.val());
      }
    });

    const handsRef = ref(db, `rooms_liar/${roomCode}/current/playerHands/${userId}`);
    const unsubHands = onValue(handsRef, (snapshot) => {
      if (snapshot.exists()) {
        setPlayerHands(snapshot.val());
      }
    });

    const wildcardsRef = ref(db, `rooms_liar/${roomCode}/current/wildcards`);
    const unsubWildcards = onValue(wildcardsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const wildcardArray = Array.isArray(data) ? data : Object.values(data);
        setWildcards(wildcardArray);
      }
    });

    const challengeRef = ref(db, `rooms_liar/${roomCode}/current/challenge`);
    const unsubChallenge = onValue(challengeRef, (snapshot) => {
      if (snapshot.exists()) {
        setCurrentChallenge(snapshot.val());
        if (snapshot.val().result) {
          setChallengeResult(snapshot.val().result);
          setWildcardActivationRequested(false);
        }
      }
    });

    unsubscribesRef.current = [unsubGame, unsubHands, unsubWildcards, unsubChallenge];

    return () => {
      unsubscribesRef.current.forEach((unsub) => unsub());
    };
  }, [userId, roomCode]);

  // ========================================
  // LOADING & ERROR STATES
  // ========================================
  if (pageLoading) {
    return <div className="loading">Caricamento...</div>;
  }

  if (!gameState) {
    return <div className="error">Stanza non trovata</div>;
  }

  // ========================================
  // STATE SHORTCUTS
  // ========================================
  const isMyTurn = gameState?.current?.turn?.currentPlayerId === userId;
  const isDeclarationPhase = gameState?.current?.phase === 'turn';
  const isChallengePhase = gameState?.current?.phase === 'challenge';
  const myHand = playerHands || [];
  const currentPlayer = gameState?.players?.[gameState?.current?.turn?.currentPlayerId];
  const lastClaim = gameState?.current?.turn?.lastClaim;
  const wildcardAvailable = hasAvailableWildcard(userId, wildcards || []);

  const validDeclarations = lastClaim
    ? generateValidDeclarations(lastClaim, gameState?.current?.declarationMode)
    : [];

  // ========================================
  // SUBMIT DECLARATION
  // ========================================
  const handleSubmitDeclaration = async () => {
    if (!isMyTurn || !isDeclarationPhase || !selectedCard) {
      setError('Seleziona una carta prima di dichiarare');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const declaration = {
        suit: selectedCard.suit,
        value: selectedCard.value,
        player: userId,
        timestamp: Date.now(),
      };

      // Valida declarazione
      if (!validateDeclarationProgression(
        declaration,
        lastClaim,
        gameState?.current?.declarationMode
      )) {
        setError('Dichiarazione non valida');
        setSubmitting(false);
        return;
      }

      // Scrivi dichiarazione su Firebase
      const turnRef = ref(db, `rooms_liar/${roomCode}/current/turn`);
      await update(turnRef, {
        lastClaim: declaration,
      });

      setDeclarationInput('');
      setSelectedCard(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ========================================
  // SUBMIT CHALLENGE
  // ========================================
  const handleSubmitChallenge = async () => {
    if (!lastClaim || !gameState?.current?.turn?.currentPlayerId) {
      setError('Nessuna dichiarazione da sfidare');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const challenge = {
        challengerId: userId,
        targetPlayerId: gameState.current.turn.currentPlayerId,
        claimId: lastClaim?.id,
        timestamp: Date.now(),
        wildcardActivated: wildcardActivationRequested && wildcardAvailable,
      };

      // Scrivi sfida su Firebase
      const challengeRef = ref(db, `rooms_liar/${roomCode}/current/challenge`);
      await set(challengeRef, challenge);

      setWildcardActivationRequested(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ========================================
  // SUBMIT PASS
  // ========================================
  const handleSubmitPass = async () => {
    if (!isMyTurn || !isChallengePhase) {
      setError('Non è il momento di passare');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Prendi il turno successivo
      const players = Object.keys(gameState?.players || {});
      const currentIndex = players.indexOf(gameState.current.turn.currentPlayerId);
      const nextPlayerId = players[(currentIndex + 1) % players.length];

      const turnRef = ref(db, `rooms_liar/${roomCode}/current/turn`);
      await update(turnRef, {
        currentPlayerId: nextPlayerId,
        lastClaim: null,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ========================================
  // RENDER
  // ========================================
  return (
    <div className="liar-game">
      {/* HEADER */}
      <header className="game-header">
        <div className="header-left">
          <h1>🎭 Lucky Liar</h1>
          <span className="room-code">{roomCode}</span>
        </div>
        <div className="header-center">
          <div className="round-badge">
            Round {gameState?.roundIndex + 1} di {gameState?.maxRounds}
          </div>
        </div>
        <div className="header-right">
          <CreditDisplay credits={gameState?.players?.[userId]?.credits || 0} />
        </div>
      </header>

      {/* ERROR BANNER */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="game-container">
        {/* MAIN GAME AREA */}
        <section className="game-main">
          {/* CURRENT TURN INFO */}
          <div className="turn-info">
            <h2>📍 Turno di {currentPlayer?.name || 'Unknown'}</h2>
            {isMyTurn ? (
              <span className="badge turn-badge">È il tuo turno!</span>
            ) : (
              <span className="badge waiting-badge">In attesa...</span>
            )}
          </div>

          {/* PLAYERS GRID */}
          <div className="players-grid">
            {Object.entries(gameState?.players || {}).map(([id, player]) => (
              <GamePlayerCard
                key={id}
                player={{
                  id,
                  name: player.name,
                  credits: player.credits,
                  isActive: id === gameState.current.turn.currentPlayerId,
                  isEliminated: player.isEliminated,
                }}
              />
            ))}
          </div>

          {/* DECLARATION TIMELINE */}
          <div className="timeline-section">
            <DeclarationTimeline
              timeline={gameState?.current?.timeline || []}
              activeClaim={lastClaim}
            />
          </div>
        </section>

        {/* SIDEBAR - MY HAND & ACTIONS */}
        <aside className="game-sidebar">
          {/* MY HAND */}
          <div className="hand-section">
            <h3>🎴 La Mia Mano</h3>
            <PlayerHand
              cards={myHand}
              selectedCard={selectedCard}
              onCardSelect={setSelectedCard}
              disabled={!isMyTurn}
            />
          </div>

          {/* ACTIONS */}
          <div className="actions-section">
            <h3>⚡ Azioni</h3>

            {/* DECLARATION PHASE */}
            {isDeclarationPhase && isMyTurn && (
              <div className="action-group">
                <h4>Dichiara</h4>
                <button
                  className="btn-declare"
                  onClick={handleSubmitDeclaration}
                  disabled={!selectedCard || submitting}
                >
                  {submitting ? 'Invio...' : '📢 Dichiara Carta'}
                </button>
              </div>
            )}

            {/* CHALLENGE PHASE */}
            {isChallengePhase && !isMyTurn && lastClaim && (
              <div className="action-group">
                <h4>Sfida</h4>
                <div className="challenge-options">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={wildcardActivationRequested}
                      onChange={(e) =>
                        setWildcardActivationRequested(e.target.checked)
                      }
                      disabled={!wildcardAvailable}
                    />
                    <span>Usa Wildcard</span>
                  </label>
                </div>
                <button
                  className="btn-challenge"
                  onClick={handleSubmitChallenge}
                  disabled={submitting}
                >
                  {submitting ? 'Invio...' : '⚔️ Sfida'}
                </button>
              </div>
            )}

            {/* PASS ACTION (CHALLENGE PHASE FOR NON-ACTIVE PLAYERS) */}
            {isChallengePhase && !isMyTurn && (
              <div className="action-group">
                <button
                  className="btn-pass"
                  onClick={handleSubmitPass}
                  disabled={submitting}
                >
                  {submitting ? 'Invio...' : '⏭️ Passa'}
                </button>
              </div>
            )}

            {/* NO ACTION AVAILABLE */}
            {!isMyTurn && !lastClaim && (
              <p className="text-gray-400 text-center text-sm py-4">
                In attesa della dichiarazione...
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* STYLES */}
      <style jsx>{`
        .liar-game {
          min-height: 100vh;
          background: linear-gradient(135deg, #1a1f35 0%, #0f172a 50%, #1a0f2e 100%);
          color: #f1f5f9;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding-bottom: 2rem;
        }

        /* HEADER */
        .game-header {
          background: linear-gradient(90deg, #1e293b 0%, #0f172a 100%);
          border-bottom: 3px solid #8b5cf6;
          padding: 1.5rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 4px 20px rgba(139, 92, 246, 0.15);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .header-left h1 {
          font-size: 1.75rem;
          margin: 0;
          font-weight: 900;
          background: linear-gradient(135deg, #a78bfa, #60a5fa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: 1px;
        }

        .room-code {
          background: rgba(139, 92, 246, 0.2);
          border: 2px solid #8b5cf6;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 700;
          color: #c4b5fd;
          letter-spacing: 2px;
          font-family: 'Courier New', monospace;
        }

        .header-center {
          flex: 1;
          text-align: center;
        }

        .round-badge {
          display: inline-block;
          background: linear-gradient(135deg, #3b82f6, #60a5fa);
          color: #fff;
          padding: 0.75rem 1.5rem;
          border-radius: 50px;
          font-size: 0.95rem;
          font-weight: 700;
          box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .header-right {
          text-align: right;
        }

        /* ERROR BANNER */
        .error-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 1rem 2rem;
          padding: 1rem 1.5rem;
          background: linear-gradient(135deg, #dc2626, #b91c1c);
          border-radius: 12px;
          color: #fff;
          font-weight: 600;
          box-shadow: 0 4px 15px rgba(220, 38, 38, 0.3);
          border-left: 4px solid #fca5a5;
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .error-banner button {
          background: none;
          border: none;
          color: #fff;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0;
          opacity: 0.8;
          transition: opacity 0.2s;
        }

        .error-banner button:hover {
          opacity: 1;
        }

        /* CONTAINER */
        .game-container {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 2rem;
          padding: 2rem;
          max-width: 1600px;
          margin: 0 auto;
        }

        /* TURN INFO */
        .turn-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(96, 165, 250, 0.1));
          border: 2px solid #8b5cf6;
          border-radius: 12px;
          margin-bottom: 2rem;
          box-shadow: 0 4px 20px rgba(139, 92, 246, 0.1);
        }

        .turn-info h2 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 800;
          color: #c4b5fd;
        }

        .badge {
          padding: 0.75rem 1.5rem;
          border-radius: 50px;
          font-size: 0.875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .turn-badge {
          background: linear-gradient(135deg, #10b981, #059669);
          color: #fff;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        .waiting-badge {
          background: linear-gradient(135deg, #64748b, #475569);
          color: #e2e8f0;
        }

        /* PLAYERS GRID */
        .players-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        /* TIMELINE */
        .timeline-section {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.8));
          border: 2px solid #334155;
          border-radius: 12px;
          padding: 1.5rem;
          backdrop-filter: blur(10px);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        /* SIDEBAR */
        .game-sidebar {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .hand-section,
        .actions-section {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9));
          border: 2px solid #8b5cf6;
          border-radius: 12px;
          padding: 1.5rem;
          backdrop-filter: blur(10px);
          box-shadow: 0 4px 20px rgba(139, 92, 246, 0.15);
        }

        .hand-section h3,
        .actions-section h3 {
          margin: 0 0 1rem 0;
          font-size: 1.1rem;
          font-weight: 700;
          color: #c4b5fd;
          border-bottom: 2px solid #8b5cf6;
          padding-bottom: 0.75rem;
          letter-spacing: 0.5px;
        }

        .action-group {
          margin-bottom: 1rem;
        }

        .action-group:last-child {
          margin-bottom: 0;
        }

        .action-group h4 {
          margin: 0 0 0.75rem 0;
          font-size: 0.8rem;
          color: #a78bfa;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 700;
        }

        .challenge-options {
          margin-bottom: 1rem;
          padding: 0.75rem;
          background: rgba(139, 92, 246, 0.1);
          border-radius: 8px;
          border: 1px solid rgba(139, 92, 246, 0.2);
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
          font-size: 0.9rem;
          color: #e2e8f0;
          font-weight: 500;
          user-select: none;
        }

        .checkbox-label input {
          cursor: pointer;
          width: 18px;
          height: 18px;
          accent-color: #8b5cf6;
        }

        .checkbox-label:hover {
          color: #f1f5f9;
        }

        /* BUTTONS */
        button {
          width: 100%;
          padding: 0.9rem 1.2rem;
          border: none;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
          color: #fff;
          font-size: 0.95rem;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: rgba(255, 255, 255, 0.1);
          transition: left 0.3s ease;
          z-index: -1;
        }

        button:hover::before {
          left: 100%;
        }

        .btn-declare {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          border: 2px solid #60a5fa;
        }

        .btn-declare:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
          border-color: #93c5fd;
        }

        .btn-challenge {
          background: linear-gradient(135deg, #f59e0b, #d97706);
          border: 2px solid #fbbf24;
        }

        .btn-challenge:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4);
          border-color: #fcd34d;
        }

        .btn-pass {
          background: linear-gradient(135deg, #64748b, #475569);
          border: 2px solid #94a3b8;
        }

        .btn-pass:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(100, 116, 139, 0.4);
          border-color: #cbd5e1;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
        }

        .text-gray-400 {
          color: #94a3b8;
        }

        /* RESPONSIVE */
        @media (max-width: 1200px) {
          .game-container {
            grid-template-columns: 1fr;
          }

          .game-sidebar {
            flex-direction: row;
          }

          .hand-section {
            flex: 1;
          }

          .actions-section {
            flex: 1;
            min-width: 300px;
          }
        }

        @media (max-width: 768px) {
          .game-header {
            flex-wrap: wrap;
            gap: 1rem;
            padding: 1rem;
          }

          .header-left,
          .header-center,
          .header-right {
            flex: 1 1 100%;
            text-align: center;
          }

          .header-left {
            flex: 1 1 100%;
            justify-content: center;
          }

          .header-left h1 {
            font-size: 1.5rem;
          }

          .game-container {
            padding: 1rem;
            gap: 1rem;
          }

          .players-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .game-sidebar {
            flex-direction: column;
          }

          .hand-section,
          .actions-section {
            flex: none;
          }

          .turn-info {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }

          .turn-info h2 {
            font-size: 1.25rem;
          }
        }

        @media (max-width: 480px) {
          .game-header {
            padding: 0.75rem;
          }

          .room-code {
            font-size: 0.75rem;
            padding: 0.4rem 0.8rem;
          }

          .round-badge {
            font-size: 0.8rem;
            padding: 0.5rem 1rem;
          }

          .players-grid {
            grid-template-columns: 1fr;
          }

          button {
            padding: 0.75rem 1rem;
            font-size: 0.85rem;
          }
        }
      `}</style>
    </div>
  );
}
