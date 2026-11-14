import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { createDailyService } from '../src/daily/service.js';
import {
  ABISSO_ANSWER_MS, ABISSO_MAX_DEPTH, ABISSO_TOTAL,
  createAbissoService, expectedShare, loadAbissoPrompts, normalizeAnswer, tierForShare,
} from '../src/abisso/service.js';

const TEST_ANSWERS = [
  'Comune', { answer: 'Rara', aliases: ['Eccezionale'] }, 'Alternativa', 'Quarta',
  'Quinta', 'Sesta', 'Settima', 'Ottava', 'Nona', 'Decima',
  'Undicesima', 'Dodicesima', 'Tredicesima', 'Quattordicesima', 'Quindicesima', 'Estrema',
];
const TEST_PROMPTS = Array.from({ length: 14 }, (_, i) => ({
  id: `domanda-${i}`,
  question: `Domanda di prova ${i}`,
  answers: TEST_ANSWERS,
}));

async function setup(start = '2026-10-04T10:00:00Z', prompts = TEST_PROMPTS) {
  const db = new PGlite();
  const clock = { t: Date.parse(start) };
  const daily = createDailyService({ db, deck: [], now: () => clock.t });
  await daily.init();
  const service = createAbissoService({ db, prompts, auth: daily.auth, now: () => clock.t, rng: () => 0.42 });
  await service.init();
  await service.init();
  return { db, clock, daily, service };
}

async function playAll(service, token, pick = () => 'Estrema') {
  let state = await service.start(token);
  let last = null;
  while (!state.done) {
    last = await service.answer(token, state.prompt.index, pick(state.prompt));
    if (last.done) return last;
    state = await service.start(token);
  }
  return last;
}

test('normalizzazione, classificatore e fasce di rarità', () => {
  assert.equal(normalizeAnswer('  Ècçèzionale!!! '), 'eccezionale');
  assert.equal(normalizeAnswer('Risposta   con spazi'), 'risposta con spazi');
  assert.equal(tierForShare(0.8).points, 10);
  assert.equal(tierForShare(0.25).points, 15);
  assert.equal(tierForShare(0.15).points, 30);
  assert.equal(tierForShare(0.05).points, 60);
  assert.equal(tierForShare(0.02).points, 85);
  assert.equal(tierForShare(0.01).points, 100);
  const shares = TEST_ANSWERS.map((_, index) => expectedShare(TEST_PROMPTS[0], index));
  assert.ok(Math.abs(shares.reduce((sum, share) => sum + share, 0) - 1) < 1e-10);
  assert.equal(tierForShare(shares[0]).points, 10);
  assert.equal(tierForShare(shares[1]).points, 15);
  assert.equal(tierForShare(shares.at(-1)).points, 100);
});

test('il mazzo reale è valido e contiene 42 domande', () => {
  const path = fileURLToPath(new URL('../data/abisso/prompts.json', import.meta.url));
  const prompts = loadAbissoPrompts(path);
  assert.equal(prompts.length, 42);
  assert.ok(prompts.every((prompt) => prompt.answers.length >= 10));
});

test('le sette domande sono uguali per tutti, senza risposte o alias esposti', async () => {
  const { daily, service } = await setup();
  const a = await daily.register('Anna');
  const b = await daily.register('Bruno');
  const sa = await service.start(a.token);
  const sb = await service.start(b.token);
  assert.equal(sa.total, ABISSO_TOTAL);
  assert.equal(sa.maxDepth, ABISSO_MAX_DEPTH);
  assert.equal(sa.prompt.question, sb.prompt.question);
  assert.ok(!JSON.stringify(sa.prompt).includes('Comune'));
  assert.ok(!JSON.stringify(sa.prompt).includes('Eccezionale'));
  assert.ok(sa.prompt.deadline > Date.parse('2026-10-04T10:00:00Z'));
});

test('alias, doppio invio e ripresa mantengono indice e scadenza', async () => {
  const { daily, service } = await setup();
  const player = await daily.register('Carla');
  const first = await service.start(player.token);
  await assert.rejects(service.answer(player.token, 0, 'Non valida'), /Prova un’altra risposta/);
  const resumedBefore = await service.start(player.token);
  assert.equal(resumedBefore.prompt.deadline, first.prompt.deadline);

  const both = await Promise.allSettled([
    service.answer(player.token, 0, '  ECCEZIONALE! '),
    service.answer(player.token, 0, 'Rara'),
  ]);
  assert.equal(both.filter((result) => result.status === 'fulfilled').length, 1);
  const accepted = both.find((result) => result.status === 'fulfilled').value;
  assert.equal(accepted.result.answer, 'Rara');
  assert.equal(accepted.result.points, 15);

  const resumed = await service.start(player.token);
  assert.equal(resumed.prompt.index, 1);
  assert.equal(resumed.depth, 150);
});

test('il tempo non si azzera ricaricando e una risposta in ritardo vale zero', async () => {
  const { clock, daily, service } = await setup();
  const player = await daily.register('Dario');
  const first = await service.start(player.token);
  clock.t += 5000;
  const resumed = await service.start(player.token);
  assert.equal(resumed.prompt.deadline, first.prompt.deadline);
  clock.t += ABISSO_ANSWER_MS;
  const expired = await service.answer(player.token, 0, 'Rara');
  assert.equal(expired.result.points, 0);
  assert.equal(expired.result.label, 'Tempo scaduto');
  const second = await service.start(player.token);
  assert.equal(second.prompt.index, 1);
  assert.equal(second.prompt.deadline, clock.t + ABISSO_ANSWER_MS);
});

test('il classificatore funziona da solo e le risposte reali correggono la stima', async () => {
  const { daily, service } = await setup();
  const a = await daily.register('A');
  const b = await daily.register('B');
  const c = await daily.register('C');
  await service.start(a.token);
  await service.start(b.token);
  await service.start(c.token);
  const first = await service.answer(a.token, 0, 'Comune');
  const second = await service.answer(b.token, 0, 'Comune');
  const third = await service.answer(c.token, 0, 'Estrema');
  assert.equal(first.result.points, 10);
  assert.equal(first.result.count, 1);
  assert.equal(second.result.count, 2);
  assert.equal(second.result.percentage, 100);
  assert.equal(second.result.points, 10);
  assert.equal(third.result.answer, 'Estrema');
  assert.equal(third.result.count, 1);
  assert.equal(third.result.points, 100);
});

test('sette risposte completano la sfida una volta sola e aprono il riepilogo', async () => {
  const { daily, service } = await setup();
  const player = await daily.register('Perfetta');
  await assert.rejects(service.review(player.token), /Completa prima/);
  const last = await playAll(service, player.token);
  assert.equal(last.done, true);
  assert.equal(last.depth, ABISSO_MAX_DEPTH);
  await assert.rejects(service.answer(player.token, 6, 'Rara'), /già completato/);

  const review = await service.review(player.token);
  assert.equal(review.prompts.length, ABISSO_TOTAL);
  assert.equal(review.depth, ABISSO_MAX_DEPTH);
  assert.ok(review.prompts.every((prompt) => prompt.answer.points === 100));
  const today = await service.today(player.token);
  assert.equal(today.me.status, 'done');
  assert.equal(today.me.depth, ABISSO_MAX_DEPTH);
});

test('classifiche e statistiche includono solo immersioni completate', async () => {
  const { clock, daily, service } = await setup();
  const a = await daily.register('Anna');
  const b = await daily.register('Bruno');
  await playAll(service, a.token);
  await playAll(service, b.token, () => 'Comune');
  await service.start((await daily.register('A metà')).token);

  const board = await service.leaderboard('today', a.token);
  assert.equal(board.players, 2);
  assert.equal(board.rows.length, 2);
  assert.equal(board.rows.find((row) => row.name === 'Anna').rank, 1);
  assert.equal(board.me.depth, ABISSO_MAX_DEPTH);

  clock.t += 86_400_000;
  await playAll(service, a.token);
  const allTime = await service.leaderboard('all', a.token);
  assert.equal(allTime.rows.find((row) => row.name === 'Anna').days, 2);
  const stats = await service.stats(a.token);
  assert.equal(stats.daysPlayed, 2);
  assert.equal(stats.currentStreak, 2);
  assert.equal(stats.bestStreak, 2);
  assert.equal(stats.bestDepth, ABISSO_MAX_DEPTH);
  assert.equal(stats.rareAnswers, 14);
});

test('il mazzo non ripete domande finché ci sono domande nuove', async () => {
  const { clock, daily, service } = await setup();
  const player = await daily.register('Esploratore');
  await playAll(service, player.token);
  const first = (await service.review(player.token)).prompts.map((prompt) => prompt.question);
  clock.t += 86_400_000;
  await playAll(service, player.token);
  const second = (await service.review(player.token)).prompts.map((prompt) => prompt.question);
  assert.equal(new Set([...first, ...second]).size, 14);
});
