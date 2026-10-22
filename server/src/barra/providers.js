// Provider audio: risoluzione lato server di ciò che il client deve riprodurre.
// - youtube: player ufficiale incorporato, intervallo [startMs, stopMs] del video.
// - deezer:  preview ufficiale di 30s; i tempi sono RELATIVI alla preview,
//            che Deezer sceglie e di cui l'API non espone l'offset nel brano.

export const DEEZER_PREVIEW_MS = 30000;
const YT_ID = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTubeId(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (YT_ID.test(s)) return s;
  let url;
  try { url = new URL(s.startsWith('http') ? s : `https://${s}`); } catch { return null; }
  const host = url.hostname.replace(/^www\.|^m\.|^music\./, '');
  let id = null;
  if (host === 'youtu.be') id = url.pathname.split('/')[1];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const m = url.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/);
      if (m) id = m[2];
    }
  }
  return id && YT_ID.test(id) ? id : null;
}

async function fetchWithTimeout(fetchImpl, url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetchImpl(url, { signal: ctrl.signal, cache: 'no-store' });
  } finally {
    clearTimeout(t);
  }
}

export function createProviders({ fetch: fetchImpl = globalThis.fetch } = {}) {
  // oEmbed ufficiale: 200 = incorporabile, 401 = incorporamento disattivato,
  // 404/400 = rimosso, privato o ID non valido. Non rileva i blocchi regionali.
  async function checkYouTube(videoId, timeoutMs = 4000) {
    if (!YT_ID.test(videoId || '')) return { status: 'unavailable', reason: 'ID video non valido' };
    const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
    try {
      const res = await fetchWithTimeout(fetchImpl, url, timeoutMs);
      if (res.ok) {
        const j = await res.json();
        return { status: 'ok', title: j.title || null, author: j.author_name || null };
      }
      if (res.status === 401 || res.status === 403) return { status: 'unavailable', reason: 'Incorporamento disattivato dal proprietario' };
      if (res.status === 404 || res.status === 400) return { status: 'unavailable', reason: 'Video rimosso, privato o inesistente' };
      return { status: 'unknown', reason: `Risposta YouTube ${res.status}` };
    } catch (e) {
      return { status: 'unknown', reason: 'Verifica YouTube non raggiungibile' };
    }
  }

  async function getDeezerTrack(trackId, timeoutMs = 5000) {
    if (!/^\d+$/.test(String(trackId || ''))) return { ok: false, reason: 'ID traccia Deezer non valido' };
    try {
      const res = await fetchWithTimeout(fetchImpl, `https://api.deezer.com/track/${trackId}`, timeoutMs);
      if (!res.ok) return { ok: false, reason: `Deezer ${res.status}`, network: true };
      const j = await res.json();
      if (j.error) return { ok: false, reason: j.error.message || 'Traccia Deezer non trovata' };
      return {
        ok: true,
        track: {
          id: j.id, title: j.title, artist: j.artist?.name || null, album: j.album?.title || null,
          durationSec: j.duration ?? null, isrc: j.isrc || null, readable: j.readable !== false,
          previewUrl: j.preview || null, link: j.link || null,
        },
      };
    } catch {
      return { ok: false, reason: 'Deezer non raggiungibile', network: true };
    }
  }

  async function resolvePlayback(song, challenge) {
    const startMs = challenge.start_ms;
    const stopMs = challenge.stop_ms;
    if (song.audio_provider === 'youtube') {
      const videoId = parseYouTubeId(song.audio_ref);
      if (!videoId) return { ok: false, contentError: true, reason: 'ID video YouTube mancante o non valido' };
      const check = await checkYouTube(videoId, 2500);
      if (check.status === 'unavailable') return { ok: false, contentError: true, reason: check.reason };
      // 'unknown': la verifica non è conclusiva, decide il player del client
      return { ok: true, playback: { provider: 'youtube', videoId, startMs, stopMs } };
    }
    if (song.audio_provider === 'deezer') {
      if (stopMs > DEEZER_PREVIEW_MS) return { ok: false, contentError: true, reason: 'Interruzione oltre i 30s della preview Deezer' };
      const r = await getDeezerTrack(song.audio_ref);
      if (!r.ok) return { ok: false, contentError: !r.network, reason: r.reason };
      if (!r.track.previewUrl || !r.track.readable) return { ok: false, contentError: true, reason: 'Preview Deezer non disponibile' };
      return { ok: true, playback: { provider: 'deezer', previewUrl: r.track.previewUrl, startMs, stopMs } };
    }
    return { ok: false, contentError: true, reason: 'Provider audio non supportato' };
  }

  // Ricerca tracce per verificare i metadati di un brano dal pannello di gestione
  async function searchDeezerTracks(query, timeoutMs = 5000) {
    const term = String(query || '').trim().slice(0, 120);
    if (!term) return [];
    const res = await fetchWithTimeout(fetchImpl, `https://api.deezer.com/search/track?limit=10&q=${encodeURIComponent(term)}`, timeoutMs);
    if (!res.ok) throw new Error(`Deezer ${res.status}`);
    const j = await res.json();
    return (j.data || []).map((t) => ({
      id: t.id, title: t.title, artist: t.artist?.name || null, album: t.album?.title || null, durationSec: t.duration ?? null,
    }));
  }

  return { checkYouTube, getDeezerTrack, searchDeezerTracks, resolvePlayback };
}
