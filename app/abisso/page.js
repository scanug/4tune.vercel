'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { abisso, daily, getDailyIdentity, getNickname, setDailyIdentity, setNickname } from '@/lib/gameClient';
import { useMusicSuppressed } from '@/components/MusicController';
import OceanDive from '@/components/abisso/OceanDive';
import AbissoDashboard from '@/components/abisso/AbissoDashboard';
import PixelIcon from '@/components/PixelIcon';
import { recordAbisso } from '@/lib/stats';

function countdown(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, '0')}m ${String(seconds % 60).padStart(2, '0')}s`;
}

function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), active ? 100 : 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

function shareMark(answer) {
  if (!answer?.points) return '⬜';
  if (answer.points < 30) return '🟦';
  if (answer.points < 60) return '🟨';
  if (answer.points < 85) return '🟧';
  return '🟪';
}

export default function AbissoPage() {
  const [identity, setIdentity] = useState(null);
  const [info, setInfo] = useState(null);
  const [view, setView] = useState('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState(null);
  const [depth, setDepth] = useState(0);
  const [draft, setDraft] = useState('');
  const [result, setResult] = useState(null);
  const [sending, setSending] = useState(false);
  const [review, setReview] = useState(null);
  const [shareMsg, setShareMsg] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const sendingRef = useRef(false);
  const expiredRef = useRef(null);
  const submitRef = useRef(null);
  const inputRef = useRef(null);
  const now = useNow(view === 'play' && !result);
  useMusicSuppressed(view === 'play');

  const loadToday = useCallback(async () => {
    try {
      const data = await abisso.today();
      setInfo(data);
      setView('home');
      setError('');
    } catch (err) {
      if (err.status === 401) {
        setDailyIdentity(null);
        setIdentity(null);
        setNotice('Il nickname salvato non è più valido: scegline uno per continuare.');
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

  async function register(event) {
    event?.preventDefault();
    const name = nameInput.trim();
    if (!name || busy) return;
    setBusy(true);
    setError('');
    try {
      const data = await daily.register(name);
      const next = { token: data.token, name: data.name, playerId: data.playerId };
      setDailyIdentity(next);
      setNickname(data.name);
      setIdentity(next);
      setNotice('');
      await loadToday();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function showPrompt(data) {
    setInfo((current) => ({ ...current, ...data }));
    setDepth(data.depth);
    setPrompt(data.prompt);
    setDraft('');
    setResult(null);
    setError('');
    setView('play');
  }

  async function play() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const data = await abisso.start();
      if (data.done) await openSummary();
      else showPrompt(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function openSummary() {
    setError('');
    try {
      const data = await abisso.review();
      setReview(data);
      setInfo((current) => ({ ...current, ...data }));
      setView('summary');
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  async function sendAnswer(value) {
    if (!prompt || result || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError('');
    try {
      const data = await abisso.answer(prompt.index, value);
      setDepth(data.depth);
      setResult({ ...data.result, done: data.done });
      try { navigator.vibrate?.(20); } catch { /* non supportato */ }
    } catch (err) {
      if (err.code === 'invalid') {
        setDraft('');
        setError(err.message);
        inputRef.current?.focus();
      } else if (err.code === 'dup' || err.code === 'done' || err.code === 'state') {
        const data = await abisso.start().catch(() => null);
        if (data?.done) await openSummary();
        else if (data) showPrompt(data);
        else setError(err.message);
      } else {
        setError(err.message);
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }
  submitRef.current = sendAnswer;

  useEffect(() => {
    if (view !== 'play' || !prompt || result) return undefined;
    const key = `${info?.day}:${prompt.index}`;
    if (expiredRef.current === key) return undefined;
    const timer = setTimeout(() => {
      expiredRef.current = key;
      submitRef.current?.(null);
    }, Math.max(0, prompt.deadline - Date.now()) + 30);
    return () => clearTimeout(timer);
  }, [view, prompt, result, info?.day]);

  async function advance() {
    if (!result?.done) {
      setBusy(true);
      try {
        const data = await abisso.start();
        showPrompt(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
      return;
    }
    await openSummary();
  }

  async function share() {
    const text = [
      `Abisso · immersione #${review.number}`,
      `${review.depth.toLocaleString('it-IT')} metri su ${review.maxDepth.toLocaleString('it-IT')}`,
      review.prompts.map((item) => shareMark(item.answer)).join(''),
      `${window.location.origin}/abisso`,
    ].join('\n');
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
      setShareMsg('Risultato copiato!');
    } catch {
      try { await navigator.clipboard.writeText(text); setShareMsg('Risultato copiato!'); } catch { setShareMsg(text); }
    }
    setTimeout(() => setShareMsg(''), 3000);
  }

  const recordDay = view === 'summary' ? review?.day : null;
  useEffect(() => {
    if (!recordDay || !review) return;
    recordAbisso({
      day: review.day,
      depth: review.depth,
      rareAnswers: review.prompts.filter((item) => item.answer?.points >= 85).length,
      perfect: review.prompts.every((item) => item.answer?.points > 0),
    });
  }, [recordDay, review]);

  const remaining = prompt && view === 'play' && !result ? Math.max(0, prompt.deadline - now) : 0;
  const me = info?.me;

  return (
    <main className="abisso-page">
      <div className="abisso-shell">
        <header className="abisso-header">
          {view === 'play' ? (
            <button type="button" className="abisso-back" onClick={loadToday}>Esci</button>
          ) : (
            <Link href="/" className="abisso-back">Hub giochi</Link>
          )}
          <div className="abisso-logo"><PixelIcon name="submarine" size={34} /><span>ABISSO</span></div>
          <span className="abisso-number">{info ? `#${info.number}` : ''}</span>
        </header>

        {notice && <p className="abisso-notice">{notice}</p>}

        {view === 'loading' && <div className="abisso-loading"><PixelIcon name="submarine" size={64} /><p>Preparo l’immersione...</p></div>}

        {view === 'error' && (
          <section className="abisso-card abisso-center">
            <p role="alert" className="abisso-error">{error || 'Qualcosa non va'}</p>
            <button type="button" className="btn-3d" onClick={() => { setView('loading'); loadToday(); }}>Riprova</button>
          </section>
        )}

        {view === 'home' && info && (
          <>
            <section className="abisso-hero">
              <p className="abisso-kicker">La sfida quotidiana</p>
              <h1>Le risposte rare<br />affondano di più.</h1>
              <p>Sette domande. Venticinque secondi a risposta.<br />Non essere ovvio: arriva sul fondo.</p>
              <OceanDive depth={me?.depth || 0} maxDepth={info.maxDepth} compact />
              {!identity ? (
                <form onSubmit={register} className="abisso-register">
                  <label htmlFor="abisso-name">Scegli il tuo nickname</label>
                  <div>
                    <input id="abisso-name" className="input-modern" maxLength={20} value={nameInput} onChange={(event) => setNameInput(event.target.value)} placeholder="Il tuo nome in classifica" autoComplete="nickname" />
                    <button className="btn-3d" type="submit" disabled={busy || !nameInput.trim()}>{busy ? 'Attendi...' : 'Entra'}</button>
                  </div>
                  <small>Niente account: il nickname resta associato a questo dispositivo.</small>
                </form>
              ) : me?.status === 'done' ? (
                <div className="abisso-start">
                  <p>Oggi hai raggiunto <strong>{me.depth.toLocaleString('it-IT')} metri</strong>.</p>
                  <button type="button" className="btn-3d" onClick={openSummary}>Vedi la tua immersione</button>
                </div>
              ) : (
                <div className="abisso-start">
                  <p>Ciao {me?.name || identity.name}. L’oceano ti aspetta.</p>
                  <button type="button" className="btn-3d abisso-dive-button" onClick={play} disabled={busy}>
                    {busy ? 'Preparazione...' : me?.status === 'playing' ? `Riprendi · ${me.answered + 1}/7` : 'Inizia la discesa ↓'}
                  </button>
                  {me?.status === 'playing' && <small>Il timer della domanda in corso non si è fermato.</small>}
                </div>
              )}
              {error && <p role="alert" className="abisso-error">{error}</p>}
              <p className="abisso-next">Nuova immersione tra {countdown(info.nextAt - now)}</p>
            </section>
            <section className="abisso-card">
              <h2>Il fondale di oggi</h2>
              <AbissoDashboard hasIdentity={!!identity} refreshKey={refreshKey} />
            </section>
          </>
        )}

        {view === 'play' && prompt && (
          <div className="abisso-play-grid">
            <OceanDive depth={depth} maxDepth={info?.maxDepth || 7000} result={result} />
            <section className="abisso-question-area">
              <div className="abisso-round"><span>Domanda {prompt.index + 1}/{info?.total || 7}</span><span>{depth.toLocaleString('it-IT')} m</span></div>
              {!result ? (
                <div className="abisso-question-card" key={prompt.index}>
                  <div className="abisso-timer" aria-label={`${Math.ceil(remaining / 1000)} secondi rimanenti`}>
                    <span className={remaining <= 5000 ? 'urgent' : ''}>{Math.ceil(remaining / 1000)}</span>
                    <div><i style={{ width: `${(remaining / (info?.answerMs || 25000)) * 100}%` }} /></div>
                  </div>
                  <h1>{prompt.question}</h1>
                  <form onSubmit={(event) => { event.preventDefault(); if (draft.trim()) sendAnswer(draft); }}>
                    <label htmlFor="abisso-answer">La tua risposta</label>
                    <input
                      ref={inputRef}
                      id="abisso-answer"
                      className="input-modern"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      maxLength={120}
                      autoComplete="off"
                      autoCapitalize="sentences"
                      placeholder="Scrivine una..."
                      autoFocus
                      disabled={sending}
                    />
                    <button type="submit" className="btn-3d abisso-dive-button" disabled={sending || !draft.trim()}>{sending ? 'Immersione...' : 'Affonda ↓'}</button>
                  </form>
                  {error && <p role="alert" className="abisso-error">{error}</p>}
                  <button type="button" className="abisso-skip" disabled={sending} onClick={() => sendAnswer(null)}>Non lo so, salta</button>
                </div>
              ) : (
                <div className={`abisso-result tier-${result.tier}`} aria-live="polite">
                  <p className="abisso-kicker">{result.label}</p>
                  <h1>{result.answer || 'Nessuna risposta'}</h1>
                  <div className="abisso-result-points">+{result.depth.toLocaleString('it-IT')} m</div>
                  {result.answer ? (
                    <p>Scelta da {result.count} {result.count === 1 ? 'giocatore' : 'giocatori'} finora · {result.percentage}% delle risposte valide</p>
                  ) : <p>Questa domanda resta in superficie. La prossima può fare la differenza.</p>}
                  <button type="button" className="btn-3d abisso-dive-button" onClick={advance} disabled={busy}>
                    {busy ? 'Attendi...' : result.done ? 'Vedi dove sei arrivato' : 'Prossima domanda ↓'}
                  </button>
                  {error && <p role="alert" className="abisso-error">{error}</p>}
                </div>
              )}
            </section>
          </div>
        )}

        {view === 'summary' && review && (
          <>
            <section className="abisso-summary">
              <OceanDive depth={review.depth} maxDepth={review.maxDepth} compact />
              <div className="abisso-summary-main">
                <p className="abisso-kicker">Immersione completata</p>
                <h1>{review.depth.toLocaleString('it-IT')} <small>metri</small></h1>
                <p>{review.depth >= 6000 ? 'Hai esplorato le fosse. Quasi nessuno arriva qui.' : review.depth >= 3500 ? 'Una discesa profonda: le tue risposte erano fuori dal branco.' : review.depth >= 1500 ? 'Buona immersione. Domani puoi scendere ancora.' : 'Sei risalito con qualche idea. Domani cerca percorsi meno battuti.'}</p>
                <div className="abisso-share-marks" aria-label="Riepilogo a simboli">{review.prompts.map((item) => shareMark(item.answer)).join('')}</div>
                <button type="button" className="btn-3d abisso-dive-button" onClick={share}>Condividi il risultato</button>
                {shareMsg && <p className="abisso-share-msg">{shareMsg}</p>}
              </div>
            </section>
            <section className="abisso-card">
              <h2>Diario di bordo</h2>
              <ol className="abisso-log">
                {review.prompts.map((item) => (
                  <li key={item.index}>
                    <span className="abisso-log-index">{item.index + 1}</span>
                    <span><small>{item.question}</small><strong>{item.answer?.answer || 'Nessuna risposta'}</strong></span>
                    <b>+{item.answer?.depth || 0} m</b>
                  </li>
                ))}
              </ol>
            </section>
            <section className="abisso-card">
              <h2>Il fondale di oggi</h2>
              <AbissoDashboard hasIdentity refreshKey={refreshKey} />
            </section>
            <p className="abisso-next">Nuova immersione tra {countdown(info.nextAt - now)}</p>
          </>
        )}
      </div>
    </main>
  );
}
