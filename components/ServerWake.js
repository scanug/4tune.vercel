'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { getWakeState, subscribeWake, wakeServer } from '@/lib/serverWake';

// Pagine che usano il server: la home lo sveglia in anticipo, così quando si
// crea una stanza è già pronto.
const ONLINE_PREFIXES = ['/gts', '/anno', '/prezzo'];
// In queste pagine senza server non si fa nulla: schermata intera.
const BLOCKING = [/^\/gts\/game\//, /^\/anno\/game\//, /^\/prezzo\/game\//, /^\/anno\/giorno$/];

const EXPECTED_MS = 60000; // durata tipica del risveglio su Render gratuito
const SEGMENTS = 20;

// Sul server lo stato è sempre lo stesso oggetto: React lo vuole stabile
const SERVER_STATE = { status: 'idle', since: 0 };
const getServerState = () => SERVER_STATE;

function useWakeState() {
  return useSyncExternalStore(subscribeWake, getWakeState, getServerState);
}

export default function ServerWake() {
  const pathname = usePathname();
  const online = pathname === '/' || ONLINE_PREFIXES.some((p) => pathname.startsWith(p));
  const blocking = BLOCKING.some((re) => re.test(pathname));
  const { status, since } = useWakeState();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (online) wakeServer();
  }, [online, pathname]);

  const visible = online && pathname !== '/' && (status === 'waking' || status === 'down');
  useEffect(() => {
    if (!visible || status !== 'waking') return undefined;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [visible, status]);

  if (!visible) return null;

  // La barra sale veloce all'inizio e rallenta: non arriva mai in fondo da sola
  const elapsed = Math.max(0, now - since);
  const progress = status === 'down' ? 0 : 1 - Math.exp(-elapsed / (EXPECTED_MS / 2.5));
  const filled = Math.round(progress * SEGMENTS);
  const seconds = Math.round(elapsed / 1000);

  const box = (
    <div className={`wake-box${blocking ? '' : ' banner'}`} role="status" aria-live="polite">
      {status === 'waking' ? (
        <>
          <div className="wake-title">Il server si sta svegliando<span className="blink">_</span></div>
          <p className="wake-text">
            Dormiva per risparmiare: ci mette circa un minuto.
            {blocking ? ' Appena è pronto si riparte da soli.' : ' Intanto puoi preparare la partita.'}
          </p>
          <div className="wake-bar" aria-hidden="true">
            {Array.from({ length: SEGMENTS }, (_, i) => <span key={i} className={i < filled ? 'on' : ''} />)}
          </div>
          <div className="wake-time">{seconds}s</div>
        </>
      ) : (
        <>
          <div className="wake-title">Il server non risponde</div>
          <p className="wake-text">Controlla la connessione e riprova tra poco.</p>
          <button type="button" className="btn-3d" onClick={() => wakeServer({ force: true })}>Riprova</button>
        </>
      )}
    </div>
  );

  return blocking ? <div className="wake-overlay">{box}</div> : box;
}
