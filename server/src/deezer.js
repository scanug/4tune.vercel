// Accesso all'API pubblica di Deezer (nessuna chiave richiesta) con cache in
// memoria: le preview durano 30s e sono l'unica cosa che ci serve.

import { GameError } from './engine.js';

const API = 'https://api.deezer.com';
const PLAYLIST_TTL_MS = 10 * 60_000;
const PRESETS_TTL_MS = 60 * 60_000;
const MAX_TRACKS = 200;

export const CATEGORY_PRESETS = [
  { slug: 'rap-hiphop', title: 'Rap / Hip-hop', query: 'rap' },
  { slug: '2000s', title: '2000s Throwback', query: '2000s hits' },
  { slug: '2010s', title: '2010s Bangers', query: '2010s hits' },
  { slug: '2020s', title: '2020s Fresh', query: '2020s hits' },
  { slug: 'hits-5y', title: 'Hits ultimi 5 anni', query: 'top hits' },
  { slug: 'rock', title: 'Rock Classics', query: 'rock classics' },
  { slug: 'metal', title: 'Metal', query: 'metal' },
  { slug: 'tiktok', title: 'TikTok Songs', query: 'tiktok songs' },
];

const playlistCache = new Map(); // id -> { at, value }
let presetsCache = null;         // { at, value }

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new GameError(`Deezer non risponde (${res.status})`, 'deezer');
  const json = await res.json();
  // Deezer risponde 200 anche in errore: il dettaglio è dentro `error`.
  if (json?.error) throw new GameError(json.error.message || 'Errore Deezer', 'deezer');
  return json;
}

// Accetta un id numerico o un URL Deezer (https://www.deezer.com/it/playlist/123).
export function normalizePlaylistId(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/[/?#]/).filter(Boolean);
  const last = parts[parts.length - 1];
  return /^\d+$/.test(last) ? last : null;
}

function normalizeTrack(t) {
  if (!t?.preview || t.readable === false) return null;
  return {
    id: t.id,
    title: t.title_short || t.title,
    artist: t.artist?.name || 'Artista sconosciuto',
    previewUrl: t.preview,
    cover: t.album?.cover_medium || t.album?.cover || null,
  };
}

export async function searchPlaylists(query, limit = 10) {
  const q = String(query ?? '').trim();
  if (!q) throw new GameError('Ricerca vuota', 'query');
  const json = await getJson(`${API}/search/playlist?limit=${limit}&q=${encodeURIComponent(q)}`);
  return (json.data || []).map((p) => ({
    id: String(p.id),
    title: p.title || '',
    creator: p.user?.name || null,
    trackCount: p.nb_tracks || null,
    picture: p.picture_medium || p.picture_small || null,
  }));
}

export async function fetchPlaylist(rawId) {
  const id = normalizePlaylistId(rawId);
  if (!id) throw new GameError('Id playlist non valido', 'playlist');

  const cached = playlistCache.get(id);
  if (cached && Date.now() - cached.at < PLAYLIST_TTL_MS) return cached.value;

  const meta = await getJson(`${API}/playlist/${id}`);
  const tracks = [];
  let next = `${API}/playlist/${id}/tracks?limit=100`;
  while (next && tracks.length < MAX_TRACKS) {
    const page = await getJson(next);
    for (const t of page.data || []) {
      const track = normalizeTrack(t);
      if (track) tracks.push(track);
    }
    next = page.next || null;
  }

  const value = {
    id,
    name: meta.title || 'Playlist Deezer',
    description: meta.description || null,
    image: meta.picture_medium || meta.picture_big || null,
    tracks: tracks.slice(0, MAX_TRACKS),
  };
  playlistCache.set(id, { at: Date.now(), value });
  return value;
}

// Versione leggera per l'anteprima nella pagina host: niente URL delle clip.
export function playlistSummary(playlist) {
  return {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    image: playlist.image,
    trackCount: playlist.tracks.length,
  };
}

// Le categorie fisse risolte alla prima playlist trovata, con cache di un'ora:
// il client fa una richiesta sola invece di otto a ogni visita.
export async function getPresets() {
  if (presetsCache && Date.now() - presetsCache.at < PRESETS_TTL_MS) return presetsCache.value;
  const settled = await Promise.allSettled(CATEGORY_PRESETS.map((c) => searchPlaylists(c.query, 1)));
  const value = CATEGORY_PRESETS.map((cat, i) => {
    const first = settled[i].status === 'fulfilled' ? settled[i].value[0] : null;
    return {
      ...cat,
      playlistId: first?.id || null,
      playlistTitle: first?.title || null,
      picture: first?.picture || null,
    };
  });
  // Se nessuna categoria è stata risolta non salviamo il fallimento in cache.
  if (value.some((c) => c.playlistId)) presetsCache = { at: Date.now(), value };
  return value;
}
