import { randomUUID } from 'node:crypto';

// Generatore pseudo-casuale riproducibile per i test
export function seededRng(seed = 42) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

// Catalogo in memoria con la stessa interfaccia di src/barra/catalog.js usata dal gioco.
// Le soluzioni contengono SEGRETO/VARIANTE per poter cercare fughe nello stato pubblico.
export function fakeCatalog(nSongs, perSong = 1) {
  const songs = [];
  const challenges = [];
  for (let i = 0; i < nSongs; i++) {
    const song = { id: randomUUID(), title: `Brano ${i}`, artist_name: `Artista ${i}`, audio_provider: 'youtube', audio_ref: `vid${String(i).padStart(8, '0')}` };
    songs.push(song);
    for (let j = 0; j < perSong; j++) {
      challenges.push({
        id: randomUUID(), song_id: song.id, start_ms: 10000, stop_ms: 18000,
        answer: `SEGRETO ${i} ${j} parole mancanti`, accepted_variants: [`VARIANTE ${i} ${j}`], difficulty: 2,
      });
    }
  }
  const errors = [];
  return {
    songs,
    challenges,
    errors,
    async listCandidates() { return challenges.map((c) => ({ id: c.id, songId: c.song_id })); },
    async getChallenge(id) {
      const c = challenges.find((x) => x.id === id);
      return c ? { challenge: { ...c }, song: { ...songs.find((s) => s.id === c.song_id) } } : null;
    },
    async reportSongError(songId, reason, markUnavailable) { errors.push({ songId, reason, markUnavailable }); },
  };
}

export const okProviders = {
  async resolvePlayback(song, challenge) {
    return { ok: true, playback: { provider: 'youtube', videoId: song.audio_ref, startMs: challenge.start_ms, stopMs: challenge.stop_ms } };
  },
};

// Lascia completare le operazioni asincrone (catalogo, provider)
export const flush = () => new Promise((r) => setImmediate(r));
