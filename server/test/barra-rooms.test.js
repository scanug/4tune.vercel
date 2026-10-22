import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BarraRoomManager, BARRA_TIMING } from '../src/barra/rooms.js';
import { fakeClock } from './helpers.js';
import { fakeCatalog, okProviders, flush, seededRng } from './barra-helpers.js';

const SECRET = /SEGRETO|VARIANTE/;

async function setup({ songs = 12, perSong = 1, players = 2, settings = {}, providers = okProviders, catalog } = {}) {
  const clock = fakeClock();
  const cat = catalog || fakeCatalog(songs, perSong);
  const emitted = [];
  const manager = new BarraRoomManager({
    getCatalog: () => cat,
    providers,
    rng: seededRng(7),
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
    emit: (room) => emitted.push(JSON.stringify(manager.publicState(room))),
  });
  const { room, player: host } = manager.createRoom({ hostName: 'Host', settings: { maxRounds: 3, roundMs: 15000, ...settings } });
  manager.setConnected(room.code, host.id, true);
  const ids = [host.id];
  for (let i = 1; i < players; i++) {
    const { player } = manager.joinRoom(room.code, { name: `P${i}` });
    manager.setConnected(room.code, player.id, true);
    ids.push(player.id);
  }
  return { clock, manager, room, code: room.code, ids, cat, emitted };
}

const state = (env) => env.manager.publicState(env.room);

async function start(env, opts) {
  await env.manager.startGame(env.code, env.ids[0], opts);
  await flush();
}

function allReady(env, ids = env.ids) {
  const r = state(env).round;
  for (const id of ids) env.manager.markReady(env.code, id, { roundId: r.id });
}

// Porta il round corrente fino all'apertura delle risposte
function toAnswering(env) {
  allReady(env);
  const s = state(env);
  assert.equal(s.status, 'countdown');
  env.clock.advance(s.round.answerOpenAt - env.clock.now());
  assert.equal(state(env).status, 'answering');
  return state(env).round;
}

test('impostazioni di default: 10 round, 15 secondi, bonus velocità spento', async () => {
  const clock = fakeClock();
  const m = new BarraRoomManager({ getCatalog: () => fakeCatalog(1), providers: okProviders, now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer });
  const { room } = m.createRoom({ hostName: 'H', settings: {} });
  assert.equal(room.settings.maxRounds, 10);
  assert.equal(room.settings.roundMs, 15000);
  assert.equal(room.settings.speedBonus, false);
});

test('flusso completo di un round: preparazione, ascolto, risposte, reveal e punti', async () => {
  const env = await setup();
  const [host, p2] = env.ids;
  await start(env);
  let s = state(env);
  assert.equal(s.status, 'preparing');
  assert.equal(s.round.playback.provider, 'youtube');
  assert.equal(s.round.number, 1);

  allReady(env);
  s = state(env);
  assert.equal(s.status, 'countdown');
  assert.equal(s.round.answerOpenAt - s.round.playAt, 8000); // durata del frammento
  assert.equal(s.round.answerDeadline - s.round.answerOpenAt, 15000);

  env.clock.advance(BARRA_TIMING.COUNTDOWN_MS);
  assert.equal(state(env).status, 'listening');
  // Durante l'ascolto il campo è chiuso
  assert.throws(() => env.manager.submitAnswer(env.code, host, 'x'), { code: 'early' });

  env.clock.advance(8000);
  assert.equal(state(env).status, 'answering');
  const { answer } = env.room.current;

  env.clock.advance(1000);
  const ack = env.manager.submitAnswer(env.code, host, `  ${answer.toUpperCase()}!! `);
  assert.deepEqual(ack, { accepted: true }, "l'ack non dice se è giusta");
  s = state(env);
  assert.equal(s.players.find((p) => p.id === host).answered, true);
  assert.equal(s.players.find((p) => p.id === p2).answered, false);

  assert.throws(() => env.manager.submitAnswer(env.code, host, 'altro'), { code: 'dup' });

  // L'ultimo giocatore attivo risponde: il round si chiude subito
  env.manager.submitAnswer(env.code, p2, 'sbagliata');
  s = state(env);
  assert.equal(s.status, 'reveal');
  assert.equal(s.reveal.answer, answer);
  const res = Object.fromEntries(s.reveal.results.map((r) => [r.playerId, r]));
  assert.equal(res[host].correct, true);
  assert.equal(res[host].points, 100);
  assert.equal(res[p2].correct, false);
  assert.equal(res[p2].points, 0);
  assert.equal(res[p2].answer, 'sbagliata');
  assert.equal(s.players.find((p) => p.id === host).score, 100);

  assert.throws(() => env.manager.submitAnswer(env.code, p2, 'tardi'), { code: 'late' });
});

test('la soluzione non compare mai nello stato pubblico prima del reveal', async () => {
  const env = await setup();
  const [host] = env.ids;
  await start(env);
  toAnswering(env);
  env.manager.submitAnswer(env.code, host, 'tentativo segreto');
  const beforeReveal = env.emitted.join('\n');
  assert.doesNotMatch(beforeReveal, SECRET);
  assert.doesNotMatch(beforeReveal, /tentativo segreto/, 'le risposte altrui restano private durante il round');

  env.clock.advance(15000 + BARRA_TIMING.LATE_GRACE_MS);
  const s = state(env);
  assert.equal(s.status, 'reveal');
  assert.match(JSON.stringify(s), SECRET);
  assert.match(JSON.stringify(s), /tentativo segreto/);
});

test('risposte entro la tolleranza di rete accettate, poi il server chiude il round', async () => {
  const env = await setup();
  const [host, p2] = env.ids;
  await start(env);
  const r = toAnswering(env);
  env.clock.advance(r.answerDeadline - env.clock.now() + BARRA_TIMING.LATE_GRACE_MS - 10);
  env.manager.submitAnswer(env.code, host, 'al pelo');
  env.clock.advance(20);
  const s = state(env);
  assert.equal(s.status, 'reveal');
  const res = Object.fromEntries(s.reveal.results.map((x) => [x.playerId, x]));
  assert.equal(res[host].status, 'answered');
  assert.equal(res[p2].status, 'missing');
  assert.throws(() => env.manager.submitAnswer(env.code, p2, 'troppo tardi'), { code: 'late' });
});

test('bonus velocità: a scaglioni, sul tempo di ricezione del server', async () => {
  const env = await setup({ settings: { speedBonus: true, roundMs: 16000 } });
  const [host, p2] = env.ids;
  await start(env);
  toAnswering(env);
  const { answer } = env.room.current;
  env.clock.advance(1000);
  env.manager.submitAnswer(env.code, host, answer);
  env.clock.advance(12000);
  env.manager.submitAnswer(env.code, p2, answer);
  const res = Object.fromEntries(state(env).reveal.results.map((x) => [x.playerId, x]));
  assert.equal(res[host].points, 120);
  assert.equal(res[p2].points, 105);
});

test("avviso all'host se i filtri non bastano; avvio forzato; catalogo vuoto", async () => {
  const env = await setup({ songs: 2, settings: { maxRounds: 5 } });
  await assert.rejects(env.manager.startGame(env.code, env.ids[0]), { code: 'not_enough' });
  assert.equal(state(env).status, 'lobby');
  await start(env, { force: true });
  assert.equal(state(env).status, 'preparing');

  const empty = await setup({ songs: 0 });
  await assert.rejects(empty.manager.startGame(empty.code, empty.ids[0], { force: true }), { code: 'no_content' });

  const other = await setup();
  await assert.rejects(other.manager.startGame(other.code, other.ids[1]), { code: 'host' });
});

test('partita completa senza brani ripetuti, podio e rivincita', async () => {
  const env = await setup({ songs: 6, perSong: 2, settings: { maxRounds: 4 } });
  await start(env);
  const songs = [];
  for (let i = 0; i < 4; i++) {
    assert.equal(state(env).status, 'preparing');
    songs.push(env.room.current.songId);
    toAnswering(env);
    env.clock.advance(15000 + BARRA_TIMING.LATE_GRACE_MS);
    assert.equal(state(env).status, 'reveal');
    env.clock.advance(i === 3 ? 10000 : 9000);
    await flush();
  }
  assert.equal(state(env).status, 'finished');
  assert.equal(new Set(songs).size, 4);

  env.manager.restartGame(env.code, env.ids[0]);
  assert.equal(state(env).status, 'lobby');
  assert.ok(state(env).players.every((p) => p.score === 0));
});

test('contenuto non riproducibile in preparazione: sfida sostituita senza penalità, poi round annullato', async () => {
  const env = await setup({ songs: 8 });
  const [, p2] = env.ids;
  await start(env);
  const first = state(env).round;
  await env.manager.reportLoadError(env.code, p2, { roundId: first.id, kind: 'content' });
  await flush();
  let s = state(env);
  assert.equal(s.status, 'preparing');
  assert.equal(s.round.number, 1);
  assert.equal(s.round.attempt, 2);
  assert.notEqual(s.round.id, first.id);
  assert.match(s.notice, /senza penalità/);
  assert.ok(env.cat.errors.length >= 1);

  await env.manager.reportLoadError(env.code, p2, { roundId: s.round.id, kind: 'content' });
  await flush();
  s = state(env);
  await env.manager.reportLoadError(env.code, p2, { roundId: s.round.id, kind: 'content' });
  await flush();
  s = state(env);
  assert.equal(s.status, 'reveal');
  assert.equal(s.reveal.cancelled, true);
  assert.ok(s.players.every((p) => p.score === 0));
});

test('errore del provider lato server: il brano viene scartato e segnalato', async () => {
  let calls = 0;
  const providers = {
    async resolvePlayback(song, challenge) {
      calls += 1;
      if (calls === 1) return { ok: false, contentError: true, reason: 'Video rimosso' };
      return okProviders.resolvePlayback(song, challenge);
    },
  };
  const env = await setup({ providers });
  await start(env);
  assert.equal(state(env).status, 'preparing');
  assert.ok(state(env).round);
  assert.equal(env.cat.errors[0].markUnavailable, true);
});

test('timeout di caricamento: si parte con chi è pronto, gli altri non sono penalizzati', async () => {
  const env = await setup({ players: 3 });
  const [host, p2, p3] = env.ids;
  await start(env);
  const r = state(env).round;
  env.manager.markReady(env.code, host, { roundId: r.id });
  await env.manager.reportLoadError(env.code, p2, { roundId: r.id, kind: 'local' });
  assert.equal(state(env).status, 'preparing'); // p3 non ha ancora risposto

  env.clock.advance(BARRA_TIMING.PREPARE_TIMEOUT_MS);
  assert.equal(state(env).status, 'countdown');
  env.clock.advance(state(env).round.answerOpenAt - env.clock.now());
  env.manager.submitAnswer(env.code, host, 'boh');
  const s = state(env);
  assert.equal(s.status, 'reveal', 'basta la risposta di chi era pronto');
  const res = Object.fromEntries(s.reveal.results.map((x) => [x.playerId, x]));
  assert.equal(res[p2].status, 'excused');
  assert.equal(res[p3].status, 'excused');
});

test('nessuno pronto entro il timeout: sfida sostituita', async () => {
  const env = await setup();
  await start(env);
  const firstId = state(env).round.id;
  env.clock.advance(BARRA_TIMING.PREPARE_TIMEOUT_MS);
  await flush();
  const s = state(env);
  assert.equal(s.status, 'preparing');
  assert.notEqual(s.round.id, firstId);
  assert.equal(s.round.attempt, 2);
});

test('disconnessione: chi è offline non blocca il round; host trasferito; rientro con lo stesso posto', async () => {
  const env = await setup({ players: 3 });
  const [host, p2, p3] = env.ids;
  await start(env);
  toAnswering(env);
  env.manager.setConnected(env.code, host, false);
  env.clock.advance(10_000); // hostGraceMs
  assert.equal(state(env).hostId, p2);

  env.manager.submitAnswer(env.code, p2, 'a');
  env.manager.submitAnswer(env.code, p3, 'b');
  assert.equal(state(env).status, 'reveal');

  const { player, rejoined } = env.manager.joinRoom(env.code, { playerId: host });
  assert.equal(rejoined, true);
  assert.equal(player.status, 'active');
});

test("uscita dell'host in lobby: il ruolo passa subito a un altro", async () => {
  const env = await setup();
  const [host, p2] = env.ids;
  env.manager.leaveRoom(env.code, host);
  assert.equal(state(env).hostId, p2);
});

test('ingresso a partita iniziata: in attesa fino alla partita successiva', async () => {
  const env = await setup({ settings: { maxRounds: 1 } });
  await start(env);
  const { player: late } = env.manager.joinRoom(env.code, { name: 'Ritardo' });
  env.manager.setConnected(env.code, late.id, true);
  assert.equal(state(env).players.find((p) => p.id === late.id).status, 'waiting');
  // Non blocca la preparazione e non può rispondere
  toAnswering(env);
  assert.throws(() => env.manager.submitAnswer(env.code, late.id, 'x'), { code: 'waiting' });
  env.clock.advance(15000 + BARRA_TIMING.LATE_GRACE_MS);
  assert.ok(!state(env).reveal.results.some((r) => r.playerId === late.id));
  env.clock.advance(10000);
  assert.equal(state(env).status, 'finished');
  env.manager.restartGame(env.code, env.ids[0]);
  assert.equal(state(env).players.find((p) => p.id === late.id).status, 'active');
});

test('eventi obsoleti ignorati; solo l\'host salta la sfida o va avanti', async () => {
  const env = await setup();
  const [host, p2] = env.ids;
  await start(env);
  assert.deepEqual(env.manager.markReady(env.code, host, { roundId: 'vecchio' }), { stale: true });
  await assert.rejects(env.manager.skipChallenge(env.code, p2), { code: 'host' });
  const before = state(env).round.id;
  await env.manager.skipChallenge(env.code, host);
  await flush();
  assert.notEqual(state(env).round.id, before);
  assert.match(state(env).notice, /saltato/);
});
