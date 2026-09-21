import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRounds, clampSettings, dedupeTracks, generateCode, normalizeTitle, sanitizeName, scoreAnswer, CODE_CHARS,
} from '../src/engine.js';

function makeTracks(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1, title: `Brano ${i + 1}`, artist: 'Artista', previewUrl: `https://cdn/${i + 1}.mp3`,
  }));
}

// rng deterministico (LCG) per test riproducibili
function seeded(seed = 42) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

test('generateCode usa solo caratteri non ambigui', () => {
  const code = generateCode(4, seeded());
  assert.equal(code.length, 4);
  for (const ch of code) assert.ok(CODE_CHARS.includes(ch));
});

test('clampSettings riporta nei limiti e ha default sensati', () => {
  assert.deepEqual(clampSettings({}), { maxRounds: 5, roundMs: 15000, prepMs: 3000 });
  assert.deepEqual(clampSettings({ maxRounds: 99, roundMs: 100, prepMs: 'x' }), { maxRounds: 20, roundMs: 5000, prepMs: 3000 });
});

test('sanitizeName pulisce e rifiuta il vuoto', () => {
  assert.equal(sanitizeName('  Marco   Rossi  '), 'Marco Rossi');
  assert.equal(sanitizeName('a'.repeat(50)).length, 20);
  assert.throws(() => sanitizeName('   '), /nickname/);
});

test('normalizeTitle unifica remix, feat e punteggiatura', () => {
  assert.equal(normalizeTitle('Shape of You (feat. X)'), normalizeTitle('Shape Of You'));
  assert.equal(normalizeTitle('Bohemian Rhapsody - Remastered 2011'), normalizeTitle('Bohemian Rhapsody'));
  assert.notEqual(normalizeTitle('Hello'), normalizeTitle('Help'));
});

test('dedupeTracks scarta duplicati e tracce senza preview', () => {
  const tracks = [
    ...makeTracks(3),
    { id: 9, title: 'Brano 1 (Live)', artist: 'A', previewUrl: 'x' },
    { id: 10, title: 'Senza preview', artist: 'A', previewUrl: null },
  ];
  assert.equal(dedupeTracks(tracks).length, 3);
});

test('buildRounds: nessuna canzone ripetuta, 4 opzioni distinte, indice corretto', () => {
  const rounds = buildRounds(makeTracks(10), 8, seeded(7));
  assert.equal(rounds.length, 8);
  const ids = rounds.map((r) => r.track.id);
  assert.equal(new Set(ids).size, ids.length, 'tracce ripetute');
  for (const r of rounds) {
    assert.equal(r.options.length, 4);
    assert.equal(new Set(r.options).size, 4, 'opzioni duplicate');
    assert.equal(r.options[r.correctIndex], r.track.title);
  }
});

test('buildRounds limita i round alle tracce disponibili e rifiuta playlist troppo piccole', () => {
  assert.equal(buildRounds(makeTracks(5), 20, seeded()).length, 5);
  assert.throws(() => buildRounds(makeTracks(3), 5, seeded()), /meno di 4/);
});

test('scoreAnswer: 100 istantanea, 50 a fine round, mai fuori range', () => {
  assert.equal(scoreAnswer(0, 15000), 100);
  assert.equal(scoreAnswer(15000, 15000), 50);
  assert.equal(scoreAnswer(7500, 15000), 75);
  assert.equal(scoreAnswer(999999, 15000), 50);
  assert.equal(scoreAnswer(-100, 15000), 100);
});
