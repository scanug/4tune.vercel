import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RoomManager } from '../src/rooms.js';
import {
  PREZZO_CATEGORIES, PREZZO_SCORING, buildPrezzoRounds, clampPrezzoSettings, createPrezzoGame,
  distancePoints, loadDeck, niceFloor, pickPriceRange, roundPrice, scorePrezzoRound,
} from '../src/games/prezzo.js';
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
  const prices = { spesa: 1.2, tecnologia: 979, vita: 116, calcio: 222e6, affari: 44e9, cinema: 2.92e9, aste: 450.3e6 };
  for (const { id } of PREZZO_CATEGORIES) {
    for (let i = 0; i < 6; i++) {
      cards.push({ id: `${id}-${i}`, category: id, title: `${id} carta ${i}`, price: prices[id] * (i + 1), unit: 'EUR', note: 'Prezzo di prova, 2025', source: 'Test' });
    }
  }
  return cards;
}

const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(b));

test('niceFloor e roundPrice: numeri tondi e arrotondamenti dello slider', () => {
  assert.equal(niceFloor(0.137), 0.12);
  assert.equal(niceFloor(1), 1);
  assert.equal(niceFloor(9.99), 8);
  assert.equal(niceFloor(2_345_000), 2_000_000);
  assert.equal(niceFloor(175), 150);
  assert.equal(roundPrice(1.234), 1.23);
  assert.equal(roundPrice(0.004), 0.01);
  assert.equal(roundPrice(978.6), 979);
  assert.equal(roundPrice(1489), 1490);
  assert.equal(roundPrice(221_700_000), 222_000_000);
});

test('pickPriceRange: il prezzo è sempre dentro, rapporto fisso, bordi tondi, mai ai bordi', () => {
  const rng = seeded(1);
  for (const { span } of PREZZO_CATEGORIES) {
    for (let exp = -1; exp <= 11; exp += 0.37) {
      const price = roundPrice(10 ** exp);
      const { min, max } = pickPriceRange(price, span, rng);
      assert.ok(price >= min && price <= max, `${price} fuori da [${min}, ${max}]`);
      assert.ok(close(max / min, span), `rapporto ${max / min} invece di ${span}`);
      assert.equal(niceFloor(min), min, `${min} non è tondo`);
      const position = Math.log(price / min) / Math.log(span);
      assert.ok(position >= 0.1 - 1e-9 && position <= 0.9, `prezzo troppo vicino ai bordi (${position})`);
    }
  }
});

test('pickPriceRange: la posizione del prezzo varia (i bordi non svelano la risposta)', () => {
  const rng = seeded(7);
  const mins = new Set();
  for (let i = 0; i < 300; i++) mins.add(pickPriceRange(979, 20, rng).min);
  assert.ok(mins.size >= 8, `solo ${mins.size} intervalli diversi`);
});

test('distancePoints: 100 al prezzo esatto, 0 da metà intervallo (log) in poi, decrescente', () => {
  assert.equal(distancePoints(0, 20), 100);
  assert.equal(distancePoints(Math.log(20) / 2, 20), 0);
  assert.equal(distancePoints(10, 20), 0);
  let prev = 101;
  for (let d = 0; d <= Math.log(20) / 2; d += 0.05) {
    const p = distancePoints(d, 20);
    assert.ok(p <= prev);
    prev = p;
  }
});

test('scorePrezzoRound: proporzionale, simmetrico in scala logaritmica, uguale su ogni ordine di grandezza', () => {
  const pointsFor = (price, guess, span = 20) => scorePrezzoRound(
    { card: { price }, span, range: { min: price / 10, max: price * 2 } },
    [{ playerId: 'a', choice: guess, at: 1 }],
  ).results[0].base;
  // Il doppio e la metà valgono uguale.
  assert.equal(pointsFor(100, 200), pointsFor(100, 50));
  assert.equal(pointsFor(100, 130), pointsFor(100, 100 / 1.3));
  // Sbagliare del 30% su un caffè o su un calciatore è la stessa cosa.
  assert.equal(pointsFor(1.2, 1.56), pointsFor(222e6, 288.6e6));
  // Più lontano = meno punti.
  assert.ok(pointsFor(100, 110) > pointsFor(100, 150));
  assert.ok(pointsFor(100, 150) > pointsFor(100, 300));
  // Con uno span più largo la stessa proporzione vale di più.
  assert.ok(pointsFor(100, 200, 1000) > pointsFor(100, 200, 20));
});

test('scorePrezzoRound: il più vicino vince, pari distanza vincono entrambi, bonus entro il 2%', () => {
  const round = { card: { price: 1000 }, span: 20, range: { min: 300, max: 6000 } };
  const { results, winnerIds } = scorePrezzoRound(round, [
    { playerId: 'a', choice: 1010, at: 1 },
    { playerId: 'b', choice: 1250, at: 2 },
    { playerId: 'c', choice: 800, at: 3 },
  ]);
  assert.deepEqual(winnerIds, ['a']);
  const a = results.find((r) => r.playerId === 'a');
  assert.equal(a.exact, true);
  assert.equal(a.points, a.base + PREZZO_SCORING.exactBonus + PREZZO_SCORING.winnerBonus);
  assert.equal(a.offPct, 1);
  const b = results.find((r) => r.playerId === 'b');
  const c = results.find((r) => r.playerId === 'c');
  assert.equal(b.points, c.points); // 1250 e 800 sono entrambi a ×1,25
  assert.equal(b.offPct, 25);
  assert.equal(c.offPct, -20);
  assert.equal(b.exact, false);
  for (let i = 1; i < results.length; i++) assert.ok(results[i - 1].distance <= results[i].distance, 'risultati non ordinati');

  const tie = scorePrezzoRound(round, [
    { playerId: 'b', choice: 1250, at: 2 },
    { playerId: 'c', choice: 800, at: 3 },
  ]);
  assert.deepEqual(tie.winnerIds.sort(), ['b', 'c']);

  const near = scorePrezzoRound(round, [{ playerId: 'x', choice: 1030, at: 1 }]);
  assert.equal(near.results[0].exact, false); // +3% non è "esatto"
});

test('scorePrezzoRound: chi è lontanissimo non vince anche se è l\'unico', () => {
  const round = { card: { price: 1000 }, span: 20, range: { min: 300, max: 6000 } };
  const { results, winnerIds } = scorePrezzoRound(round, [{ playerId: 'a', choice: 6000, at: 1 }]);
  assert.deepEqual(winnerIds, []);
  assert.equal(results[0].points, 0);
});

test('clampPrezzoSettings: categorie sconosciute scartate, nessuna valida = tutte', () => {
  assert.deepEqual(clampPrezzoSettings({ categories: ['calcio', 'boh', 'calcio'] }).categories, ['calcio']);
  assert.equal(clampPrezzoSettings({ categories: ['boh'] }).categories.length, PREZZO_CATEGORIES.length);
  assert.equal(clampPrezzoSettings({}).maxRounds, 10);
  assert.equal(clampPrezzoSettings({ maxRounds: 99 }).maxRounds, 20);
  assert.equal(clampPrezzoSettings({ roundMs: 1 }).roundMs, 10000);
});

test('buildPrezzoRounds: niente doppioni, solo categorie scelte, categorie alternate', () => {
  const settings = clampPrezzoSettings({ maxRounds: 20, categories: ['spesa', 'affari'] });
  const rounds = buildPrezzoRounds(deck(), settings, new Set(), seeded(3));
  assert.equal(rounds.length, 12);
  assert.equal(new Set(rounds.map((r) => r.card.id)).size, rounds.length);
  assert.ok(rounds.every((r) => ['spesa', 'affari'].includes(r.card.category)));
  for (const r of rounds) assert.ok(r.card.price >= r.range.min && r.card.price <= r.range.max);
  for (let i = 2; i < rounds.length; i++) {
    const same = rounds[i].card.category === rounds[i - 1].card.category && rounds[i].card.category === rounds[i - 2].card.category;
    assert.ok(!same, 'tre carte di fila della stessa categoria');
  }
});

test('parseAnswer: accetta solo prezzi positivi dentro l\'intervallo', () => {
  const game = createPrezzoGame(deck());
  const current = { range: { min: 1.2, max: 24 } };
  assert.equal(game.parseAnswer(current, 5.37), 5.37);
  assert.equal(game.parseAnswer(current, '1.2'), 1.2);
  assert.equal(game.parseAnswer(current, 24), 24);
  assert.equal(game.parseAnswer(current, 5.3749), 5.37); // arrotondato come lo slider
  for (const bad of [1.1, 24.5, 0, -3, 'abc', null, undefined, NaN, Infinity, {}, [5]]) {
    assert.throws(() => game.parseAnswer(current, bad), /non valido/, `accettato ${bad}`);
  }
});

function setup(settings = { maxRounds: 2, roundMs: 20000, categories: ['tecnologia'] }) {
  const clock = fakeClock(NOW);
  const emitted = [];
  const manager = new RoomManager({
    game: createPrezzoGame(deck()),
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer, rng: seeded(11),
    emit: (room) => emitted.push(manager.publicState(room)),
  });
  const { room, player: host } = manager.createRoom({ hostName: 'Host', settings });
  manager.setConnected(room.code, host.id, true);
  const { player: guest } = manager.joinRoom(room.code, { name: 'Guest' });
  manager.setConnected(room.code, guest.id, true);
  return { clock, manager, room, host, guest, emitted };
}

test('partita: lo stato pubblico non svela prezzo, nota o fonte prima del reveal', () => {
  const { clock, manager, room, host, emitted } = setup();
  manager.startGame(room.code, host.id);
  clock.advance(2500);
  const state = manager.publicState(room);
  assert.equal(state.status, 'playing');
  assert.deepEqual(Object.keys(state.round).sort(), ['category', 'range', 'subtitle', 'title', 'unit']);
  for (const s of emitted.filter((e) => ['countdown', 'playing'].includes(e.status))) {
    const json = JSON.stringify(s);
    assert.ok(!json.includes('"price"') && !json.includes('"note"') && !json.includes('"source"'));
    assert.equal(s.reveal, null);
  }
});

test('partita: risposte validate sull\'intervallo, punti e vincitore al reveal', () => {
  const { clock, manager, room, host, guest } = setup();
  manager.startGame(room.code, host.id);
  assert.throws(() => manager.submitAnswer(room.code, host.id, 979), /momento/);
  clock.advance(2500);
  const { range, card } = room.rounds[0];
  assert.throws(() => manager.submitAnswer(room.code, host.id, range.min * 0.9), /non valido/);
  assert.throws(() => manager.submitAnswer(room.code, host.id, range.max * 1.1), /non valido/);
  assert.throws(() => manager.submitAnswer(room.code, host.id, 'abc'), /non valido/);

  manager.submitAnswer(room.code, host.id, card.price);
  assert.throws(() => manager.submitAnswer(room.code, host.id, card.price), /già risposto/);
  const far = card.price * 1.5 <= range.max ? card.price * 1.5 : card.price / 1.5;
  manager.submitAnswer(room.code, guest.id, roundPrice(far));

  assert.equal(room.status, 'reveal');
  const reveal = manager.publicState(room).reveal;
  assert.equal(reveal.price, card.price);
  assert.equal(reveal.unit, 'EUR');
  assert.equal(reveal.note, 'Prezzo di prova, 2025');
  assert.deepEqual(reveal.winnerIds, [host.id]);
  assert.equal(room.players.get(host.id).score, 200);
  assert.equal(room.players.get(guest.id).score, reveal.results.find((r) => r.playerId === guest.id).points);
  assert.ok(room.players.get(guest.id).score < 100);
});

test('partita: reveal lungo per l\'animazione, poi podio; rigiocando le carte cambiano', () => {
  const { clock, manager, room, host } = setup({ maxRounds: 3, roundMs: 10000, categories: ['tecnologia'] });
  manager.startGame(room.code, host.id);
  const first = room.rounds.map((r) => r.card.id);
  clock.advance(2500 + 10000);
  assert.equal(room.status, 'reveal');
  clock.advance(8999);
  assert.equal(room.status, 'reveal');
  clock.advance(1);
  assert.equal(room.status, 'countdown');
  clock.advance(120000);
  assert.equal(room.status, 'finished');
  manager.restartGame(room.code, host.id);
  manager.startGame(room.code, host.id);
  assert.ok(room.rounds.every((r) => !first.includes(r.card.id)));
});

test('createRoom rifiuta un mazzo vuoto', () => {
  const manager = new RoomManager({ game: createPrezzoGame([]) });
  assert.throws(() => manager.createRoom({ hostName: 'A', settings: {} }), /Mazzo/);
});

test('mazzo vero: ogni carta è valida e ogni categoria ha carte', () => {
  const file = new URL('../data/prezzo/cards.json', import.meta.url);
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const cards = loadDeck(file);
  assert.equal(cards.length, raw.length, 'carte scartate dal server');
  assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
  for (const { id } of PREZZO_CATEGORIES) assert.ok(cards.some((c) => c.category === id), `nessuna carta in ${id}`);
  for (const c of cards) assert.ok(c.note && c.source && c.title, `${c.id} incompleta`);
});
