import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from '../src/rooms.js';
import {
  ANNO_CATEGORIES, ANNO_SCORING, buildAnnoRounds, clampAnnoSettings, createAnnoGame,
  distancePoints, pickRange, scoreAnnoRound,
} from '../src/games/anno.js';
import { fakeClock } from './helpers.js';

const NOW = Date.UTC(2026, 5, 1);

// rng deterministico (mulberry32) per test ripetibili.
function seeded(seed = 42) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deck() {
  const cards = [];
  const years = { personaggi: 1952, storia: 1861, invenzioni: 1964, media: 1997, attualita: 2021 };
  for (const { id } of ANNO_CATEGORIES) {
    for (let i = 0; i < 6; i++) {
      cards.push({ id: `${id}-${i}`, category: id, title: `${id} carta ${i}`, year: years[id] + i, image: null, wikiUrl: 'https://it.wikipedia.org/wiki/X' });
    }
  }
  return cards;
}

test('pickRange: l\'anno giusto è sempre dentro, larghezza fissa, mai nel futuro', () => {
  const rng = seeded(1);
  for (const { span } of ANNO_CATEGORIES) {
    for (let year = 1000; year <= 2026; year += 7) {
      const { min, max } = pickRange(year, span, rng, 2026);
      assert.ok(year >= min && year <= max, `${year} fuori da [${min}, ${max}]`);
      assert.equal(max - min, span);
      assert.ok(max <= 2026);
    }
  }
});

test('pickRange: la posizione dell\'anno nell\'intervallo varia (i bordi non svelano la risposta)', () => {
  const rng = seeded(7);
  const positions = new Set();
  for (let i = 0; i < 300; i++) {
    const { min } = pickRange(1900, 120, rng, 2026);
    positions.add(1900 - min);
  }
  assert.ok(positions.size > 15, `solo ${positions.size} posizioni diverse`);
});

test('distancePoints: 100 all\'anno esatto, 0 da metà intervallo in poi, decrescente', () => {
  assert.equal(distancePoints(0, 120), 100);
  assert.equal(distancePoints(60, 120), 0);
  assert.equal(distancePoints(500, 120), 0);
  let prev = 101;
  for (let d = 0; d <= 60; d++) {
    const p = distancePoints(d, 120);
    assert.ok(p <= prev);
    prev = p;
  }
});

test('clampAnnoSettings: categorie sconosciute scartate, nessuna valida = tutte', () => {
  assert.deepEqual(clampAnnoSettings({ categories: ['media', 'boh', 'media'] }).categories, ['media']);
  assert.equal(clampAnnoSettings({ categories: ['boh'] }).categories.length, ANNO_CATEGORIES.length);
  assert.equal(clampAnnoSettings({}).maxRounds, 10);
  assert.equal(clampAnnoSettings({ maxRounds: 99, roundMs: 1 }).maxRounds, 20);
  assert.equal(clampAnnoSettings({ roundMs: 1 }).roundMs, 10000);
});

test('buildAnnoRounds: niente doppioni, solo categorie scelte, categorie alternate', () => {
  const settings = clampAnnoSettings({ maxRounds: 20, categories: ['media', 'storia'] });
  const rounds = buildAnnoRounds(deck(), settings, new Set(), seeded(3), 2026);
  assert.equal(rounds.length, 12); // 6 + 6 carte disponibili
  assert.equal(new Set(rounds.map((r) => r.card.id)).size, rounds.length);
  assert.ok(rounds.every((r) => ['media', 'storia'].includes(r.card.category)));
  for (let i = 2; i < rounds.length; i++) {
    const same = rounds[i].card.category === rounds[i - 1].card.category && rounds[i].card.category === rounds[i - 2].card.category;
    assert.ok(!same, 'tre carte di fila della stessa categoria');
  }
});

test('buildAnnoRounds: preferisce le carte non ancora uscite', () => {
  const settings = clampAnnoSettings({ maxRounds: 3, categories: ['media'] });
  const used = new Set(['media-0', 'media-1', 'media-2']);
  const rounds = buildAnnoRounds(deck(), settings, used, seeded(5), 2026);
  assert.ok(rounds.every((r) => !used.has(r.card.id)));
});

test('scoreAnnoRound: il più vicino vince, pari distanza vincono entrambi, bonus anno esatto', () => {
  const round = { card: { year: 1990 }, span: 120, range: { min: 1950, max: 2070 } };
  const { results, winnerIds } = scoreAnnoRound(round, [
    { playerId: 'a', choice: 1990, at: 1 },
    { playerId: 'b', choice: 1995, at: 2 },
    { playerId: 'c', choice: 1985, at: 3 },
  ]);
  assert.deepEqual(winnerIds, ['a']);
  const a = results.find((r) => r.playerId === 'a');
  assert.equal(a.points, 100 + ANNO_SCORING.exactBonus + ANNO_SCORING.winnerBonus);
  const b = results.find((r) => r.playerId === 'b');
  const c = results.find((r) => r.playerId === 'c');
  assert.equal(b.points, c.points);
  assert.equal(b.winner, false);

  const tie = scoreAnnoRound(round, [
    { playerId: 'b', choice: 1995, at: 2 },
    { playerId: 'c', choice: 1985, at: 3 },
  ]);
  assert.deepEqual(tie.winnerIds.sort(), ['b', 'c']);
});

test('scoreAnnoRound: chi è lontanissimo non vince anche se è l\'unico', () => {
  const round = { card: { year: 1990 }, span: 120, range: { min: 1950, max: 2070 } };
  const { results, winnerIds } = scoreAnnoRound(round, [{ playerId: 'a', choice: 2060, at: 1 }]);
  assert.deepEqual(winnerIds, []);
  assert.equal(results[0].points, 0);
});

function setup(settings = { maxRounds: 2, roundMs: 20000, categories: ['media'] }) {
  const clock = fakeClock(NOW);
  const emitted = [];
  const manager = new RoomManager({
    game: createAnnoGame(deck(), { now: clock.now }),
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer, rng: seeded(11),
    emit: (room) => emitted.push(manager.publicState(room)),
  });
  const { room, player: host } = manager.createRoom({ hostName: 'Host', settings });
  manager.setConnected(room.code, host.id, true);
  const { player: guest } = manager.joinRoom(room.code, { name: 'Guest' });
  manager.setConnected(room.code, guest.id, true);
  return { clock, manager, room, host, guest, emitted };
}

test('partita: lo stato pubblico non svela anno, foto o link prima del reveal', () => {
  const { clock, manager, room, host, emitted } = setup();
  manager.startGame(room.code, host.id);
  clock.advance(2500);
  const state = manager.publicState(room);
  assert.equal(state.status, 'playing');
  assert.deepEqual(Object.keys(state.round).sort(), ['category', 'range', 'subtitle', 'title']);
  for (const s of emitted.filter((e) => ['countdown', 'playing'].includes(e.status))) {
    const json = JSON.stringify(s);
    assert.ok(!json.includes('"year"') && !json.includes('wikiUrl') && !json.includes('"image"'));
    assert.equal(s.reveal, null);
  }
});

test('partita: risposte validate sull\'intervallo, punti e vincitore al reveal', () => {
  const { clock, manager, room, host, guest } = setup();
  manager.startGame(room.code, host.id);
  assert.throws(() => manager.submitAnswer(room.code, host.id, 1990), /momento/);
  clock.advance(2500);
  const { range, card } = room.rounds[0];
  assert.throws(() => manager.submitAnswer(room.code, host.id, range.min - 1), /non valido/);
  assert.throws(() => manager.submitAnswer(room.code, host.id, 'abc'), /non valido/);
  assert.throws(() => manager.submitAnswer(room.code, host.id, 1990.5), /non valido/);

  manager.submitAnswer(room.code, host.id, card.year);
  assert.throws(() => manager.submitAnswer(room.code, host.id, card.year), /già risposto/);
  const far = card.year - 10 >= range.min ? card.year - 10 : card.year + 10;
  manager.submitAnswer(room.code, guest.id, far);

  assert.equal(room.status, 'reveal');
  const reveal = manager.publicState(room).reveal;
  assert.equal(reveal.year, card.year);
  assert.deepEqual(reveal.winnerIds, [host.id]);
  assert.equal(room.players.get(host.id).score, 200);
  assert.equal(room.players.get(guest.id).score, reveal.results.find((r) => r.playerId === guest.id).points);
  assert.ok(room.players.get(guest.id).score < 100);
});

test('partita: tempi del reveal più lunghi per l\'animazione, poi podio', () => {
  const { clock, manager, room, host } = setup();
  manager.startGame(room.code, host.id);
  clock.advance(2500 + 20000);
  assert.equal(room.status, 'reveal');
  clock.advance(8999);
  assert.equal(room.status, 'reveal');
  clock.advance(1);
  assert.equal(room.status, 'countdown');
  clock.advance(2500 + 20000 + 10000);
  assert.equal(room.status, 'finished');
});

test('rigiocare nella stessa stanza non ripropone le carte appena uscite', () => {
  const { clock, manager, room, host } = setup({ maxRounds: 3, roundMs: 10000, categories: ['media'] });
  manager.startGame(room.code, host.id);
  const first = room.rounds.map((r) => r.card.id);
  clock.advance(120000);
  assert.equal(room.status, 'finished');
  manager.restartGame(room.code, host.id);
  manager.startGame(room.code, host.id);
  const second = room.rounds.map((r) => r.card.id);
  assert.ok(second.every((id) => !first.includes(id)));
});

test('createRoom rifiuta un mazzo vuoto', () => {
  const manager = new RoomManager({ game: createAnnoGame([]) });
  assert.throws(() => manager.createRoom({ hostName: 'A', settings: {} }), /Mazzo/);
});
