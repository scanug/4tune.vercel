'use client';

import { useEffect, useRef, useState } from 'react';
import {
  formatCode, getDailyIdentity, linkDevice, profile, profileInfo, PROFILE_EVENT, setDailyIdentity, syncProfile,
} from '@/lib/profile';
import { wakeServer } from '@/lib/serverWake';

function ago(ts) {
  if (!ts) return 'mai';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'adesso';
  if (s < 3600) return `${Math.floor(s / 60)} min fa`;
  if (s < 86400) return `${Math.floor(s / 3600)} ore fa`;
  return new Date(ts).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

function countdown(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Profilo condiviso tra dispositivi: crearlo, mostrare il codice per collegarne
// un altro, oppure inserire il codice ricevuto. `initialCode` arriva dal QR.
export default function ProfilePanel({ initialCode = '', onClose }) {
  const [info, setInfo] = useState(() => profileInfo());
  const [view, setView] = useState(initialCode ? 'enter' : 'home'); // home | code | enter | done
  const [name, setName] = useState('');
  const [code, setCode] = useState(formatCode(initialCode));
  const [link, setLink] = useState(null); // { code, expiresAt, qr }
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const box = useRef(null);

  useEffect(() => {
    wakeServer();
    const refresh = () => setInfo(profileInfo());
    window.addEventListener(PROFILE_EVENT, refresh);
    return () => window.removeEventListener(PROFILE_EVENT, refresh);
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    box.current?.querySelector('input, button')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, view]);

  useEffect(() => {
    if (view !== 'code' || !link) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [view, link]);

  function go(next) {
    setError('');
    setView(next);
  }

  async function run(fn) {
    setBusy(true);
    setError('');
    try { await fn(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  const create = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    run(async () => {
      const res = await profile.register(name.trim());
      setDailyIdentity({ token: res.token, name: res.name, playerId: res.playerId });
      setInfo(profileInfo());
    });
  };

  const newCode = () => run(async () => {
    setLink(null);
    go('code');
    const res = await profile.linkCode();
    const url = `${window.location.origin}/sala?collega=${res.code}`;
    let qr = null;
    try {
      const QRCode = (await import('qrcode')).default;
      qr = await QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#120b2e', light: '#ffffff' } });
    } catch { /* senza QR resta il codice */ }
    setLink({ code: res.code, expiresAt: res.expiresAt, qr });
    setNow(Date.now());
  });

  const redeem = (e) => {
    e.preventDefault();
    run(async () => {
      await linkDevice(code);
      setInfo(profileInfo());
      go('done');
    });
  };

  const syncNow = () => run(async () => {
    if (!(await syncProfile({ force: true }))) throw new Error('Sincronizzazione non riuscita, riprova tra poco');
  });

  const expired = link && now >= link.expiresAt;
  const current = getDailyIdentity();

  return (
    <div className="overlay-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} className="profile-box" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <div className="profile-head">
          <h2 id="profile-title">Profilo</h2>
          <button type="button" className="profile-close" onClick={onClose} aria-label="Chiudi">✕</button>
        </div>

        {view === 'home' && !info.name && (
          <>
            <p className="profile-text">Crea un profilo per avere statistiche e trofei uguali su telefono e PC. Niente email né password.</p>
            <form onSubmit={create} className="profile-form">
              <input
                className="input-modern"
                value={name}
                maxLength={20}
                onChange={(e) => setName(e.target.value)}
                placeholder="Scegli un nickname"
                aria-label="Nickname"
              />
              <button type="submit" className="btn-3d" disabled={busy || !name.trim()}>{busy ? 'Attendi…' : 'Crea profilo'}</button>
            </form>
            <p className="profile-note">È anche il tuo nome nella classifica dell&apos;Anno del Giorno.</p>
            <div className="profile-or">oppure</div>
            <button type="button" className="btn-3d profile-alt" onClick={() => go('enter')}>Ho già un profilo</button>
          </>
        )}

        {view === 'home' && info.name && (
          <>
            <dl className="profile-stats">
              <div><dt>Nickname</dt><dd>{info.name}</dd></div>
              <div><dt>Dispositivi</dt><dd>{info.devices}</dd></div>
              <div><dt>Sincronizzato</dt><dd>{ago(info.syncedAt)}</dd></div>
            </dl>
            <div className="profile-actions">
              <button type="button" className="btn-3d" onClick={newCode} disabled={busy}>Collega un dispositivo</button>
              <button type="button" className="btn-3d profile-alt" onClick={syncNow} disabled={busy}>{busy ? 'Attendi…' : 'Sincronizza ora'}</button>
              <button type="button" className="profile-link" onClick={() => go('enter')}>Ho un codice di un altro profilo</button>
            </div>
          </>
        )}

        {view === 'code' && (
          <>
            <p className="profile-text">Sull&apos;altro dispositivo inquadra il QR, oppure apri la Sala → Profilo → <em>Ho già un profilo</em> e scrivi il codice.</p>
            {!link && !error && <div className="profile-code" role="status">…<span className="blink">_</span></div>}
            {link && (
              <>
                {link.qr && !expired && (
                  // SVG generato da qrcode a partire dal nostro indirizzo
                  <div className="profile-qr" aria-hidden="true" dangerouslySetInnerHTML={{ __html: link.qr }} />
                )}
                <div className={`profile-code${expired ? ' expired' : ''}`} aria-label={`Codice ${link.code.split('').join(' ')}`}>{formatCode(link.code)}</div>
                <div className="profile-note">{expired ? 'Codice scaduto' : `Scade tra ${countdown(link.expiresAt - now)} · vale una volta sola`}</div>
              </>
            )}
            <div className="profile-actions">
              {(expired || error) && <button type="button" className="btn-3d" onClick={newCode} disabled={busy}>Nuovo codice</button>}
              <button type="button" className="profile-link" onClick={() => go('home')}>← Indietro</button>
            </div>
          </>
        )}

        {view === 'enter' && (
          <>
            <p className="profile-text">Scrivi il codice che vedi sull&apos;altro dispositivo (Sala → Profilo → <em>Collega un dispositivo</em>).</p>
            <form onSubmit={redeem} className="profile-form">
              <input
                className="input-modern profile-code-input"
                value={code}
                onChange={(e) => setCode(formatCode(e.target.value))}
                placeholder="ABC-123"
                aria-label="Codice"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" className="btn-3d" disabled={busy || code.replace('-', '').length !== 6}>{busy ? 'Attendi…' : 'Collega'}</button>
            </form>
            <p className="profile-note">
              Le partite giocate qui si sommano a quelle del profilo.
              {current && ` Questo dispositivo lascia il profilo "${current.name}".`}
            </p>
            <div className="profile-actions">
              <button type="button" className="profile-link" onClick={() => go('home')}>← Indietro</button>
            </div>
          </>
        )}

        {view === 'done' && (
          <>
            <p className="profile-text profile-ok">Collegato! Ora sei <strong>{info.name}</strong> anche qui.</p>
            <p className="profile-note">Statistiche e trofei si aggiornano da soli a ogni partita.</p>
            <div className="profile-actions">
              <button type="button" className="btn-3d" onClick={onClose}>Vai alla Sala</button>
            </div>
          </>
        )}

        {error && <p className="profile-error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
