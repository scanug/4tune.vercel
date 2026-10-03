// Regole del GTS – Guess the Song, nella forma che il RoomManager si aspetta
// da un gioco. Il RoomManager gestisce stanze, giocatori, timer e host; il
// gioco decide come sono fatti i round, cosa vedono i client e come si fa punti.

import { GameError, buildRounds, clampSettings, scoreAnswer } from '../engine.js';

export const gtsGame = {
  id: 'gts',
  config: {},

  clampSettings,

  // Dati della stanza scelti alla creazione: la playlist Deezer.
  prepare({ playlist }, _settings, rng) {
    if (!playlist?.tracks?.length) throw new GameError('Playlist non disponibile', 'playlist');
    // Verifica subito che la playlist regga almeno un round.
    buildRounds(playlist.tracks, 1, rng);
    return { playlist: { id: playlist.id, name: playlist.name, image: playlist.image || null, tracks: playlist.tracks } };
  },

  buildRounds(room, rng) {
    return buildRounds(room.content.playlist.tracks, room.settings.maxRounds, rng);
  },

  // Cosa vedono tutti. Mai la risposta corretta prima del reveal.
  publicView(room, current, showRound) {
    const { playlist } = room.content;
    // La clip del round dopo arriva in anticipo così i client la scaricano
    // mentre si gioca questo: l'URL Deezer è un hash, non svela il titolo.
    const next = showRound ? room.rounds[room.roundIndex] || null : null;
    return {
      playlist: {
        id: playlist.id,
        name: playlist.name,
        image: playlist.image,
        trackCount: playlist.tracks.length,
      },
      round: showRound ? { options: current.options, clipUrl: current.track.previewUrl } : null,
      nextClipUrl: next ? next.track.previewUrl : null,
    };
  },

  parseAnswer(current, choice) {
    const idx = Number(choice);
    if (!Number.isInteger(idx) || idx < 0 || idx >= current.options.length) {
      throw new GameError('Risposta non valida', 'choice');
    }
    return idx;
  },

  // `answers`: [{ playerId, choice, at }] in ordine di arrivo.
  score(room, current, answers) {
    const results = [];
    let firstCorrect = null;
    for (const { playerId, choice, at } of answers) {
      const correct = choice === current.correctIndex;
      const deltaMs = Math.max(0, at - room.startAt);
      const points = correct ? scoreAnswer(deltaMs, room.settings.roundMs) : 0;
      results.push({ playerId, choice, correct, deltaMs, points });
      if (correct && !firstCorrect) firstCorrect = { playerId, deltaMs, points };
    }
    return {
      results,
      reveal: {
        correctIndex: current.correctIndex,
        title: current.track.title,
        artist: current.track.artist,
        cover: current.track.cover || null,
        firstCorrect,
      },
    };
  },
};
