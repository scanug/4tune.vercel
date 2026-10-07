'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { daily, getDailyIdentity, getNickname, setDailyIdentity, setNickname } from '@/lib/gameClient';
import YearPicker from '@/components/anno/YearPicker';
import RevealTimeline from '@/components/anno/RevealTimeline';
import DailyDashboard from '@/components/anno/DailyDashboard';
import { recordDaily } from '@/lib/stats';

const CATEGORY = {
  personaggi: { label: 'Personaggi', emoji: '🎂' },
  storia: { label: 'Eventi storici', emoji: '🏛️' },
  invenzioni: { label: 'Invenzioni e prodotti', emoji: '💡' },
  media: { label: 'Film, serie e videogiochi', emoji: '🎬' },
  musica: { label: 'Musica', emoji: '🎵' },
  sport: { label: 'Sport', emoji: '⚽' },
  attualita: { label: 'Attualità', emoji: '📰' },
};

// Stessa formula del server (server/src/games/anno.js): serve solo per la
// rigiocata d'allenamento, che non passa dal server e non conta in classifica.
function practicePoints(distance, span) {
  const ratio = Math.min(1, distance / (span / 2));
  const base = Math.round(100 * (1 - ratio) ** 2);
  return { base, points: base + (distance === 0 ? 50 : 0) };
}

function emojiOf({ distance, base }) {
  if (distance === 0) return '🎯';
  if (base >= 80) return '🟩';
  if (base >= 40) return '🟨';
  if (base > 0) return '🟧';
  return '🟥';
}

function countdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s % 60).padStart(2, '0')}s`;
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

const panel = { border: '1px solid rgba(17,24,39,0.12)', borderRadius: 14, padding: 'clamp(12px, 3vw, 20px)', background: 'rgba(99,102,241,0.04)' };

export default function AnnoDelGiornoPage() {
  const now = useNow();
  const [identity, setIdentity] = useState(null);
  const [info, setInfo] = useState(null); // risposta di /daily/today
  const [view, setView] = useState('loading'); // loading | home | play | summary | practice | error
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // partita in corso (ufficiale o allenamento)
  const [card, setCard] = useState(null);
  const [draft, setDraft] = useState(null);
  const [result, setResult] = useState(null); // ultima carta rivelata
  const [pending, setPending] = useState(null); // { next, done }
  const [score, setScore] = useState(0);
  const [sending, setSending] = useState(false);
  const [review, setReview] = useState(null);
  const [practice, setPractice] = useState(null); // { cards, index, score, answers }
  const [shareMsg, setShareMsg] = useState('');

  // nickname
  const [nameInput, setNameInput] = useState('');
  const [registering, setRegistering] = useState(false);

  const loadToday = useCallback(async () => {
    try {
      const data = await daily.today();
      setInfo(data);
      setView('home');
      setError('');
    } catch (err) {
      if (err.status === 401) {
        // Il nickname salvato non esiste più sul server: si ricomincia.
        setDailyIdentity(null);
        setIdentity(null);
        setNotice('Il tuo nickname non è più valido su questo dispositivo, scegline uno.');
        return loadToday();
      }
      setError(err.message);
      setView('error');
    }
    return null;
  }, []);

  useEffect(() => {
    setIdentity(getDailyIdentity());
    setNameInput(getNickname());
    loadToday();
  }, [loadToday]);

  async function register(e) {
    e?.preventDefault();
    const name = nameInput.trim();
    if (!name) return;
    setRegistering(true);
    setError('');
    try {
      const res = await daily.register(name);
      const id = { token: res.token, name: res.name, playerId: res.playerId };
      setDailyIdentity(id);
      setNickname(res.name);
      setIdentity(id);
      setNotice('');
      await loadToday();
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setRegistering(false);
    }
  }

  function showCard(next) {
    setCard(next);
    setResult(null);
    setPending(null);
    setDraft({ index: next.index, year: Math.round((next.range.min + next.range.max) / 2) });
  }

  async function play() {
    setError('');
    try {
      const res = await daily.start();
      setScore(res.score);
      if (res.done || !res.card) { await openSummary(); return; }
      showCard(res.card);
      setView('play');
    } catch (err) {
      setError(err.message);
    }
  }

  async function openSummary() {
    try {
      const data = await daily.review();
      setReview(data);
      setView('summary');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirm() {
    if (!card || sending) return;
    setSending(true);
    setError('');
    try {
      if (view === 'practice') {
        const c = practice.cards[practice.index];
        const distance = Math.abs(draft.year - c.year);
        const { base, points } = practicePoints(distance, c.span);
        const entry = { ...c, guess: draft.year, distance, base, points, exact: distance === 0 };
        const index = practice.index + 1;
        setPractice((p) => ({ ...p, index, score: p.score + points }));
        setScore((s) => s + points);
        setResult(entry);
        const nextCard = practice.cards[index];
        setPending({ done: !nextCard, next: nextCard ? { index, category: nextCard.category, title: nextCard.title, subtitle: nextCard.subtitle, range: nextCard.range } : null });
      } else {
        const res = await daily.answer(card.index, draft.year);
        setScore(res.score);
        setResult(res.result);
        setPending({ done: res.done, next: res.next });
      }
      try { navigator.vibrate?.(15); } catch { /* non supportato */ }
    } catch (err) {
      // Mezzanotte passata a metà partita: la sfida di ieri è chiusa.
      if (err.code === 'state' || err.code === 'index') {
        setNotice('È iniziata una nuova sfida!');
        await loadToday();
      } else if (err.code === 'dup' || err.code === 'done') {
        await play();
      } else {
        setError(err.message);
      }
    } finally {
      setSending(false);
    }
  }

  async function advance() {
    if (pending?.next) { showCard(pending.next); return; }
    if (view === 'practice') { setView('summary'); return; }
    await openSummary();
  }

  function startPractice() {
    const cards = review.cards;
    setPractice({ cards, index: 0, score: 0 });
    setScore(0);
    showCard({ index: 0, category: cards[0].category, title: cards[0].title, subtitle: cards[0].subtitle, range: cards[0].range });
    setView('practice');
  }

  async function share() {
    const answers = review.cards.map((c) => c.answer);
    const text = [
      `📅 L'Anno del Giorno #${review.number}`,
      `${review.score}/${review.maxScore} punti`,
      answers.map((a) => (a ? emojiOf(a) : '⬜')).join(''),
      `${window.location.origin}/anno/giorno`,
    ].join('\n');
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
      setShareMsg('Copiato! Incollalo dove vuoi');
    } catch {
      try { await navigator.clipboard.writeText(text); setShareMsg('Copiato! Incollalo dove vuoi'); } catch { setShareMsg(text); }
    }
    setTimeout(() => setShareMsg(''), 3000);
  }

  const nextAtLeft = info ? info.nextAt - now : 0;
  // A mezzanotte la pagina passa da sola alla sfida nuova (se non si sta giocando).
  // Un tentativo per scadenza: se l'orologio del telefono è avanti rispetto al
  // server, la sfida nuova arriva al riaggiornamento successivo.
  const reloadedFor = useRef(null);
  useEffect(() => {
    if (!info || nextAtLeft > 0 || reloadedFor.current === info.nextAt) return;
    if (view !== 'home' && view !== 'summary') return;
    reloadedFor.current = info.nextAt;
    const t = setTimeout(loadToday, 1500);
    return () => clearTimeout(t);
  }, [info, nextAtLeft, view, loadToday]);

  const me = info?.me;

  // Sfida di oggi completata: entra nelle statistiche personali (una volta al giorno)
  const doneDay = me?.status === 'done' ? info.day : null;
  const doneScore = me?.score;
  useEffect(() => {
    if (doneDay) recordDaily({ day: doneDay, score: doneScore });
  }, [doneDay, doneScore]);
  const playing = view === 'play' || view === 'practice';

  // ---------- render ----------

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(10px, 3vw, 20px)' }}>
      <div className="panel" style={{ width: 'min(760px, 98vw)', padding: 'clamp(14px, 3vw, 24px)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          {playing ? (
            <button className="btn-3d" style={{ background: '#374151' }} onClick={() => { if (view === 'practice') setView('summary'); else loadToday(); }}>
              {view === 'practice' ? 'Chiudi' : 'Pausa'}
            </button>
          ) : (
            <Link href="/anno" className="btn-3d" style={{ textDecoration: 'none' }}>Indietro</Link>
          )}
          <h1 style={{ margin: 0, color: '#111827', fontSize: '1.15rem', textAlign: 'center' }}>
            📅 L&apos;Anno del Giorno{info ? ` #${info.number}` : ''}
          </h1>
          <span />
        </div>

        {notice && <p style={{ margin: 0, padding: '8px 12px', borderRadius: 10, background: 'rgba(234,179,8,0.2)', color: '#92400e', fontSize: 12 }}>{notice}</p>}

        {view === 'loading' && <p style={{ textAlign: 'center', color: '#6b7280' }}>Caricamento...</p>}

        {view === 'error' && (
          <div style={{ ...panel, textAlign: 'center', display: 'grid', gap: 12 }}>
            <p style={{ margin: 0, color: '#dc2626' }}>{error || 'Qualcosa non va'}</p>
            <button className="btn-3d" style={{ justifySelf: 'center' }} onClick={() => { setView('loading'); loadToday(); }}>Riprova</button>
          </div>
        )}

        {/* ---------- home ---------- */}
        {view === 'home' && info && (
          <>
            <div style={{ ...panel, textAlign: 'center', display: 'grid', gap: 14 }}>
              <p style={{ margin: 0, color: '#4b5563', fontSize: 12, lineHeight: 1.6 }}>
                {info.total} carte uguali per tutti, una sfida al giorno. Indovina l&apos;anno, scala la classifica e torna domani.
              </p>

              {!identity ? (
                <form onSubmit={register} style={{ display: 'grid', gap: 10, textAlign: 'left' }}>
                  <label style={{ fontWeight: 600, color: '#111827', fontSize: 13 }}>Scegli il tuo nickname per la classifica</label>
                  <input className="input-modern" maxLength={20} value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="Nickname" />
                  <p style={{ margin: 0, fontSize: 10, color: '#6b7280', lineHeight: 1.5 }}>
                    Il nickname resta tuo su questo dispositivo: nessun altro potrà usarlo. Se cancelli i dati del browser o cambi telefono, ne dovrai scegliere un altro.
                  </p>
                  <button className="btn-3d" type="submit" disabled={registering || !nameInput.trim()}>{registering ? 'Un attimo...' : 'Inizia'}</button>
                </form>
              ) : me?.status === 'done' ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  <p style={{ margin: 0, color: '#111827' }}>Sfida di oggi completata, {me.name}!</p>
                  <div className="anno-year-big" style={{ fontSize: 44 }}>{me.score}</div>
                  <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>punti su {info.maxScore}</p>
                  <button className="btn-3d" style={{ justifySelf: 'center' }} onClick={openSummary}>Riepilogo e condividi</button>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  <p style={{ margin: 0, color: '#111827', fontSize: 13 }}>Ciao {me?.name || identity.name}!</p>
                  <button className="btn-3d" style={{ justifySelf: 'center', minWidth: 240, fontSize: '1.05rem', padding: '14px 24px', background: 'linear-gradient(180deg, #10b981, #059669)', boxShadow: '0 8px 0 #065f46, 0 12px 22px rgba(5,150,105,0.35)' }} onClick={play}>
                    {me?.status === 'playing' ? `Continua (carta ${me.answered + 1}/${info.total})` : 'Gioca la sfida di oggi'}
                  </button>
                </div>
              )}

              <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>Nuova sfida tra {countdown(nextAtLeft)}</p>
              {error && <p style={{ margin: 0, color: '#dc2626', fontSize: 12 }}>{error}</p>}
            </div>

            <div style={panel}>
              <h2 style={{ margin: '0 0 12px', fontSize: 14, color: '#111827' }}>🏆 Classifica</h2>
              <DailyDashboard hasIdentity={!!identity} refreshKey={refreshKey} />
            </div>
          </>
        )}

        {/* ---------- partita ---------- */}
        {playing && card && (
          <div style={{ ...panel, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280' }}>
              <span>Carta {card.index + 1}/{info?.total || 10}{view === 'practice' ? ' · allenamento' : ''}</span>
              <span style={{ color: '#4f46e5', fontWeight: 700 }}>{score} pt</span>
            </div>

            <div className="anno-card" key={`${view}-${card.index}`}>
              <span className="anno-chip">{CATEGORY[card.category]?.emoji} {CATEGORY[card.category]?.label}</span>
              <h2>{card.title}</h2>
              {card.subtitle && <p>{card.subtitle}</p>}
            </div>

            {!result && draft?.index === card.index && (
              <>
                <YearPicker range={card.range} value={draft.year} disabled={sending} onChange={(year) => setDraft({ index: card.index, year })} />
                <button
                  className="btn-3d"
                  onClick={confirm}
                  disabled={sending}
                  style={{ fontSize: '1.05rem', padding: '14px 0', background: 'linear-gradient(180deg, #10b981, #059669)', boxShadow: '0 8px 0 #065f46, 0 12px 22px rgba(5,150,105,0.35)' }}
                >
                  {sending ? 'Invio...' : `Conferma ${draft.year}`}
                </button>
              </>
            )}

            {result && (
              <>
                <RevealTimeline
                  key={`${view}-${card.index}`}
                  reveal={{
                    ...result,
                    results: [{ playerId: 'me', guess: result.guess, distance: result.distance, exact: result.exact, winner: result.base >= 80, base: result.base, points: result.points }],
                    winnerIds: result.base >= 80 ? ['me'] : [],
                  }}
                  players={[{ id: 'me', name: identity?.name || 'Tu' }]}
                  playerId="me"
                />
                <button className="btn-3d" onClick={advance} style={{ fontSize: '1rem', padding: '12px 0' }}>
                  {pending?.next ? 'Prossima carta →' : 'Vedi il risultato'}
                </button>
              </>
            )}

            {error && <p style={{ margin: 0, color: '#dc2626', fontSize: 12, textAlign: 'center' }}>{error}</p>}
          </div>
        )}

        {/* ---------- riepilogo ---------- */}
        {view === 'summary' && review && (
          <>
            <div style={{ ...panel, textAlign: 'center', display: 'grid', gap: 12 }}>
              <p style={{ margin: 0, color: '#6b7280', fontSize: 12 }}>Sfida #{review.number}</p>
              <div className="anno-year-big reveal-pop">{review.score}</div>
              <p style={{ margin: 0, color: '#6b7280', fontSize: 11 }}>punti su {review.maxScore}</p>
              <div style={{ fontSize: 26, letterSpacing: 2 }} aria-label="Risultato carta per carta">
                {review.cards.map((c) => (c.answer ? emojiOf(c.answer) : '⬜')).join('')}
              </div>
              {practice && practice.index >= practice.cards.length && (
                <p style={{ margin: 0, fontSize: 11, color: '#4f46e5' }}>Allenamento: {practice.score} punti (non conta in classifica)</p>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn-3d" onClick={share}>📤 Condividi</button>
                <button className="btn-3d" style={{ background: '#fff', color: '#111827' }} onClick={startPractice}>🔁 Rigioca per allenarti</button>
              </div>
              {shareMsg && <p style={{ margin: 0, fontSize: 11, color: '#065f46', whiteSpace: 'pre-line' }}>{shareMsg}</p>}
              <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>Nuova sfida tra {countdown(nextAtLeft)}</p>
            </div>

            <div style={panel}>
              <h2 style={{ margin: '0 0 12px', fontSize: 14, color: '#111827' }}>Le carte di oggi</h2>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6 }}>
                {review.cards.map((c) => (
                  <li key={c.index} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(17,24,39,0.04)', fontSize: 11, color: '#111827' }}>
                    <span style={{ fontSize: 16 }}>{c.answer ? emojiOf(c.answer) : '⬜'}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                      <span style={{ color: '#6b7280', fontSize: 10 }}>Era il {c.year}{c.answer ? ` · tu ${c.answer.guess}` : ''}</span>
                    </span>
                    <span style={{ fontWeight: 800, color: '#4f46e5' }}>+{c.answer?.points ?? 0}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div style={panel}>
              <h2 style={{ margin: '0 0 12px', fontSize: 14, color: '#111827' }}>🏆 Classifica</h2>
              <DailyDashboard hasIdentity={!!identity} refreshKey={refreshKey} />
              <button className="btn-3d" style={{ marginTop: 14, background: '#374151' }} onClick={() => { setView('home'); loadToday(); }}>Torna all&apos;inizio</button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
