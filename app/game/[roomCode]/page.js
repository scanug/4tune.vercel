'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ref, onValue, update, get, runTransaction } from 'firebase/database';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { updateMissionProgress } from '@/lib/missions';

// Funzione helper per calcolare il range in base al round
function getRangeForRound(round) {
  if (round <= 2) return { min: 1, max: 10 };
  if (round <= 4) return { min: 11, max: 25 };
  if (round <= 9) return { min: 26, max: 50 };
  if (round <= 10) return { min: 51, max: 100 };
  return { min: 1, max: 10 };
}

function getRoundPayoutMultiplier(round) {
  if (round <= 2) return 2;      // 2x
  if (round <= 4) return 4;      // 4x
  if (round <= 9) return 10;     // 10x
  return 25;                      // round 10 => 25x
}

// Funzione per verificare se un numero è primo
function isPrime(n) {
  if (n < 2) return false;
  for (let i = 2; i <= Math.sqrt(n); i++) {
    if (n % i === 0) return false;
  }
  return true;
}

// Funzione per verificare se un numero è multiplo di 10
function isMultipleOf10(n) {
  return n % 10 === 0;
}

export default function GamePage() {
  const router = useRouter();
  const { roomCode } = useParams();
  const [pageLoading, setPageLoading] = useState(true);
  const [roomData, setRoomData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedBet, setSelectedBet] = useState(null);
  const [betting, setBetting] = useState(false);
  const [betAmount, setBetAmount] = useState(10);
  const [sideBets, setSideBets] = useState({});
  const [userCredits, setUserCredits] = useState(null);

  // Verifica autenticazione
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/");
        return;
      }
      setPageLoading(false);
    });
    return () => unsub();
  }, [router]);
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);
  const autoStartRef = useRef({ lastRoundAutoStarted: 0 });
  const [pendingBetNumber, setPendingBetNumber] = useState(null);

  // Carica crediti utente
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const userRef = ref(db, `users/${currentUser.uid}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data.credits === 'number') {
        setUserCredits(data.credits);
      }
    });

    return () => unsubscribe();
  }, []);

  // Timer countdown per le scommesse
  useEffect(() => {
    if (!roomData || roomData.phase !== 'pre-bet' || !roomData.betTimeSeconds) {
      setTimeLeft(null);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (roomData.betEndTime) {
      const updateTimer = () => {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((roomData.betEndTime - now) / 1000));
        setTimeLeft(remaining);
        
        if (remaining <= 0) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }
      };

      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }
  }, [roomData?.phase, roomData?.betEndTime, roomData?.betTimeSeconds]);

  // Auto-estrazione: quando il countdown finisce, l'host avvia automaticamente il round
  useEffect(() => {
    if (!roomData) return;
    const isHost = auth.currentUser && roomData.hostId === auth.currentUser.uid;
    if (!isHost) return;
    if (roomData.phase !== 'pre-bet') return;
    if (typeof timeLeft !== 'number') return;
    if (timeLeft > 0) return;

    // Evita doppi avvii nello stesso round
    const round = roomData.round || 1;
    if (autoStartRef.current.lastRoundAutoStarted === round) return;
    autoStartRef.current.lastRoundAutoStarted = round;
    startRound();
  }, [timeLeft, roomData]);

  // Al termine del round (fase results), ogni giocatore accredita autonomamente la propria vincita del round
  useEffect(() => {
    const pid = (typeof window !== 'undefined') ? (localStorage.getItem('playerId') || auth.currentUser?.uid) : null;
    if (!roomData || roomData.phase !== 'results' || !pid) return;
    const res = roomData.roundResults?.[pid];
    if (!res || !res.creditsGained || res.creditsGained <= 0) return;

    const flagPath = `rooms/${roomCode}/payoutApplied/results/${roomData.round || 1}/${pid}`;
    const flagRef = ref(db, flagPath);
    const userRef = ref(db, `users/${pid}`);
    (async () => {
      try {
        const flagSnap = await get(flagRef);
        if (flagSnap.exists()) return; // già applicato
        await runTransaction(userRef, (current) => {
          const cur = current || {};
          const credits = Number(cur.credits || 0);
          return { ...cur, credits: credits + Number(res.creditsGained || 0) };
        });
        await update(flagRef, { at: Date.now(), amount: Number(res.creditsGained || 0) });
      } catch (e) {
        console.error('Errore accredito vincita round:', e);
      }
    })();
  }, [roomData?.phase, roomData?.round, roomData?.roundResults]);

  // A fine partita, ogni giocatore accredita autonomamente vincite side bets e bonus all-wins
  useEffect(() => {
    const pid = (typeof window !== 'undefined') ? (localStorage.getItem('playerId') || auth.currentUser?.uid) : null;
    if (!roomData || roomData.status !== 'finished' || !pid) return;
    const side = roomData.sideBetResults?.[pid];
    const sideWin = side ? Object.values(side).reduce((acc, r) => acc + (r?.amount || 0), 0) : 0;
    const bonus = Number(roomData.allWinsBonus?.[pid] || 0);
    const total = Number(sideWin + bonus);
    if (total <= 0) return;

    const flagPath = `rooms/${roomCode}/payoutApplied/final/${pid}`;
    const flagRef = ref(db, flagPath);
    const userRef = ref(db, `users/${pid}`);
    (async () => {
      try {
        const flagSnap = await get(flagRef);
        if (flagSnap.exists()) return;
        await runTransaction(userRef, (current) => {
          const cur = current || {};
          const credits = Number(cur.credits || 0);
          return { ...cur, credits: credits + total };
        });
        await update(flagRef, { at: Date.now(), amount: total });
      } catch (e) {
        console.error('Errore accredito vincite finali:', e);
      }
    })();
  }, [roomData?.status, roomData?.sideBetResults, roomData?.allWinsBonus]);

  // All'avvio partita (status: playing) ogni client detrae le proprie side bets una sola volta
  useEffect(() => {
    const pid = (typeof window !== 'undefined') ? (localStorage.getItem('playerId') || auth.currentUser?.uid) : null;
    if (!roomData || roomData.status !== 'playing' || !pid) return;
    const myBets = roomData.sideBets?.[pid];
    if (!myBets) return;
    const total = Number(myBets.evenHalf || 0) + Number(myBets.oddHalf || 0) + Number(myBets.twoPrimes || 0) + Number(myBets.twoMultiplesOf10 || 0);
    if (total <= 0) return;

    const flagRef = ref(db, `rooms/${roomCode}/payoutApplied/sideDebit/${pid}`);
    const userRef = ref(db, `users/${pid}`);
    (async () => {
      try {
        const flagSnap = await get(flagRef);
        if (flagSnap.exists()) return;
        await runTransaction(userRef, (current) => {
          const cur = current || {};
          const credits = Number(cur.credits || 0);
          const newCredits = Math.max(0, credits - total);
          return { ...cur, credits: newCredits };
        });
        await update(flagRef, { at: Date.now(), amount: total });
      } catch (e) {
        console.error('Errore detrazione side bets (client):', e);
      }
    })();
  }, [roomData?.status, roomData?.sideBets]);
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
        const uid = auth.currentUser?.uid || localStorage.getItem('playerId');
        if (uid && data.bets) {
          setSelectedBet(data.bets[uid]?.number || null);
        }
        if (uid && data.sideBets) {
          setSideBets(data.sideBets[uid] || {});
        }
      }

      // Se l'host non è nella lista giocatori e la stanza è in attesa, aggiungilo
      const currentUser = auth.currentUser;
      if (currentUser && data.hostId === currentUser.uid && data.status === 'waiting') {
        const playerId = localStorage.getItem('playerId') || currentUser.uid;
        const players = data.players || {};
        if (!players[playerId]) {
          const playerName = localStorage.getItem('playerName') || currentUser.displayName || 'Player';
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

      // Debug utilissimo: verifica UID vs hostId
      console.log('Avvio partita → uid:', currentUser.uid, 'hostId:', roomData.hostId);

      if (currentUser.uid !== roomData.hostId) {
        setError('Solo l\'host può avviare la partita');
        console.error('PERMISSION_DENIED: uid non corrisponde a hostId', {
          uid: currentUser.uid,
          hostId: roomData.hostId
        });
        return;
      }

      // Calcola range per round 1
      const range = getRangeForRound(1);
      const betTimeSeconds = roomData.betTimeSeconds || 15;
      const betEndTime = Date.now() + (betTimeSeconds * 1000);

      // La detrazione delle side bets viene fatta da ogni client sul proprio account

      await update(ref(db, 'rooms/' + roomCode), {
        status: 'playing',
        startedAt: Date.now(),
        round: 1,
        phase: 'pre-bet',
        currentRange: range,
        bets: {},
        winningNumber: null,
        roundResults: null,
        betEndTime: betEndTime
      });
    } catch (err) {
      console.error('Errore Firebase:', err?.code, err?.message, err);
      setError(`Errore nell'avviare la partita: ${err?.code || ''} ${err?.message || ''}`);
    }
  }

  function chooseBet(number) {
    setPendingBetNumber(number);
  }

  async function placeBet(number) {
    if (!roomCode || !roomData || betting) return;

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError('Utente non autenticato');
      return;
    }

    const playerId = currentUser.uid;
    if (!roomData.players || !roomData.players[playerId]) {
      setError('Non sei un giocatore in questa stanza');
      return;
    }

    if (roomData.phase !== 'pre-bet') {
      setError('La fase di scommessa è terminata');
      return;
    }

    if (timeLeft !== null && timeLeft <= 0) {
      setError('Tempo scaduto per scommettere');
      return;
    }

    if (!userCredits || userCredits < betAmount) {
      setError('Crediti insufficienti');
      return;
    }

    setBetting(true);
    try {
      await update(ref(db, `rooms/${roomCode}/bets`), {
        [playerId]: { number, amount: betAmount }
      });
      setSelectedBet(number);
      setPendingBetNumber(null);
      
      // Detrai crediti immediatamente
      const userRef = ref(db, `users/${currentUser.uid}`);
      await runTransaction(userRef, (current) => {
        const cur = current || {};
        const credits = Number(cur.credits || 0);
        if (credits >= betAmount) {
          return { ...cur, credits: credits - betAmount };
        }
        return cur; // Abort se non ha abbastanza crediti
      });
    } catch (err) {
      console.error('Errore nel piazzare la scommessa:', err);
      setError('Errore nel piazzare la scommessa');
    } finally {
      setBetting(false);
    }
  }

  async function placeSideBet(type, amount) {
    if (!roomCode || !roomData || betting) return;

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError('Utente non autenticato');
      return;
    }

    const playerId = localStorage.getItem('playerId') || currentUser.uid;
    
    if (!userCredits || userCredits < amount) {
      setError('Crediti insufficienti');
      return;
    }

    if (amount < 1) {
      setError('L\'importo minimo è 1 credito');
      return;
    }

    setBetting(true);
    try {
      const currentSideBets = roomData.sideBets || {};
      const mySideBets = currentSideBets[playerId] || {};
      
      await update(ref(db, `rooms/${roomCode}/sideBets`), {
        [playerId]: {
          ...mySideBets,
          [type]: amount
        }
      });

      setSideBets({ ...mySideBets, [type]: amount });
    } catch (err) {
      console.error('Errore nel piazzare la side bet:', err);
      setError('Errore nel piazzare la side bet');
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

      console.log('Avvio round → uid:', currentUser.uid, 'hostId:', roomData.hostId);

      if (currentUser.uid !== roomData.hostId) {
        setError('Solo l\'host può avviare il round');
        console.error('PERMISSION_DENIED: uid non corrisponde a hostId nel round');
        return;
      }

      if (roomData.phase !== 'pre-bet') {
        setError('La fase non è corretta');
        return;
      }

      const range = roomData.currentRange || getRangeForRound(roomData.round || 1);
      const winningNumber = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;

      // Calcola risultati
      const bets = roomData.bets || {};
      const players = roomData.players || {};
      const roundResults = {};
      const playersUpdate = {};
      
      Object.entries(bets).forEach(([playerId, betData]) => {
        const bet = betData?.number || betData; // Supporta vecchio formato
        const won = bet === winningNumber;
        const player = players[playerId];
        if (player) {
          const currentScore = player.score || 0;
          const amount = Number(betData?.amount || 0);
          const multiplier = getRoundPayoutMultiplier(roomData.round || 1);
          const creditsGained = won ? Math.floor(amount * multiplier) : 0;
          roundResults[playerId] = {
            bet,
            won,
            creditsGained,
            newScore: currentScore + (won ? 1 : 0)
          };
          playersUpdate[`players/${playerId}/score`] = roundResults[playerId].newScore;

          // Aggiorna crediti se ha vinto
          if (won) {
            const userRef = ref(db, `users/${playerId}`);
            runTransaction(userRef, (current) => {
              const cur = current || {};
              const credits = Number(cur.credits || 0);
              return { ...cur, credits: credits + creditsGained };
            }).catch(err => console.error('Errore aggiornamento crediti:', err));

            // Aggiorna missioni
            updateMissionProgress(playerId, 'win_3_games').catch(err => 
              console.error('Errore aggiornamento missioni:', err)
            );
          }
        }
      });

      // Calcola risultati side bets (per ora salviamo solo i numeri estratti, calcoleremo alla fine)
      const allWinningNumbers = roomData.winningNumbers || [];
      allWinningNumbers.push(winningNumber);

      // Aggiorna prima i risultati e la fase
      await update(ref(db, `rooms/${roomCode}`), {
        phase: 'rolling',
        winningNumber,
        roundResults,
        winningNumbers: allWinningNumbers
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
      if (!currentUser) {
        setError('Utente non autenticato');
        return;
      }

      console.log('Round successivo → uid:', currentUser.uid, 'hostId:', roomData.hostId);

      if (currentUser.uid !== roomData.hostId) {
        setError('Solo l\'host può procedere');
        console.error('PERMISSION_DENIED: uid non corrisponde a hostId nel nextRound');
        return;
      }

      const currentRound = roomData.round || 1;
      const maxRounds = roomData.maxRounds || 10;
      
      if (currentRound >= maxRounds) {
        // Fine partita - calcola risultati side bets
        const winningNumbers = roomData.winningNumbers || [];
        const sideBetsData = roomData.sideBets || {};
        const sideBetResults = await calculateSideBetResults(winningNumbers, sideBetsData);

        await update(ref(db, `rooms/${roomCode}`), {
          status: 'finished',
          phase: 'finished',
          sideBetResults: sideBetResults
        });
        return;
      }

      const newRound = currentRound + 1;
      const range = getRangeForRound(newRound);
      const betTimeSeconds = roomData.betTimeSeconds || 15;
      const betEndTime = Date.now() + (betTimeSeconds * 1000);

      await update(ref(db, `rooms/${roomCode}`), {
        round: newRound,
        phase: 'pre-bet',
        bets: {},
        winningNumber: null,
        roundResults: null,
        currentRange: range,
        betEndTime: betEndTime
      });
    } catch (err) {
      console.error('Errore nel round successivo:', err);
      setError(`Errore: ${err.message}`);
    }
  }

  // Calcola risultati side bets alla fine della partita
  async function calculateSideBetResults(winningNumbers, sideBetsData) {
    if (!winningNumbers || winningNumbers.length === 0) return {};

    const results = {};
    const totalRounds = winningNumbers.length;
    const evenCount = winningNumbers.filter(n => n % 2 === 0).length;
    const oddCount = winningNumbers.filter(n => n % 2 !== 0).length;
    const primeCount = winningNumbers.filter(n => isPrime(n)).length;
    const multiplesOf10Count = winningNumbers.filter(n => isMultipleOf10(n)).length;

    for (const [playerId, bets] of Object.entries(sideBetsData)) {
      results[playerId] = {};
      let totalWinnings = 0;

      if (bets.evenHalf && evenCount >= totalRounds / 2) {
        results[playerId].evenHalf = { won: true, amount: bets.evenHalf * 4 };
        totalWinnings += bets.evenHalf * 4;
      }
      if (bets.oddHalf && oddCount >= totalRounds / 2) {
        results[playerId].oddHalf = { won: true, amount: bets.oddHalf * 4 };
        totalWinnings += bets.oddHalf * 4;
      }
      if (bets.twoPrimes && primeCount >= 2) {
        results[playerId].twoPrimes = { won: true, amount: bets.twoPrimes * 4 };
        totalWinnings += bets.twoPrimes * 4;
      }
      if (bets.twoMultiplesOf10 && multiplesOf10Count >= 2) {
        results[playerId].twoMultiplesOf10 = { won: true, amount: bets.twoMultiplesOf10 * 4 };
        totalWinnings += bets.twoMultiplesOf10 * 4;
      }

      if (totalWinnings > 0) {
        try {
          const userRef = ref(db, `users/${playerId}`);
          await runTransaction(userRef, (current) => {
            const cur = current || {};
            const credits = Number(cur.credits || 0);
            return { ...cur, credits: credits + totalWinnings };
      });
    } catch (err) {
          console.error('Errore aggiornamento crediti side bet:', err);
        }
      }
    }

    return results;
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

  if (pageLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Caricamento...</div>
      </div>
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
  const playerId = typeof window !== 'undefined' ? (currentUser?.uid || localStorage.getItem('playerId')) : null;
  const isHost = currentUser && roomData.hostId === currentUser.uid;
  const playersCount = Object.keys(roomData.players || {}).length;
  const statusText = roomData.status === 'waiting' ? 'In attesa' : roomData.status === 'playing' ? 'In corso' : roomData.status === 'finished' ? 'Terminata' : roomData.status;
  const phase = roomData.phase || null;
  const range = roomData.currentRange || getRangeForRound(roomData.round || 1);
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
          {userCredits !== null && (
            <span style={{ padding: '6px 12px', borderRadius: 999, background: 'rgba(99,102,241,0.1)', color: '#6366f1', fontWeight: 700 }}>
              {userCredits} 💰
            </span>
          )}
        </div>

        {error && (
          <div className="fade-up" style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#dc2626' }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 999, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', marginBottom: 16 }}>
            <span className="bubble" style={{ background: roomData.status === 'waiting' ? 'rgba(234,179,8,0.18)' : roomData.status === 'playing' ? 'rgba(16,185,129,0.18)' : 'rgba(156,163,175,0.18)', color: roomData.status === 'waiting' ? '#f59e0b' : roomData.status === 'playing' ? '#10b981' : '#9ca3af', border: `1px solid ${roomData.status === 'waiting' ? 'rgba(234,179,8,0.35)' : roomData.status === 'playing' ? 'rgba(16,185,129,0.35)' : 'rgba(156,163,175,0.35)'}` }}>
              Stato: {statusText}
            </span>
            {phase === 'pre-bet' && timeLeft !== null && (
              <span className="bubble" style={{ background: timeLeft <= 5 ? 'rgba(239,68,68,0.18)' : 'rgba(99,102,241,0.18)', color: timeLeft <= 5 ? '#dc2626' : '#6366f1' }}>
                ⏱️ {timeLeft}s
              </span>
            )}
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
                    background: id === playerId ? 'rgba(99,102,241,0.1)' : 'rgba(0,0,0,0.05)', 
                    border: `1px solid ${id === playerId ? 'rgba(99,102,241,0.3)' : 'rgba(0,0,0,0.1)'}`,
                    color: '#111827'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700 }}>{player.name || 'Guest'}</span>
                    {id === roomData.hostId && (
                      <span style={{ fontSize: '1.2rem' }} title="Host">👑</span>
                    )}
                  </div>
                  <span style={{ fontWeight: 700, color: '#111827' }}>
                    Score: {player.score || 0}
                  </span>
                </li>
          ))}
      </ul>
          )}
        </div>

        {/* Side Bets */}
        {roomData.status === 'waiting' && (
          <div style={{ marginBottom: 20, textAlign: 'left', padding: '16px', borderRadius: 10, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <h3 style={{ marginBottom: 12, color: '#111827', fontSize: '1.1rem' }}>Side Bets (crediti verranno detratti all'avvio):</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ flex: 1, minWidth: 200, color: '#111827' }}>Almeno metà numeri pari</span>
                <input 
                  type="number" 
                  min="1" 
                  max={userCredits || 0}
                  value={sideBets.evenHalf || ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : '';
                    setSideBets({ ...sideBets, evenHalf: val });
                  }}
                  className="input-modern"
                  style={{ width: '100px' }}
                  placeholder="Crediti"
                />
                <button 
                  className="btn-3d" 
                  onClick={() => sideBets.evenHalf && placeSideBet('evenHalf', sideBets.evenHalf)}
                  disabled={!sideBets.evenHalf || sideBets.evenHalf < 1}
                  style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                >
                  Scommetti
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ flex: 1, minWidth: 200, color: '#111827' }}>Almeno metà numeri dispari</span>
                <input 
                  type="number" 
                  min="1"
                  max={userCredits || 0}
                  value={sideBets.oddHalf || ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : '';
                    setSideBets({ ...sideBets, oddHalf: val });
                  }}
                  className="input-modern"
                  style={{ width: '100px' }}
                  placeholder="Crediti"
                />
                <button 
                  className="btn-3d" 
                  onClick={() => sideBets.oddHalf && placeSideBet('oddHalf', sideBets.oddHalf)}
                  disabled={!sideBets.oddHalf || sideBets.oddHalf < 1}
                  style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                >
                  Scommetti
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ flex: 1, minWidth: 200, color: '#111827' }}>Almeno due numeri primi</span>
                <input 
                  type="number" 
                  min="1"
                  max={userCredits || 0}
                  value={sideBets.twoPrimes || ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : '';
                    setSideBets({ ...sideBets, twoPrimes: val });
                  }}
                  className="input-modern"
                  style={{ width: '100px' }}
                  placeholder="Crediti"
                />
                <button 
                  className="btn-3d" 
                  onClick={() => sideBets.twoPrimes && placeSideBet('twoPrimes', sideBets.twoPrimes)}
                  disabled={!sideBets.twoPrimes || sideBets.twoPrimes < 1}
                  style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                >
                  Scommetti
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ flex: 1, minWidth: 200, color: '#111827' }}>Almeno due multipli di 10</span>
                <input 
                  type="number" 
                  min="1"
                  max={userCredits || 0}
                  value={sideBets.twoMultiplesOf10 || ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : '';
                    setSideBets({ ...sideBets, twoMultiplesOf10: val });
                  }}
                  className="input-modern"
                  style={{ width: '100px' }}
                  placeholder="Crediti"
                />
                <button 
                  className="btn-3d" 
                  onClick={() => sideBets.twoMultiplesOf10 && placeSideBet('twoMultiplesOf10', sideBets.twoMultiplesOf10)}
                  disabled={!sideBets.twoMultiplesOf10 || sideBets.twoMultiplesOf10 < 1}
                  style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                >
                  Scommetti
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Fase Pre-Bet */}
        {phase === 'pre-bet' && (
          <div className="fade-up">
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ color: '#111827', marginBottom: 12 }}>Round {round} - Fase Scommessa</h2>
              <p style={{ color: '#6b7280', marginBottom: 16 }}>Scegli un numero tra {range.min} e {range.max}</p>
              
              {myBet ? (
                <div style={{ padding: '16px', borderRadius: 10, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', marginBottom: 16 }}>
                  <p style={{ color: '#10b981', fontWeight: 700, margin: 0 }}>✓ Hai scommesso sul numero: <strong>{myBet.number || myBet}</strong> ({myBet.amount || betAmount} crediti)</p>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', marginBottom: 8, color: '#111827', fontWeight: 700 }}>
                      Importo scommessa (crediti): {betAmount}
                    </label>
                    <input 
                      type="range" 
                      min="1" 
                      max={Math.min(userCredits || 100, 100)}
                      value={betAmount} 
                      onChange={(e) => setBetAmount(Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))', gap: 6, marginBottom: 12 }}>
                    {numbersInRange.map(num => (
                      <button
                        key={num}
                        className="btn-3d"
                        onClick={() => chooseBet(num)}
                        disabled={betting || (timeLeft !== null && timeLeft <= 0) || !userCredits || userCredits < betAmount}
                        style={{ 
                          minWidth: '48px', 
                          padding: '10px',
                          fontSize: '1rem',
                          fontWeight: 700
                        }}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  {pendingBetNumber != null && (
                    <div className="fade-up" style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                      <span style={{ color: '#111827', fontWeight: 700 }}>Confermi il numero {pendingBetNumber} per {betAmount} crediti?</span>
                      <button className="btn-3d" style={{ padding: '6px 10px' }} onClick={() => placeBet(pendingBetNumber)}>Conferma</button>
                      <button className="btn-3d" style={{ padding: '6px 10px', background: '#6b7280' }} onClick={() => setPendingBetNumber(null)}>Annulla</button>
                    </div>
                  )}
                </>
              )}

              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '1rem', color: '#111827', marginBottom: 8 }}>Scommesse dei giocatori:</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                  {Object.entries(roomData.players || {}).map(([id, player]) => {
                    const bet = bets[id];
                    return (
                      <li key={id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.05)' }}>
                        <span style={{ color: '#111827' }}>{player.name || 'Guest'}</span>
                        <span style={{ fontWeight: 700, color: bet ? '#6366f1' : '#9ca3af' }}>
                          {bet ? `Numero: ${bet.number || bet} (${bet.amount || betAmount} crediti)` : 'In attesa...'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {isHost && (
                <button 
                  className="btn-3d" 
                  onClick={startRound}
                  style={{ minWidth: 200 }}
                  disabled={Object.keys(bets).length === 0}
                >
                  Estrai Numero
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
                              ✓ +{result?.creditsGained || 0} crediti
                            </span>
                          ) : (
                            <span style={{ color: '#9ca3af' }}>✗ 0 crediti</span>
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

              {isHost && round < (roomData.maxRounds || 10) && (
                <button 
                  className="btn-3d" 
                  onClick={nextRound}
                  style={{ minWidth: 200 }}
                >
                  Round Successivo
                </button>
              )}
              {isHost && round >= (roomData.maxRounds || 10) && (
                <div style={{ padding: '16px', borderRadius: 10, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <p style={{ color: '#dc2626', fontWeight: 700, margin: 0 }}>Partita terminata!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Fine partita: classifica finale */}
        {roomData.status === 'finished' && (
          <div className="fade-up" style={{ marginTop: 16 }}>
            <h2 style={{ color: '#111827', marginBottom: 12 }}>Classifica finale</h2>
            {(() => {
              const players = roomData.players || {};
              const sideRes = roomData.sideBetResults || {};
              const rows = Object.entries(players).map(([id, p]) => {
                const score = Number(p.score || 0);
                const mainWin = score * 50;
                const side = sideRes[id] || {};
                const sideWin = Object.values(side).reduce((acc, r) => acc + (r?.amount || 0), 0);
                const total = mainWin + sideWin;
                return { id, name: p.name || 'Guest', score, mainWin, sideWin, total };
              });
              rows.sort((a, b) => b.total - a.total || b.score - a.score);
              return (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                  {rows.map((r, idx) => (
                    <li key={r.id} className="fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(99,102,241,0.25)', background: '#fff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 28, textAlign: 'center', fontWeight: 800 }}>{idx + 1}</span>
                        <span style={{ fontWeight: 800, color: '#111827' }}>{r.name}</span>
                        {r.id === roomData.hostId && <span title="Host">👑</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="bubble">Score: {r.score}</span>
                        <span className="bubble" title="Vincite principali">+{r.mainWin} 💰</span>
                        {r.sideWin > 0 && <span className="bubble success" title="Vincite side bets">+{r.sideWin} 💰</span>}
                        <span className="bubble" style={{ fontWeight: 800 }}>Totale: {r.total} 💰</span>
                      </div>
                    </li>
          ))}
      </ul>
              );
            })()}
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
