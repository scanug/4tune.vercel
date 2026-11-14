import { GameError } from '../engine.js';
import { bearer } from '../daily/http.js';

const STATUS = { auth: 401, invalid: 422, dup: 409, done: 409 };

export function createAbissoRoutes(getService) {
  return async function handle(req, url, body) {
    if (!url.pathname.startsWith('/abisso/')) return null;
    const service = getService();
    if (!service) return { status: 503, payload: { error: 'Abisso non è disponibile in questo momento' } };
    const token = bearer(req);
    const route = `${req.method} ${url.pathname}`;
    try {
      switch (route) {
        case 'GET /abisso/today':
          return { status: 200, payload: await service.today(token) };
        case 'POST /abisso/start':
          return { status: 200, payload: await service.start(token) };
        case 'POST /abisso/answer':
          return { status: 200, payload: await service.answer(token, body?.index, body?.answer) };
        case 'GET /abisso/review':
          return { status: 200, payload: await service.review(token) };
        case 'GET /abisso/leaderboard':
          return { status: 200, payload: await service.leaderboard(url.searchParams.get('scope'), token) };
        case 'GET /abisso/stats':
          return { status: 200, payload: await service.stats(token) };
        default:
          return { status: 404, payload: { error: 'Non trovato' } };
      }
    } catch (err) {
      if (err instanceof GameError) {
        return { status: STATUS[err.code] || 400, payload: { error: err.message, code: err.code } };
      }
      console.error('[abisso]', err);
      return { status: 500, payload: { error: 'Errore del server' } };
    }
  };
}
