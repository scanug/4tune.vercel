// Sveglia del server di gioco. Su Render gratuito il server si spegne dopo 15
// minuti senza traffico e impiega circa un minuto a ripartire: lo si chiama
// in anticipo (home, pagine online) e intanto si mostra a che punto è.

// Stesso indirizzo di lib/gameClient.js, ricavato qui per non caricare
// socket.io in ogni pagina solo per un ping.
const SERVER_URL = (process.env.NEXT_PUBLIC_GAME_SERVER_URL || 'http://localhost:4000').replace(/\/$/, '');

const QUIET_MS = 1500;        // se risponde entro questo tempo non si mostra nulla
const GIVE_UP_MS = 120000;    // oltre, il server è giù davvero
const RECHECK_MS = 120000;    // dopo una risposta buona non si richiama per un po'

let state = { status: 'idle', since: 0 }; // idle | checking | waking | awake | down
let lastOkAt = 0;
let running = null;
const listeners = new Set();

function set(next) {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn());
}

export function getWakeState() {
  return state;
}

export function subscribeWake(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function pingOnce(timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${SERVER_URL}/health`, { signal: ctrl.signal, cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

// Avvia (o riusa) il controllo. Mentre il server si avvia Render può
// rispondere con errori: si riprova finché non risponde bene o si arrende.
export function wakeServer({ force = false } = {}) {
  if (running) return running;
  if (!force && Date.now() - lastOkAt < RECHECK_MS) return Promise.resolve(true);
  const startedAt = Date.now();
  set({ status: 'checking', since: startedAt });
  const quiet = setTimeout(() => {
    if (state.status === 'checking') set({ status: 'waking' });
  }, QUIET_MS);

  running = (async () => {
    while (Date.now() - startedAt < GIVE_UP_MS) {
      const left = GIVE_UP_MS - (Date.now() - startedAt);
      if (await pingOnce(Math.min(left, 30000))) {
        lastOkAt = Date.now();
        set({ status: 'awake' });
        return true;
      }
      await new Promise((r) => setTimeout(r, 2500));
    }
    set({ status: 'down' });
    return false;
  })().finally(() => {
    clearTimeout(quiet);
    running = null;
  });
  return running;
}
