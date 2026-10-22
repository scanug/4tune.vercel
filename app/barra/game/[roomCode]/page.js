'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { gameChannel, getNickname, setNickname } from '@/lib/gameClient';
import { recordOnlineMatch } from '@/lib/stats';
import ClipPlayer, { unlockAudio } from '@/components/barra/ClipPlayer';

const { emitAck, getSocket, getStoredPlayer, storePlayer, syncClock } = gameChannel('barra');

const STATUS_LABEL = {
  lobby: 'In attesa',
  preparing: 'Caricamento',
  countdown: 'Preparati',
  listening: 'Ascolta',
  answering: 'Rispondi',
  reveal: 'Risultato',
  finished: 'Finita',
};
const ROUND_PHASES = ['preparing', 'countdown', 'listening', 'answering'];
// Se la riproduzione è in forte ritardo (buffering, pubblicità) si apre comunque la risposta
const FORCE_OPEN_MS = 3000;
const RESULT_LABEL = { missing: 'nessuna risposta', excused: 'problema di caricamento, nessuna penalità' };
const readable = { fontFamily: 'var(--font-geist-sans), Arial, sans-serif', letterSpacing: 0 };

function secondsLeft(ms) {
  return Math.max(0, Math.ceil(ms / 1000));
}

function buzz(pattern) {
  try { navigator.vibrate?.(pattern); } catch { /* non supportato */ }
}

export default function BarraGamePage() {
  const router = useRouter();
  const params = useParams();
  const roomCode = String(params.roomCode || '').toUpperCase();

  const [phase, setPhase] = useState('connecting'); // connecting | joining | need-name | ready | error
  const [error, setError] = useState('');
  const [state, setState] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [online, setOnline] = useState(true);
  const [nameInput, setNameInput] = useState('');
  const [actionError, setActionError] = useState('');
  const [copied, setCopied] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [answer, setAnswer] = useState('');
  const [myAnswer, setMyAnswer] = useState(null); // { roundId, text }
  const [sending, setSending] = useState(false);
  const [confirmForce, setConfirmForce] = useState('');
  // Stato del player locale per il round: { roundId, ready, error, clip: idle|playing|ended|blocked }
  const [player, setPlayer] = useState({ roundId: null, ready: false, error: null, clip: 'idle' });

  const playerRef = useRef(null);
  const sentRef = useRef({ ready: null, error: null });
  const stateRef = useRef(null);
  stateRef.current = state;

  // ---------- connessione e ingresso ----------

  const join = useCallback(async () => {
    const storedId = getStoredPlayer(roomCode);
    const nick = getNickname();
    if (!storedId && !nick) { setPhase('need-name'); return; }
    setPhase((p) => (p === 'ready' ? p : 'joining'));
    try {
      const res = await emitAck('room:join', { code: roomCode, name: nick || undefined, playerId: storedId || undefined });
      storePlayer(res.code, res.playerId);
      setPlayerId(res.playerId);
      setState(res.state);
      setPhase('ready');
      setError('');
    } catch (err) {
      if (err.code === 'name') { setPhase('need-name'); return; }
      setError(err.message || 'Impossibile entrare nella stanza');
      setPhase('error');
    }
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode) return undefined;
    const socket = getSocket();
    const onState = (s) => setState(s);
    const onConnect = () => {
      setOnline(true);
      syncClock(6).then(setOffset);
      join();
    };
    const onDisconnect = () => setOnline(false);
    socket.on('room:state', onState);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) onConnect();
    return () => {
      socket.off('room:state', onState);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.emit('room:detach');
    };
  }, [roomCode, join]);

  async function submitName(e) {
    e?.preventDefault();
    const nick = nameInput.trim();
    if (!nick) return;
    setNickname(nick);
    await join();
  }

  // ---------- orologio ----------

  const status = state?.status;
  useEffect(() => {
    if (!status || status === 'lobby' || status === 'finished') return undefined;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [status]);
  const serverNow = now + offset;

  // ---------- round e player ----------

  const round = state?.round || null;
  const roundId = round?.id || null;
  const me = useMemo(() => state?.players.find((p) => p.id === playerId) || null, [state, playerId]);
  const meActive = me?.status === 'active';
  const inRound = meActive && ROUND_PHASES.includes(status) && !!round;

  useEffect(() => {
    setPlayer({ roundId, ready: false, error: null, clip: 'idle' });
    setAnswer('');
    setActionError('');
  }, [roundId]);

  // "Sono pronto" = player caricato + audio attivato da un tocco dell'utente
  useEffect(() => {
    if (!inRound || !unlocked || player.roundId !== roundId || !player.ready || player.error) return;
    if (sentRef.current.ready === roundId) return;
    sentRef.current.ready = roundId;
    emitAck('player:ready', { roundId }).catch(() => { sentRef.current.ready = null; });
  }, [inRound, unlocked, player, roundId]);

  const onPlayerReady = useCallback(() => {
    setPlayer((p) => (p.roundId === stateRef.current?.round?.id ? { ...p, ready: true } : p));
  }, []);

  const onPlayerError = useCallback((kind, message) => {
    const rid = stateRef.current?.round?.id;
    setPlayer((p) => ({ ...p, error: message }));
    if (!rid || sentRef.current.error === rid) return;
    sentRef.current.error = rid;
    emitAck('player:load-error', { roundId: rid, kind }).catch(() => {});
  }, []);

  const onPlayerState = useCallback((st) => {
    setPlayer((p) => ({ ...p, clip: st === 'paused' ? p.clip : st }));
  }, []);

  // Avvio del frammento all'istante deciso dal server
  useEffect(() => {
    if (!inRound || !round?.playAt || !unlocked || !player.ready || player.error || player.clip !== 'idle') return undefined;
    const sNow = Date.now() + offset;
    if (sNow >= round.answerOpenAt) return undefined; // troppo tardi per ascoltare
    const t = setTimeout(() => {
      playerRef.current?.playClip();
      buzz(10);
    }, Math.max(0, round.playAt - sNow));
    return () => clearTimeout(t);
  }, [inRound, round?.playAt, round?.answerOpenAt, unlocked, player.ready, player.error, player.clip, offset]);

  const forceOpen = !!round?.answerOpenAt && ['listening', 'answering'].includes(status) && serverNow >= round.answerOpenAt + FORCE_OPEN_MS;
  useEffect(() => {
    if (forceOpen && (player.clip === 'playing' || player.clip === 'blocked')) {
      playerRef.current?.stop();
      setPlayer((p) => ({ ...p, clip: 'ended' }));
    }
  }, [forceOpen, player.clip]);

  const mine = myAnswer?.roundId === roundId ? myAnswer : null;
  const answered = !!mine || !!me?.answered;
  const clipDone = player.clip === 'ended' || !!player.error || !player.ready || !unlocked || forceOpen;
  const canAnswer = inRound && !answered && ['listening', 'answering'].includes(status)
    && serverNow >= (round?.answerOpenAt || Infinity) - 1000 && clipDone;

  async function submitAnswer(e) {
    e?.preventDefault();
    const text = answer.trim();
    if (!text || sending || !roundId) return;
    setSending(true);
    setActionError('');
    try {
      await emitAck('game:answer', { choice: text });
      setMyAnswer({ roundId, text });
      buzz(15);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSending(false);
    }
  }

  // ---------- azioni ----------

  async function act(event, payload) {
    setActionError('');
    try { await emitAck(event, payload); return true; } catch (err) { setActionError(err.message); return false; }
  }

  async function startGame(force = false) {
    setActionError('');
    setConfirmForce('');
    try {
      await emitAck('game:start', { force });
    } catch (err) {
      if (err.code === 'not_enough') setConfirmForce(err.message);
      else setActionError(err.message);
    }
  }

  function activateAudio() {
    unlockAudio();
    setUnlocked(true);
    if (player.clip === 'blocked') playerRef.current?.resume();
  }

  async function leaveRoom() {
    try { await emitAck('room:leave'); } catch { /* usciamo comunque */ }
    router.push('/barra');
  }

  async function share() {
    const link = `${window.location.origin}/barra/game/${roomCode}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Completa la barra', text: `Entra nella stanza ${roomCode}`, url: link });
      else { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    } catch { /* condivisione annullata */ }
  }

  // ---------- derivati ----------

  const isHost = !!me?.isHost;
  const standings = useMemo(
    () => [...(state?.players || [])].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)),
    [state],
  );
  const activePlayers = state?.players.filter((p) => p.status === 'active') || [];
  const connectedActive = activePlayers.filter((p) => p.connected);
  const readyCount = connectedActive.filter((p) => p.ready).length;
  const answeredCount = connectedActive.filter((p) => p.answered).length;
  const reveal = state?.reveal;
  const phaseLeftMs = state?.phaseEndsAt ? state.phaseEndsAt - serverNow : 0;

  // A fine partita salva le statistiche personali (una volta per partita)
  const finished = status === 'finished';
  useEffect(() => {
    if (!finished || !playerId || !state) return;
    const mineP = state.players.find((p) => p.id === playerId);
    if (!mineP || mineP.status !== 'active') return;
    const contenders = state.players.filter((p) => p.status === 'active');
    const rank = 1 + contenders.filter((p) => p.score > mineP.score).length;
    const finalScores = contenders.map((p) => `${p.id}=${p.score}`).sort().join(',');
    recordOnlineMatch('barra', { matchKey: `${state.code}:${finalScores}`, score: mineP.score, rank, players: contenders.length });
  }, [finished, playerId, state]);

  // ---------- render: stati speciali ----------

  if (phase === 'connecting' || phase === 'joining') {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
          {online ? 'Entro nella stanza...' : 'Connessione al server...'}
        </div>
      </main>
    );
  }

  if (phase === 'need-name') {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <form onSubmit={submitName} className="panel" style={{ width: 'min(420px, 92vw)', padding: 24, display: 'grid', gap: 12 }}>
          <h1 style={{ margin: 0, color: '#111827', fontSize: '1.3rem' }}>Stanza {roomCode}</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>Come ti chiami?</p>
          <input className="input-modern" autoFocus maxLength={20} value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="Nickname" />
          <button className="btn-3d" type="submit" disabled={!nameInput.trim()}>Entra</button>
          <Link href="/barra" style={{ color: '#6b7280', fontSize: 13, textAlign: 'center' }}>Torna al menu</Link>
        </form>
      </main>
    );
  }

  if (phase === 'error' || !state) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ border: '2px solid rgba(239,68,68,0.4)', borderRadius: 16, padding: 24, background: '#fff', display: 'grid', gap: 12 }}>
          <h1 style={{ color: '#dc2626', margin: 0 }}>Ops</h1>
          <p style={{ margin: 0, color: '#111827' }}>{error || 'Stanza non disponibile'}</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn-3d" onClick={() => { setPhase('connecting'); join(); }}>Riprova</button>
            <Link href="/barra/join" className="btn-3d" style={{ textDecoration: 'none' }}>Altro codice</Link>
            <Link href="/barra" className="btn-3d" style={{ textDecoration: 'none', background: '#374151' }}>Menu</Link>
          </div>
        </div>
      </main>
    );
  }

  // ---------- render: partita ----------

  const timeFraction = status === 'answering' && round
    ? Math.max(0, Math.min(1, (round.answerDeadline - serverNow) / state.settings.roundMs))
    : 1;
  const listening = inRound && round?.playAt && serverNow >= round.playAt && !canAnswer && !answered && status !== 'preparing';

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(10px, 3vw, 20px)' }}>
      <div className="panel" style={{ width: 'min(1100px, 98vw)', padding: 'clamp(14px, 3vw, 24px)' }}>

        {!online && (
          <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 10, background: 'rgba(234,179,8,0.2)', color: '#92400e', fontSize: 13 }}>
            Connessione persa, riconnessione in corso...
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <button className="btn-3d" onClick={leaveRoom} style={{ background: '#374151' }}>Esci</button>
          <h1 style={{ margin: 0, color: '#111827', fontSize: '1.2rem' }}>🎤 {roomCode}</h1>
          <span className="bubble" style={{ background: 'rgba(99,102,241,0.15)', color: '#312e81' }}>{STATUS_LABEL[status] || status}</span>
        </div>

        {state.notice && (
          <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 10, background: 'rgba(234,179,8,0.18)', color: '#92400e', fontSize: 12 }}>{state.notice}</div>
        )}

        {me?.status === 'active' && !unlocked && status !== 'finished' && (
          <button className="btn-3d" onClick={activateAudio} style={{ marginTop: 12, width: '100%', padding: '14px 0', fontSize: '1rem', background: 'linear-gradient(180deg, #10b981, #059669)', boxShadow: '0 8px 0 #065f46, 0 12px 22px rgba(5,150,105,0.35)' }}>
            🔊 Attiva audio / Sono pronto
          </button>
        )}
        {me?.status === 'waiting' && (
          <p style={{ marginTop: 12, marginBottom: 0, color: '#4f46e5', fontSize: 12 }}>Partita in corso: guardi questa e giochi dalla prossima.</p>
        )}

        <div style={{ marginTop: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '2 1 480px', minWidth: 0, border: '1px solid rgba(17,24,39,0.12)', borderRadius: 14, padding: 'clamp(12px, 3vw, 20px)', background: 'rgba(99,102,241,0.04)' }}>

            {status === 'lobby' && (
              <div style={{ display: 'grid', gap: 16, textAlign: 'center' }}>
                <p style={{ margin: 0, color: '#6b7280' }}>Condividi il codice o il link</p>
                <span style={{ fontSize: '3rem', letterSpacing: '0.25em', color: '#4f46e5', fontWeight: 800 }}>{roomCode}</span>
                <button className="btn-3d" onClick={share} style={{ justifySelf: 'center', background: '#fff', color: '#111827' }}>{copied ? 'Link copiato!' : 'Condividi link'}</button>
                <p style={{ margin: 0, color: '#111827', fontSize: 13 }}>
                  {state.settings.maxRounds} round · {state.settings.roundMs / 1000}s per rispondere · bonus velocità {state.settings.speedBonus ? 'sì' : 'no'}
                </p>
                {confirmForce && (
                  <div style={{ padding: 12, borderRadius: 10, background: 'rgba(234,179,8,0.18)', color: '#92400e', fontSize: 12, display: 'grid', gap: 10 }}>
                    <span>{confirmForce}</span>
                    <button className="btn-3d" onClick={() => startGame(true)} style={{ justifySelf: 'center' }}>Avvia comunque</button>
                  </div>
                )}
                {isHost ? (
                  <button className="btn-3d" onClick={() => startGame(false)} style={{ justifySelf: 'center', minWidth: 220, fontSize: '1.1rem' }}>Avvia partita</button>
                ) : (
                  <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>In attesa che l&apos;host avvii la partita...</p>
                )}
              </div>
            )}

            {ROUND_PHASES.includes(status) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: '#6b7280', fontSize: 12 }}>Round {state.roundIndex}/{state.totalRounds}</span>
                  {status === 'answering' && <span className="bubble" style={{ background: 'rgba(16,185,129,0.2)', color: '#065f46', fontSize: 14 }}>⏱ {secondsLeft(round.answerDeadline - serverNow)}s</span>}
                </div>

                {!round && <p style={{ margin: 0, textAlign: 'center', color: '#6b7280' }}>Scelgo la prossima canzone...</p>}

                {round && (
                  <div className="anno-card" key={round.id}>
                    <span className="anno-chip">{'★'.repeat(round.difficulty || 2)} {round.difficulty === 1 ? 'Facile' : round.difficulty === 3 ? 'Difficile' : 'Media'}</span>
                    <h2 style={readable}>{round.song.title}</h2>
                    <p>{round.song.artist}</p>
                  </div>
                )}

                {round && inRound && (
                  <ClipPlayer
                    key={round.id}
                    ref={playerRef}
                    playback={round.playback}
                    locked
                    onReady={onPlayerReady}
                    onError={onPlayerError}
                    onState={onPlayerState}
                  />
                )}

                {player.error && <p style={{ margin: 0, color: '#dc2626', fontSize: 12 }}>{player.error}. Questo round non ti penalizza.</p>}
                {player.clip === 'blocked' && (
                  <button className="btn-3d" onClick={() => playerRef.current?.resume()}>▶ Il browser ha bloccato l&apos;audio: tocca per ascoltare</button>
                )}

                {status === 'preparing' && round && (
                  <p style={{ margin: 0, textAlign: 'center', color: '#4f46e5', fontSize: 12 }}>
                    {!meActive ? 'Gli altri stanno caricando il video...'
                      : !unlocked ? 'Tocca "Attiva audio / Sono pronto" per partecipare'
                      : !player.ready && !player.error ? 'Carico il video...'
                      : `In attesa degli altri (${readyCount}/${connectedActive.length} pronti)`}
                  </p>
                )}

                {status === 'countdown' && round && (
                  <div key={secondsLeft(round.playAt - serverNow)} className="reveal-pop" style={{ textAlign: 'center', fontSize: 48, fontWeight: 800, color: '#4f46e5' }}>
                    {secondsLeft(round.playAt - serverNow) || '🎧'}
                  </div>
                )}

                {listening && (
                  <p className="pulse" style={{ margin: 0, textAlign: 'center', color: '#059669', fontSize: 16 }}>🎧 Ascolta...</p>
                )}

                {inRound && status !== 'preparing' && (
                  <>
                    {status === 'answering' && (
                      <div className="anno-timebar" aria-hidden="true">
                        <div style={{ width: `${timeFraction * 100}%`, backgroundPosition: `${(1 - timeFraction) * 100}% 0` }} />
                      </div>
                    )}
                    {answered ? (
                      <div className="fade-up" style={{ textAlign: 'center', padding: '8px 0' }}>
                        <p style={{ margin: 0, color: '#6b7280', fontSize: 12 }}>Risposta inviata ✓ L&apos;esito arriva a fine round</p>
                        {mine && <p style={{ ...readable, margin: '8px 0 0', fontSize: 18, color: '#111827' }}>«{mine.text}»</p>}
                        <p style={{ margin: '10px 0 0', color: '#4f46e5', fontSize: 12 }}>Aspetta gli altri... ({answeredCount}/{connectedActive.length})</p>
                      </div>
                    ) : (
                      <form onSubmit={submitAnswer} style={{ display: 'grid', gap: 10 }}>
                        <input
                          className="input-modern"
                          style={{ ...readable, fontSize: 18, padding: '14px 12px' }}
                          value={answer}
                          onChange={(e) => setAnswer(e.target.value)}
                          disabled={!canAnswer || sending}
                          placeholder={canAnswer ? 'Scrivi come continua...' : 'Il campo si apre quando la musica si ferma'}
                          maxLength={200}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          enterKeyHint="send"
                          aria-label="La tua risposta"
                        />
                        <button
                          className="btn-3d"
                          type="submit"
                          disabled={!canAnswer || sending || !answer.trim()}
                          style={{ fontSize: '1.05rem', padding: '14px 0', background: 'linear-gradient(180deg, #10b981, #059669)', boxShadow: '0 8px 0 #065f46, 0 12px 22px rgba(5,150,105,0.35)' }}
                        >
                          {sending ? 'Invio...' : 'Invia (risposta definitiva)'}
                        </button>
                      </form>
                    )}
                  </>
                )}

                {isHost && round && (
                  <button className="btn-3d" onClick={() => act('game:skip')} style={{ background: '#fff', color: '#111827', fontSize: 11 }}>
                    Salta questa canzone (nessuna penalità)
                  </button>
                )}
              </div>
            )}

            {status === 'reveal' && reveal && (
              <div className="fade-up" style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: '#6b7280', fontSize: 12 }}>Round {reveal.roundIndex}/{state.totalRounds}</span>
                  <span className="bubble" style={{ background: 'rgba(99,102,241,0.15)', color: '#312e81', fontSize: 12 }}>{reveal.isLast ? 'Podio' : 'Prossimo'} tra {secondsLeft(phaseLeftMs)}s</span>
                </div>
                {reveal.cancelled ? (
                  <p style={{ margin: 0, color: '#92400e', textAlign: 'center' }}>Round annullato senza penalità: il contenuto non era riproducibile.</p>
                ) : (
                  <>
                    <div className="anno-card">
                      <span className="anno-chip">{reveal.song?.title} – {reveal.song?.artist}</span>
                      <p style={{ marginTop: 12 }}>Continuazione corretta</p>
                      <h2 className="reveal-pop" style={{ ...readable, color: '#4f46e5' }}>{reveal.answer}</h2>
                      {reveal.variants?.length > 0 && <p>Accettate anche: {reveal.variants.join(' · ')}</p>}
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                      {reveal.results.map((r) => (
                        <li key={r.playerId} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderRadius: 10, background: r.correct ? 'rgba(16,185,129,0.14)' : 'rgba(17,24,39,0.05)', color: '#111827' }}>
                          <span style={{ minWidth: 0 }}>
                            <span style={{ fontSize: 12, fontWeight: 700 }}>{r.correct ? '✅' : r.status === 'answered' ? '❌' : '➖'} {r.name}{r.playerId === playerId ? ' (tu)' : ''}</span>
                            <span style={{ ...readable, display: 'block', fontSize: 14, wordBreak: 'break-word', color: '#374151' }}>
                              {r.answer ? `«${r.answer}»` : RESULT_LABEL[r.status]}
                            </span>
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>+{r.points}{r.bonus ? ' ⚡' : ''}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {isHost && <button className="btn-3d" onClick={() => act('game:next')} style={{ justifySelf: 'center' }}>Avanti</button>}
              </div>
            )}

            {status === 'finished' && (
              <div className="fade-up" style={{ textAlign: 'center' }}>
                <h2 style={{ color: '#111827', margin: '0 0 16px' }}>🏆 Podio finale</h2>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {standings.filter((p) => p.status === 'active').slice(0, 3).map((row, idx) => (
                    <div key={row.id} className="podium-item" style={{ flex: '1 1 160px', maxWidth: 220, border: '1px solid rgba(17,24,39,0.12)', borderRadius: 12, padding: 16, background: idx === 0 ? 'rgba(251,191,36,0.25)' : idx === 1 ? 'rgba(209,213,219,0.4)' : 'rgba(205,127,50,0.2)', animationDelay: `${(2 - idx) * 250}ms` }}>
                      <div style={{ fontSize: '1.6rem' }}>{['🥇', '🥈', '🥉'][idx]}</div>
                      <p style={{ margin: '4px 0', fontWeight: 700, color: '#111827' }}>{row.name}{row.id === playerId ? ' (tu)' : ''}</p>
                      <p style={{ margin: 0, color: '#111827' }}>{row.score} punti · {row.correct} esatte</p>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {isHost && <button className="btn-3d" onClick={() => act('game:restart')}>Rivincita</button>}
                  <button className="btn-3d" onClick={leaveRoom} style={{ background: '#374151' }}>Esci</button>
                </div>
              </div>
            )}

            {actionError && <p style={{ marginTop: 12, color: '#dc2626', fontSize: 13, textAlign: 'center' }}>{actionError}</p>}
          </div>

          <div style={{ flex: '1 1 240px', border: '1px solid rgba(17,24,39,0.12)', borderRadius: 14, padding: 16 }}>
            <h3 style={{ marginTop: 0, color: '#111827', fontSize: 14 }}>Giocatori ({state.players.filter((p) => p.connected).length}/{state.players.length})</h3>
            <ol style={{ paddingLeft: 0, margin: 0, listStyle: 'none', display: 'grid', gap: 8, fontSize: 12 }}>
              {standings.map((row, idx) => (
                <li key={row.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: row.id === playerId ? '#4f46e5' : '#111827', fontWeight: row.id === playerId ? 700 : 500, opacity: row.connected ? 1 : 0.5 }}>
                  <span>
                    {status === 'lobby' ? '' : `${idx + 1}. `}
                    {row.isHost ? '👑 ' : ''}{row.name}
                    {!row.connected ? ' ⚠️' : ''}
                    {row.status === 'waiting' ? ' 👀' : ''}
                    {status === 'preparing' && row.ready ? ' 🎧' : ''}
                    {['listening', 'answering'].includes(status) && row.answered ? ' ✅' : ''}
                  </span>
                  {status !== 'lobby' && <span>{row.score} pt</span>}
                </li>
              ))}
            </ol>
            {['listening', 'answering'].includes(status) && (
              <p style={{ marginTop: 12, fontSize: 11, color: '#6b7280' }}>Hanno risposto: {answeredCount}/{connectedActive.length}</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
