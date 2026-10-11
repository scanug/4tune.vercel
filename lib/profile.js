// Profilo condiviso tra dispositivi (telefono, PC...). Niente account: il
// profilo è il nickname riservato dell'Anno del Giorno, legato a un token
// segreto che il server consegna una volta sola. Se il browser lo perde, il
// nickname resta a chi lo aveva.
//
// Ogni dispositivo carica le sue statistiche e i suoi trofei e scarica quelli
// degli altri (lib/profileStore.js); lib/stats.js e lib/trophies.js li uniscono.
// Un dispositivo nuovo si collega con un codice breve chiesto da uno già collegato.
//
// Niente socket.io qui: questo modulo si carica in ogni pagina.

import { deviceId, readRemote, writeRemote } from './profileStore';
import { readOwnStats, syncTrophies } from './stats';
import { readOwnUnlocked } from './trophies';

export const SERVER_URL = (process.env.NEXT_PUBLIC_GAME_SERVER_URL || 'http://localhost:4000').replace(/\/$/, '');

// Parte quando arrivano dati nuovi dagli altri dispositivi o cambia il profilo.
export const PROFILE_EVENT = '4tune:profile';

const IDENTITY_KEY = '4tune_daily'; // { token, name, playerId }
const REQUEST_TIMEOUT_MS = 90_000; // il server gratuito può metterci un minuto a svegliarsi
const MIN_GAP_MS = 30_000;          // sincronizzazioni automatiche non più fitte di così

function storage() {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}

function announce() {
  window.dispatchEvent(new Event(PROFILE_EVENT));
}

// ---------- identità ----------

export function getDailyIdentity() {
  try {
    const raw = storage()?.getItem(IDENTITY_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.token ? parsed : null;
  } catch { return null; }
}

export function setDailyIdentity(identity) {
  const prev = getDailyIdentity();
  if (identity) storage()?.setItem(IDENTITY_KEY, JSON.stringify(identity));
  else storage()?.removeItem(IDENTITY_KEY);
  if (!identity) return;
  // Profilo diverso: i dati degli altri dispositivi erano di un altro profilo
  if (identity.playerId !== prev?.playerId) writeRemote({ syncedAt: 0, devices: {} });
  announce();
  syncProfile({ force: true });
}

// Richiesta HTTP al server di gioco, col token del profilo se c'è.
export async function authRequest(method, path, body) {
  const identity = getDailyIdentity();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${SERVER_URL}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(identity ? { Authorization: `Bearer ${identity.token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch {
    throw new Error('Server di gioco non raggiungibile');
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(data?.error || `Errore ${res.status}`);
    error.code = data?.code || 'server';
    error.status = res.status;
    throw error;
  }
  return data;
}

// ---------- sincronizzazione ----------

// Le statistiche senza l'elenco delle partite già contate: serve solo qui.
function uploadData() {
  const stats = {};
  for (const [id, s] of Object.entries(readOwnStats())) {
    const { seen, ...rest } = s || {};
    stats[id] = rest;
  }
  return { stats, trophies: readOwnUnlocked() };
}

let running = null;
let again = false;
let lastAt = 0;

async function runSync() {
  const me = deviceId();
  const res = await authRequest('POST', '/profile/sync', { deviceId: me, data: uploadData() });
  const devices = {};
  for (const d of res.devices || []) {
    if (d.deviceId !== me) devices[d.deviceId] = { ...d.data, updatedAt: d.updatedAt };
  }
  writeRemote({ syncedAt: Date.now(), devices });
  const identity = getDailyIdentity();
  if (identity && res.name && res.name !== identity.name) {
    storage()?.setItem(IDENTITY_KEY, JSON.stringify({ ...identity, name: res.name }));
  }
  // Insieme, i dispositivi possono aver raggiunto un traguardo nuovo
  if (syncTrophies().length > 0) again = true;
  announce();
}

// Carica questo dispositivo e scarica gli altri. Senza profilo non fa nulla;
// se il server non risponde si riprova alla prossima occasione.
export function syncProfile({ force = false } = {}) {
  if (!getDailyIdentity()) return Promise.resolve(false);
  if (running) { if (force) again = true; return running; }
  if (!force && Date.now() - lastAt < MIN_GAP_MS) return Promise.resolve(false);
  lastAt = Date.now();
  running = (async () => {
    try {
      do {
        again = false;
        await runSync();
      } while (again);
      return true;
    } catch {
      return false;
    } finally {
      running = null;
    }
  })();
  return running;
}

export function profileInfo() {
  const identity = getDailyIdentity();
  const { syncedAt, devices } = readRemote();
  return { name: identity?.name || null, devices: Object.keys(devices).length + 1, syncedAt };
}

// ---------- collegamento ----------

export const profile = {
  register: (name) => authRequest('POST', '/daily/register', { name }),
  linkCode: () => authRequest('POST', '/profile/link-code', {}),
};

// Questo dispositivo entra nel profilo del codice. Le sue partite non si
// perdono: alla prima sincronizzazione si sommano a quelle del profilo.
export async function linkDevice(code) {
  const res = await authRequest('POST', '/profile/link', { code });
  setDailyIdentity({ token: res.token, name: res.name, playerId: res.playerId });
  return res;
}

// Il codice va mostrato come K7Q-42M
export function formatCode(code) {
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  return c.length > 3 ? `${c.slice(0, 3)}-${c.slice(3)}` : c;
}
