'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { pickRandomWord } from '@/lib/impostoreWords';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateHint(word) {
  // Simple hint: category-style hint (first letter + length)
  return `${word.length} lettere, inizia con "${word[0].toUpperCase()}"`;
}

export default function ImpostorePlayPage() {
  const router = useRouter();
  const [config, setConfig] = useState(null);

  // Game state
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState('loading'); // loading | peek | timer | vote | cliffhanger | reveal | finished
  const [secretWord, setSecretWord] = useState('');
  const [impostorIndices, setImpostorIndices] = useState([]); // indices into config.players
  const [peekIndex, setPeekIndex] = useState(0); // which player is currently peeking
  const [wordRevealed, setWordRevealed] = useState(false);
  const [timerLeft, setTimerLeft] = useState(0);
  const [votes, setVotes] = useState({}); // {playerName: votedPlayerName}
  const [currentVoter, setCurrentVoter] = useState(0);
  const [voteTarget, setVoteTarget] = useState(null);
  const [cliffhangerStep, setCliffhangerStep] = useState(0); // 0=building, 1=reveal
  const [scores, setScores] = useState({}); // {playerName: points}
  const [usedWords, setUsedWords] = useState([]);

  const timerRef = useRef(null);

  // Load config from localStorage
  useEffect(() => {
    const raw = localStorage.getItem('impostore_config');
    if (!raw) { router.push('/impostore/setup'); return; }
    try {
      const cfg = JSON.parse(raw);
      if (!cfg.players?.length || !cfg.wordPool?.length) throw new Error();
      setConfig(cfg);
      // Init scores
      const initialScores = {};
      cfg.players.forEach((p) => { initialScores[p] = 0; });
      setScores(initialScores);
      // Start first round
      startNewRound(cfg, [], initialScores);
    } catch {
      router.push('/impostore/setup');
    }
  }, [router]);

  const startNewRound = useCallback((cfg, used, currentScores) => {
    const available = cfg.wordPool.filter((w) => !used.includes(w));
    const pool = available.length > 0 ? available : cfg.wordPool;
    const word = pickRandomWord(pool);

    // Pick random impostors
    const indices = shuffle(Array.from({ length: cfg.players.length }, (_, i) => i))
      .slice(0, cfg.impostorCount);

    setSecretWord(word);
    setImpostorIndices(indices);
    setUsedWords([...used, word]);
    setRound((prev) => prev + 1);
    setPeekIndex(0);
    setWordRevealed(false);
    setVotes({});
    setCurrentVoter(0);
    setVoteTarget(null);
    setCliffhangerStep(0);
    setPhase('peek');
  }, []);

  // Timer
  useEffect(() => {
    if (phase !== 'timer') return;
    timerRef.current = setInterval(() => {
      setTimerLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setPhase('vote');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  function handlePeekReveal() {
    setWordRevealed(true);
  }

  function handlePeekNext() {
    setWordRevealed(false);
    if (peekIndex + 1 >= config.players.length) {
      // All players have seen their word — start timer
      setTimerLeft(config.timerSecs);
      setPhase('timer');
    } else {
      setPeekIndex(peekIndex + 1);
    }
  }

  function handleVoteConfirm() {
    if (!voteTarget) return;
    const newVotes = { ...votes, [config.players[currentVoter]]: voteTarget };
    setVotes(newVotes);
    setVoteTarget(null);

    if (currentVoter + 1 >= config.players.length) {
      // All voted — go to cliffhanger
      setPhase('cliffhanger');
      setCliffhangerStep(0);
    } else {
      setCurrentVoter(currentVoter + 1);
    }
  }

  function handleCliffhangerReveal() {
    // Calculate results and scores
    const voteCounts = {};
    config.players.forEach((p) => { voteCounts[p] = 0; });
    Object.values(votes).forEach((target) => {
      voteCounts[target] = (voteCounts[target] || 0) + 1;
    });

    // Find most voted
    let maxVotes = 0;
    let mostVoted = [];
    for (const [player, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) { maxVotes = count; mostVoted = [player]; }
      else if (count === maxVotes) mostVoted.push(player);
    }

    const impostorNames = impostorIndices.map((i) => config.players[i]);
    const caughtImpostors = mostVoted.filter((p) => impostorNames.includes(p));

    const newScores = { ...scores };
    if (caughtImpostors.length > 0) {
      // Innocents win — +10 each
      config.players.forEach((p) => {
        if (!impostorNames.includes(p)) newScores[p] = (newScores[p] || 0) + 10;
      });
    } else {
      // Impostors win — +15 each
      impostorNames.forEach((p) => { newScores[p] = (newScores[p] || 0) + 15; });
    }
    setScores(newScores);

    setCliffhangerStep(1);
  }

  function handleNextRound() {
    startNewRound(config, usedWords, scores);
  }

  function handleEndGame() {
    setPhase('finished');
  }

  // RENDER
  if (!config || phase === 'loading') {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Caricamento...
      </main>
    );
  }

  const impostorNames = impostorIndices.map((i) => config.players[i]);

  // Vote counts for reveal
  const voteCounts = {};
  config.players.forEach((p) => { voteCounts[p] = 0; });
  Object.values(votes).forEach((target) => { voteCounts[target] = (voteCounts[target] || 0) + 1; });
  let maxVoteCount = 0;
  let mostVotedPlayers = [];
  for (const [player, count] of Object.entries(voteCounts)) {
    if (count > maxVoteCount) { maxVoteCount = count; mostVotedPlayers = [player]; }
    else if (count === maxVoteCount && count > 0) mostVotedPlayers.push(player);
  }
  const caughtImpostors = mostVotedPlayers.filter((p) => impostorNames.includes(p));

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 'min(600px, 96vw)', border: '2px solid rgba(17,24,39,0.2)', borderRadius: 18, background: 'rgba(255,255,255,0.92)', padding: 28, boxShadow: '0 20px 50px rgba(0,0,0,0.25)', textAlign: 'center' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Link href="/impostore" className="btn-3d" style={{ textDecoration: 'none' }}>Menu</Link>
          <span style={{ color: '#6b7280', fontSize: 14 }}>Round {round} · {config.mode === 'ocane' ? '🐕 Ocane' : '📚 Classica'}</span>
        </div>

        {/* PEEK PHASE */}
        {phase === 'peek' && (
          <div>
            <h2 style={{ color: '#111827', margin: '0 0 20px' }}>
              {config.players[peekIndex]}, guarda la tua carta!
            </h2>

            {!wordRevealed ? (
              <button
                className="btn-3d"
                onClick={handlePeekReveal}
                style={{ fontSize: '1.2rem', padding: '16px 40px', background: '#4f46e5', color: '#fff' }}
              >
                👁️ Tocca per rivelare
              </button>
            ) : (
              <div>
                {impostorIndices.includes(peekIndex) ? (
                  <div style={{ padding: 24, borderRadius: 16, background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.3)', marginBottom: 20 }}>
                    <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#dc2626' }}>🕵️ Sei l&apos;Impostore!</p>
                    {config.impostorHint && (
                      <p style={{ margin: '8px 0 0', color: '#991b1b', fontSize: '1rem' }}>
                        Indizio: {generateHint(secretWord)}
                      </p>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: 24, borderRadius: 16, background: 'rgba(16,185,129,0.1)', border: '2px solid rgba(16,185,129,0.3)', marginBottom: 20 }}>
                    <p style={{ margin: 0, color: '#065f46', fontSize: '0.9rem' }}>La parola segreta è:</p>
                    <p style={{ margin: '8px 0 0', fontSize: '2rem', fontWeight: 800, color: '#059669' }}>{secretWord}</p>
                  </div>
                )}
                <button
                  className="btn-3d"
                  onClick={handlePeekNext}
                  style={{ fontSize: '1.1rem', padding: '12px 36px' }}
                >
                  {peekIndex + 1 < config.players.length ? 'Passa al prossimo' : 'Tutti pronti — Inizia!'}
                </button>
              </div>
            )}

            <p style={{ color: '#6b7280', fontSize: 13, marginTop: 16 }}>
              {peekIndex + 1} / {config.players.length}
            </p>
          </div>
        )}

        {/* TIMER PHASE */}
        {phase === 'timer' && (
          <div>
            <h2 style={{ color: '#111827', margin: '0 0 12px' }}>Discussione in corso!</h2>
            <p style={{ color: '#6b7280', marginBottom: 20 }}>Date indizi, discutete, trovate l&apos;Impostore!</p>

            <div style={{ fontSize: '4rem', fontWeight: 800, color: timerLeft <= 10 ? '#dc2626' : '#4f46e5', margin: '20px 0' }}>
              {Math.floor(timerLeft / 60)}:{String(timerLeft % 60).padStart(2, '0')}
            </div>

            <button
              className="btn-3d"
              onClick={() => { clearInterval(timerRef.current); setPhase('vote'); }}
              style={{ marginTop: 12 }}
            >
              Passa alla votazione
            </button>
          </div>
        )}

        {/* VOTE PHASE */}
        {phase === 'vote' && (
          <div>
            <h2 style={{ color: '#111827', margin: '0 0 8px' }}>Votazione</h2>
            <p style={{ color: '#4f46e5', fontWeight: 700, fontSize: '1.2rem', marginBottom: 16 }}>
              {config.players[currentVoter]}, vota l&apos;Impostore!
            </p>

            <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
              {config.players.map((player, idx) => {
                const isSelf = idx === currentVoter;
                const isSelected = voteTarget === player;
                return (
                  <button
                    key={player}
                    className="btn-3d"
                    onClick={() => !isSelf && setVoteTarget(player)}
                    disabled={isSelf}
                    style={{
                      justifyContent: 'flex-start',
                      background: isSelected ? '#4f46e5' : isSelf ? '#374151' : '#111827',
                      color: '#fff',
                      opacity: isSelf ? 0.4 : 1,
                    }}
                  >
                    {player} {isSelf ? '(tu)' : ''}
                  </button>
                );
              })}
            </div>

            {voteTarget && (
              <button className="btn-3d" onClick={handleVoteConfirm} style={{ width: '100%', background: '#dc2626', color: '#fff' }}>
                Conferma voto per {voteTarget}
              </button>
            )}

            <p style={{ color: '#6b7280', fontSize: 13, marginTop: 12 }}>
              Voto {currentVoter + 1} / {config.players.length}
            </p>
          </div>
        )}

        {/* CLIFFHANGER */}
        {phase === 'cliffhanger' && cliffhangerStep === 0 && (
          <div>
            <h2 style={{ color: '#111827', margin: '0 0 16px' }}>Il verdetto...</h2>

            {/* Show vote results */}
            <div style={{ display: 'grid', gap: 6, marginBottom: 20, textAlign: 'left' }}>
              {config.players.map((player) => (
                <div key={player} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 14px', borderRadius: 10,
                  background: mostVotedPlayers.includes(player) ? 'rgba(239,68,68,0.15)' : 'rgba(17,24,39,0.05)',
                  border: mostVotedPlayers.includes(player) ? '1px solid rgba(239,68,68,0.3)' : '1px solid transparent',
                }}>
                  <span style={{ fontWeight: 600, color: '#111827' }}>{player}</span>
                  <span style={{ fontWeight: 700, color: mostVotedPlayers.includes(player) ? '#dc2626' : '#6b7280' }}>
                    {voteCounts[player] || 0} vot{(voteCounts[player] || 0) === 1 ? 'o' : 'i'}
                  </span>
                </div>
              ))}
            </div>

            <p style={{ color: '#111827', fontWeight: 600, fontSize: '1.1rem', marginBottom: 16 }}>
              Il più votato è: <strong style={{ color: '#dc2626' }}>{mostVotedPlayers.join(', ')}</strong>
            </p>

            <button
              className="btn-3d"
              onClick={handleCliffhangerReveal}
              style={{ fontSize: '1.2rem', padding: '14px 40px', background: '#dc2626', color: '#fff' }}
            >
              Rivela il risultato!
            </button>
          </div>
        )}

        {/* REVEAL after cliffhanger */}
        {phase === 'cliffhanger' && cliffhangerStep === 1 && (
          <div>
            <div style={{ padding: 20, borderRadius: 16, marginBottom: 20,
              background: caughtImpostors.length > 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              border: caughtImpostors.length > 0 ? '2px solid rgba(16,185,129,0.4)' : '2px solid rgba(239,68,68,0.4)' }}>

              {caughtImpostors.length > 0 ? (
                <>
                  <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#059669' }}>
                    Beccato! 🎉
                  </p>
                  <p style={{ margin: '8px 0 0', color: '#065f46', fontSize: '1.1rem' }}>
                    {caughtImpostors.join(', ')} {caughtImpostors.length === 1 ? 'era l\'Impostore!' : 'erano gli Impostori!'}
                  </p>
                </>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#dc2626' }}>
                    L&apos;Impostore l&apos;ha fatta franca! 😈
                  </p>
                  <p style={{ margin: '8px 0 0', color: '#991b1b', fontSize: '1.1rem' }}>
                    {impostorNames.length === 1 ? 'L\'Impostore era' : 'Gli Impostori erano'}: <strong>{impostorNames.join(', ')}</strong>
                  </p>
                </>
              )}
            </div>

            <div style={{ padding: 16, borderRadius: 12, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', marginBottom: 20 }}>
              <p style={{ margin: 0, color: '#312e81' }}>La parola era:</p>
              <p style={{ margin: '4px 0 0', fontSize: '1.8rem', fontWeight: 800, color: '#4f46e5' }}>{secretWord}</p>
            </div>

            {/* Scoreboard */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ color: '#111827', margin: '0 0 10px' }}>Punteggi</h3>
              <div style={{ display: 'grid', gap: 4 }}>
                {Object.entries(scores).sort(([, a], [, b]) => b - a).map(([name, pts]) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', borderRadius: 8, background: 'rgba(17,24,39,0.04)' }}>
                    <span style={{ color: '#111827', fontWeight: impostorNames.includes(name) ? 700 : 500 }}>
                      {impostorNames.includes(name) ? '🕵️ ' : ''}{name}
                    </span>
                    <span style={{ color: '#4f46e5', fontWeight: 700 }}>{pts} pt</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn-3d" onClick={handleNextRound} style={{ minWidth: 160 }}>
                Prossimo Round
              </button>
              <button className="btn-3d" onClick={handleEndGame} style={{ minWidth: 160, background: '#374151' }}>
                Fine Partita
              </button>
            </div>
          </div>
        )}

        {/* FINISHED */}
        {phase === 'finished' && (
          <div>
            <h2 style={{ color: '#111827', margin: '0 0 16px' }}>🏆 Classifica Finale</h2>
            <div style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
              {Object.entries(scores).sort(([, a], [, b]) => b - a).map(([name, pts], idx) => (
                <div key={name} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 16px', borderRadius: 12,
                  background: idx === 0 ? 'rgba(251,191,36,0.2)' : idx === 1 ? 'rgba(209,213,219,0.3)' : idx === 2 ? 'rgba(205,127,50,0.15)' : 'rgba(17,24,39,0.04)',
                  border: idx < 3 ? '1px solid rgba(17,24,39,0.12)' : 'none',
                }}>
                  <span style={{ fontWeight: 700, color: '#111827' }}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`} {name}
                  </span>
                  <span style={{ fontWeight: 700, color: '#4f46e5' }}>{pts} pt</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/impostore/setup" className="btn-3d" style={{ textDecoration: 'none' }}>
                Nuova Partita
              </Link>
              <Link href="/impostore" className="btn-3d" style={{ textDecoration: 'none', background: '#374151' }}>
                Menu
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
