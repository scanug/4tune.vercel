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
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          color: #f1f5f9;
          font-family: system-ui, -apple-system, sans-serif;
        }

        /* HEADER */
        .game-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem 2rem;
          background: #0f172a;
          border-bottom: 2px solid #334155;
        }

        .header-left,
        .header-right {
          flex: 1;
        }

        .header-center {
          flex: 1;
          text-align: center;
        }

        .header-left h1 {
          font-size: 1.5rem;
          margin: 0;
          margin-bottom: 0.25rem;
        }

        .room-code {
          font-size: 0.875rem;
          color: #94a3b8;
          font-weight: 600;
        }

        .round-badge {
          display: inline-block;
          background: #60a5fa;
          color: #fff;
          padding: 0.5rem 1rem;
          border-radius: 9999px;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .header-right {
          text-align: right;
        }

        /* ERROR BANNER */
        .error-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 1rem;
          padding: 1rem;
          background: #dc2626;
          border-radius: 0.5rem;
          color: #fff;
          font-weight: 600;
        }

        .error-banner button {
          background: none;
          border: none;
          color: #fff;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0;
        }

        /* CONTAINER */
        .game-container {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 2rem;
          padding: 2rem;
          max-width: 1400px;
          margin: 0 auto;
        }

        /* TURN INFO */
        .turn-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          background: #1e293b;
          border: 2px solid #334155;
          border-radius: 0.75rem;
          margin-bottom: 2rem;
        }

        .turn-info h2 {
          margin: 0;
          font-size: 1.25rem;
        }

        .badge {
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .turn-badge {
          background: #10b981;
          color: #fff;
        }

        .waiting-badge {
          background: #64748b;
          color: #fff;
        }

        /* PLAYERS GRID */
        .players-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        /* TIMELINE */
        .timeline-section {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 0.75rem;
          padding: 1.5rem;
        }

        /* SIDEBAR */
        .game-sidebar {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .hand-section,
        .actions-section {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 0.75rem;
          padding: 1.5rem;
        }

        .hand-section h3,
        .actions-section h3 {
          margin: 0 0 1rem 0;
          font-size: 1rem;
          font-weight: 600;
          border-bottom: 2px solid #334155;
          padding-bottom: 0.75rem;
        }

        .action-group {
          margin-bottom: 1.5rem;
        }

        .action-group:last-child {
          margin-bottom: 0;
        }

        .action-group h4 {
          margin: 0 0 0.75rem 0;
          font-size: 0.875rem;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .challenge-options {
          margin-bottom: 1rem;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          font-size: 0.875rem;
          color: #e2e8f0;
        }

        .checkbox-label input {
          cursor: pointer;
        }

        /* BUTTONS */
        button {
          width: 100%;
          padding: 0.75rem;
          border: none;
          border-radius: 0.5rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          color: #fff;
          font-size: 0.875rem;
        }

        .btn-declare {
          background: #3b82f6;
        }

        .btn-declare:hover:not(:disabled) {
          background: #2563eb;
        }

        .btn-challenge {
          background: #f59e0b;
        }

        .btn-challenge:hover:not(:disabled) {
          background: #d97706;
        }

        .btn-pass {
          background: #64748b;
        }

        .btn-pass:hover:not(:disabled) {
          background: #475569;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .text-gray-400 {
          color: #94a3b8;
        }

        /* RESPONSIVE */
        @media (max-width: 1024px) {
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
          }
        }

        @media (max-width: 640px) {
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

          .game-container {
            padding: 1rem;
            gap: 1rem;
          }

          .players-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
