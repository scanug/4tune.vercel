import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { ANNO_CATEGORIES } from '../src/games/anno.js';
import { DAY_ONE, addDays, dayNumber, nextRomeMidnight, romeDay } from '../src/daily/time.js';
import {
  DAILY_TOTAL, MAX_SCORE, cardPoints, createDailyService, nameKey, resultEmoji, spreadCategories, streaks,
} from '../src/daily/service.js';

// ---------- calendario ----------

test('romeDay: il giorno cambia a mezzanotte di Roma, non di UTC', () => {
  assert.equal(romeDay(Date.parse('2026-10-04T21:59:00Z')), '2026-10-04'); // 23:59 a Roma (UTC+2)
  assert.equal(romeDay(Date.parse('2026-10-04T22:00:00Z')), '2026-10-05'); // 00:00 a Roma
  assert.equal(romeDay(Date.parse('2026-12-31T22:59:00Z')), '2026-12-31'); // inverno, UTC+1
  assert.equal(romeDay(Date.parse('2026-12-31T23:00:00Z')), '2027-01-01');
});

test('nextRomeMidnight: giusto anche nei giorni del cambio d\'ora', () => {
  assert.equal(new Date(nextRomeMidnight(Date.parse('2026-10-04T12:00:00Z'))).toISOString(), '2026-10-04T22:00:00.000Z');
  // 25 ottobre 2026: si torna all'ora solare, la mezzanotte del 26 è alle 23:00 UTC
  assert.equal(new Date(nextRomeMidnight(Date.parse('2026-10-25T12:00:00Z'))).toISOString(), '2026-10-25T23:00:00.000Z');
  // 29 marzo 2026: si passa all'ora legale durante la notte
  assert.equal(new Date(nextRomeMidnight(Date.parse('2026-03-28T12:00:00Z'))).toISOString(), '2026-03-28T23:00:00.000Z');
  assert.equal(new Date(nextRomeMidnight(Date.parse('2026-03-29T12:00:00Z'))).toISOString(), '2026-03-29T22:00:00.000Z');
});

test('dayNumber e addDays', () => {
  assert.equal(dayNumber(DAY_ONE), 1);
  assert.equal(dayNumber(addDays(DAY_ONE, 30)), 31);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('streaks: serie attuale viva fino a ieri, migliore serie storica', () => {
  assert.deepEqual(streaks([], '2026-10-10'), { current: 0, best: 0 });
  assert.deepEqual(streaks(['2026-10-10', '2026-10-09', '2026-10-08', '2026-10-05', '2026-10-04'], '2026-10-10'), { current: 3, best: 3 });
  assert.deepEqual(streaks(['2026-10-09', '2026-10-08'], '2026-10-10'), { current: 2, best: 2 }); // oggi non ancora giocato
  assert.deepEqual(streaks(['2026-10-07', '2026-10-06', '2026-10-05', '2026-10-04'], '2026-10-10'), { current: 0, best: 4 });
});

test('nameKey e punteggi', () => {
  assert.equal(nameKey('  GiuLIA   Rossi '), 'giulia rossi');
  assert.equal(cardPoints(0, 120), 150);
  assert.equal(MAX_SCORE, DAILY_TOTAL * 150);
  assert.equal(resultEmoji({ distance: 0, base: 100 }), '🎯');
  assert.equal(resultEmoji({ distance: 3, base: 90 }), '🟩');
  assert.equal(resultEmoji({ distance: 60, base: 0 }), '🟥');
});

// ---------- servizio su Postgres in memoria ----------

function deck(perCategory = 10) {
  const cards = [];
  for (const { id } of ANNO_CATEGORIES) {
    for (let i = 0; i < perCategory; i++) {
      cards.push({ id: `${id}-${i}`, category: id, title: `${id} ${i}`, subtitle: null, year: 1950 + i, description: 'd', image: null, wikiUrl: 'w' });
    }
  }
  return cards;
}

async function setup(start = '2026-10-04T10:00:00Z') {
  const db = new PGlite();
  const clock = { t: Date.parse(start) };
  const service = createDailyService({ db, deck: deck(), now: () => clock.t });
  await service.init();
  await service.init(); // idempotente
  return { db, clock, service };
}

async function playAll(service, token, pickYear = (card) => card.range.min) {
  let { card } = await service.start(token);
  let last;
  while (card) {
    last = await service.answer(token, card.index, pickYear(card));
    card = last.next;
  }
  return last;
}

test('registrazione: nickname unico senza distinzione di maiuscole, token valido solo per chi lo ha', async () => {
  const { service } = await setup();
  const a = await service.register('Giulia');
  assert.ok(a.token.length >= 30);
  await assert.rejects(service.register('  giulia '), /già preso/);
  await assert.rejects(service.register(''), /nickname/);
  assert.equal((await service.auth(a.token)).name, 'Giulia');
  await assert.rejects(service.auth('token-inventato'), /non riconosciuto/);
});

test('spreadCategories: mai due carte della stessa categoria vicine', () => {
  const cards = ['a', 'a', 'a', 'b', 'b', 'c', 'd', 'e', 'f', 'g'].map((category, i) => ({ category, i }));
  for (let k = 0; k < 20; k++) {
    const out = spreadCategories([...cards].sort(() => Math.random() - 0.5));
    assert.equal(out.length, 10);
    for (let i = 1; i < out.length; i++) assert.notEqual(out[i].category, out[i - 1].category);
  }
});

test('sfida: 10 carte, almeno una per categoria, uguali per tutti e senza anno prima della risposta', async () => {
  const { service } = await setup();
  const a = await service.register('A');
  const b = await service.register('B');
  const sa = await service.start(a.token);
  const sb = await service.start(b.token);
  assert.equal(sa.total, 10);
  assert.deepEqual(sa.card, sb.card);
  assert.ok(!('year' in sa.card) && !JSON.stringify(sa).includes('wikiUrl'));

  const review = [];
  let card = sa.card;
  while (card) {
    const r = await service.answer(a.token, card.index, card.range.min);
    review.push(r.result.category);
    assert.ok(r.next === null || !('year' in r.next));
    card = r.next;
  }
  assert.equal(review.length, DAILY_TOTAL);
  for (const { id } of ANNO_CATEGORIES) {
    const n = review.filter((c) => c === id).length;
    assert.ok(n >= 1 && n <= 2, `${id}: ${n} carte`);
  }
  for (let i = 1; i < review.length; i++) assert.notEqual(review[i], review[i - 1]);
});

test('risposte: ordine obbligato, niente doppioni, anno dentro l\'intervallo, punteggio sommato', async () => {
  const { service, db } = await setup();
  const a = await service.register('A');
  await assert.rejects(service.answer(a.token, 0, 1950), /non iniziata/);
  const { card } = await service.start(a.token);
  // Saltare alla carta 2 con un anno valido per quella carta: rifiutato per l'ordine.
  const { rows } = await db.query('SELECT cards FROM daily_days');
  await assert.rejects(service.answer(a.token, 1, rows[0].cards[1].range.min), /già stata giocata/);
  await assert.rejects(service.answer(a.token, 0, card.range.max + 1), /Anno non valido/);
  await assert.rejects(service.answer(a.token, 0, 'boh'), /Anno non valido/);

  // Doppio invio in parallelo della stessa carta: ne passa uno solo.
  const both = await Promise.allSettled([
    service.answer(a.token, 0, card.range.min),
    service.answer(a.token, 0, card.range.min),
  ]);
  assert.equal(both.filter((r) => r.status === 'fulfilled').length, 1);

  const resumed = await service.start(a.token);
  assert.equal(resumed.index, 1);
});

test('fine sfida: riepilogo, una sola partita in classifica, la rigiocata non conta', async () => {
  const { service } = await setup();
  const a = await service.register('A');
  await assert.rejects(service.review(a.token), /Completa prima/);
  const exact = await playAll(service, a.token, () => null).catch(() => null);
  assert.equal(exact, null); // anno nullo rifiutato

  const { service: s2 } = await setup();
  const p = await s2.register('Perfetto');
  const answers = [];
  // Con la review di un altro giocatore conosciamo gli anni: risposte esatte.
  const spy = await s2.register('Spia');
  await playAll(s2, spy.token);
  const days = (await s2.review(spy.token)).cards;
  const last = await playAll(s2, p.token, (card) => { answers.push(days[card.index].year); return days[card.index].year; });
  assert.equal(last.done, true);
  assert.equal(last.score, MAX_SCORE);
  await assert.rejects(s2.answer(p.token, 9, answers[9]), /già completato/);

  const rev = await s2.review(p.token);
  assert.equal(rev.cards.length, 10);
  assert.ok(rev.cards.every((c) => c.answer.exact && typeof c.year === 'number'));
  const today = await s2.today(p.token);
  assert.equal(today.me.status, 'done');
  assert.equal(today.me.score, MAX_SCORE);
});

test('classifiche: oggi e di sempre, pari merito con lo stesso posto, la mia riga', async () => {
  const { service, clock } = await setup();
  const a = await service.register('Anna');
  const b = await service.register('Bruno');
  const c = await service.register('Carla');
  await playAll(service, a.token, (card) => card.range.min);
  await playAll(service, b.token, (card) => card.range.min);
  await playAll(service, c.token, (card) => card.range.max);
  await service.start((await service.register('Dario')).token); // a metà: non in classifica

  const today = await service.leaderboard('today', a.token);
  assert.equal(today.players, 3);
  assert.equal(today.rows.length, 3);
  const anna = today.rows.find((r) => r.name === 'Anna');
  const bruno = today.rows.find((r) => r.name === 'Bruno');
  assert.equal(anna.rank, bruno.rank); // stesse risposte, stesso posto
  assert.equal(anna.me, true);
  assert.equal(today.me.rank, anna.rank);

  // Giorno dopo: gioca solo Carla, la classifica di sempre somma.
  clock.t += 86_400_000;
  await playAll(service, c.token, (card) => card.range.max);
  const all = await service.leaderboard('all', c.token);
  const carla = all.rows.find((r) => r.name === 'Carla');
  assert.equal(carla.days, 2);
  assert.equal(all.me.score, carla.score);
  const newToday = await service.leaderboard('today');
  assert.equal(newToday.players, 1);
  assert.equal(newToday.me, null);
});

test('giorni diversi: carte nuove ogni giorno, stabili nello stesso giorno', async () => {
  const { service, clock } = await setup();
  const a = await service.register('A');
  const seen = new Set();
  for (let d = 0; d < 3; d++) {
    await playAll(service, a.token);
    const rev = await service.review(a.token);
    const again = await service.review(a.token);
    assert.deepEqual(rev.cards.map((c) => c.title), again.cards.map((c) => c.title));
    for (const c of rev.cards) {
      assert.ok(!seen.has(c.title), `carta ripetuta: ${c.title}`);
      seen.add(c.title);
    }
    clock.t += 86_400_000;
  }
});

test('statistiche: giorni, serie, migliore e media', async () => {
  const { service, clock } = await setup();
  const a = await service.register('A');
  const scores = [];
  for (const skip of [false, false, true, false]) {
    if (!skip) scores.push((await playAll(service, a.token)).score);
    clock.t += 86_400_000;
  }
  clock.t -= 86_400_000; // oggi = ultimo giorno giocato
  const s = await service.stats(a.token);
  assert.equal(s.daysPlayed, 3);
  assert.equal(s.currentStreak, 1);
  assert.equal(s.bestStreak, 2);
  assert.equal(s.bestScore, Math.max(...scores));
  assert.equal(s.total, scores.reduce((x, y) => x + y, 0));
  assert.equal(s.history.length, 3);
});
