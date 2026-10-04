// Rotte HTTP dell'Anno del Giorno. L'identità viaggia come
// `Authorization: Bearer <token>`: il token lo genera il server alla
// registrazione del nickname e il browser lo conserva.
//
//   POST /daily/register     { name }            → { playerId, name, token }
//   GET  /daily/today                            → info sul giorno (+ stato personale se c'è il token)
//   POST /daily/start                            → carta a cui si è arrivati
//   POST /daily/answer       { index, year }     → risultato della carta + la successiva
//   GET  /daily/review                           → tutte le carte di oggi, solo a sfida completata
//   GET  /daily/leaderboard?scope=today|all
//   GET  /daily/stats

import { GameError } from '../engine.js';

const STATUS = { auth: 401, taken: 409, rate: 429, dup: 409, done: 409 };

// Massimo 5 nickname nuovi ogni 10 minuti per indirizzo IP.
const REGISTER_LIMIT = 5;
const REGISTER_WINDOW_MS = 10 * 60_000;

function clientIp(req) {
  // Render mette l'IP reale del client in testa a X-Forwarded-For.
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.socket.remoteAddress || 'unknown';
}

function bearer(req) {
  const h = String(req.headers.authorization || '');
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

export function createDailyRoutes(getService, { now = Date.now } = {}) {
  const registrations = new Map(); // ip -> [timestamp]

  function checkRate(ip) {
    const t = now();
    const recent = (registrations.get(ip) || []).filter((at) => t - at < REGISTER_WINDOW_MS);
    if (recent.length >= REGISTER_LIMIT) throw new GameError('Troppi nickname creati, riprova tra qualche minuto', 'rate');
    recent.push(t);
    registrations.set(ip, recent);
    if (registrations.size > 10_000) registrations.clear();
  }

  // Restituisce { status, payload } oppure null se la rotta non è dell'Anno del Giorno.
  return async function handle(req, url, body) {
    if (!url.pathname.startsWith('/daily/')) return null;
    const service = getService();
    if (!service) return { status: 503, payload: { error: 'Classifica non disponibile in questo momento' } };
    const token = bearer(req);
    const route = `${req.method} ${url.pathname}`;
    try {
      switch (route) {
        case 'POST /daily/register':
          checkRate(clientIp(req));
          return { status: 200, payload: await service.register(body?.name) };
        case 'GET /daily/today':
          return { status: 200, payload: await service.today(token) };
        case 'POST /daily/start':
          return { status: 200, payload: await service.start(token) };
        case 'POST /daily/answer':
          return { status: 200, payload: await service.answer(token, body?.index, body?.year) };
        case 'GET /daily/review':
          return { status: 200, payload: await service.review(token) };
        case 'GET /daily/leaderboard':
          return { status: 200, payload: await service.leaderboard(url.searchParams.get('scope'), token) };
        case 'GET /daily/stats':
          return { status: 200, payload: await service.stats(token) };
        default:
          return { status: 404, payload: { error: 'Non trovato' } };
      }
    } catch (err) {
      if (err instanceof GameError) {
        return { status: STATUS[err.code] || 400, payload: { error: err.message, code: err.code } };
      }
      console.error('[daily]', err);
      return { status: 500, payload: { error: 'Errore del server' } };
    }
  };
}
