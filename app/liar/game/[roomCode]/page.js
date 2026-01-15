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
  const [turnToken, setTurnToken] = useState(null); // UUID per anti-doppio input
  const [phaseTimeLeft, setPhaseTimeLeft] = useState(30); // Timer UI

  // Subscriptions
  const unsubscribesRef = useRef([]);
  const timeoutTimerRef = useRef(null);

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
  // RECONNECT HANDLER - Restore state on reconnect
  // ========================================
  useEffect(() => {
    if (!userId || !roomCode || !gameState?.current) return;

    // Se il gioco è in stato di gioco attivo, verifica se ci sono disconnessioni
    if (gameState?.status === 'playing') {
      // Recupera l'ID del giocatore corrente per evitare conflitti
      const currentPlayerId = gameState?.current?.turn?.currentPlayerId;
      
      // Log di debug per riconnessione
      console.log('✅ PLAYER RECONNECTED', {
        userId,
        roomCode,
        currentPhase: gameState?.current?.phase,
        currentPlayerId,
      });

      // Ripristina lo stato UI in base alla fase corrente
      if (gameState?.current?.phase === 'turn') {
        // In fase di dichiarazione, reset UI
        setSelectedCard(null);
        setDeclarationInput('');
        setWildcardActivationRequested(false);
      } else if (gameState?.current?.phase === 'challenge') {
        // In fase di sfida, reset UI
        setWildcardActivationRequested(false);
      } else if (gameState?.current?.phase === 'resolve') {
        // In fase di risoluzione, mantieni il risultato visibile
        // (sarà auto-avanzato dallo useEffect di resolve)
      }

      // Reset UI generici
      setError(null);
      setSubmitting(false);
    }
  }, [userId, gameState?.status, gameState?.current?.phase, roomCode]);

  // ========================================
  // AUTO-DISCONNECT HANDLER - Monitor connection
  // ========================================
  useEffect(() => {
    // Monitora la disponibilità della connessione
    const handleOnline = () => {
      console.log('🌐 ONLINE - Connection restored');
      // Force refresh dello stato del gioco
      if (gameState?.current?.phase) {
        setTurnToken(Math.random().toString(36).substring(2, 15));
      }
    };

    const handleOffline = () => {
      console.log('📴 OFFLINE - Connection lost');
      setError('Connessione persa. Riconnessione in corso...');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [gameState?.current?.phase]);

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

    const handsRef = ref(db, `rooms_liar/${roomCode}/current/hands/${userId}`);
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
  // DEBUG LOGGING
  // ========================================
  useEffect(() => {
    if (!gameState?.current) return;
    
    console.log('🎮 GAME STATE UPDATE:', {
      round: gameState.round,
      phase: gameState.current.phase,
      currentPlayerId: gameState.current.turn?.currentPlayerId,
      timelineLength: gameState.current.timeline?.length || 0,
      playersCount: Object.keys(gameState.players || {}).length,
      lastClaim: gameState.current.turn?.lastClaim || null,
      timestamp: new Date().toLocaleTimeString(),
    });
  }, [gameState?.round, gameState?.current?.phase, gameState?.current?.turn?.currentPlayerId]);

  // ========================================
  // TURN TOKEN MANAGER (Anti-doppio input)
  // ========================================
  useEffect(() => {
    // Genera nuovo token quando fase cambia
    if (gameState?.current?.phase) {
      const newToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      setTurnToken(newToken);
      console.log('🔐 NEW TURN TOKEN:', newToken, { phase: gameState.current.phase });
    }
  }, [gameState?.current?.phase]);

  // ========================================
  // TIMEOUT SYSTEM (30s phase timer - UI only for now)
  // ========================================
  useEffect(() => {
    // Non eseguire se roundResetting è true
    if (gameState?.current?.roundResetting) return;
    // Non eseguire se è fase resolve o finished
    if (!gameState?.current?.phase || gameState?.current?.phase === 'resolve' || gameState?.current?.phase === 'finished') return;

    const PHASE_TIMEOUT_MS = 30000; // 30 secondi
    const roundStartedAt = gameState?.current?.roundStartedAt || Date.now();
    
    // Aggiorna il timer UI ogni secondo
    const timerInterval = setInterval(() => {
      const currentElapsedMs = Date.now() - roundStartedAt;
      const currentRemainingMs = Math.max(0, PHASE_TIMEOUT_MS - currentElapsedMs);
      setPhaseTimeLeft(Math.ceil(currentRemainingMs / 1000));
    }, 1000);

    return () => {
      clearInterval(timerInterval);
    };
  }, [gameState?.current?.roundStartedAt, gameState?.current?.phase, gameState?.current?.roundResetting]);

  // ========================================
  // HANDLE BOT TURN
  // ========================================
  useEffect(() => {
    if (!gameState?.current || !gameState?.current?.turn?.currentPlayerId) return;

    const currentTurnPlayerId = gameState.current.turn.currentPlayerId;
    const currentTurnPlayer = gameState.players?.[currentTurnPlayerId];

    // Check if it's a bot's turn and it's the declaration phase
    if (currentTurnPlayer?.isAI && gameState.current.phase === 'turn') {
      // Delay per evitare race conditions e fare sembrare più naturale
      const timeout = setTimeout(async () => {
        try {
          const botCards = gameState.current.hands?.[currentTurnPlayerId] || [];
          if (botCards.length === 0) return;

          const lastClaim = gameState.current.turn.lastClaim;
          let declaration = null;

          // Se non c'è un'ultima dichiarazione, il bot dichiara una carta a caso
          if (!lastClaim) {
            const randomCard = botCards[Math.floor(Math.random() * botCards.length)];
            declaration = {
              suit: randomCard.suit,
              value: randomCard.value,
              player: currentTurnPlayerId,
              timestamp: Date.now(),
            };
          } else {
            // Cerca una dichiarazione valida incrementando il valore
            const suits = ['spades', 'hearts', 'diamonds', 'clubs'];
            const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
            
            for (const suit of suits) {
              for (const value of values) {
                const testDeclaration = {
                  suit,
                  value,
                  player: currentTurnPlayerId,
                  timestamp: Date.now(),
                };

                if (validateDeclarationProgression(
                  testDeclaration,
                  lastClaim,
                  gameState.current.declarationMode
                )) {
                  declaration = testDeclaration;
                  break;
                }
              }
              if (declaration) break;
            }
          }

          if (!declaration) return; // Non è riuscito a trovare una dichiarazione valida

          // Scrivi la dichiarazione
          const turnRef = ref(db, `rooms_liar/${roomCode}/current/turn`);
          await update(turnRef, {
            lastClaim: declaration,
          });
        } catch (err) {
          console.error('Error in bot turn:', err);
        }
      }, 2000); // 2 secondi di delay

      return () => clearTimeout(timeout);
    }
  }, [gameState?.current?.turn?.currentPlayerId, gameState?.current?.phase, roomCode]);

  // ========================================
  // AUTO-TRANSITION: RESOLVE → ROUND_END
  // (Show result for 3s then auto-reset)
  // ========================================
  useEffect(() => {
    if (!gameState?.current || gameState?.current?.phase !== 'resolve') return;
    if (!challengeResult) return;

    // Mostra il risultato per 3 secondi, poi fa il reset del round
    const resolveTimer = setTimeout(() => {
      console.log('✅ CHALLENGE RESOLVED, AUTO-ADVANCING ROUND');
      handleResetRound();
    }, 3000); // 3 secondi di delay per animazione

    return () => clearTimeout(resolveTimer);
  }, [gameState?.current?.phase, challengeResult]);

  // ========================================
  // ALL PLAYERS PASSED → AUTO-ADVANCE TURN
  // (If in challenge phase and no one challenged for 35s)
  // ========================================
  useEffect(() => {
    if (!gameState?.current || gameState?.current?.phase !== 'challenge') return;
    if (currentChallenge?.result) return; // Se c'è un risultato, è già stato risolto
    if (!lastClaim) return; // Se non c'è una dichiarazione, skip

    // Aspetta 35 secondi (5s più del timeout fase) per dare tempo ai giocatori di sfidare
    // Se nessuno sfida, auto-avanza il turno
    const allPassedTimer = setTimeout(async () => {
      try {
        console.log('👥 ALL PLAYERS PASSED - AUTO-ADVANCING TURN');
        
        // Avanza il turno al prossimo giocatore
        const playerIds = Object.keys(gameState.players || {});
        const currentIndex = playerIds.indexOf(gameState?.current?.turn?.currentPlayerId);
        const nextPlayerId = playerIds[(currentIndex + 1) % playerIds.length];

        const turnRef = ref(db, `rooms_liar/${roomCode}/current/turn`);
        await update(turnRef, {
          currentPlayerId: nextPlayerId,
          lastClaim: null, // Reset per il nuovo turno
        });

        // Transita a 'turn' phase (tornando da 'challenge')
        const roomRef = ref(db, `rooms_liar/${roomCode}`);
        await update(roomRef, {
          current: {
            ...gameState.current,
            phase: 'turn',
            turn: {
              currentPlayerId: nextPlayerId,
              lastClaim: null,
            },
          },
        });
      } catch (err) {
        console.error('Error advancing turn after all passed:', err);
      }
    }, 35000); // 35 secondi

    return () => clearTimeout(allPassedTimer);
  }, [gameState?.current?.phase, lastClaim, gameState, roomCode]);

  // ========================================
  // AUTO-TRANSITION: CHALLENGE → RESOLVE
  // ========================================
  useEffect(() => {
    if (!gameState?.current || gameState?.current?.phase !== 'challenge') return;
    if (!currentChallenge?.result) return; // Aspetta il risultato

    // La sfida è risolta server-side. Transita a 'resolve' per mostrare il risultato
    const transitionTimer = setTimeout(async () => {
      try {
        const roomRef = ref(db, `rooms_liar/${roomCode}`);
        await update(roomRef, {
          current: {
            ...gameState.current,
            phase: 'resolve',
          },
        });
        console.log('🔄 TRANSITIONED TO RESOLVE PHASE');
      } catch (err) {
        console.error('Error transitioning to resolve:', err);
      }
    }, 500); // Piccolo delay per garantire consistency

    return () => clearTimeout(transitionTimer);
  }, [gameState?.current?.phase, currentChallenge?.result, gameState, roomCode]);

  // ========================================
  // AUTO-TRANSITION: RESOLVE → ROUND_END
  // (Show result for 3s then auto-reset)
  // ========================================
  useEffect(() => {
    if (!gameState?.current || gameState?.current?.phase !== 'resolve') return;
    if (!challengeResult) return;

    // Mostra il risultato per 3 secondi, poi fa il reset del round
    const resolveTimer = setTimeout(() => {
      console.log('✅ CHALLENGE RESOLVED, AUTO-ADVANCING ROUND');
      handleResetRound();
    }, 3000); // 3 secondi di delay per animazione

    return () => clearTimeout(resolveTimer);
  }, [gameState?.current?.phase, challengeResult]);

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
  const isResolvePhase = gameState?.current?.phase === 'resolve';
  const myHand = playerHands || [];
  const currentPlayer = gameState?.players?.[gameState?.current?.turn?.currentPlayerId];
  const lastClaim = gameState?.current?.turn?.lastClaim;
  const wildcardAvailable = hasAvailableWildcard(userId, wildcards || []);

  const validDeclarations = lastClaim
    ? generateValidDeclarations(lastClaim, gameState?.current?.declarationMode)
    : [];

  // ========================================
  // SAFETY GUARDS
  // ========================================
  if (!gameState?.current) {
    return (
      <div className="error">
        <h2>⏳ Caricamento stato gioco...</h2>
        <p>Se questo messaggio persiste, ricarica la pagina</p>
      </div>
    );
  }

  if (!gameState.current.phase) {
    return (
      <div className="error">
        <h2>⚠️ Fase di gioco non definita</h2>
        <p>Contatta il supporto</p>
      </div>
    );
  }

  if (!gameState.current.turn?.currentPlayerId) {
    return (
      <div className="error">
        <h2>⚠️ Turno non inizializzato</h2>
        <p>Il gioco non è ancora iniziato correttamente</p>
      </div>
    );
  }

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
        targetPlayerId: gameState?.current?.turn?.currentPlayerId,
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
      const currentIndex = players.indexOf(gameState?.current?.turn?.currentPlayerId);
      const nextPlayerId = players[(currentIndex + 1) % players.length];

      const turnRef = ref(db, `rooms_liar/${roomCode}/current/turn`);
      await update(turnRef, {
        currentPlayerId: nextPlayerId,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ========================================
  // RESET ROUND (NEW ROUND INIT) - ATOMIC
  // ========================================
  const handleResetRound = async () => {
    try {
      console.log('🔄 RESETTING ROUND', { round: gameState.round });
      
      const playerIds = Object.keys(gameState.players || {});
      const firstTurnPlayerId = playerIds[0];
      const nowTimestamp = Date.now();
      
      const roomRef = ref(db, `rooms_liar/${roomCode}`);
      
      // ATOMIC UPDATE: Tutto insieme per garantire consistency
      // 1. Setta roundResetting = true per bloccare timeout
      // 2. Cancella lastClaim e challenge
      // 3. Reset timeline e wildcards
      // 4. Avanza round number
      // 5. Avanza currentPlayerIndex
      // 6. Setta roundResetting = false
      // 7. Aggiorna roundStartedAt
      
      const nextRound = (gameState.round || 0) + 1;
      
      await update(roomRef, {
        round: nextRound,
        current: {
          phase: 'turn',
          turn: {
            currentPlayerId: firstTurnPlayerId,
            lastClaim: null,
          },
          hands: gameState.current.hands, // Keep hands from previous round for now
          wildcards: [],
          timeline: [],
          challenge: null, // Clear any previous challenge
          declarationMode: gameState.current.declarationMode,
          roundStartedAt: nowTimestamp,
          roundResetting: false,
        },
      });
      
      // Clear challenge result from UI
      setChallengeResult(null);
      setCurrentChallenge(null);
      setDeclarationInput('');
      setSelectedCard(null);
      
      console.log('✅ ROUND RESET COMPLETE', { newRound: nextRound });
    } catch (err) {
      console.error('❌ Error resetting round:', err);
      setError('Errore nel reset del round');
    }
  };

  // ========================================
  // END GAME
  // ========================================
  const handleEndGame = async () => {
    try {
      console.log('🏆 ENDING GAME', { round: gameState.round, maxRounds: gameState.maxRounds });
      
      const winner = determineWinner(gameState.players || {});
      
      const roomRef = ref(db, `rooms_liar/${roomCode}`);
      await update(roomRef, {
        status: 'finished',
        current: {
          ...gameState.current,
          phase: 'finished',
        },
        winner: winner,
        finishedAt: Date.now(),
      });
      
      console.log('✅ GAME ENDED', { winner });
    } catch (err) {
      console.error('❌ Error ending game:', err);
      setError('Errore nella conclusione della partita');
    }
  };

  // ========================================
  // AUTO-TRIGGER: END ROUND WHEN CONDITIONS MET
  // ========================================
  useEffect(() => {
    if (!gameState?.current || !gameState?.round !== undefined || !gameState?.maxRounds) return;
    
    // Check if all players have passed and challenge is resolved
    // For simplicity: if 30+ seconds have passed and no active turn, move to next round
    const now = Date.now();
    const turnEndTime = gameState.turnEndTime || 0;
    
    // If turn time exceeded and no one is declaring
    if (now > turnEndTime + 5000 && gameState.current.phase === 'turn' && !gameState.current.turn?.lastClaim) {
      console.log('⏱️ AUTO-ADVANCE: No declaration, moving to next round');
      handleResetRound();
    }
  }, [gameState?.round, gameState?.current?.turn?.lastClaim, gameState?.turnEndTime]);

  // ========================================
  // AUTO-TRIGGER: END GAME WHEN ROUND LIMIT REACHED
  // ========================================
  useEffect(() => {
    if (!gameState?.round !== undefined || !gameState?.maxRounds) return;
    
    if (gameState.round >= gameState.maxRounds) {
      console.log('🎯 ROUND LIMIT REACHED, ENDING GAME');
      handleEndGame();
    }
  }, [gameState?.round, gameState?.maxRounds]);

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
            Round {gameState?.round + 1} di {gameState?.maxRounds}
          </div>
        </div>
        <div className="header-right">
          <span className="round-badge">Giocatori: {Object.keys(gameState?.players || {}).length}</span>
        </div>
      </header>

      {/* ERROR BANNER */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* GAME FINISHED OVERLAY */}
      {gameState?.status === 'finished' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(5px)',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '3px solid #8b5cf6',
            borderRadius: '16px',
            padding: '3rem 2rem',
            textAlign: 'center',
            maxWidth: '500px',
            color: '#f1f5f9',
          }}>
            <h1 style={{
              fontSize: '2.5rem',
              marginBottom: '0.5rem',
              background: 'linear-gradient(135deg, #a78bfa, #60a5fa)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              🏆 Partita Conclusa!
            </h1>
            {gameState.winner && (
              <>
                <p style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#c4b5fd' }}>
                  Vincitore: <strong>{gameState.players?.[gameState.winner]?.name || 'Unknown'}</strong>
                </p>
                <div style={{
                  background: 'rgba(139, 92, 246, 0.2)',
                  border: '2px solid #8b5cf6',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  marginBottom: '1.5rem',
                }}>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#e2e8f0' }}>
                    📊 Statistiche finali disponibili nella leaderboard
                  </p>
                </div>
              </>
            )}
            <button
              onClick={() => router.push('/liar')}
              style={{
                background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                border: 'none',
                color: '#fff',
                padding: '0.75rem 2rem',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
            >
              ← Torna alla Lobby
            </button>
          </div>
        </div>
      )}

      {/* CHALLENGE RESOLUTION OVERLAY (RESOLVE PHASE) */}
      {isResolvePhase && challengeResult && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          backdropFilter: 'blur(5px)',
          animation: 'fadeIn 0.3s ease-out',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: `3px solid ${challengeResult.truth ? '#10b981' : '#ef4444'}`,
            borderRadius: '16px',
            padding: '2rem',
            textAlign: 'center',
            maxWidth: '500px',
            color: '#f1f5f9',
            animation: 'scaleIn 0.4s ease-out',
          }}>
            <h1 style={{
              fontSize: '2rem',
              marginBottom: '1rem',
              color: challengeResult.truth ? '#86efac' : '#fca5a5',
            }}>
              {challengeResult.truth ? '✅ Verità!' : '❌ Bugia!'}
            </h1>
            <p style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: '#c4b5fd' }}>
              {challengeResult.truth 
                ? 'La dichiarazione era vera' 
                : 'La dichiarazione era falsa'}
            </p>
            <div style={{
              background: `rgba(${challengeResult.truth ? '16, 185, 129' : '239, 68, 68'}, 0.2)`,
              border: `2px solid ${challengeResult.truth ? '#10b981' : '#ef4444'}`,
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem',
            }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#e2e8f0' }}>
                ⏳ Avanzamento automatico in 3 secondi...
              </p>
            </div>
          </div>
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
                  isActive: id === gameState?.current?.turn?.currentPlayerId,
                  alive: player.alive,
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

            {/* TIMER */}
            {(isDeclarationPhase || isChallengePhase) && !isResolvePhase && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.2))',
                border: '2px solid #ef4444',
                borderRadius: '8px',
                padding: '0.75rem',
                marginBottom: '1rem',
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: '2rem',
                  fontWeight: '900',
                  color: phaseTimeLeft <= 5 ? '#fca5a5' : '#f1f5f9',
                  animation: phaseTimeLeft <= 5 ? 'pulse 0.5s infinite' : 'none',
                }}>
                  ⏱️ {phaseTimeLeft}s
                </div>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#a78bfa', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>
                  {isDeclarationPhase ? 'Tempo per dichiarare' : 'Tempo per sfidare'}
                </p>
              </div>
            )}

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

        /* ANIMATIONS */
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
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
