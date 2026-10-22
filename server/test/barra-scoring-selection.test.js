import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePoints, speedBonus, BASE_POINTS, MAX_SPEED_BONUS } from '../src/barra/scoring.js';
import { pickChallenge } from '../src/barra/selection.js';
import { seededRng } from './barra-helpers.js';

test('100 punti per risposta corretta, 0 per errata', () => {
  const base = { receivedAt: 5000, answerOpenAt: 0, answerMs: 15000 };
  assert.deepEqual(computePoints({ ...base, correct: true, speedBonusEnabled: false }), { points: 100, bonus: 0 });
  assert.deepEqual(computePoints({ ...base, correct: false, speedBonusEnabled: true }), { points: 0, bonus: 0 });
});

test('bonus velocità a scaglioni, massimo 20, calcolato sul tempo server', () => {
  const ms = 16000;
  assert.equal(speedBonus(0, 0, ms), 20);
  assert.equal(speedBonus(3999, 0, ms), 20);
  assert.equal(speedBonus(4001, 0, ms), 15);
  assert.equal(speedBonus(8001, 0, ms), 10);
  assert.equal(speedBonus(15999, 0, ms), 5);
  assert.equal(speedBonus(30000, 0, ms), 5);   // oltre la finestra (tolleranza): minimo
  assert.equal(speedBonus(-500, 0, ms), 20);   // prima dell'apertura (tolleranza orologi)
  // differenze di millisecondi nello stesso scaglione non cambiano nulla
  assert.equal(speedBonus(100, 0, ms), speedBonus(3900, 0, ms));
  const max = computePoints({ correct: true, receivedAt: 0, answerOpenAt: 0, answerMs: ms, speedBonusEnabled: true });
  assert.equal(max.points, BASE_POINTS + MAX_SPEED_BONUS);
  assert.ok(MAX_SPEED_BONUS < BASE_POINTS);
});

test('selezione: nessun brano ripetuto finché il catalogo lo consente', () => {
  const candidates = [];
  for (let s = 0; s < 5; s++) for (let c = 0; c < 3; c++) candidates.push({ id: `c${s}-${c}`, songId: `s${s}` });
  const rng = seededRng(7);
  const history = [];
  for (let i = 0; i < 5; i++) {
    const p = pickChallenge(candidates, history, new Set(), rng);
    assert.ok(!history.some((h) => h.songId === p.songId), 'brano ripetuto troppo presto');
    history.push({ challengeId: p.id, songId: p.songId });
  }
  // Catalogo esaurito per brani: si ripete un brano ma con una sfida nuova
  const p6 = pickChallenge(candidates, history, new Set(), rng);
  assert.ok(!history.some((h) => h.challengeId === p6.id));
});

test('selezione: esclusioni rispettate, null se non resta nulla', () => {
  const candidates = [{ id: 'a', songId: 's1' }, { id: 'b', songId: 's2' }];
  assert.equal(pickChallenge(candidates, [], new Set(['a']), seededRng()).id, 'b');
  assert.equal(pickChallenge(candidates, [], new Set(['a', 'b']), seededRng()), null);
  assert.equal(pickChallenge([], [], new Set(), seededRng()), null);
});

test('selezione: brano scelto uniformemente, non pesato per numero di sfide', () => {
  const candidates = [{ id: 'x', songId: 'solo' }];
  for (let i = 0; i < 20; i++) candidates.push({ id: `m${i}`, songId: 'molte' });
  const rng = seededRng(3);
  let solo = 0;
  for (let i = 0; i < 2000; i++) if (pickChallenge(candidates, [], new Set(), rng).songId === 'solo') solo++;
  assert.ok(solo > 800 && solo < 1200, `atteso ~50%, ottenuto ${solo / 20}%`);
});

test('selezione: casualità effettiva sui candidati', () => {
  const candidates = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, songId: `s${i}` }));
  const rng = seededRng(11);
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(pickChallenge(candidates, [], new Set(), rng).id);
  assert.equal(seen.size, 10);
});
