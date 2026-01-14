'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ref, onValue, update, runTransaction, set } from 'firebase/database';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildRoundPayload(tracks) {
  if (!tracks || tracks.length < 4) throw new Error('Tracce insufficienti per il round');
  const track = tracks[Math.floor(Math.random() * tracks.length)];
  const distractors = shuffle(tracks.filter((t) => t.id !== track.id));
  const choices = [track.title, ...distractors.slice(0, 3).map((t) => t.title)];
  const shuffled = shuffle(choices);
  const correctIndex = shuffled.indexOf(track.title);
  return {
    trackId: track.id,
    trackTitle: track.title,
    trackArtist: track.artist,
    clipUrl: track.previewUrl,
    cover: track.cover || null,
    options: shuffled,
    correctIndex,
  };
}

export default function GuessTheSongGamePage() {
  const router = useRouter();
  const { roomCode } = useParams();
  const [pageLoading, setPageLoading] = useState(true);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [serverOffset, setServerOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [answerIndex, setAnswerIndex] = useState(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [uid, setUid] = useState(null);
  const [userCredits, setUserCredits] = useState(null);
  const audioRef = useRef(null);
  const playTimeoutRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.push("/");
        return;
      }
      setPageLoading(false);
      setUid(u.uid);
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!uid) return;
    const userRef = ref(db, `users/${uid}`);
    const unsub = onValue(userRef, (snap) => {
      const val = snap.val();
      if (val && typeof val.credits === 'number') setUserCredits(val.credits);
    });
    return () => unsub();
  }, [uid]);

  useEffect(() => {
    const offsetRef = ref(db, '.info/serverTimeOffset');
    const unsub = onValue(offsetRef, (snap) => {
      setServerOffset(Number(snap.val()) || 0);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 300);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!roomCode) return;
    const roomRef = ref(db, `rooms_music/${roomCode}`);
    const unsub = onValue(roomRef, (snap) => {
      if (!snap.exists()) {
        setError('Stanza non trovata');
        setRoom(null);
        setLoading(false);
      } else {
        setRoom(snap.val());
        setLoading(false);
      }
    }, () => {
      setError('Errore nel recuperare la stanza');
      setLoading(false);
    });
    return () => unsub();
  }, [roomCode]);

  useEffect(() => {
    setAnswerIndex(null);
  }, [room?.current?.trackId, room?.roundIndex]);

  // Crea una sola istanza Audio per tutta la partita
  useEffect(() => {
    audioRef.current = new Audio();
    return () => {
      if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Sincronizza audio solo all'inizio di ogni round
  useEffect(() => {
    if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
    const clipUrl = room?.current?.clipUrl;
    const startAt = room?.startAt;
    if (!clipUrl || !startAt || !audioUnlocked || !audioRef.current) return;

    const audio = audioRef.current;
    audio.src = clipUrl;
    audio.currentTime = 0;

    const serverNow = Date.now() + serverOffset;
    const delay = startAt - serverNow;

    if (delay > 0) {
      playTimeoutRef.current = setTimeout(() => {
        audio.play().catch(() => {});
      }, delay);
    } else {
      audio.currentTime = Math.max(0, Math.abs(delay) / 1000);
      audio.play().catch(() => {});
    }
  }, [room?.current?.clipUrl, room?.startAt, audioUnlocked, serverOffset]);

  const playerId = uid;
  const isHost = playerId && room?.hostId === playerId;
  const serverNow = now + serverOffset;
  const countdownMs = Math.max(0, (room?.startAt || 0) - serverNow);
  const playingMs = Math.max(0, (room?.startAt || 0) + (room?.roundMs || 15000) - serverNow);
  const isCountdown = room?.status === 'countdown' && countdownMs > 0;
  const isPlaying = room?.status === 'playing' || (room?.status === 'countdown' && countdownMs === 0 && playingMs > 0);
  const playersCount = Object.keys(room?.players || {}).length;
  const answersCount = Object.keys(room?.current?.answers || {}).length;
  const wagerMap = room?.wagers || {};

  useEffect(() => {
    if (!room || !isHost || !room.startAt) return;
    if (room.status === 'countdown' && countdownMs === 0) {
      update(ref(db, `rooms_music/${roomCode}`), { status: 'playing' }).catch(() => {});
    }
    if (room.status === 'playing' && playingMs === 0) {
      update(ref(db, `rooms_music/${roomCode}`), { status: 'reveal' }).catch(() => {});
    }
  }, [room?.status, room?.startAt, countdownMs, playingMs, isHost, roomCode]);

  // Chiudi il round se tutti hanno risposto (host)
  useEffect(() => {
    if (!room || !isHost) return;
    if (room.status !== 'playing') return;
    if (playersCount === 0) return;
    if (answersCount >= playersCount) {
      update(ref(db, `rooms_music/${roomCode}`), { status: 'reveal' }).catch(() => {});
    }
  }, [answersCount, playersCount, room?.status, isHost, roomCode]);

  // Assegna punteggi a tutti i giocatori che hanno risposto correttamente, una sola volta per round
  useEffect(() => {
    if (!room || !isHost) return;
    if (room.status !== 'reveal') return;
    if (room.current?.scored) return;
    const answers = room.current?.answers;
    const correctIndex = room.current?.correctIndex;
    if (!answers || typeof correctIndex !== 'number') return;
    const correctAnswers = Object.entries(answers)
      .filter(([_, ans]) => ans && ans.choice === correctIndex)
      .sort((a, b) => (a[1].at || Infinity) - (b[1].at || Infinity));
    if (!correctAnswers.length) {
      set(ref(db, `rooms_music/${roomCode}/current/scored`), true).catch(() => {});
      return;
    }

    const startAt = room.startAt || 0;
    const scoredRef = ref(db, `rooms_music/${roomCode}/current/scored`);

    runTransaction(scoredRef, (current) => {
      if (current === true) return current;
      return true;
    }).then(async (res) => {
      if (!res.committed) return; // qualcuno ha già segnato

      for (const [playerId, ans] of correctAnswers) {
        const deltaMs = Math.max(0, (ans.at || 0) - startAt);
        const points = Math.max(10, 100 - Math.floor(deltaMs / 100));
        const boardRef = ref(db, `rooms_music/${roomCode}/scoreboard/${playerId}`);
        await runTransaction(boardRef, (current) => {
          const prev = Number(current?.points || 0);
          return {
            name: room.players?.[playerId]?.name || current?.name || 'Player',
            avatar: room.players?.[playerId]?.avatar || current?.avatar || null,
            points: prev + points,
          };
        });
      }

      if (correctAnswers.length && !room.current?.firstCorrect) {
        const [winnerId, ans] = correctAnswers[0];
        const deltaMs = Math.max(0, (ans.at || 0) - startAt);
        const points = Math.max(10, 100 - Math.floor(deltaMs / 100));
        await set(ref(db, `rooms_music/${roomCode}/current/firstCorrect`), {
          playerId: winnerId,
          at: ans.at || Date.now(),
          deltaMs,
          points,
        }).catch(() => {});
      }
    }).catch(() => {});
  }, [room?.status, room?.current?.answers, room?.current?.correctIndex, room?.current?.firstCorrect, room?.current?.scored, room?.players, room?.startAt, isHost, roomCode]);

  async function startRound() {
    if (!room || !isHost) return;
    if (!room.playlist?.tracks?.length) {
      setError('Playlist non disponibile');
      return;
    }
    if (room.roundIndex >= room.maxRounds && room.status !== 'finished') {
      await finishGame();
      return;
    }
    try {
      const payload = buildRoundPayload(room.playlist.tracks);
      const nextIndex = (room.roundIndex || 0) + 1;
      const serverNowValue = Date.now() + serverOffset;
      await update(ref(db, `rooms_music/${roomCode}`), {
        status: 'countdown',
        roundIndex: nextIndex,
        startAt: serverNowValue + (room.prepMs || 3000),
        current: {
          ...payload,
          answers: {},
          firstCorrect: null,
        },
      });
    } catch (err) {
      setError(err.message || 'Errore nel preparare il round');
    }
  }

  async function finishGame() {
    await update(ref(db, `rooms_music/${roomCode}`), { status: 'finished', startAt: null }).catch(() => {});
  }

  // Payout scommessa: ogni client applica solo la propria
  useEffect(() => {
    if (room?.status !== 'finished' || !playerId) return;
    const payoutFlag = ref(db, `rooms_music/${roomCode}/payoutApplied/${playerId}`);
    const wager = Number(wagerMap[playerId] || 0);
    if (wager <= 0) return;
    const offFlag = onValue(payoutFlag, (snap) => {
      if (snap.exists()) return;
      const playersArr = scoreboard.slice().sort((a, b) => (b.points || 0) - (a.points || 0));
      const placements = playersArr.map((p) => p.id);
      const firstId = placements[0];
      const secondId = placements[1];
      const hasSecond = placements.length >= 3;

      let prize = 0;
      if (playerId === firstId) {
        prize = wager * 2;
      } else if (hasSecond && playerId === secondId) {
        prize = wager; // ritorno puntata
      }
      if (prize <= 0) return;

      const credRef = ref(db, `users/${playerId}/credits`);
      runTransaction(credRef, (current) => {
        const c = Number(current || 0);
        return c + prize;
      }).then((res) => {
        if (res.committed) {
          update(payoutFlag, { amount: prize, at: Date.now() }).catch(() => {});
        }
      }).catch(() => {});
    });
    return () => offFlag();
  }, [room?.status, playerId, wagerMap, scoreboard, roomCode]);


  async function sendAnswer(idx) {
    if (!room || !playerId || !isPlaying) return;
    if (answerIndex !== null) return;
    if (room.current?.answers && room.current.answers[playerId]) return;
    if ((room.startAt || 0) - (Date.now() + serverOffset) > 0) return;
    setAnswerIndex(idx);
    const serverNowValue = Date.now() + serverOffset;
    await update(ref(db, `rooms_music/${roomCode}/current/answers/${playerId}`), {
      choice: idx,
      at: serverNowValue,
    }).catch(() => {});
  }

  if (pageLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Caricamento...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <video autoPlay muted loop playsInline className="fixed top-0 left-0 w-full h-full object-cover -z-10">
          <source src="/background_gts.mp4" type="video/mp4" />
        </video>
        <div className="fixed inset-0 bg-black/60 -z-10"></div>
        Caricamento stanza...
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative' }}>
        <video autoPlay muted loop playsInline className="fixed top-0 left-0 w-full h-full object-cover -z-10">
          <source src="/background_gts.mp4" type="video/mp4" />
        </video>
        <div className="fixed inset-0 bg-black/60 -z-10"></div>
        <div style={{ border: '2px solid rgba(239,68,68,0.4)', borderRadius: 16, padding: 24, background: '#fff' }}>
          <h1 style={{ color: '#dc2626' }}>Errore</h1>
          <p>{error}</p>
          <Link href="/music" className="btn-3d" style={{ textDecoration: 'none' }}>Torna al menu</Link>
        </div>
      </main>
    );
  }

  if (!room) return null;

  const roundNumber = room.roundIndex || 0;
  const options = room.current?.options || [];
  const firstCorrect = room.current?.firstCorrect;

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative' }}>
      <video autoPlay muted loop playsInline className="fixed top-0 left-0 w-full h-full object-cover -z-10">
        <source src="/background_gts.mp4" type="video/mp4" />
      </video>
      <div className="fixed inset-0 bg-black/60 -z-10"></div>

      <div style={{ width: 'min(1100px, 98vw)', border: '2px solid rgba(17,24,39,0.2)', borderRadius: 18, background: 'rgba(255,255,255,0.92)', padding: 28, boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Link href="/music" className="btn-3d" style={{ textDecoration: 'none' }}> Menu</Link>
          <h1 style={{ margin: 0, color: '#111827' }}>Room: {roomCode}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {userCredits != null && (
              <span className="bubble" style={{ background: 'rgba(99,102,241,0.12)', color: '#111827' }}>
                Crediti: {userCredits}
              </span>
            )}
            <Link href="/profile" className="btn-3d" style={{ textDecoration: 'none' }}>Profilo</Link>
            <span className="bubble">Status: {room.status}</span>
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '2 1 480px', border: '1px solid rgba(17,24,39,0.12)', borderRadius: 14, padding: 20, background: 'rgba(99,102,241,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <p style={{ margin: 0, color: '#6b7280' }}>Round</p>
                <h2 style={{ margin: 0, color: '#111827' }}>{roundNumber}/{room.maxRounds}</h2>
              </div>
              <div>
                {isCountdown && <span className="bubble" style={{ background: 'rgba(234,179,8,0.2)', color: '#92400e' }}>Parte in {Math.ceil(countdownMs / 1000)}s</span>}
                {!isCountdown && isPlaying && <span className="bubble" style={{ background: 'rgba(16,185,129,0.2)', color: '#065f46' }}>Tempo: {Math.ceil(playingMs / 1000)}s</span>}
              </div>
            </div>
            {!audioUnlocked && (
              <button className="btn-3d" style={{ marginBottom: 12 }} onClick={() => { setAudioUnlocked(true); audioRef.current?.play().catch(() => {}); }}>
                Abilita audio
              </button>
            )}
            <div style={{ display: 'grid', gap: 10 }}>
              {options.map((option, idx) => {
                const disabled = !isPlaying || answerIndex !== null;
                const isMine = answerIndex === idx;
                const isCorrectReveal = room.status === 'reveal' && idx === room.current?.correctIndex;
                const isWrongReveal = room.status === 'reveal' && answerIndex === idx && idx !== room.current?.correctIndex;
                const mutedReveal = room.status === 'reveal' && !isCorrectReveal && !isWrongReveal;

                let background = '#111827';
                let color = '#fff';
                let border = '1px solid rgba(255,255,255,0.12)';
                let boxShadow = '0 8px 20px rgba(0,0,0,0.25)';

                if (room.status === 'reveal') {
                  if (isCorrectReveal) {
                    background = '#16a34a';
                    border = '1px solid #15803d';
                  } else if (isWrongReveal) {
                    background = '#dc2626';
                    border = '1px solid #b91c1c';
                  } else if (mutedReveal) {
                    background = '#1f2937';
                    color = '#e5e7eb';
                    border = '1px solid rgba(255,255,255,0.08)';
                  }
                } else if (isMine) {
                  border = '2px solid #60a5fa';
                  boxShadow = '0 0 0 3px rgba(96,165,250,0.35)';
                }

                return (
                  <button
                    key={idx}
                    className="btn-3d btn-option"
                    onClick={() => sendAnswer(idx)}
                    disabled={disabled}
                    style={{
                      justifyContent: 'flex-start',
                      background,
                      color,
                      border,
                      boxShadow,
                    }}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {firstCorrect && room.status === 'reveal' && (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#065f46' }}>
                <p style={{ margin: 0, fontWeight: 700 }}>Prima risposta corretta: {room.players?.[firstCorrect.playerId]?.name || firstCorrect.playerId}</p>
                <p style={{ margin: 0 }}>Tempo: {(firstCorrect.deltaMs / 1000).toFixed(2)}s  +{firstCorrect.points} punti</p>
              </div>
            )}
          </div>

          <div style={{ flex: '1 1 260px', border: '1px solid rgba(17,24,39,0.12)', borderRadius: 14, padding: 16 }}>
            <h3 style={{ marginTop: 0, color: '#111827' }}>Classifica</h3>
            {room.playlist?.name && (
              <p style={{ margin: '4px 0 12px', color: '#111827', fontWeight: 600 }}>
                Playlist: {room.playlist.name}
              </p>
            )}
            <ol style={{ paddingLeft: 18, margin: 0, display: 'grid', gap: 8 }}>
              {scoreboard.length === 0 && <li style={{ color: '#6b7280' }}>Ancora nessun punto</li>}
              {scoreboard.map((row, idx) => (
                <li key={row.id} style={{ color: row.id === playerId ? '#4f46e5' : '#111827', fontWeight: row.id === playerId ? 700 : 500 }}>
                  {idx + 1}. {row.id === room.hostId ? '👑 ' : ''}{row.name || 'Player'} — {row.points || 0} pt
                </li>
              ))}
            </ol>
            <div style={{ marginTop: 12 }}>
              <h4 style={{ margin: '6px 0', color: '#111827' }}>Giocatori</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                {Object.entries(room?.players || {}).map(([id, p]) => (
                  <li key={id} style={{ color: '#111827', fontWeight: id === room.hostId ? 700 : 500 }}>
                    {id === room.hostId ? '👑 ' : ''}{p.name || 'Player'}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {isHost && room.status === 'waiting' && (
            <button className="btn-3d" onClick={startRound}>
              Avvia partita
            </button>
          )}
          {isHost && room.status === 'reveal' && room.roundIndex < room.maxRounds && (
            <button className="btn-3d" onClick={startRound}>
              Prossimo round
            </button>
          )}
          {isHost && room.status === 'reveal' && room.roundIndex >= room.maxRounds && (
            <button className="btn-3d" onClick={finishGame}>
              Concludi partita
            </button>
          )}
        </div>

        {room.status === 'finished' && (
          <div className="fade-up" style={{ marginTop: 30, borderTop: '1px solid rgba(17,24,39,0.1)', paddingTop: 20 }}>
            <h2 style={{ color: '#111827' }}>Podio finale</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {scoreboard.slice(0, 3).map((row, idx) => (
                <div key={row.id} style={{ flex: '1 1 200px', border: '1px solid rgba(17,24,39,0.12)', borderRadius: 12, padding: 16, background: idx === 0 ? 'rgba(251,191,36,0.2)' : 'rgba(209,213,219,0.3)' }}>
                  <h3 style={{ margin: 0 }}>{idx + 1}</h3>
                  <p style={{ margin: '4px 0', fontWeight: 700 }}>{row.id === room.hostId ? '👑 ' : ''}{row.name || 'Player'}</p>
                  <p style={{ margin: 0 }}>{row.points || 0} punti</p>
                </div>
              ))}
              {scoreboard.length === 0 && <p style={{ color: '#6b7280' }}>Nessun punteggio registrato.</p>}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

