// Client Musixmatch API v1.1 (solo server). Tutti gli endpoint richiedono
// MUSIXMATCH_API_KEY. track.lyrics.get sui piani gratuiti restituisce solo una
// parte del testo; track.subtitle.get (testo sincronizzato) richiede un piano
// che lo includa. I testi NON vengono salvati: servono solo per preparare le sfide.

const BASE = 'https://api.musixmatch.com/ws/1.1/';
const STATUS_TTL_MS = 10 * 60 * 1000;

export class MusixmatchError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

const STATUS_MESSAGES = {
  401: 'Chiave API non valida o funzione non inclusa nel piano',
  402: 'Limite di utilizzo raggiunto',
  403: 'Funzione non autorizzata per questa chiave',
  404: 'Risorsa non trovata',
  405: 'Metodo non consentito',
  503: 'Servizio Musixmatch non disponibile',
};

export function parseLrc(body) {
  const lines = [];
  for (const raw of String(body || '').split(/\r?\n/)) {
    const m = raw.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s?(.*)$/);
    if (!m) continue;
    const ms = Math.round((Number(m[1]) * 60 + Number(m[2])) * 1000);
    lines.push({ timeMs: ms, text: m[3] });
  }
  return lines;
}

export function createMusixmatch({ apiKey = process.env.MUSIXMATCH_API_KEY, fetch: fetchImpl = globalThis.fetch } = {}) {
  let cachedStatus = null;

  async function call(method, params) {
    if (!apiKey) throw new MusixmatchError('Integrazione Musixmatch non configurata (MUSIXMATCH_API_KEY assente)', 0);
    const url = new URL(method, BASE);
    for (const [k, v] of Object.entries(params)) if (v != null && v !== '') url.searchParams.set(k, String(v));
    url.searchParams.set('apikey', apiKey);
    let res;
    try {
      res = await fetchImpl(url.toString(), { cache: 'no-store' });
    } catch {
      throw new MusixmatchError('Musixmatch non raggiungibile', 0);
    }
    const json = await res.json().catch(() => null);
    const code = json?.message?.header?.status_code ?? res.status;
    if (code !== 200) throw new MusixmatchError(STATUS_MESSAGES[code] || `Errore Musixmatch ${code}`, code);
    return json.message.body;
  }

  async function status() {
    if (!apiKey) return { configured: false, active: false, message: 'Predisposta: manca MUSIXMATCH_API_KEY sul server' };
    if (cachedStatus && Date.now() - cachedStatus.at < STATUS_TTL_MS) return cachedStatus.value;
    let value;
    try {
      await call('track.search', { q_track: 'test', page_size: 1 });
      value = { configured: true, active: true, message: 'Attiva: chiave verificata con una chiamata reale' };
    } catch (e) {
      value = { configured: true, active: false, message: `Chiave presente ma non funzionante: ${e.message}` };
    }
    cachedStatus = { at: Date.now(), value };
    return value;
  }

  async function searchTracks({ track, artist }) {
    const body = await call('track.search', {
      q_track: track, q_artist: artist, f_has_lyrics: 1, s_track_rating: 'desc', page_size: 10,
    });
    return (body.track_list || []).map(({ track: t }) => ({
      trackId: t.track_id,
      commontrackId: t.commontrack_id,
      title: t.track_name,
      artist: t.artist_name,
      album: t.album_name,
      hasLyrics: !!t.has_lyrics,
      hasSubtitles: !!t.has_subtitles,
      instrumental: !!t.instrumental,
      shareUrl: t.track_share_url || null,
    }));
  }

  async function getLyrics(trackId) {
    const body = await call('track.lyrics.get', { track_id: trackId });
    const l = body.lyrics || {};
    return {
      text: l.lyrics_body || '',
      copyright: l.lyrics_copyright || null,
      pixelTrackingUrl: l.pixel_tracking_url || null,
      restricted: !!l.restricted,
    };
  }

  async function getSyncedLyrics(trackId) {
    const body = await call('track.subtitle.get', { track_id: trackId, subtitle_format: 'lrc' });
    const s = body.subtitle || {};
    return {
      lines: parseLrc(s.subtitle_body),
      copyright: s.lyrics_copyright || null,
      pixelTrackingUrl: s.pixel_tracking_url || null,
    };
  }

  return { status, searchTracks, getLyrics, getSyncedLyrics };
}
