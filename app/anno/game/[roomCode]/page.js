'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { gameChannel, getNickname, setNickname } from '@/lib/gameClient';
import YearPicker from '@/components/anno/YearPicker';
import RevealTimeline from '@/components/anno/RevealTimeline';
import { recordOnlineMatch } from '@/lib/stats';

const { emitAck, getSocket, getStoredPlayer, storePlayer, syncClock } = gameChannel('anno');

const STATUS_LABEL = {
  lobby: 'In attesa',
  countdown: 'Preparati',
  playing: 'In gioco',
  reveal: 'Risultato',
  finished: 'Finita',
};

// Margine prima della fine del round per l'invio automatico: la risposta
// deve arrivare al server prima che chiuda il round.
const AUTO_SUBMIT_LEAD_MS = 900;

function formatSeconds(ms) {
  return Math.max(0, Math.ceil(ms / 1000));
}

function buzz(pattern) {
  try { navigator.vibrate?.(pattern); } catch { /* non supportato */ }
}

export default function AnnoGamePage() {
  const router = useRouter();
  const params = useParams();
  const roomCode = String(params.roomCode || '').toUpperCase();

  const [phase, setPhase] = useState('connecting'); // connecting | joining | need-name | ready | error
  const [error, setError] = useState('');
  const [state, setState] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [draft, setDraft] = useState(null); // { key, year, touched }
  const [myAnswer, setMyAnswer] = useState(null); // { key, year, auto }
  const [sending, setSending] = useState(false);
  const [online, setOnline] = useState(true);
  const [nameInput, setNameInput] = useState('');
  const [actionError, setActionError] = useState('');
  const [copied, setCopied] = useState(false);

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

  const status = state?.status;
  const active = ['countdown', 'playing', 'reveal'].includes(status);
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);

  const serverNow = now + offset;

  // ---------- round corrente e risposta ----------

  const round = state?.round || null;
  const roundIndex = state?.roundIndex ?? 0;
  // Identifica il round: due partite di fila nella stessa stanza ripartono da 1.
  const roundKey = round ? `${roundIndex}|${round.title}|${round.range.min}` : null;

  // Nuovo round → lo slider riparte da metà intervallo (l'anno giusto può essere ovunque).
  useEffect(() => {
    if (!round) return;
    setDraft((d) => (d?.key === roundKey ? d : { key: roundKey, year: Math.round((round.range.min + round.range.max) / 2), touched: false }));
    setActionError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundKey]);

  const me = useMemo(() => state?.players.find((p) => p.id === playerId) || null, [state, playerId]);
  const mine = myAnswer?.key === roundKey ? myAnswer : null;
  const answered = !!mine || !!me?.answered;

  const sendAnswer = useCallback(async (year, auto = false) => {
    if (!roundKey || sending) return;
    setSending(true);
    setActionError('');
    try {
      await emitAck('game:answer', { choice: year });
      setMyAnswer({ key: roundKey, year, auto });
      buzz(15);
    } catch (err) {
      if (!auto) setActionError(err.message);
    } finally {
      setSending(false);
    }
  }, [roundKey, sending]);

  // Invio automatico a fine tempo, solo se lo slider è stato mosso.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const phaseEndsAt = state?.phaseEndsAt || null;
  useEffect(() => {
    if (status !== 'playing' || answered || !phaseEndsAt) return undefined;
    const delay = phaseEndsAt - (Date.now() + offset) - AUTO_SUBMIT_LEAD_MS;
    const t = setTimeout(() => {
      const d = draftRef.current;
      if (d?.key === roundKey && d.touched) sendAnswer(d.year, true);
    }, Math.max(0, delay));
    return () => clearTimeout(t);
  }, [status, answered, phaseEndsAt, offset, roundKey, sendAnswer]);

  // ---------- azioni ----------

  async function act(event, payload) {
    setActionError('');
    try { await emitAck(event, payload); } catch (err) { setActionError(err.message); }
  }

  async function leaveRoom() {
    try { await emitAck('room:leave'); } catch { /* usciamo comunque */ }
    router.push('/anno');
  }

  function copyCode() {
    navigator.clipboard?.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }

  // ---------- derivati ----------

  const isHost = !!me?.isHost;
  const standings = useMemo(
    () => [...(state?.players || [])].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)),
    [state],
  );

  // A fine partita salva le statistiche personali (una volta per partita)
  const finished = state?.status === 'finished';
  useEffect(() => {
    if (!finished || !playerId || !state) return;
    const mine = state.players.find((p) => p.id === playerId);
    if (!mine) return;
    const rank = 1 + state.players.filter((p) => p.score > mine.score).length;
    // startAt a fine partita è null: la partita si riconosce da stanza + punteggi finali
    const finalScores = state.players.map((p) => `${p.id}=${p.score}`).sort().join(',');
    recordOnlineMatch('anno', { matchKey: `${state.code}:${finalScores}`, score: mine.score, rank, players: state.players.length });
  }, [finished, playerId, state]);
  const connectedCount = state?.players.filter((p) => p.connected).length || 0;
  const answeredCount = state?.players.filter((p) => p.connected && p.answered).length || 0;
  const phaseLeftMs = phaseEndsAt ? phaseEndsAt - serverNow : 0;
  const reveal = state?.reveal;
  const categoryOf = (id) => state?.categories?.find((c) => c.id === id) || { label: id, emoji: '📅' };
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
        <form onSubmit={submitName} className="panel" style={{ width: 'min(420px, 92vw)', padding: 24, display: 'grid', gap: 12 }}>
          <h1 style={{ margin: 0, color: '#111827', fontSize: '1.3rem' }}>Stanza {roomCode}</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>Come ti chiami?</p>
          <input className="input-modern" autoFocus maxLength={20} value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="Nickname" />
          <button className="btn-3d" type="submit" disabled={!nameInput.trim()}>Entra</button>
          <Link href="/anno" style={{ color: '#6b7280', fontSize: 13, textAlign: 'center' }}>Torna al menu</Link>
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
            <Link href="/anno/join" className="btn-3d" style={{ textDecoration: 'none' }}>Altro codice</Link>
            <Link href="/anno" className="btn-3d" style={{ textDecoration: 'none', background: '#374151' }}>Menu</Link>
          </div>
        </div>
      </main>
    );
  }

  // ---------- render: partita ----------

  const cat = round ? categoryOf(round.category) : null;
  const totalMs = state.settings.roundMs;
  const timeFraction = status === 'playing' ? Math.max(0, Math.min(1, phaseLeftMs / totalMs)) : 1;

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(10px, 3vw, 20px)' }}>
      <div className="panel" style={{ width: 'min(1100px, 98vw)', padding: 'clamp(14px, 3vw, 24px)' }}>

        {!online && (
          <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 10, background: 'rgba(234,179,8,0.2)', color: '#92400e', fontSize: 13 }}>
            Connessione persa, riconnessione in corso...
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <button className="btn-3d" onClick={leaveRoom} style={{ background: '#374151' }}>Esci</button>
          <h1 style={{ margin: 0, color: '#111827', fontSize: '1.2rem' }}>📅 {roomCode}</h1>
          <span className="bubble" style={{ background: 'rgba(99,102,241,0.15)', color: '#312e81' }}>{STATUS_LABEL[status] || status}</span>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {/* Pannello principale */}
          <div style={{ flex: '2 1 480px', minWidth: 0, border: '1px solid rgba(17,24,39,0.12)', borderRadius: 14, padding: 'clamp(12px, 3vw, 20px)', background: 'rgba(99,102,241,0.04)' }}>

            {status === 'lobby' && (
              <div style={{ display: 'grid', gap: 16, textAlign: 'center' }}>
                <p style={{ margin: 0, color: '#6b7280' }}>Condividi il codice con gli amici</p>
                <button onClick={copyCode} title="Copia" style={{ background: 'none', border: 0, cursor: 'pointer' }}>
                  <span style={{ fontSize: '3rem', letterSpacing: '0.25em', color: '#4f46e5', fontWeight: 800 }}>{roomCode}</span>
                  <span style={{ display: 'block', fontSize: 12, color: '#6b7280' }}>{copied ? 'Copiato!' : 'tocca per copiare'}</span>
                </button>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {(state.categories || []).map((c) => (
                    <span key={c.id} className="bubble" style={{ background: 'rgba(99,102,241,0.12)', color: '#312e81', fontSize: 11, padding: '4px 10px' }}>{c.emoji} {c.label}</span>
                  ))}
                </div>
                <p style={{ margin: 0, color: '#111827', fontSize: 13 }}>
                  {state.settings.maxRounds} round · {state.settings.roundMs / 1000}s per rispondere
                </p>
                {isHost ? (
                  <button className="btn-3d" onClick={() => act('game:start')} style={{ justifySelf: 'center', minWidth: 220, fontSize: '1.1rem' }}>
                    Avvia partita
                  </button>
                ) : (
                  <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>In attesa che {nameOf(state.hostId)} avvii la partita...</p>
                )}
              </div>
            )}

            {active && round && (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: '#6b7280', fontSize: 12 }}>Round {roundIndex}/{state.totalRounds}</span>
                  {status === 'playing' && <span className="bubble" style={{ background: 'rgba(16,185,129,0.2)', color: '#065f46', fontSize: 14 }}>⏱ {formatSeconds(phaseLeftMs)}s</span>}
                  {status === 'reveal' && <span className="bubble" style={{ background: 'rgba(99,102,241,0.15)', color: '#312e81', fontSize: 12 }}>{reveal?.isLast ? 'Podio' : 'Prossimo'} tra {formatSeconds(phaseLeftMs)}s</span>}
                </div>

                {status === 'countdown' && (
                  <div className="fade-up" style={{ textAlign: 'center', padding: '24px 0' }}>
                    <div style={{ fontSize: 56 }}>{cat.emoji}</div>
                    <p style={{ margin: '10px 0 0', color: '#312e81', fontWeight: 700 }}>{cat.label}</p>
                    <div key={formatSeconds(phaseLeftMs)} className="reveal-pop" style={{ marginTop: 18, fontSize: 48, fontWeight: 800, color: '#4f46e5' }}>
                      {formatSeconds(phaseLeftMs) || 'Via!'}
                    </div>
                  </div>
                )}

                {(status === 'playing' || status === 'reveal') && (
                  <div className="anno-card" key={roundKey}>
                    <span className="anno-chip">{cat.emoji} {cat.label}</span>
                    <h2>{round.title}</h2>
                    {round.subtitle && <p>{round.subtitle}</p>}
                  </div>
                )}

                {status === 'playing' && (
                  <>
                    <div className="anno-timebar" aria-hidden="true">
                      <div style={{ width: `${timeFraction * 100}%`, backgroundPosition: `${(1 - timeFraction) * 100}% 0` }} />
                    </div>

                    {!answered && draft?.key === roundKey && (
                      <>
                        <YearPicker
                          range={round.range}
                          value={draft.year}
                          disabled={sending}
                          onChange={(year) => setDraft({ key: roundKey, year, touched: true })}
                        />
                        <button
                          className="btn-3d"
                          onClick={() => sendAnswer(draft.year)}
                          disabled={sending}
                          style={{ fontSize: '1.05rem', padding: '14px 0', background: 'linear-gradient(180deg, #10b981, #059669)', boxShadow: '0 8px 0 #065f46, 0 12px 22px rgba(5,150,105,0.35)' }}
                        >
                          {sending ? 'Invio...' : `Conferma ${draft.year}`}
                        </button>
                      </>
                    )}

                    {answered && (
                      <div className="fade-up" style={{ textAlign: 'center', padding: '12px 0' }}>
                        <p style={{ margin: 0, color: '#6b7280', fontSize: 12 }}>{mine?.auto ? 'Tempo scaduto, inviato in automatico' : 'La tua risposta'}</p>
                        <div className="anno-year-big" style={{ marginTop: 8 }}>{mine ? mine.year : '🔒'}</div>
                        <p style={{ margin: '12px 0 0', color: '#4f46e5', fontSize: 12 }}>Aspetta gli altri... ({answeredCount}/{connectedCount})</p>
                      </div>
                    )}
                  </>
                )}

                {status === 'reveal' && reveal && (
                  <RevealTimeline key={`${reveal.roundIndex}|${reveal.title}`} reveal={reveal} players={state.players} playerId={playerId} />
                )}
              </div>
            )}

            {status === 'finished' && (
              <div className="fade-up" style={{ textAlign: 'center' }}>
                <h2 style={{ color: '#111827', margin: '0 0 16px' }}>🏆 Podio finale</h2>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {standings.slice(0, 3).map((row, idx) => (
                    <div key={row.id} className="podium-item" style={{ flex: '1 1 160px', maxWidth: 220, border: '1px solid rgba(17,24,39,0.12)', borderRadius: 12, padding: 16, background: idx === 0 ? 'rgba(251,191,36,0.25)' : idx === 1 ? 'rgba(209,213,219,0.4)' : 'rgba(205,127,50,0.2)', animationDelay: `${(2 - idx) * 250}ms` }}>
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
            <h3 style={{ marginTop: 0, color: '#111827', fontSize: 14 }}>Giocatori ({connectedCount}/{state.players.length})</h3>
            <ol style={{ paddingLeft: 0, margin: 0, listStyle: 'none', display: 'grid', gap: 8, fontSize: 12 }}>
              {standings.map((row, idx) => (
                <li key={row.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: row.id === playerId ? '#4f46e5' : '#111827', fontWeight: row.id === playerId ? 700 : 500, opacity: row.connected ? 1 : 0.5 }}>
                  <span>
                    {status === 'lobby' ? '' : `${idx + 1}. `}
                    {row.isHost ? '👑 ' : ''}{row.name}
                    {!row.connected ? ' ⚠️' : ''}
                    {status === 'playing' && row.answered ? ' ✅' : ''}
                  </span>
                  {status !== 'lobby' && <span>{row.score} pt</span>}
                </li>
              ))}
            </ol>
            {status === 'playing' && (
              <p style={{ marginTop: 12, fontSize: 11, color: '#6b7280' }}>Risposte: {answeredCount}/{connectedCount}</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
