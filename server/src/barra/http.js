// Rotte HTTP di "Completa la barra".
//
//   GET  /barra/catalog?collections=&genres=&artists=   opzioni dei filtri + quante sfide giocabili
//
// Gestione del catalogo, con `Authorization: Bearer <ADMIN_TOKEN>`:
//   GET  /barra/admin/catalog                  tutto il catalogo (soluzioni comprese) + stato integrazioni
//   POST /barra/admin/op       { op, data }    crea/modifica/elimina, restituisce il catalogo aggiornato
//   GET  /barra/admin/verify?youtube=|deezer=  verifica di un contenuto audio
//   GET  /barra/admin/deezer?q=                ricerca tracce Deezer (verifica metadati)
//   GET  /barra/admin/musixmatch?op=status|search|lyrics|synced
//
// Senza ADMIN_TOKEN la gestione è spenta. Nessuna di queste rotte è usata dai giocatori.

import { createHash, timingSafeEqual } from 'node:crypto';
import { GameError } from '../engine.js';
import { bearer, clientIp } from '../daily/http.js';
import { catalogSummary } from './selection.js';
import { MusixmatchError } from './musixmatch.js';
import { parseYouTubeId } from './providers.js';

const STATUS = { invalid: 400, auth: 401, rate: 429 };
const FAIL_LIMIT = 10;
const FAIL_WINDOW_MS = 10 * 60_000;

function digest(s) {
  return createHash('sha256').update(String(s)).digest();
}

function ids(url, key) {
  return (url.searchParams.get(key) || '').split(',').filter(Boolean);
}

export function createBarraRoutes({ getCatalog, providers, musixmatch, adminToken = process.env.ADMIN_TOKEN, now = Date.now }) {
  const failures = new Map(); // ip -> [timestamp]

  function checkAdmin(req) {
    if (!adminToken) throw new GameError('Gestione disattivata: imposta ADMIN_TOKEN sul server', 'disabled');
    const ip = clientIp(req);
    const t = now();
    const recent = (failures.get(ip) || []).filter((at) => t - at < FAIL_WINDOW_MS);
    if (recent.length >= FAIL_LIMIT) throw new GameError('Troppi tentativi, riprova tra qualche minuto', 'rate');
    const given = bearer(req);
    if (!given || !timingSafeEqual(digest(given), digest(adminToken))) {
      recent.push(t);
      failures.set(ip, recent);
      if (failures.size > 10_000) failures.clear();
      throw new GameError('Codice di gestione non valido', 'auth');
    }
  }

  function catalog() {
    const c = getCatalog();
    if (!c) throw new GameError('Catalogo non disponibile: database non configurato o non raggiungibile', 'unavailable');
    return c;
  }

  async function integrations() {
    return {
      youtube: { active: true, message: 'Player ufficiale incorporato; disponibilità verificata con oEmbed (nessuna chiave richiesta)' },
      deezer: { active: true, message: 'API pubblica: metadati e preview di 30s scelta da Deezer (tempi relativi alla preview)' },
      musixmatch: await musixmatch.status(),
    };
  }

  async function checkSong(id) {
    const c = catalog();
    const song = await c.getSong(id);
    if (!song) throw new GameError('Brano non trovato', 'invalid');
    let status = 'unchecked';
    let note = null;
    if (!song.audio_ref) {
      note = 'Nessun contenuto audio associato';
    } else if (song.audio_provider === 'youtube') {
      const r = await providers.checkYouTube(song.audio_ref);
      if (r.status === 'ok') { status = 'ok'; note = `oEmbed OK: "${r.title}" – ${r.author}. I blocchi regionali non sono rilevabili: prova il frammento.`; }
      else if (r.status === 'unavailable') { status = 'unavailable'; note = r.reason; }
      else note = r.reason;
    } else {
      const r = await providers.getDeezerTrack(song.audio_ref);
      if (r.ok && r.track.previewUrl && r.track.readable) { status = 'ok'; note = `Deezer OK: "${r.track.title}" – ${r.track.artist}, preview 30s disponibile`; }
      else if (r.ok) { status = 'unavailable'; note = 'Traccia senza preview riproducibile'; }
      else if (r.network) note = r.reason;
      else { status = 'unavailable'; note = r.reason; }
    }
    await c.setAvailability(id, status, note);
  }

  async function runOp(op, d = {}) {
    const c = catalog();
    switch (op) {
      case 'artist.save': await c.saveNamed('artist', d); return null;
      case 'artist.delete': await c.deleteNamed('artist', d); return null;
      case 'genre.save': await c.saveNamed('genre', d); return null;
      case 'genre.delete': await c.deleteNamed('genre', d); return null;
      case 'collection.save': await c.saveNamed('collection', d); return null;
      case 'collection.delete': await c.deleteNamed('collection', d); return null;
      case 'song.save': return c.saveSong(d);
      case 'song.delete': await c.deleteSong(d); return null;
      case 'song.check': await checkSong(d.id); return null;
      case 'challenge.save': return c.saveChallenge(d);
      case 'challenge.delete': await c.deleteChallenge(d); return null;
      case 'challenge.verify': await c.verifyChallenge(d); return null;
      case 'challenge.publish': await c.publishChallenge(d); return null;
      default: throw new GameError('Operazione non valida', 'invalid');
    }
  }

  async function adminRoute(route, url, body) {
    switch (route) {
      case 'GET /barra/admin/catalog':
        return { ...(await catalog().loadAll()), integrations: await integrations() };
      case 'POST /barra/admin/op': {
        const savedId = await runOp(body?.op, body?.data || {});
        return { ...(await catalog().loadAll()), savedId };
      }
      case 'GET /barra/admin/verify': {
        if (url.searchParams.has('youtube')) {
          const id = parseYouTubeId(url.searchParams.get('youtube'));
          if (!id) return { status: 'unavailable', reason: 'Link o ID YouTube non valido' };
          return { videoId: id, ...(await providers.checkYouTube(id)) };
        }
        if (url.searchParams.has('deezer')) return providers.getDeezerTrack(url.searchParams.get('deezer'));
        throw new GameError('Parametro mancante', 'invalid');
      }
      case 'GET /barra/admin/deezer':
        return { data: await providers.searchDeezerTracks(url.searchParams.get('q')) };
      case 'GET /barra/admin/musixmatch': {
        const op = url.searchParams.get('op');
        if (op === 'status') return musixmatch.status();
        if (op === 'search') return { results: await musixmatch.searchTracks({ track: url.searchParams.get('track'), artist: url.searchParams.get('artist') }) };
        const trackId = url.searchParams.get('trackId');
        if (!/^\d+$/.test(trackId || '')) throw new GameError('trackId non valido', 'invalid');
        if (op === 'lyrics') return musixmatch.getLyrics(trackId);
        if (op === 'synced') return musixmatch.getSyncedLyrics(trackId);
        throw new GameError('Operazione non valida', 'invalid');
      }
      default:
        return undefined;
    }
  }

  // Restituisce { status, payload } per le rotte /barra/*.
  return async function handle(req, url, body) {
    const route = `${req.method} ${url.pathname}`;
    try {
      if (route === 'GET /barra/catalog') {
        const c = catalog();
        const filters = { collectionIds: ids(url, 'collections'), genreIds: ids(url, 'genres'), artistIds: ids(url, 'artists') };
        const [options, candidates] = await Promise.all([c.filterOptions(), c.listCandidates(filters)]);
        return { status: 200, payload: { ...options, summary: catalogSummary(candidates) } };
      }
      if (url.pathname.startsWith('/barra/admin/')) {
        checkAdmin(req);
        const payload = await adminRoute(route, url, body);
        if (payload === undefined) return { status: 404, payload: { error: 'Non trovato' } };
        return { status: 200, payload };
      }
      return { status: 404, payload: { error: 'Non trovato' } };
    } catch (err) {
      if (err instanceof MusixmatchError) {
        return { status: err.statusCode === 0 ? 503 : 502, payload: { error: err.message, mxmStatus: err.statusCode } };
      }
      if (err instanceof GameError) {
        const status = err.code === 'disabled' || err.code === 'unavailable' ? 503 : STATUS[err.code] || 400;
        return { status, payload: { error: err.message, code: err.code } };
      }
      console.error('[barra]', err);
      return { status: 500, payload: { error: 'Errore del server' } };
    }
  };
}
