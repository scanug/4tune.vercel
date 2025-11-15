'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ref, onValue, update, runTransaction } from 'firebase/database';
import { auth, db } from '@/lib/firebase';
import { signInAnonymously } from 'firebase/auth';

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
  const { roomCode } = useParams();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [serverOffset, setServerOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [answerIndex, setAnswerIndex] = useState(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [uid, setUid] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (!u) {
        setUid(null);
        signInAnonymously(auth).catch(() => {});
      } else {
        setUid(u.uid);
      }
    });
    return () => unsub();
  }, []);

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

  useEffect(() => {
    const clipUrl = room?.current?.clipUrl;
    if (!clipUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      return;
    }
    const audio = new Audio(clipUrl);
    audio.preload = 'auto';
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [room?.current?.clipUrl]);

  useEffect(() => {
    if (!room || !room.startAt || !audioUnlocked) return;
    const audio = audioRef.current;
    if (!audio) return;
    const serverNow = now + serverOffset;
    const delay = (room.startAt || 0) - serverNow;
    let timeout;
    if (delay > 0) {
      timeout = setTimeout(() => {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }, delay);
    } else {
      audio.currentTime = Math.max(0, Math.abs(delay) / 1000);
      audio.play().catch(() => {});
    }
    return () => timeout && clearTimeout(timeout);
  }, [room?.startAt, room?.current?.clipUrl, audioUnlocked, now, serverOffset]);

  const playerId = uid;
  const isHost = playerId && room?.hostId === playerId;
  const serverNow = now + serverOffset;
  const countdownMs = Math.max(0, (room?.startAt || 0) - serverNow);
  const playingMs = Math.max(0, (room?.startAt || 0) + (room?.roundMs || 15000) - serverNow);
  const isCountdown = room?.status === 'countdown' && countdownMs > 0;
  const isPlaying = room?.status === 'playing' || (room?.status === 'countdown' && countdownMs === 0 && playingMs > 0);

  useEffect(() => {
    if (!room || !isHost || !room.startAt) return;
    if (room.status === 'countdown' && countdownMs === 0) {
      update(ref(db, `rooms_music/${roomCode}`), { status: 'playing' }).catch(() => {});
    }
    if (room.status === 'playing' && playingMs === 0) {
      update(ref(db, `rooms_music/${roomCode}`), { status: 'reveal' }).catch(() => {});
    }
  }, [room?.status, room?.startAt, countdownMs, playingMs, isHost, roomCode]);

  useEffect(() => {
    if (!room || !isHost) return;
    const answers = room.current?.answers;
    if (!answers || room.current?.firstCorrect) return;
    const entries = Object.entries(answers);
    if (!entries.length) return;
    const correctIndex = room.current?.correctIndex;
    if (typeof correctIndex !== 'number') return;
    const correctAnswers = entries.filter(([_, ans]) => ans && ans.choice === correctIndex);
    if (!correctAnswers.length) return;
    correctAnswers.sort((a, b) => (a[1].at || Infinity) - (b[1].at || Infinity));
    const [winnerId, ans] = correctAnswers[0];
    const deltaMs = Math.max(0, (ans.at || 0) - (room.startAt || 0));
    const points = Math.max(30, 100 - Math.floor(deltaMs / 100));
    const firstCorrectRef = ref(db, `rooms_music/${roomCode}/current/firstCorrect`);
    runTransaction(firstCorrectRef, (current) => {
      if (current) return current;
      return { playerId: winnerId, at: ans.at || Date.now(), deltaMs, points };
    }).then((result) => {
      if (result.committed) {
        const boardRef = ref(db, `rooms_music/${roomCode}/scoreboard/${winnerId}`);
        runTransaction(boardRef, (current) => {
          const prev = Number(current?.points || 0);
          return {
            name: room.players?.[winnerId]?.name || current?.name || 'Player',
            avatar: room.players?.[winnerId]?.avatar || current?.avatar || null,
            points: prev + points,
          };
        }).catch(() => {});
      }
    }).catch(() => {});
  }, [room?.current?.answers, room?.current?.firstCorrect, room?.current?.correctIndex, room?.players, room?.startAt, isHost, roomCode]);

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

  const scoreboard = useMemo(() => {
    const data = room?.scoreboard || {};
    return Object.entries(data)
      .map(([id, entry]) => ({ id, ...entry }))
      .sort((a, b) => (b.points || 0) - (a.points || 0));
  }, [room?.scoreboard]);

  if (loading) {
    return <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Caricamento stanza...</main>;
  }

  if (error) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
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
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 'min(1100px, 98vw)', border: '2px solid rgba(17,24,39,0.2)', borderRadius: 18, background: '#fff', padding: 28, boxShadow: '0 20px 50px rgba(0,0,0,0.12)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Link href="/music" className="btn-3d" style={{ textDecoration: 'none' }}> Menu</Link>
          <h1 style={{ margin: 0, color: '#111827' }}>Room: {roomCode}</h1>
          <span className="bubble">Status: {room.status}</span>
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
                return (
                  <button
                    key={idx}
                    className="btn-3d"
                    onClick={() => sendAnswer(idx)}
                    disabled={disabled}
                    style={{
                      justifyContent: 'flex-start',
                      background: isCorrectReveal ? 'rgba(16,185,129,0.2)' : isMine ? 'rgba(59,130,246,0.15)' : undefined,
                    }}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {firstCorrect && (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#065f46' }}>
                <p style={{ margin: 0, fontWeight: 700 }}>Prima risposta corretta: {room.players?.[firstCorrect.playerId]?.name || firstCorrect.playerId}</p>
                <p style={{ margin: 0 }}>Tempo: {(firstCorrect.deltaMs / 1000).toFixed(2)}s  +{firstCorrect.points} punti</p>
              </div>
            )}
          </div>

          <div style={{ flex: '1 1 260px', border: '1px solid rgba(17,24,39,0.12)', borderRadius: 14, padding: 16 }}>
            <h3 style={{ marginTop: 0, color: '#111827' }}>Classifica</h3>
            <ol style={{ paddingLeft: 18, margin: 0, display: 'grid', gap: 8 }}>
              {scoreboard.length === 0 && <li style={{ color: '#6b7280' }}>Ancora nessun punto</li>}
              {scoreboard.map((row, idx) => (
                <li key={row.id} style={{ color: row.id === playerId ? '#4f46e5' : '#111827', fontWeight: row.id === playerId ? 700 : 500 }}>
                  {idx + 1}. {row.name || 'Player'}  {row.points || 0} pt
                </li>
              ))}
            </ol>
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
                  <p style={{ margin: '4px 0', fontWeight: 700 }}>{row.name || 'Player'}</p>
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
