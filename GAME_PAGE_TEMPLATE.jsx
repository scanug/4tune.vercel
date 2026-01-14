/**
 * LUCKY LIAR - Game Page Implementation Template
 * Esempio di come implementare la pagina di gioco con wildcard
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import {
  ref,
  onValue,
  update,
  get,
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
  generateAssistedModeOptions,
  parseFreeModeDeclaration,
} from '@/lib/luckyLiarDeclarations';
import {
  executeClaimAction,
  executeChallengeAction,
  executePassAction,
} from '@/lib/luckyLiarGameLogic';

export default function LuckyLiarGamePage() {
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
  const [wildcardActivationRequested, setWildcardActivationRequested] = useState(false);
  const [animatingWildcard, setAnimatingWildcard] = useState(false);
  const [error, setError] = useState(null);

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

    // Game state
    const gameRef = ref(db, `rooms_liar/${roomCode}`);
    const unsubGame = onValue(gameRef, (snapshot) => {
      if (snapshot.exists()) {
        setGameState(snapshot.val());
      }
    });

    // Player hands (only read own)
    const handsRef = ref(db, `rooms_liar/${roomCode}/current/playerHands/${userId}`);
    const unsubHands = onValue(handsRef, (snapshot) => {
      if (snapshot.exists()) {
        setPlayerHands(snapshot.val());
      }
    });

    // Wildcards
    const wildcardsRef = ref(db, `rooms_liar/${roomCode}/current/wildcards`);
    const unsubWildcards = onValue(wildcardsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const wildcardArray = Array.isArray(data) ? data : Object.values(data);
        setWildcards(wildcardArray);
      }
    });

    // Current challenge
    const challengeRef = ref(db, `rooms_liar/${roomCode}/current/challenge`);
    const unsubChallenge = onValue(challengeRef, (snapshot) => {
      if (snapshot.exists()) {
        setCurrentChallenge(snapshot.val());
        if (snapshot.val().result) {
          setChallengeResult(snapshot.val().result);
          setWildcardActivationRequested(false); // Reset
        }
      }
    });

    unsubscribesRef.current = [unsubGame, unsubHands, unsubWildcards, unsubChallenge];

    return () => {
      unsubscribesRef.current.forEach((unsub) => unsub());
    };
  }, [userId, roomCode]);

  // ========================================
  // MAKE CLAIM
  // ========================================
  const handleMakeClaim = async (quantity, value) => {
    try {
      setError(null);

      if (!gameState?.current || !gameState?.players) {
        setError('Stato di gioco non caricato');
        return;
      }

      // Execute locally first (validate)
      const result = executeClaimAction(
        gameState.current,
        userId,
        auth.currentUser?.displayName || 'Player',
        quantity,
        value,
        Object.keys(gameState.players)
      );

      if (!result.success) {
        setError(result.error);
        return;
      }

      // Update Firebase
      const turnRef = ref(db, `rooms_liar/${roomCode}/current/turn`);
      await update(turnRef, result.roundState.turn);

      setDeclarationInput('');
    } catch (err) {
      setError('Errore nella dichiarazione: ' + err.message);
    }
  };

  // ========================================
  // MAKE FREE MODE DECLARATION
  // ========================================
  const handleFreeModeClaim = async () => {
    if (!declarationInput.trim()) return;

    try {
      // Parse the input
      const parsed = parseFreeModeDeclaration(declarationInput);
      if (!parsed.valid) {
        setError('Non ho capito. Prova "3 assi" o "almeno 2 re"');
        return;
      }

      await handleMakeClaim(parsed.quantity, parsed.value);
    } catch (err) {
      setError('Errore: ' + err.message);
    }
  };

  // ========================================
  // CHALLENGE
  // ========================================
  const handleChallenge = async () => {
    try {
      setError(null);

      if (!gameState?.current || !gameState?.players) {
        setError('Stato di gioco non caricato');
        return;
      }

      const result = executeChallengeAction(
        gameState.current,
        userId,
        Object.keys(gameState.players)
      );

      if (!result.success) {
        setError(result.error);
        return;
      }

      // Update challenge state
      const challengeRef = ref(db, `rooms_liar/${roomCode}/current/challenge`);
      await set(challengeRef, result.challengeResult);

      // Store that we need to resolve this
      setCurrentChallenge({
        ...result.challengeResult,
        state: 'pending_wildcard_decision',
      });
    } catch (err) {
      setError('Errore nella sfida: ' + err.message);
    }
  };

  // ========================================
  // ACTIVATE WILDCARD
  // ========================================
  const handleActivateWildcard = async () => {
    try {
      if (!wildcards || wildcards.length === 0) {
        setError('Nessuna wildcard disponibile');
        return;
      }

      // Validate activation
      const validation = validateWildcardActivationInChallenge(userId, wildcards);
      if (!validation.valid) {
        setError(validation.reason);
        return;
      }

      // Update Firebase
      const wildcardRef = ref(
        db,
        `rooms_liar/${roomCode}/current/challenge/wildcardActivatedBy`
      );
      await update(wildcardRef, userId);

      setWildcardActivationRequested(true);
      setAnimatingWildcard(true);

      // Animate wildcard effect
      setTimeout(() => {
        setAnimatingWildcard(false);
      }, 1500);
    } catch (err) {
      setError('Errore attivazione wildcard: ' + err.message);
    }
  };

  // ========================================
  // PASS
  // ========================================
  const handlePass = async () => {
    try {
      setError(null);

      if (!gameState?.current || !gameState?.players) {
        setError('Stato di gioco non caricato');
        return;
      }

      const result = executePassAction(
        gameState.current,
        userId,
        Object.keys(gameState.players)
      );

      if (!result.success) {
        setError(result.error);
        return;
      }

      // Update Firebase
      const turnRef = ref(db, `rooms_liar/${roomCode}/current/turn`);
      await update(turnRef, result.roundState.turn);
    } catch (err) {
      setError('Errore nel passo: ' + err.message);
    }
  };

  // ========================================
  // RENDER: LOADING
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
  const isMyTurn =
    gameState?.current?.turn?.currentPlayerId === userId;
  const isDeclarationPhase =
    gameState?.current?.phase === 'turn';
  const isChallengePhase =
    gameState?.current?.phase === 'challenge';
  const myHand = playerHands || [];
  const currentPlayer = gameState?.players?.[gameState?.current?.turn?.currentPlayerId];
  const lastClaim = gameState?.current?.turn?.lastClaim;
  const wildcardAvailable = hasAvailableWildcard(userId, wildcards || []);

  // Generate valid declarations based on last claim
  const validDeclarations = lastClaim
    ? generateValidDeclarations(lastClaim, gameState?.current?.declarationMode)
    : [];

  // ========================================
  // RENDER: GAME UI
  // ========================================
  return (
    <div className="lucky-liar-game">
      <div className="game-header">
        <h1>🃏 Lucky Liar</h1>
        <div className="room-info">
          Stanza: <span className="code">{roomCode}</span>
        </div>
        <div className="round-info">
          Round {gameState.roundIndex + 1} di {gameState.maxRounds}
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="error-banner">
          <span className="close" onClick={() => setError(null)}>×</span>
          {error}
        </div>
      )}

      {/* MAIN GAME AREA */}
      <div className="game-main">
        {/* LEFT: HAND DISPLAY */}
        <div className="left-panel">
          <div className="hand-section">
            <h2>La Tua Mano</h2>
            <div className="cards-display">
              {myHand.map((card, idx) => (
                <div key={idx} className="card">
                  <div className="value">{card.value}</div>
                  <div className="suit">{card.suit}</div>
                </div>
              ))}
            </div>
          </div>

          {/* WILDCARD STATUS */}
          {wildcards && (
            <div className="wildcard-status">
              <h3>🎴 Wildcard</h3>
              {wildcardAvailable ? (
                <div className="available">
                  Hai una wildcard disponibile!
                </div>
              ) : (
                <div className="unavailable">
                  Nessuna wildcard disponibile
                </div>
              )}
            </div>
          )}
        </div>

        {/* CENTER: GAME STATE */}
        <div className="center-panel">
          {/* TURN STATE */}
          {isDeclarationPhase && (
            <div className="phase-declaration">
              <h2>Fase: Dichiarazioni</h2>

              {isMyTurn ? (
                <div className="my-turn">
                  <p className="subtitle">È il tuo turno!</p>

                  {/* LAST CLAIM */}
                  {lastClaim && (
                    <div className="last-claim">
                      <strong>{lastClaim.playerName}</strong> ha dichiarato:
                      <div className="claim">
                        {lastClaim.quantity} {lastClaim.value}
                      </div>
                    </div>
                  )}

                  {/* DECLARATION MODE */}
                  {gameState?.current?.declarationMode === 'free' ? (
                    <div className="free-mode">
                      <input
                        type="text"
                        placeholder="Es: 3 assi, almeno 2 re..."
                        value={declarationInput}
                        onChange={(e) => setDeclarationInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') handleFreeModeClaim();
                        }}
                      />
                      <button onClick={handleFreeModeClaim}>
                        Dichiara
                      </button>
                    </div>
                  ) : (
                    <div className="assisted-mode">
                      <p>Scegli una dichiarazione:</p>
                      {validDeclarations.map((decl, idx) => (
                        <button
                          key={idx}
                          onClick={() =>
                            handleMakeClaim(decl.quantity, decl.value)
                          }
                        >
                          {decl.quantity} {decl.value}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* ACTION BUTTONS */}
                  <div className="actions">
                    <button className="pass" onClick={handlePass}>
                      Passa (-10 crediti)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="other-turn">
                  <p>Aspetta il turno di <strong>{currentPlayer?.name}</strong></p>
                  {lastClaim && (
                    <div className="last-claim">
                      Ultima dichiarazione: <strong>{lastClaim.quantity} {lastClaim.value}</strong>
                    </div>
                  )}
                  {gameState.current?.turn?.canChallenge && (
                    <button className="challenge-btn" onClick={handleChallenge}>
                      Sfida! ⚔️
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* CHALLENGE STATE */}
          {isChallengePhase && currentChallenge && !challengeResult && (
            <div className="phase-challenge">
              <h2>🔍 Sfida in Corso</h2>
              <div className="challenge-info">
                <div className="challenger">
                  Sfida di: <strong>{currentChallenge.challengerName}</strong>
                </div>
                <div className="claimer">
                  Dichiarazione di: <strong>{currentChallenge.claimerName}</strong>
                </div>
                <div className="claim">
                  Dichiarato: <strong>{currentChallenge.claim.quantity} {currentChallenge.claim.value}</strong>
                </div>
              </div>

              {/* WILDCARD OPTION */}
              {wildcardAvailable &&
                currentChallenge &&
                (userId === currentChallenge.challengerId ||
                  userId === currentChallenge.claimerId) && (
                  <div className="wildcard-option">
                    <button
                      className={`wildcard-btn ${animatingWildcard ? 'activating' : ''}`}
                      onClick={handleActivateWildcard}
                    >
                      🎴 Attiva Wildcard
                    </button>
                    {wildcardActivationRequested && (
                      <div className="wildcard-activated">
                        ✓ Wildcard attivata!
                      </div>
                    )}
                  </div>
                )}
            </div>
          )}

          {/* CHALLENGE RESULT */}
          {challengeResult && (
            <div className="phase-result">
              <h2>📊 Risultato Sfida</h2>

              {(() => {
                const highlight = getResultHighlight(challengeResult);
                return (
                  <div
                    className="result-display"
                    style={{ borderColor: highlight.color }}
                  >
                    <h3 style={{ color: highlight.color }}>
                      {highlight.icon} {highlight.title}
                    </h3>

                    <div className="details">
                      <p>
                        Dichiarato: <strong>{challengeResult.claimedQuantity}</strong>
                      </p>
                      <p>
                        Reali: <strong>{challengeResult.actualCount}</strong>
                      </p>
                      <p>
                        Perdente: <strong>{challengeResult.loserName}</strong>
                      </p>
                    </div>

                    {/* PENALTY */}
                    <div className="penalty-display">
                      <span>Penalità:</span>
                      {challengeResult.wildcardEffect?.wasUsed ? (
                        <div className="penalty-modified">
                          <span className="original">
                            {challengeResult.penalty}
                          </span>
                          <span className="arrow">→</span>
                          <span className="modified">
                            {challengeResult.modifiedPenalty}
                          </span>
                        </div>
                      ) : (
                        <span className="amount">
                          {challengeResult.penalty} crediti
                        </span>
                      )}
                    </div>

                    {/* WILDCARD EFFECT */}
                    {challengeResult.wildcardEffect?.wasUsed && (
                      (() => {
                        const displayData = getWildcardDisplayData(
                          challengeResult.wildcardEffect
                        );
                        return (
                          <div
                            className="wildcard-effect"
                            style={{ borderColor: displayData.color }}
                          >
                            <div className="effect-header">
                              <span className="icon">{displayData.icon}</span>
                              <span className="title">
                                {displayData.description}
                              </span>
                            </div>
                            <p className="explanation">
                              {displayData.explanation}
                            </p>
                            {displayData.wasSaved && (
                              <p className="saved">
                                💰 Crediti salvati: {displayData.amountSaved}
                              </p>
                            )}
                            {displayData.wasAmplified && (
                              <p className="amplified">
                                ⚡ Penalità aumentata: +
                                {displayData.amountAdded}
                              </p>
                            )}
                          </div>
                        );
                      })()
                    )}

                    <p className="explanation">
                      {challengeResult.explanation}
                    </p>
                  </div>
                );
              })()}

              {/* NEXT ROUND BUTTON */}
              <button
                className="next-round-btn"
                onClick={() => {
                  // Trigger next round or game end
                  // This would be handled by game logic
                }}
              >
                Prossimo Round →
              </button>
            </div>
          )}
        </div>

        {/* RIGHT: SCOREBOARD */}
        <div className="right-panel">
          <h2>Scoreboard</h2>
          <div className="scoreboard">
            {gameState?.scoreboard &&
              Object.entries(gameState.scoreboard).map(([playerId, score]) => (
                <div
                  key={playerId}
                  className={`player-score ${playerId === userId ? 'me' : ''} ${
                    playerId === gameState?.current?.turn?.currentPlayerId
                      ? 'current-turn'
                      : ''
                  }`}
                >
                  <span className="name">{score.name}</span>
                  <span className="points">{score.points} crediti</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* CLAIM HISTORY */}
      <div className="game-footer">
        <h3>Cronologia Dichiarazioni</h3>
        <div className="claims-log">
          {gameState?.current?.turn?.claimHistory?.map((claim, idx) => (
            <div key={idx} className="claim-log-item">
              <span className="player">{claim.playerName}:</span>
              <span className="declaration">
                {claim.quantity} {claim.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
