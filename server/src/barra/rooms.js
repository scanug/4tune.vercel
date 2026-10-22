// Stanze di "Completa la barra". Estende il RoomManager comune (lobby, host,
// riconnessioni, pulizia delle stanze) con un round in più fasi:
//
//   preparing  il server sceglie la sfida; i client caricano il player e
//              rispondono "pronto" (o segnalano un errore di caricamento)
//   countdown  conto alla rovescia uguale per tutti
//   listening  si ascolta il frammento [playAt, answerOpenAt)
//   answering  campo risposta aperto fino ad answerDeadline (+ tolleranza rete)
//   reveal     soluzione, risposte di tutti e punti
//
// Il server è l'unica autorità: sceglie le sfide, misura i tempi col suo
// orologio, valida le risposte e calcola i punti. La soluzione resta in
// memoria qui e compare nello stato pubblico solo al reveal.

import { randomUUID } from 'node:crypto';
import { RoomManager } from '../rooms.js';
import { GameError } from '../engine.js';
import { isAnswerCorrect } from './normalize.js';
import { computePoints } from './scoring.js';
import { pickChallenge, catalogSummary } from './selection.js';

export const BARRA_TIMING = {
  PREPARE_TIMEOUT_MS: 15000,  // tempo massimo per caricare il player
  EARLY_TOLERANCE_MS: 1500,   // tolleranza orologi prima dell'apertura risposte
  LATE_GRACE_MS: 1500,        // tolleranza rete dopo la scadenza
  MAX_ATTEMPTS: 3,            // sfide sostitutive per round prima di annullarlo
  COUNTDOWN_MS: 3000,
};

export const BARRA_LIMITS = {
  maxRounds: [1, 30],
  roundMs: [5000, 60000],
};

const ROUND_PHASES = ['preparing', 'countdown', 'listening', 'answering'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clamp(value, [min, max], fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function idList(v) {
  return Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string' && UUID.test(x)))].slice(0, 50) : [];
}

export function clampBarraSettings(input = {}) {
  const f = input.filters || {};
  return {
    maxRounds: clamp(input.maxRounds, BARRA_LIMITS.maxRounds, 10),
    roundMs: clamp(input.roundMs, BARRA_LIMITS.roundMs, 15000),
    prepMs: BARRA_TIMING.COUNTDOWN_MS,
    speedBonus: input.speedBonus === true,
    filters: {
      collectionIds: idList(f.collectionIds),
      genreIds: idList(f.genreIds),
      artistIds: idList(f.artistIds),
    },
  };
}

// Le parti "gioco" che il RoomManager base usa alla creazione della stanza.
export const barraGame = {
  id: 'barra',
  config: { revealMs: 9000, finalRevealMs: 10000 },
  clampSettings: clampBarraSettings,
  prepare() {
    // history: round giocati in questa stanza (anche nelle rivincite), per non ripetere i brani
    // bad: sfide che non si riproducono, da non riproporre
    return { history: [], bad: new Set(), candidates: [] };
  },
};

export class BarraRoomManager extends RoomManager {
  // `getCatalog()`: il catalogo (può mancare finché il database non risponde).
  // `providers.resolvePlayback(song, challenge)`: verifica e dati di riproduzione.
  constructor({ getCatalog, providers, ...options } = {}) {
    super({ ...options, game: barraGame });
    this.getCatalog = getCatalog || (() => null);
    this.providers = providers;
  }

  _catalog() {
    const catalog = this.getCatalog();
    if (!catalog) throw new GameError('Catalogo non disponibile in questo momento, riprova tra poco', 'catalog');
    return catalog;
  }

  _alive(room, epoch) {
    return this.rooms.get(room.code) === room && (epoch === undefined || epoch === room.epoch);
  }

  _run(promise) {
    promise.catch((err) => console.error('[barra]', err));
  }

  // ---------- stato pubblico ----------

  publicState(room) {
    const r = room.current;
    const inRound = r && ROUND_PHASES.includes(room.status);
    const players = [...room.players.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        score: p.score,
        correct: p.correct || 0,
        isHost: p.id === room.hostId,
        status: p.status,
        ready: !!r && p.readyRound === r.id,
        answered: room.answers.has(p.id),
        loadError: !!r && p.loadError === r.id,
      }));
    const p = inRound ? r.playback : null;
    return {
      code: room.code,
      status: room.status,
      hostId: room.hostId,
      settings: {
        maxRounds: room.settings.maxRounds,
        roundMs: room.settings.roundMs,
        speedBonus: room.settings.speedBonus,
        filters: room.settings.filters,
      },
      roundIndex: room.roundIndex,
      totalRounds: room.settings.maxRounds,
      phaseEndsAt: room.phaseEndsAt,
      serverNow: this.now(),
      notice: room.notice || null,
      players,
      // Mai la soluzione qui: solo ciò che serve per riprodurre il frammento.
      round: inRound ? {
        id: r.id,
        number: r.number,
        attempt: r.attempt,
        song: { title: r.song.title, artist: r.song.artist },
        difficulty: r.difficulty,
        playback: p.provider === 'youtube'
          ? { provider: 'youtube', videoId: p.videoId, startMs: p.startMs, stopMs: p.stopMs }
          : { provider: 'deezer', previewUrl: p.previewUrl, startMs: p.startMs, stopMs: p.stopMs },
        prepareDeadline: r.prepareDeadline ?? null,
        playAt: r.playAt ?? null,
        answerOpenAt: r.answerOpenAt ?? null,
        answerDeadline: r.answerDeadline ?? null,
      } : null,
      reveal: ['reveal', 'finished'].includes(room.status) ? room.lastReveal : null,
    };
  }

  // ---------- lobby ----------

  createRoom(args) {
    const res = super.createRoom(args);
    res.room.epoch = 0;
    res.room.current = null;
    res.room.notice = null;
    return res;
  }

  _addPlayer(room, name) {
    const player = super._addPlayer(room, name);
    // Chi entra a partita iniziata guarda e gioca dalla partita successiva
    player.status = ['lobby', 'finished'].includes(room.status) ? 'active' : 'waiting';
    player.correct = 0;
    player.readyRound = null;
    player.loadError = null;
    return player;
  }

  setConnected(code, playerId, connected) {
    super.setConnected(code, playerId, connected);
    if (this.hasRoom(code)) this._checkPrepared(this.getRoom(code));
  }

  leaveRoom(code, playerId) {
    super.leaveRoom(code, playerId);
    if (this.hasRoom(code)) this._checkPrepared(this.getRoom(code));
  }

  _inGame(room) {
    return [...ROUND_PHASES, 'reveal'].includes(room.status);
  }

  // ---------- partita ----------

  async startGame(code, playerId, { force = false } = {}) {
    const room = this.getRoom(code);
    this._assertHost(room, playerId);
    if (room.status !== 'lobby') throw new GameError('La partita è già iniziata', 'state');
    const candidates = await this._catalog().listCandidates(room.settings.filters);
    const summary = catalogSummary(candidates);
    if (summary.challenges === 0) {
      throw new GameError('Nessuna sfida pubblicata corrisponde ai filtri scelti', 'no_content');
    }
    const { maxRounds } = room.settings;
    if (summary.songs < maxRounds && !force) {
      throw new GameError(
        `Con questi filtri ci sono ${summary.songs} brani (${summary.challenges} sfide) per ${maxRounds} round: alcuni brani si ripeteranno.`,
        'not_enough',
      );
    }
    if (room.status !== 'lobby' || !this._alive(room)) throw new GameError('La partita è già iniziata', 'state');

    room.content.candidates = candidates;
    room.roundIndex = 0;
    room.notice = null;
    for (const p of room.players.values()) {
      p.status = 'active';
      p.score = 0;
      p.correct = 0;
    }
    await this._prepareRound(room, 1, 1, new Set());
  }

  restartGame(code, playerId) {
    super.restartGame(code, playerId);
    const room = this.getRoom(code);
    room.epoch += 1;
    room.current = null;
    room.notice = null;
    for (const p of room.players.values()) { p.status = 'active'; p.correct = 0; }
    this.emit(room);
  }

  async _pick(room, excluded) {
    const catalog = this._catalog();
    const { candidates, history, bad } = room.content;
    const exclude = new Set([...bad, ...excluded]);
    for (let i = 0; i < 6; i++) {
      const c = pickChallenge(candidates, history, exclude, this.rng);
      if (!c) return null;
      exclude.add(c.id);
      const full = await catalog.getChallenge(c.id);
      if (!full) continue;
      const res = await this.providers.resolvePlayback(full.song, full.challenge);
      if (!res.ok) {
        if (res.contentError) {
          // Video rimosso o non incorporabile: fuori tutto il brano
          for (const x of candidates) if (x.songId === c.songId) { bad.add(x.id); exclude.add(x.id); }
          await catalog.reportSongError(full.song.id, res.reason, true).catch(() => {});
        }
        continue;
      }
      return { full, playback: res.playback };
    }
    return null;
  }

  async _prepareRound(room, number, attempt, excluded) {
    this._clearRoundTimer(room);
    const epoch = ++room.epoch;
    room.status = 'preparing';
    room.roundIndex = number;
    room.current = null;
    room.answers.clear();
    room.lastReveal = null;
    room.startAt = null;
    room.phaseEndsAt = null;
    if (attempt === 1) room.notice = null;
    this._touch(room);
    this.emit(room);

    let picked = null;
    let failed = false;
    try {
      picked = await this._pick(room, excluded);
    } catch (err) {
      console.error('[barra] scelta della sfida fallita:', err);
      failed = true;
    }
    if (!this._alive(room, epoch)) return;

    if (!picked) {
      room.notice = failed
        ? 'Catalogo non raggiungibile: partita interrotta.'
        : 'Non ci sono altre sfide riproducibili con i filtri scelti.';
      if (number === 1) {
        room.status = 'lobby';
        room.roundIndex = 0;
        this._touch(room);
        this.emit(room);
      } else {
        this._finish(room);
      }
      return;
    }

    const { full, playback } = picked;
    const now = this.now();
    room.current = {
      id: randomUUID(),
      number,
      attempt,
      excluded,
      challengeId: full.challenge.id,
      songId: full.song.id,
      song: { title: full.song.title, artist: full.song.artist_name },
      difficulty: full.challenge.difficulty,
      playback,
      answer: full.challenge.answer,
      variants: full.challenge.accepted_variants || [],
      prepareDeadline: now + BARRA_TIMING.PREPARE_TIMEOUT_MS,
    };
    room.phaseEndsAt = room.current.prepareDeadline;
    this._touch(room);
    this.emit(room);
    room.timer = this.setTimer(() => this._onPrepareTimeout(room), BARRA_TIMING.PREPARE_TIMEOUT_MS);
  }

  _connectedActive(room) {
    return [...room.players.values()].filter((p) => p.connected && p.status === 'active');
  }

  _checkPrepared(room) {
    const r = room.current;
    if (room.status !== 'preparing' || !r) return;
    const active = this._connectedActive(room);
    if (active.length === 0) return;
    const responded = active.filter((p) => p.readyRound === r.id || p.loadError === r.id);
    if (responded.length < active.length) return;
    const ready = active.filter((p) => p.readyRound === r.id && p.loadError !== r.id);
    if (ready.length > 0) this._startCountdown(room);
    else this._run(this._replace(room, 'load'));
  }

  _onPrepareTimeout(room) {
    room.timer = null;
    const r = room.current;
    if (room.status !== 'preparing' || !r) return;
    const active = this._connectedActive(room);
    const ready = active.filter((p) => p.readyRound === r.id && p.loadError !== r.id);
    if (ready.length > 0) this._startCountdown(room);
    else if (active.length > 0) this._run(this._replace(room, 'timeout'));
    // Nessuno connesso: si aspetta che qualcuno rientri
    else room.timer = this.setTimer(() => this._onPrepareTimeout(room), BARRA_TIMING.PREPARE_TIMEOUT_MS);
  }

  // Annulla la sfida corrente senza penalità e ne prova un'altra.
  async _replace(room, reason) {
    const r = room.current;
    if (!r || !ROUND_PHASES.includes(room.status)) return;
    this._clearRoundTimer(room);
    if (reason === 'content') {
      room.content.bad.add(r.challengeId);
      this.getCatalog()?.reportSongError(r.songId, 'Errore di riproduzione segnalato dal player', false).catch(() => {});
    }
    if (r.attempt >= BARRA_TIMING.MAX_ATTEMPTS) { this._cancelRound(room); return; }
    room.notice = reason === 'host'
      ? "L'host ha saltato la sfida: nessuna penalità."
      : 'Contenuto non disponibile: sfida sostituita senza penalità.';
    await this._prepareRound(room, r.number, r.attempt + 1, new Set([...r.excluded, r.challengeId]));
  }

  _cancelRound(room) {
    this._clearRoundTimer(room);
    const isLast = room.roundIndex >= room.settings.maxRounds;
    room.status = 'reveal';
    room.current = null;
    room.answers.clear();
    room.notice = 'Round annullato: contenuti non riproducibili. Nessuna penalità.';
    room.lastReveal = { roundIndex: room.roundIndex, cancelled: true, results: [], isLast };
    this._afterReveal(room, isLast);
  }

  _startCountdown(room) {
    this._clearRoundTimer(room);
    const r = room.current;
    const now = this.now();
    r.playAt = now + room.settings.prepMs;
    r.answerOpenAt = r.playAt + (r.playback.stopMs - r.playback.startMs);
    r.answerDeadline = r.answerOpenAt + room.settings.roundMs;
    room.status = 'countdown';
    room.startAt = r.playAt;
    room.phaseEndsAt = r.playAt;
    this._touch(room);
    this.emit(room);
    room.timer = this.setTimer(() => this._listen(room), room.settings.prepMs);
  }

  _listen(room) {
    const r = room.current;
    room.status = 'listening';
    room.phaseEndsAt = r.answerOpenAt;
    this.emit(room);
    room.timer = this.setTimer(() => this._openAnswers(room), Math.max(0, r.answerOpenAt - this.now()));
  }

  _openAnswers(room) {
    const r = room.current;
    room.status = 'answering';
    room.phaseEndsAt = r.answerDeadline;
    this.emit(room);
    room.timer = this.setTimer(() => this._reveal(room), Math.max(0, r.answerDeadline + BARRA_TIMING.LATE_GRACE_MS - this.now()));
  }

  markReady(code, playerId, { roundId } = {}) {
    const room = this.getRoom(code);
    const player = room.players.get(playerId);
    const r = room.current;
    if (!player || !r || r.id !== roundId || !ROUND_PHASES.includes(room.status)) return { stale: true };
    if (player.status !== 'active') return { stale: true };
    player.readyRound = roundId;
    this.emit(room);
    this._checkPrepared(room);
    return {};
  }

  async reportLoadError(code, playerId, { roundId, kind } = {}) {
    const room = this.getRoom(code);
    const player = room.players.get(playerId);
    const r = room.current;
    if (!player || !r || r.id !== roundId || !ROUND_PHASES.includes(room.status)) return { stale: true };
    if (player.status !== 'active') return { stale: true };
    // Un contenuto che non si riproduce si sostituisce solo in preparazione;
    // dopo, l'errore esclude dal round solo chi l'ha avuto, senza penalità.
    if (room.status === 'preparing' && kind === 'content') {
      await this._replace(room, 'content');
      return {};
    }
    player.loadError = roundId;
    this.emit(room);
    this._checkPrepared(room);
    this._checkAllAnswered(room);
    return {};
  }

  submitAnswer(code, playerId, choice) {
    const room = this.getRoom(code);
    const player = room.players.get(playerId);
    if (!player) throw new GameError('Non sei in questa stanza', 'player');
    if (player.status !== 'active') throw new GameError('Stai guardando questa partita: giocherai dalla prossima', 'waiting');
    const r = room.current;
    const at = this.now(); // tempo di ricezione sul server: l'unico che conta
    const open = r && (room.status === 'answering' || (room.status === 'listening' && at >= r.answerOpenAt - BARRA_TIMING.EARLY_TOLERANCE_MS));
    if (!open) {
      const early = r && ['preparing', 'countdown', 'listening'].includes(room.status);
      throw new GameError(early ? 'La risposta non è ancora aperta' : 'Tempo scaduto: risposta non accettata', early ? 'early' : 'late');
    }
    if (room.answers.has(playerId)) throw new GameError('Hai già inviato la tua risposta', 'dup');
    const text = String(choice ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!text) throw new GameError('Scrivi una risposta', 'empty');

    const correct = isAnswerCorrect(text, r.answer, r.variants);
    const { points, bonus } = computePoints({
      correct, receivedAt: at, answerOpenAt: r.answerOpenAt, answerMs: room.settings.roundMs,
      speedBonusEnabled: room.settings.speedBonus,
    });
    room.answers.set(playerId, { text, at, correct, points, bonus });
    this._touch(room);
    this.emit(room);
    this._checkAllAnswered(room);
    // Nessun esito qui: si scopre al reveal
    return { accepted: true };
  }

  _checkAllAnswered(room) {
    if (!['listening', 'answering'].includes(room.status)) return;
    const r = room.current;
    const eligible = this._connectedActive(room).filter((p) => p.readyRound === r.id && p.loadError !== r.id);
    if (eligible.length > 0 && eligible.every((p) => room.answers.has(p.id))) this._reveal(room);
  }

  _reveal(room) {
    if (!['listening', 'answering'].includes(room.status)) return;
    this._clearRoundTimer(room);
    const r = room.current;
    const participants = [...room.players.values()]
      .filter((p) => p.status === 'active' || room.answers.has(p.id))
      .sort((a, b) => a.joinedAt - b.joinedAt);
    const results = participants.map((p) => {
      const a = room.answers.get(p.id);
      if (a) {
        return { playerId: p.id, name: p.name, answer: a.text, correct: a.correct, points: a.points, bonus: a.bonus, status: 'answered' };
      }
      const excused = p.loadError === r.id || p.readyRound !== r.id;
      return { playerId: p.id, name: p.name, answer: null, correct: false, points: 0, bonus: 0, status: excused ? 'excused' : 'missing' };
    });
    for (const res of results) {
      const p = room.players.get(res.playerId);
      p.score += res.points;
      if (res.correct) p.correct = (p.correct || 0) + 1;
    }
    room.content.history.push({ challengeId: r.challengeId, songId: r.songId });

    const isLast = room.roundIndex >= room.settings.maxRounds;
    room.status = 'reveal';
    room.lastReveal = {
      roundIndex: room.roundIndex,
      cancelled: false,
      song: r.song,
      answer: r.answer,
      variants: r.variants,
      results,
      isLast,
    };
    this._afterReveal(room, isLast);
  }

  _afterReveal(room, isLast) {
    const pause = isLast ? this.config.finalRevealMs : this.config.revealMs;
    room.phaseEndsAt = this.now() + pause;
    this._touch(room);
    this.emit(room);
    room.timer = this.setTimer(() => this._advance(room), pause);
  }

  _advance(room) {
    room.timer = null;
    if (room.status !== 'reveal') return;
    if (room.roundIndex >= room.settings.maxRounds) this._finish(room);
    else this._run(this._prepareRound(room, room.roundIndex + 1, 1, new Set()));
  }

  // Solo host: passa subito al round successivo dopo il reveal.
  nextRound(code, playerId) {
    const room = this.getRoom(code);
    this._assertHost(room, playerId);
    if (room.status !== 'reveal') return {};
    this._clearRoundTimer(room);
    this._advance(room);
    return {};
  }

  // Solo host: salta la sfida corrente (contenuto bloccato), senza penalità.
  async skipChallenge(code, playerId) {
    const room = this.getRoom(code);
    this._assertHost(room, playerId);
    if (!room.current || !ROUND_PHASES.includes(room.status)) return {};
    await this._replace(room, 'host');
    return {};
  }
}

// Eventi Socket.IO in più rispetto agli altri giochi (vedi socket.js)
export const barraEvents = {
  'player:ready': (m, { code, playerId }, payload) => m.markReady(code, playerId, payload),
  'player:load-error': (m, { code, playerId }, payload) => m.reportLoadError(code, playerId, payload),
  'game:next': (m, { code, playerId }) => m.nextRound(code, playerId),
  'game:skip': (m, { code, playerId }) => m.skipChallenge(code, playerId),
};
