'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  emitAck, getNickname, getSocket, getStoredPlayer, setNickname, storePlayer, syncClock,
} from '@/lib/gameClient';

// Un wav silenzioso di pochi byte: serve solo a "sbloccare" l'audio con un
// gesto dell'utente (Safari iOS vuole play() dentro il click) quando non c'è
// ancora una clip da suonare.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

const STATUS_LABEL = {
  lobby: 'In attesa',
  countdown: 'Preparati',
  playing: 'In gioco',
  reveal: 'Risultato',
  finished: 'Finita',
};

function formatSeconds(ms) {
  return Math.max(0, Math.ceil(ms / 1000));
}

export default function GTSGamePage() {
  const router = useRouter();
  const params = useParams();
  const roomCode = String(params.roomCode || '').toUpperCase();

  const [phase, setPhase] = useState('connecting'); // connecting | joining | need-name | ready | error
  const [error, setError] = useState('');
  const [state, setState] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [myAnswer, setMyAnswer] = useState(null);
  const [sending, setSending] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [online, setOnline] = useState(true);
  const [nameInput, setNameInput] = useState('');
  const [actionError, setActionError] = useState('');
  const [copied, setCopied] = useState(false);

  const audioRef = useRef(null);
  const playTimerRef = useRef(null);
  const scheduledRef = useRef(''); // chiave dell'ultima clip programmata

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
      syncClock().then(setOffset);
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
      // Non "leave": il posto resta, così un refresh o un ritorno indietro
      // riprende la stessa identità. Il server ci segna solo come disconnessi.
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

  const active = state && ['countdown', 'playing', 'reveal'].includes(state.status);
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);

  const serverNow = now + offset;

  // Nuovo round (o ritorno in lobby) → si azzera la risposta locale.
  const roundIndex = state?.roundIndex ?? 0;
  const inLobby = state?.status === 'lobby';
  useEffect(() => {
    setMyAnswer(null);
    setActionError('');
  }, [roundIndex, inLobby]);

  // ---------- audio ----------

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;
    return () => {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, []);

  const clipUrl = state?.round?.clipUrl || null;
  const startAt = state?.startAt || null;
  const status = state?.status;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const shouldPlay = clipUrl && startAt && ['countdown', 'playing', 'reveal'].includes(status);
    if (!shouldPlay) {
      scheduledRef.current = '';
      if (playTimerRef.current) { clearTimeout(playTimerRef.current); playTimerRef.current = null; }
      audio.pause();
      return;
    }
    if (!audioUnlocked) return;

    const key = `${clipUrl}|${startAt}`;
    if (scheduledRef.current === key) return;
    scheduledRef.current = key;

    if (playTimerRef.current) { clearTimeout(playTimerRef.current); playTimerRef.current = null; }
    audio.pause();
    audio.src = clipUrl;
    audio.load();

    const startPlayback = () => {
      const elapsed = Date.now() + offset - startAt;
      if (elapsed <= 0) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      // Ingresso a round già iniziato: si salta avanti di quanto è passato,
      // ma solo dopo che il browser conosce la durata (altrimenti Safari ignora il seek).
      const seekAndPlay = () => {
        const target = (Date.now() + offset - startAt) / 1000;
        if (Number.isFinite(audio.duration) && target >= audio.duration) return;
        try { audio.currentTime = Math.max(0, target); } catch { /* ignora */ }
        audio.play().catch(() => {});
      };
      if (audio.readyState >= 1) seekAndPlay();
      else audio.addEventListener('loadedmetadata', seekAndPlay, { once: true });
    };

    const delay = startAt - (Date.now() + offset);
    if (delay > 0) playTimerRef.current = setTimeout(startPlayback, delay);
    else startPlayback();
  }, [clipUrl, startAt, status, audioUnlocked, offset]);

  function unlockAudio() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.src) audio.src = SILENT_WAV;
    audio.play().then(() => {
      if (audio.src === SILENT_WAV) audio.pause();
    }).catch(() => {});
    setAudioUnlocked(true);
  }

  // ---------- azioni ----------

  async function act(event, payload) {
    setActionError('');
    try { await emitAck(event, payload); } catch (err) { setActionError(err.message); }
  }

  async function sendAnswer(idx) {
    if (!state || state.status !== 'playing' || myAnswer !== null || sending) return;
    setSending(true);
    setMyAnswer(idx);
    try {
      await emitAck('game:answer', { choice: idx });
    } catch (err) {
      setMyAnswer(null);
      setActionError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function leaveRoom() {
    try { await emitAck('room:leave'); } catch { /* usciamo comunque */ }
    router.push('/gts');
  }

  function copyCode() {
    navigator.clipboard?.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }

  // ---------- derivati ----------

  const me = useMemo(() => state?.players.find((p) => p.id === playerId) || null, [state, playerId]);
  const isHost = !!me?.isHost;
  const standings = useMemo(
    () => [...(state?.players || [])].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)),
    [state],
  );
  const connectedCount = state?.players.filter((p) => p.connected).length || 0;
  const answeredCount = state?.players.filter((p) => p.connected && p.answered).length || 0;
  const phaseLeftMs = state?.phaseEndsAt ? state.phaseEndsAt - serverNow : 0;
  const answered = myAnswer !== null || !!me?.answered;
  const reveal = state?.reveal;
  const myResult = reveal?.results.find((r) => r.playerId === playerId) || null;
  const nameOf = (id) => state?.players.find((p) => p.id === id)?.name || 'Giocatore';

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
        <form onSubmit={submitName} style={{ width: 'min(420px, 92vw)', border: '2px solid rgba(17,24,39,0.2)', borderRadius: 16, padding: 24, background: 'rgba(255,255,255,0.95)', display: 'grid', gap: 12 }}>
          <h1 style={{ margin: 0, color: '#111827', fontSize: '1.3rem' }}>Stanza {roomCode}</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>Come ti chiami?</p>
          <input className="input-modern" autoFocus maxLength={20} value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="Nickname" />
          <button className="btn-3d" type="submit" disabled={!nameInput.trim()}>Entra</button>
          <Link href="/gts" style={{ color: '#6b7280', fontSize: 13, textAlign: 'center' }}>Torna al menu</Link>
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
            <Link href="/gts/join" className="btn-3d" style={{ textDecoration: 'none' }}>Altro codice</Link>
            <Link href="/gts" className="btn-3d" style={{ textDecoration: 'none', background: '#374151' }}>Menu</Link>
          </div>
        </div>
      </main>
    );
  }

  // ---------- render: partita ----------

  const options = state.round?.options || [];

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 'min(1100px, 98vw)', border: '2px solid rgba(17,24,39,0.2)', borderRadius: 18, background: 'rgba(255,255,255,0.92)', padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>

        {!online && (
          <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 10, background: 'rgba(234,179,8,0.2)', color: '#92400e', fontSize: 13 }}>
            Connessione persa, riconnessione in corso...
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <button className="btn-3d" onClick={leaveRoom} style={{ background: '#374151' }}>Esci</button>
          <h1 style={{ margin: 0, color: '#111827', fontSize: '1.4rem' }}>Stanza {roomCode}</h1>
          <span className="bubble" style={{ background: 'rgba(99,102,241,0.15)', color: '#312e81' }}>{STATUS_LABEL[state.status] || state.status}</span>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {/* Pannello principale */}
          <div style={{ flex: '2 1 480px', border: '1px solid rgba(17,24,39,0.12)', borderRadius: 14, padding: 20, background: 'rgba(99,102,241,0.04)' }}>

            {state.status === 'lobby' && (
              <div style={{ display: 'grid', gap: 16, textAlign: 'center' }}>
                <p style={{ margin: 0, color: '#6b7280' }}>Condividi il codice con gli amici</p>
                <button onClick={copyCode} title="Copia" style={{ background: 'none', border: 0, cursor: 'pointer' }}>
                  <span style={{ fontSize: '3rem', letterSpacing: '0.25em', color: '#4f46e5', fontWeight: 800 }}>{roomCode}</span>
                  <span style={{ display: 'block', fontSize: 12, color: '#6b7280' }}>{copied ? 'Copiato!' : 'tocca per copiare'}</span>
                </button>
                <p style={{ margin: 0, color: '#111827' }}>
                  {state.settings.maxRounds} round · {state.settings.roundMs / 1000}s a round · playlist <strong>{state.playlist.name}</strong>
                </p>
                {!audioUnlocked && (
                  <button className="btn-3d" onClick={unlockAudio} style={{ justifySelf: 'center' }}>🔊 Abilita audio</button>
                )}
                {isHost ? (
                  <button className="btn-3d" onClick={() => act('game:start')} style={{ justifySelf: 'center', minWidth: 220, fontSize: '1.1rem' }}>
                    Avvia partita
                  </button>
                ) : (
                  <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>In attesa che {nameOf(state.hostId)} avvii la partita...</p>
                )}
              </div>
            )}

            {state.status !== 'lobby' && state.status !== 'finished' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>Round</p>
                    <h2 style={{ margin: 0, color: '#111827' }}>{state.roundIndex}/{state.totalRounds}</h2>
                  </div>
                  <div>
                    {state.status === 'countdown' && <span className="bubble" style={{ background: 'rgba(234,179,8,0.2)', color: '#92400e', fontSize: 16 }}>Parte in {formatSeconds(phaseLeftMs)}s</span>}
                    {state.status === 'playing' && <span className="bubble" style={{ background: 'rgba(16,185,129,0.2)', color: '#065f46', fontSize: 16 }}>Tempo: {formatSeconds(phaseLeftMs)}s</span>}
                    {state.status === 'reveal' && <span className="bubble" style={{ background: 'rgba(99,102,241,0.15)', color: '#312e81', fontSize: 16 }}>{reveal?.isLast ? 'Podio' : 'Prossimo round'} tra {formatSeconds(phaseLeftMs)}s</span>}
                  </div>
                </div>

                {!audioUnlocked && (
                  <button className="btn-3d" style={{ marginBottom: 12 }} onClick={unlockAudio}>🔊 Abilita audio</button>
                )}

                <div style={{ display: 'grid', gap: 10 }}>
                  {options.map((option, idx) => {
                    const isReveal = state.status === 'reveal';
                    const isCorrect = isReveal && idx === reveal?.correctIndex;
                    const mine = myAnswer === idx || myResult?.choice === idx;
                    const isWrongMine = isReveal && mine && !isCorrect;
                    const disabled = state.status !== 'playing' || answered || sending;

                    let background = '#111827';
                    let color = '#fff';
                    let border = '1px solid rgba(255,255,255,0.12)';
                    let boxShadow = '0 8px 20px rgba(0,0,0,0.25)';
                    if (isReveal) {
                      if (isCorrect) { background = '#16a34a'; border = '1px solid #15803d'; }
                      else if (isWrongMine) { background = '#dc2626'; border = '1px solid #b91c1c'; }
                      else { background = '#1f2937'; color = '#9ca3af'; }
                    } else if (mine) {
                      border = '2px solid #60a5fa';
                      boxShadow = '0 0 0 3px rgba(96,165,250,0.35)';
                    }

                    return (
                      <button
                        key={idx}
                        className="btn-3d btn-option"
                        onClick={() => sendAnswer(idx)}
                        disabled={disabled}
                        style={{ background, color, border, boxShadow }}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>

                {state.status === 'playing' && answered && (
                  <p style={{ margin: '12px 0 0', color: '#4f46e5', fontWeight: 600, textAlign: 'center' }}>Risposta inviata, aspetta gli altri...</p>
                )}

                {state.status === 'reveal' && reveal && (
                  <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, borderRadius: 12, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#312e81' }}>
                      {reveal.cover && <img src={reveal.cover} alt="" style={{ width: 56, height: 56, borderRadius: 8 }} />}
                      <div>
                        <p style={{ margin: 0, fontWeight: 700 }}>{reveal.title}</p>
                        <p style={{ margin: 0, fontSize: 13 }}>{reveal.artist}</p>
                      </div>
                    </div>
                    {myResult ? (
                      <p style={{ margin: 0, textAlign: 'center', fontWeight: 700, color: myResult.correct ? '#065f46' : '#991b1b' }}>
                        {myResult.correct ? `Giusto! +${myResult.points} punti in ${(myResult.deltaMs / 1000).toFixed(2)}s` : 'Sbagliato, 0 punti'}
                      </p>
                    ) : (
                      <p style={{ margin: 0, textAlign: 'center', color: '#6b7280' }}>Non hai risposto</p>
                    )}
                    {reveal.firstCorrect && (
                      <p style={{ margin: 0, fontSize: 13, color: '#065f46', textAlign: 'center' }}>
                        Più veloce: {nameOf(reveal.firstCorrect.playerId)} in {(reveal.firstCorrect.deltaMs / 1000).toFixed(2)}s (+{reveal.firstCorrect.points})
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {state.status === 'finished' && (
              <div className="fade-up" style={{ textAlign: 'center' }}>
                <h2 style={{ color: '#111827', marginTop: 0 }}>🏆 Podio finale</h2>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {standings.slice(0, 3).map((row, idx) => (
                    <div key={row.id} style={{ flex: '1 1 160px', maxWidth: 220, border: '1px solid rgba(17,24,39,0.12)', borderRadius: 12, padding: 16, background: idx === 0 ? 'rgba(251,191,36,0.25)' : idx === 1 ? 'rgba(209,213,219,0.4)' : 'rgba(205,127,50,0.2)' }}>
                      <div style={{ fontSize: '1.6rem' }}>{['🥇', '🥈', '🥉'][idx]}</div>
                      <p style={{ margin: '4px 0', fontWeight: 700, color: '#111827' }}>{row.name}{row.id === playerId ? ' (tu)' : ''}</p>
                      <p style={{ margin: 0, color: '#111827' }}>{row.score} punti</p>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {isHost && <button className="btn-3d" onClick={() => act('game:restart')}>Rigioca con gli stessi</button>}
                  <button className="btn-3d" onClick={leaveRoom} style={{ background: '#374151' }}>Esci</button>
                </div>
              </div>
            )}

            {actionError && <p style={{ marginTop: 12, color: '#dc2626', fontSize: 13, textAlign: 'center' }}>{actionError}</p>}
          </div>

          {/* Sidebar */}
          <div style={{ flex: '1 1 240px', border: '1px solid rgba(17,24,39,0.12)', borderRadius: 14, padding: 16 }}>
            <h3 style={{ marginTop: 0, color: '#111827' }}>Giocatori ({connectedCount}/{state.players.length})</h3>
            <ol style={{ paddingLeft: 0, margin: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
              {standings.map((row, idx) => (
                <li key={row.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: row.id === playerId ? '#4f46e5' : '#111827', fontWeight: row.id === playerId ? 700 : 500, opacity: row.connected ? 1 : 0.5 }}>
                  <span>
                    {state.status === 'lobby' ? '' : `${idx + 1}. `}
                    {row.isHost ? '👑 ' : ''}{row.name}
                    {!row.connected ? ' ⚠️' : ''}
                    {state.status === 'playing' && row.answered ? ' ✅' : ''}
                  </span>
                  {state.status !== 'lobby' && <span>{row.score} pt</span>}
                </li>
              ))}
            </ol>
            {state.status === 'playing' && (
              <p style={{ marginTop: 12, fontSize: 12, color: '#6b7280' }}>Risposte: {answeredCount}/{connectedCount}</p>
            )}
            <p style={{ marginTop: 12, fontSize: 12, color: '#6b7280' }}>Playlist: {state.playlist.name}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
