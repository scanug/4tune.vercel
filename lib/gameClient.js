// Unico punto di contatto col server di gioco (Socket.IO + poche rotte HTTP).
// Nessun account: il giocatore è identificato da un playerId che il server
// assegna al primo ingresso e che il browser conserva per poter rientrare.

import { io } from 'socket.io-client';

export const SERVER_URL = (process.env.NEXT_PUBLIC_GAME_SERVER_URL || 'http://localhost:4000').replace(/\/$/, '');

const NICKNAME_KEY = '4tune_nickname';

// Ogni gioco online ha il suo namespace Socket.IO sul server e la sua chiave
// per ricordare il playerId; la connessione fisica è una sola, condivisa.
const CHANNELS = {
  gts: { ns: '', playerKey: '4tune_player' },          // { code, playerId }
  anno: { ns: '/anno', playerKey: '4tune_player_anno' },
};

function storage() {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}

export function getNickname() {
  return storage()?.getItem(NICKNAME_KEY) || '';
}

export function setNickname(name) {
  storage()?.setItem(NICKNAME_KEY, String(name || '').trim());
}

const channels = new Map();

export function gameChannel(game = 'gts') {
  if (channels.has(game)) return channels.get(game);
  const { ns, playerKey } = CHANNELS[game];
  let socket = null;

  function getSocket() {
    if (!socket) socket = io(`${SERVER_URL}${ns}`, { transports: ['websocket', 'polling'] });
    return socket;
  }

  // Emette un evento e attende l'ack. Rifiuta se il server risponde ok:false o
  // se non risponde entro il timeout (server giù, rete assente).
  function emitAck(event, payload = {}, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      getSocket().timeout(timeoutMs).emit(event, payload, (err, res) => {
        if (err) return reject(new Error('Il server non risponde'));
        if (!res?.ok) {
          const error = new Error(res?.error || 'Errore del server');
          error.code = res?.code || 'server';
          return reject(error);
        }
        resolve(res);
      });
    });
  }

  // Il playerId vale solo per la stanza in cui è stato assegnato.
  function getStoredPlayer(code) {
    try {
      const raw = storage()?.getItem(playerKey);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && parsed.code === code ? parsed.playerId : null;
    } catch { return null; }
  }

  function storePlayer(code, playerId) {
    storage()?.setItem(playerKey, JSON.stringify({ code, playerId }));
  }

  // Offset (ms) da sommare a Date.now() per avere l'ora del server.
  // Più campioni, si tiene quello col round-trip più basso: è il meno rumoroso.
  async function syncClock(samples = 4) {
    const results = [];
    for (let i = 0; i < samples; i++) {
      const sent = Date.now();
      try {
        const res = await new Promise((resolve, reject) => {
          getSocket().timeout(3000).emit('time:sync', sent, (err, r) => (err ? reject(err) : resolve(r)));
        });
        const received = Date.now();
        const rtt = received - sent;
        results.push({ rtt, offset: res.serverNow + rtt / 2 - received });
      } catch { /* campione perso */ }
    }
    if (results.length === 0) return 0;
    results.sort((a, b) => a.rtt - b.rtt);
    return Math.round(results[0].offset);
  }

  const channel = { getSocket, emitAck, getStoredPlayer, storePlayer, syncClock };
  channels.set(game, channel);
  return channel;
}

// Il GTS usa le funzioni "nude", come prima.
export const { getSocket, emitAck, getStoredPlayer, storePlayer, syncClock } = gameChannel('gts');

export async function apiGet(path) {
  let res;
  try {
    res = await fetch(`${SERVER_URL}${path}`);
  } catch {
    throw new Error('Server di gioco non raggiungibile');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Errore ${res.status}`);
  return data;
}

export const api = {
  presets: () => apiGet('/deezer/presets'),
  search: (q) => apiGet(`/deezer/search?q=${encodeURIComponent(q)}`),
  playlist: (id) => apiGet(`/deezer/playlist?id=${encodeURIComponent(id)}`),
  annoCategories: () => apiGet('/anno/categories'),
};

// ---------- L'Anno del Giorno ----------
// Il nickname riservato è legato a un token segreto che il server consegna
// una volta sola: se il browser lo perde, il nickname resta a chi lo aveva.

const DAILY_KEY = '4tune_daily'; // { token, name, playerId }

export function getDailyIdentity() {
  try {
    const raw = storage()?.getItem(DAILY_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.token ? parsed : null;
  } catch { return null; }
}

export function setDailyIdentity(identity) {
  if (identity) storage()?.setItem(DAILY_KEY, JSON.stringify(identity));
  else storage()?.removeItem(DAILY_KEY);
}

async function dailyRequest(method, path, body) {
  const identity = getDailyIdentity();
  let res;
  try {
    res = await fetch(`${SERVER_URL}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(identity ? { Authorization: `Bearer ${identity.token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Server di gioco non raggiungibile');
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

export const daily = {
  register: (name) => dailyRequest('POST', '/daily/register', { name }),
  today: () => dailyRequest('GET', '/daily/today'),
  start: () => dailyRequest('POST', '/daily/start', {}),
  answer: (index, year) => dailyRequest('POST', '/daily/answer', { index, year }),
  review: () => dailyRequest('GET', '/daily/review'),
  leaderboard: (scope) => dailyRequest('GET', `/daily/leaderboard?scope=${scope}`),
  stats: () => dailyRequest('GET', '/daily/stats'),
};
