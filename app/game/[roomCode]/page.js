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
  const [selectedBet, setSelectedBet] = useState(null);
  const [betting, setBetting] = useState(false);

  useEffect(() => {
    if (!roomCode) return;

    const roomRef = ref(db, 'rooms/' + roomCode);

    const unsubscribe = onValue(roomRef, async (snapshot) => {
      if (!snapshot.exists()) {
        setError('Stanza non trovata o eliminata');
        setRoomData(null);
        setLoading(false);
        return;
      }

      const data = snapshot.val();
      setRoomData(data);
      setError('');
      setLoading(false);

      // Aggiorna selectedBet se presente
      if (typeof window !== 'undefined') {
        const playerId = localStorage.getItem('playerId') || auth.currentUser?.uid;
        if (playerId && data.bets) {
          setSelectedBet(data.bets[playerId] || null);
        }
      }

      // Se l'host non è nella lista giocatori e la stanza è in attesa, aggiungilo
      const currentUser = auth.currentUser;
      if (currentUser && data.hostId === currentUser.uid && data.status === 'waiting') {
        const playerId = localStorage.getItem('playerId') || currentUser.uid;
        const players = data.players || {};
        if (!players[playerId]) {
          const playerName = localStorage.getItem('playerName') || 'Host';
          try {
            await update(ref(db, `rooms/${roomCode}/players`), {
              [playerId]: {
                joinedAt: Date.now(),
                name: playerName,
                score: 0,
                avatar: localStorage.getItem('playerAvatar') || null
              }
            });
          } catch (err) {
            console.error('Errore aggiunta host come giocatore:', err);
          }
        }
      }
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
        phase: 'pre-bet',
        currentRange: { min: 1, max: 10 },
        bets: {},
        winningNumber: null,
        roundResults: null
      });
    } catch (err) {
      console.error('Errore Firebase:', err);
      setError(`Errore nell'avviare la partita: ${err.message}`);
    }
  }

  async function placeBet(number) {
    if (!roomCode || !roomData || betting) return;

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError('Utente non autenticato');
      return;
    }

    const playerId = localStorage.getItem('playerId') || currentUser.uid;
    if (!roomData.players || !roomData.players[playerId]) {
      setError('Non sei un giocatore in questa stanza');
      return;
    }

    if (roomData.phase !== 'pre-bet') {
      setError('La fase di scommessa è terminata');
      return;
    }

    setBetting(true);
    try {
      const bets = roomData.bets || {};
      await update(ref(db, `rooms/${roomCode}/bets`), {
        [playerId]: number
      });
      setSelectedBet(number);
    } catch (err) {
      console.error('Errore nel piazzare la scommessa:', err);
      setError('Errore nel piazzare la scommessa');
    } finally {
      setBetting(false);
    }
  }

  async function startRound() {
    if (!roomCode || !roomData) return;

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError('Utente non autenticato');
        return;
      }

      if (currentUser.uid !== roomData.hostId) {
        setError('Solo l\'host può avviare il round');
        return;
      }

      if (roomData.phase !== 'pre-bet') {
        setError('La fase non è corretta');
        return;
      }

      const range = roomData.currentRange || { min: 1, max: 10 };
      const winningNumber = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;

      // Calcola risultati
      const bets = roomData.bets || {};
      const players = roomData.players || {};
      const roundResults = {};
      const playersUpdate = {};
      
      Object.entries(bets).forEach(([playerId, bet]) => {
        const won = bet === winningNumber;
        const player = players[playerId];
        if (player) {
          const currentScore = player.score || 0;
          const newScore = won ? currentScore + 10 : currentScore;
          roundResults[playerId] = {
            bet,
            won,
            pointsGained: won ? 10 : 0,
            newScore
          };
          // Prepara aggiornamento score
          playersUpdate[`players/${playerId}/score`] = newScore;
        }
      });

      // Aggiorna prima i risultati e la fase
      await update(ref(db, `rooms/${roomCode}`), {
        phase: 'rolling',
        winningNumber,
        roundResults
      });

      // Aggiorna gli score separatamente
      if (Object.keys(playersUpdate).length > 0) {
        await update(ref(db, `rooms/${roomCode}`), playersUpdate);
      }

      // Dopo 3 secondi, mostra i risultati
      setTimeout(async () => {
        await update(ref(db, `rooms/${roomCode}`), {
          phase: 'results'
        });
      }, 3000);
    } catch (err) {
      console.error('Errore nell\'avviare il round:', err);
      setError(`Errore: ${err.message}`);
    }
  }

  async function nextRound() {
    if (!roomCode || !roomData) return;

    try {
      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.uid !== roomData.hostId) {
        setError('Solo l\'host può procedere');
        return;
      }

      const currentRound = roomData.round || 1;
      const newRound = currentRound + 1;
      const range = roomData.currentRange || { min: 1, max: 10 };
      
      // Espandi il range per il round successivo
      const newRange = {
        min: range.min,
        max: Math.min(range.max + 5, 100) // Aumenta di 5 fino a max 100
      };

      await update(ref(db, `rooms/${roomCode}`), {
        round: newRound,
        phase: 'pre-bet',
        bets: {},
        winningNumber: null,
        roundResults: null,
        currentRange: newRange
      });
    } catch (err) {
      console.error('Errore nel round successivo:', err);
      setError(`Errore: ${err.message}`);
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
  const playerId = typeof window !== 'undefined' ? (localStorage.getItem('playerId') || currentUser?.uid) : null;
  const isHost = currentUser && roomData.hostId === currentUser.uid;
  const playersCount = Object.keys(roomData.players || {}).length;
  const statusText = roomData.status === 'waiting' ? 'In attesa' : roomData.status === 'playing' ? 'In corso' : roomData.status;
  const phase = roomData.phase || null;
  const range = roomData.currentRange || { min: 1, max: 10 };
  const bets = roomData.bets || {};
  const myBet = playerId ? bets[playerId] : null;
  const roundResults = roomData.roundResults || {};
  const winningNumber = roomData.winningNumber;
  const round = roomData.round || 0;
  
  // Genera array di numeri nel range
  const numbersInRange = [];
  for (let i = range.min; i <= range.max; i++) {
    numbersInRange.push(i);
  }

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

        {/* Fase Pre-Bet */}
        {phase === 'pre-bet' && (
          <div className="fade-up">
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ color: '#111827', marginBottom: 12 }}>Round {round} - Fase Scommessa</h2>
              <p style={{ color: '#6b7280', marginBottom: 16 }}>Scegli un numero tra {range.min} e {range.max}</p>
              
              {myBet ? (
                <div style={{ padding: '16px', borderRadius: 10, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', marginBottom: 16 }}>
                  <p style={{ color: '#10b981', fontWeight: 700, margin: 0 }}>✓ Hai scommesso sul numero: <strong>{myBet}</strong></p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: 8, marginBottom: 16 }}>
                  {numbersInRange.map(num => (
                    <button
                      key={num}
                      className="btn-3d"
                      onClick={() => placeBet(num)}
                      disabled={betting}
                      style={{ 
                        minWidth: '60px', 
                        padding: '12px',
                        fontSize: '1.2rem',
                        fontWeight: 700
                      }}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '1rem', color: '#111827', marginBottom: 8 }}>Scommesse dei giocatori:</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                  {Object.entries(roomData.players || {}).map(([id, player]) => (
                    <li key={id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.05)' }}>
                      <span style={{ color: '#111827' }}>{player.name || 'Guest'}</span>
                      <span style={{ fontWeight: 700, color: bets[id] ? '#6366f1' : '#9ca3af' }}>
                        {bets[id] ? `Numero: ${bets[id]}` : 'In attesa...'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {isHost && (
                <button 
                  className="btn-3d" 
                  onClick={startRound}
                  style={{ minWidth: 200 }}
                  disabled={Object.keys(bets).length === 0}
                >
                  Avvia Round
                </button>
              )}
            </div>
          </div>
        )}

        {/* Fase Rolling */}
        {phase === 'rolling' && (
          <div className="fade-up" style={{ textAlign: 'center' }}>
            <h2 style={{ color: '#111827', marginBottom: 16 }}>Round {round} - Estrazione in corso...</h2>
            <div style={{ padding: '24px', borderRadius: 16, background: 'linear-gradient(180deg, #6366f1, #4f46e5)', color: '#fff', marginBottom: 16 }}>
              <p style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }} className="pulse">🎲</p>
              <p style={{ marginTop: 12, fontSize: '1.2rem' }}>Estrazione del numero...</p>
            </div>
          </div>
        )}

        {/* Fase Results */}
        {phase === 'results' && winningNumber !== null && (
          <div className="fade-up">
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <h2 style={{ color: '#111827', marginBottom: 12 }}>Round {round} - Risultati</h2>
              <div style={{ padding: '24px', borderRadius: 16, background: 'linear-gradient(180deg, #10b981, #059669)', color: '#fff', marginBottom: 20 }}>
                <p style={{ fontSize: '3rem', fontWeight: 800, margin: 0 }} className="reveal-pop">{winningNumber}</p>
                <p style={{ marginTop: 8, fontSize: '1.2rem' }}>Numero estratto!</p>
              </div>

              <div style={{ marginBottom: 20, textAlign: 'left' }}>
                <h3 style={{ fontSize: '1rem', color: '#111827', marginBottom: 12 }}>Risultati del round:</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                  {Object.entries(roomData.players || {}).map(([id, player]) => {
                    const result = roundResults[id];
                    const won = result?.won || false;
                    return (
                      <li 
                        key={id} 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          padding: '12px 16px', 
                          borderRadius: 10, 
                          background: won ? 'rgba(16,185,129,0.1)' : 'rgba(0,0,0,0.05)',
                          border: `1px solid ${won ? 'rgba(16,185,129,0.3)' : 'rgba(0,0,0,0.1)'}`
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 700, color: '#111827' }}>{player.name || 'Guest'}</span>
                          {result && (
                            <span style={{ marginLeft: 8, color: '#6b7280', fontSize: '0.9rem' }}>
                              (scommessa: {result.bet})
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {won ? (
                            <span className="bubble success" style={{ fontSize: '1rem' }}>
                              ✓ +{result?.pointsGained || 0} punti
                            </span>
                          ) : (
                            <span style={{ color: '#9ca3af' }}>✗ 0 punti</span>
                          )}
                          <span style={{ fontWeight: 700, color: '#111827' }}>
                            Score: {player.score || 0}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {isHost && (
                <button 
                  className="btn-3d" 
                  onClick={nextRound}
                  style={{ minWidth: 200 }}
                >
                  Round Successivo
                </button>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {isHost && roomData.status === 'waiting' && (
            <button className="btn-3d" onClick={startGame} style={{ minWidth: 200 }}>
              Avvia Partita
            </button>
          )}

          {roomData.status === 'playing' && !phase && (
            <div style={{ width: '100%', padding: '16px', borderRadius: 10, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <p style={{ color: '#10b981', fontWeight: 700, margin: 0 }}>🎮 La partita è in corso...</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
