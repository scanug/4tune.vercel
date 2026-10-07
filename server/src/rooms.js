// Gestore delle stanze, comune a tutti i giochi online. Il server è l'unica
// autorità: tiene la risposta corretta, misura i tempi di risposta col proprio
// orologio, calcola i punti e fa avanzare i round con i propri timer. Se
// l'host chiude la pagina la partita continua.
//
// Le regole del singolo gioco (round, stato visibile, risposte, punti) arrivano
// da un oggetto `game` (vedi games/gts.js, games/anno.js e games/prezzo.js); senza, è il GTS.
//
// Orologio e timer sono iniettabili (`now`, `setTimer`, `clearTimer`) per i test.

import { randomUUID } from 'node:crypto';
import { GameError, LIMITS, generateCode, sanitizeName } from './engine.js';
import { gtsGame } from './games/gts.js';

const DEFAULTS = {
  revealMs: 5000,        // pausa dopo il reveal prima del round successivo
  finalRevealMs: 8000,   // pausa dopo l'ultimo reveal prima del podio
  hostGraceMs: 10000,    // quanto aspettare un host disconnesso prima di passare il ruolo
  emptyTtlMs: 5 * 60_000, // stanza senza nessuno connesso → eliminata
  idleTtlMs: 60 * 60_000, // stanza in lobby/finita senza attività → eliminata
};

export class RoomManager {
  constructor(options = {}) {
    this.now = options.now || Date.now;
    this.setTimer = options.setTimer || ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = options.clearTimer || ((id) => clearTimeout(id));
    this.rng = options.rng || Math.random;
    this.emit = options.emit || (() => {});
    this.onRoomRemoved = options.onRoomRemoved || (() => {});
    this.game = options.game || gtsGame;
    this.config = { ...DEFAULTS, ...this.game.config, ...(options.config || {}) };
    this.rooms = new Map();
  }

  // ---------- lettura ----------

  getRoom(code) {
    const room = this.rooms.get(String(code || '').toUpperCase());
    if (!room) throw new GameError('Stanza non trovata', 'room');
    return room;
  }

  hasRoom(code) {
    return this.rooms.has(String(code || '').toUpperCase());
  }

  // Stato visibile a tutti i client: mai la risposta corretta prima del reveal.
  publicState(room) {
    const current = room.rounds[room.roundIndex - 1] || null;
    const showRound = current && ['countdown', 'playing', 'reveal'].includes(room.status);
    const players = [...room.players.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        score: p.score,
        isHost: p.id === room.hostId,
        answered: room.answers.has(p.id),
      }));

    return {
      code: room.code,
      status: room.status,
      hostId: room.hostId,
      settings: room.settings,
      roundIndex: room.roundIndex,
      totalRounds: room.rounds.length || room.settings.maxRounds,
      startAt: room.startAt,
      phaseEndsAt: room.phaseEndsAt,
      serverNow: this.now(),
      players,
      ...this.game.publicView(room, current, showRound),
      reveal: ['reveal', 'finished'].includes(room.status) ? room.lastReveal : null,
    };
  }

  // ---------- lobby ----------

  // `input`: i dati specifici del gioco (es. la playlist del GTS).
  createRoom({ hostName, settings, ...input }) {
    const clean = this.game.clampSettings(settings);
    const content = this.game.prepare(input, clean, this.rng);
    const name = sanitizeName(hostName);

    let code;
    do { code = generateCode(4, this.rng); } while (this.rooms.has(code));

    const room = {
      code,
      status: 'lobby',
      hostId: null,
      settings: clean,
      content,
      rounds: [],
      roundIndex: 0,
      startAt: null,
      phaseEndsAt: null,
      players: new Map(),
      answers: new Map(),
      lastReveal: null,
      timer: null,
      hostTimer: null,
      cleanupTimer: null,
      createdAt: this.now(),
    };
    this.rooms.set(code, room);
    const player = this._addPlayer(room, name);
    room.hostId = player.id;
    this._scheduleCleanup(room);
    return { room, player };
  }

  joinRoom(code, { name, playerId }) {
    const room = this.getRoom(code);
    // Rientro (refresh pagina, cambio rete): stesso playerId, stesso posto.
    if (playerId && room.players.has(playerId)) {
      const player = room.players.get(playerId);
      if (name) {
        try { player.name = sanitizeName(name); } catch { /* tiene il vecchio nome */ }
      }
      this._touch(room);
      return { room, player, rejoined: true };
    }
    if (room.players.size >= LIMITS.maxPlayers) throw new GameError('Stanza piena', 'full');
    const player = this._addPlayer(room, sanitizeName(name));
    if (!room.hostId) room.hostId = player.id;
    this._touch(room);
    this.emit(room);
    return { room, player, rejoined: false };
  }

  leaveRoom(code, playerId) {
    if (!this.hasRoom(code)) return;
    const room = this.getRoom(code);
    if (!room.players.delete(playerId)) return;
    room.answers.delete(playerId);
    if (room.hostId === playerId) this._migrateHost(room);
    if (room.players.size === 0) { this._removeRoom(room); return; }
    this._touch(room);
    this.emit(room);
    this._checkAllAnswered(room);
  }

  setConnected(code, playerId, connected) {
    if (!this.hasRoom(code)) return;
    const room = this.getRoom(code);
    const player = room.players.get(playerId);
    if (!player) return;
    player.connected = connected;

    if (playerId === room.hostId) {
      if (connected && room.hostTimer) { this.clearTimer(room.hostTimer); room.hostTimer = null; }
      if (!connected && !room.hostTimer) {
        room.hostTimer = this.setTimer(() => {
          room.hostTimer = null;
          if (!room.players.get(room.hostId)?.connected) { this._migrateHost(room); this.emit(room); }
        }, this.config.hostGraceMs);
      }
    }

    this._touch(room);
    this.emit(room);
    if (!connected) this._checkAllAnswered(room);
  }

  // ---------- partita ----------

  startGame(code, playerId) {
    const room = this.getRoom(code);
    this._assertHost(room, playerId);
    if (room.status !== 'lobby') throw new GameError('La partita è già iniziata', 'state');
    room.rounds = this.game.buildRounds(room, this.rng);
    room.roundIndex = 0;
    for (const p of room.players.values()) p.score = 0;
    this._beginRound(room);
  }

  restartGame(code, playerId) {
    const room = this.getRoom(code);
    this._assertHost(room, playerId);
    if (room.status !== 'finished') throw new GameError('La partita non è ancora finita', 'state');
    this._clearRoundTimer(room);
    room.status = 'lobby';
    room.rounds = [];
    room.roundIndex = 0;
    room.startAt = null;
    room.phaseEndsAt = null;
    room.answers.clear();
    room.lastReveal = null;
    for (const p of room.players.values()) p.score = 0;
    this._touch(room);
    this.emit(room);
  }

  submitAnswer(code, playerId, choice) {
    const room = this.getRoom(code);
    const player = room.players.get(playerId);
    if (!player) throw new GameError('Non sei in questa stanza', 'player');
    if (room.status !== 'playing') throw new GameError('Non è il momento di rispondere', 'state');
    if (room.answers.has(playerId)) throw new GameError('Hai già risposto', 'dup');
    const current = room.rounds[room.roundIndex - 1];
    const value = this.game.parseAnswer(current, choice);
    const at = this.now();
    room.answers.set(playerId, { choice: value, at });
    this.emit(room);
    this._checkAllAnswered(room);
    return { accepted: true, at };
  }

  // ---------- interni ----------

  _addPlayer(room, name) {
    const player = { id: randomUUID(), name, connected: false, score: 0, joinedAt: this.now() };
    room.players.set(player.id, player);
    return player;
  }

  _assertHost(room, playerId) {
    if (room.hostId !== playerId) throw new GameError('Solo l\'host può farlo', 'host');
  }

  _migrateHost(room) {
    const candidates = [...room.players.values()]
      .filter((p) => p.id !== room.hostId)
      .sort((a, b) => Number(b.connected) - Number(a.connected) || a.joinedAt - b.joinedAt);
    room.hostId = candidates[0]?.id || null;
  }

  _beginRound(room) {
    this._clearRoundTimer(room);
    room.roundIndex += 1;
    room.answers.clear();
    room.lastReveal = null;
    room.status = 'countdown';
    room.startAt = this.now() + room.settings.prepMs;
    room.phaseEndsAt = room.startAt;
    this._touch(room);
    this.emit(room);
    room.timer = this.setTimer(() => this._play(room), room.settings.prepMs);
  }

  _play(room) {
    room.status = 'playing';
    room.phaseEndsAt = room.startAt + room.settings.roundMs;
    this.emit(room);
    room.timer = this.setTimer(() => this._reveal(room), room.settings.roundMs);
  }

  _checkAllAnswered(room) {
    if (room.status !== 'playing') return;
    const active = [...room.players.values()].filter((p) => p.connected);
    if (active.length === 0) return;
    if (active.every((p) => room.answers.has(p.id))) this._reveal(room);
  }

  _reveal(room) {
    if (room.status !== 'playing') return;
    this._clearRoundTimer(room);
    const current = room.rounds[room.roundIndex - 1];
    const answers = [...room.answers.entries()]
      .filter(([playerId]) => room.players.has(playerId))
      .map(([playerId, ans]) => ({ playerId, ...ans }))
      .sort((a, b) => a.at - b.at);
    const { results, reveal } = this.game.score(room, current, answers);
    for (const r of results) room.players.get(r.playerId).score += r.points;

    const isLast = room.roundIndex >= room.rounds.length;
    room.status = 'reveal';
    room.lastReveal = {
      roundIndex: room.roundIndex,
      ...reveal,
      results,
      isLast,
    };
    const pause = isLast ? this.config.finalRevealMs : this.config.revealMs;
    room.phaseEndsAt = this.now() + pause;
    this._touch(room);
    this.emit(room);
    room.timer = this.setTimer(() => (isLast ? this._finish(room) : this._beginRound(room)), pause);
  }

  _finish(room) {
    this._clearRoundTimer(room);
    room.status = 'finished';
    room.startAt = null;
    room.phaseEndsAt = null;
    this._touch(room);
    this.emit(room);
  }

  _clearRoundTimer(room) {
    if (room.timer) { this.clearTimer(room.timer); room.timer = null; }
  }

  _touch(room) {
    room.updatedAt = this.now();
    this._scheduleCleanup(room);
  }

  // Una stanza muore quando nessuno è connesso da un po', o quando resta
  // ferma in lobby/podio troppo a lungo. Mai a metà partita con gente dentro.
  _scheduleCleanup(room) {
    if (room.cleanupTimer) this.clearTimer(room.cleanupTimer);
    const anyoneConnected = [...room.players.values()].some((p) => p.connected);
    const ttl = anyoneConnected ? this.config.idleTtlMs : this.config.emptyTtlMs;
    room.cleanupTimer = this.setTimer(() => {
      room.cleanupTimer = null;
      const connected = [...room.players.values()].some((p) => p.connected);
      const inGame = ['countdown', 'playing', 'reveal'].includes(room.status);
      if (!connected || !inGame) this._removeRoom(room);
      else this._scheduleCleanup(room);
    }, ttl);
  }

  _removeRoom(room) {
    this._clearRoundTimer(room);
    if (room.hostTimer) this.clearTimer(room.hostTimer);
    if (room.cleanupTimer) this.clearTimer(room.cleanupTimer);
    this.rooms.delete(room.code);
    this.onRoomRemoved(room);
  }
}
