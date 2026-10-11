// Rotte HTTP del profilo condiviso. Stessa identità dell'Anno del Giorno:
// `Authorization: Bearer <token>`.
//
//   POST /profile/sync       { deviceId, data }  → { playerId, name, devices: [{ deviceId, data, updatedAt }] }
//   POST /profile/link-code                      → { code, expiresAt }
//   POST /profile/link       { code }            → { playerId, name, token }   (senza token)

import { GameError } from '../engine.js';
import { bearer, clientIp } from '../daily/http.js';

const STATUS = { auth: 401, rate: 429, code: 404 };

// Massimo 10 tentativi di codice ogni 10 minuti per indirizzo IP: con codici
// da 6 caratteri che durano 10 minuti indovinarne uno non è pensabile.
const LINK_LIMIT = 10;
const LINK_WINDOW_MS = 10 * 60_000;

export function createProfileRoutes(getService, { now = Date.now } = {}) {
  const attempts = new Map(); // ip -> [timestamp]

  function checkRate(ip) {
    const t = now();
    const recent = (attempts.get(ip) || []).filter((at) => t - at < LINK_WINDOW_MS);
    if (recent.length >= LINK_LIMIT) throw new GameError('Troppi tentativi, riprova tra qualche minuto', 'rate');
    recent.push(t);
    attempts.set(ip, recent);
    if (attempts.size > 10_000) attempts.clear();
  }

  // Restituisce { status, payload } oppure null se la rotta non è del profilo.
  return async function handle(req, url, body) {
    if (!url.pathname.startsWith('/profile/')) return null;
    const service = getService();
    if (!service) return { status: 503, payload: { error: 'Profili non disponibili in questo momento' } };
    const token = bearer(req);
    const route = `${req.method} ${url.pathname}`;
    try {
      switch (route) {
        case 'POST /profile/sync':
          return { status: 200, payload: await service.sync(token, body?.deviceId, body?.data) };
        case 'POST /profile/link-code':
          return { status: 200, payload: await service.createLinkCode(token) };
        case 'POST /profile/link':
          checkRate(clientIp(req));
          return { status: 200, payload: await service.link(body?.code) };
        default:
          return { status: 404, payload: { error: 'Non trovato' } };
      }
    } catch (err) {
      if (err instanceof GameError) {
        return { status: STATUS[err.code] || 400, payload: { error: err.message, code: err.code } };
      }
      console.error('[profile]', err);
      return { status: 500, payload: { error: 'Errore del server' } };
    }
  };
}
