import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import {
  baseTitle, chooseSyncedChallenge, collectVideos, featuredArtists, mainArtist, parseTop500,
} from '../src/barra/import.js';
import { createCatalog } from '../src/barra/catalog.js';

test('importazione: legge tutte le righe e decodifica i caratteri HTML', () => {
  const html = `<table><tr><td>1</td><td>BABY K FEAT. GIUSY FERRERI</td><td>Roma &ndash; Bangkok</td></tr>
    <tr><td>2</td><td>FRANCESCO GABBANI</td><td>Occidentali&rsquo;s Karma</td></tr></table>`;
  const rows = parseTop500(html);
  assert.equal(rows.length, 2);
  assert.equal(rows[1].title, 'Occidentali’s Karma');
  assert.equal(mainArtist(rows[0].artist), 'BABY K');
  assert.deepEqual(featuredArtists(rows[0].artist), ['GIUSY FERRERI']);
  assert.equal(baseTitle('Roma - Bangkok (Lyric Video) ft. Lali'), 'Roma - Bangkok (Lyric Video)');
  assert.equal(baseTitle('Roma - Bangkok ft. Lali'), 'Roma - Bangkok');
});

test('importazione: estrae video annidati e sceglie un verso con due versi di contesto', () => {
  const videos = collectVideos({ contents: [{ videoRenderer: { videoId: 'dQw4w9WgXcQ', title: { runs: [{ text: 'Titolo' }] }, lengthText: { simpleText: '3:42' } } }] });
  assert.deepEqual(videos[0], { videoId: 'dQw4w9WgXcQ', title: 'Titolo', channel: '', durationSec: 222 });
  const lyrics = '[00:05.00] Primo verso\n[00:10.00] Secondo verso\n[00:15.50] Risposta giusta\n[00:20.00] Dopo\n[03:30.00] Fuori durata';
  assert.deepEqual(chooseSyncedChallenge(lyrics, 30), { startMs: 5000, stopMs: 15500, answer: 'Risposta giusta' });
  assert.equal(chooseSyncedChallenge('[00:01.00] Troppo poco', 30), null);
});

test('catalogo iniziale: sfide pubblicate, filtri e seconda importazione senza duplicati', async () => {
  const db = new PGlite();
  const catalog = createCatalog({ db });
  await catalog.init();
  const entries = [1, 2].map((rank) => ({
    rank, title: `Brano ${rank}`, artist: 'Artista importato', audioRef: 'dQw4w9WgXcQ',
    startMs: 10000, stopMs: 18000, answer: `Risposta ${rank}`, acceptedVariants: [], difficulty: 1,
    songId: randomUUID(), challengeId: randomUUID(), lyricsId: rank,
    sourceNotes: 'Fonte di prova', rightsNotes: 'Prova', videoTitle: `Video ${rank}`,
  }));
  assert.deepEqual(await catalog.seed(entries), { songs: 2, unchanged: false });
  assert.deepEqual(await catalog.seed(entries), { songs: 2, unchanged: true });
  assert.equal((await catalog.listCandidates()).length, 2);
  const all = await catalog.loadAll();
  assert.equal(all.songs.length, 2);
  assert.equal(all.collections.length, 1);
  assert.ok(all.challenges.every((challenge) => challenge.is_verified && challenge.is_published));
  const options = await catalog.filterOptions();
  assert.equal(options.collections[0].songs, 2);
  assert.equal(options.artists[0].songs, 2);
  await db.close();
});

test('catalogo reale: 500 sfide complete, uniche e compatibili con i video', async () => {
  const { readFile } = await import('node:fs/promises');
  const entries = JSON.parse(await readFile(new URL('../data/barra/top500.json', import.meta.url), 'utf8'));
  assert.equal(entries.length, 500);
  assert.equal(new Set(entries.map((entry) => entry.rank)).size, 500);
  assert.equal(new Set(entries.map((entry) => entry.songId)).size, 500);
  assert.equal(new Set(entries.map((entry) => entry.challengeId)).size, 500);
  assert.equal(new Set(entries.map((entry) => entry.audioRef)).size, 500);
  for (const entry of entries) {
    assert.match(entry.audioRef, /^[\w-]{11}$/);
    assert.ok(Number.isInteger(entry.lyricsId) && entry.lyricsId > 0);
    assert.ok(Number.isInteger(entry.startMs) && entry.startMs >= 0);
    assert.ok(Number.isInteger(entry.stopMs) && entry.stopMs - entry.startMs >= 3500);
    assert.ok(entry.stopMs - entry.startMs <= 25000);
    assert.ok(entry.stopMs <= (entry.videoDuration - 1) * 1000);
    assert.ok(entry.answer.trim().length >= 5 && entry.answer.length <= 200);
  }
});
