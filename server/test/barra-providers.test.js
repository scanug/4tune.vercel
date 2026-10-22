import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProviders, parseYouTubeId } from '../src/barra/providers.js';
import { createMusixmatch, parseLrc } from '../src/barra/musixmatch.js';

function fakeFetch(handler) {
  return async (url) => {
    const r = await handler(String(url));
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => r.body,
    };
  };
}

test('parseYouTubeId accetta ID e link comuni, rifiuta il resto', () => {
  const id = 'dQw4w9WgXcQ';
  for (const s of [id, `https://www.youtube.com/watch?v=${id}&t=30s`, `https://youtu.be/${id}?si=x`,
    `https://m.youtube.com/watch?v=${id}`, `https://music.youtube.com/watch?v=${id}`,
    `https://www.youtube.com/embed/${id}`, `https://youtube.com/shorts/${id}`, `youtu.be/${id}`]) {
    assert.equal(parseYouTubeId(s), id, s);
  }
  for (const s of ['', 'ciao', 'https://vimeo.com/123', 'https://www.youtube.com/watch?v=short', null]) {
    assert.equal(parseYouTubeId(s), null, String(s));
  }
});

test('YouTube: video rimosso o non incorporabile -> errore di contenuto', async () => {
  const song = { audio_provider: 'youtube', audio_ref: 'dQw4w9WgXcQ' };
  const ch = { start_ms: 1000, stop_ms: 5000 };
  for (const [status, reason] of [[404, /rimosso/], [401, /Incorporamento/]]) {
    const p = createProviders({ fetch: fakeFetch(() => ({ status, body: {} })) });
    const r = await p.resolvePlayback(song, ch);
    assert.equal(r.ok, false);
    assert.equal(r.contentError, true);
    assert.match(r.reason, reason);
  }
  const ok = createProviders({ fetch: fakeFetch(() => ({ status: 200, body: { title: 'T', author_name: 'A' } })) });
  const r = await ok.resolvePlayback(song, ch);
  assert.deepEqual(r.playback, { provider: 'youtube', videoId: 'dQw4w9WgXcQ', startMs: 1000, stopMs: 5000 });
});

test('YouTube: verifica non raggiungibile non blocca (decide il player)', async () => {
  const p = createProviders({ fetch: async () => { throw new Error('rete'); } });
  const r = await p.resolvePlayback({ audio_provider: 'youtube', audio_ref: 'dQw4w9WgXcQ' }, { start_ms: 0, stop_ms: 2000 });
  assert.equal(r.ok, true);
});

test('Deezer: tempi oltre la preview e tracce senza preview rifiutati', async () => {
  const p = createProviders({ fetch: fakeFetch(() => ({ status: 200, body: { id: 1, title: 'x', preview: '' } })) });
  const song = { audio_provider: 'deezer', audio_ref: '123' };
  const over = await p.resolvePlayback(song, { start_ms: 25000, stop_ms: 32000 });
  assert.equal(over.ok, false);
  assert.match(over.reason, /30s/);
  const noPreview = await p.resolvePlayback(song, { start_ms: 1000, stop_ms: 5000 });
  assert.equal(noPreview.contentError, true);

  const err = createProviders({ fetch: fakeFetch(() => ({ status: 200, body: { error: { message: 'no data' } } })) });
  assert.equal((await err.resolvePlayback(song, { start_ms: 0, stop_ms: 3000 })).contentError, true);

  const good = createProviders({ fetch: fakeFetch(() => ({ status: 200, body: { id: 1, preview: 'https://cdn/x.mp3' } })) });
  const r = await good.resolvePlayback(song, { start_ms: 1000, stop_ms: 5000 });
  assert.equal(r.playback.previewUrl, 'https://cdn/x.mp3');
});

test('Musixmatch senza chiave: predisposta ma non attiva, nessuna chiamata', async () => {
  let called = false;
  const mxm = createMusixmatch({ apiKey: '', fetch: async () => { called = true; } });
  const s = await mxm.status();
  assert.equal(s.configured, false);
  assert.equal(s.active, false);
  await assert.rejects(mxm.searchTracks({ track: 'x' }), /non configurata/);
  assert.equal(called, false);
});

test('Musixmatch con chiave rifiutata: configurata ma non attiva', async () => {
  const mxm = createMusixmatch({
    apiKey: 'k', fetch: fakeFetch(() => ({ status: 200, body: { message: { header: { status_code: 401 }, body: '' } } })),
  });
  const s = await mxm.status();
  assert.equal(s.configured, true);
  assert.equal(s.active, false);
});

test('Musixmatch: la chiave è passata solo come parametro della richiesta server', async () => {
  let seen;
  const mxm = createMusixmatch({
    apiKey: 'SEGRETA', fetch: fakeFetch((url) => {
      seen = url;
      return { status: 200, body: { message: { header: { status_code: 200 }, body: { track_list: [{ track: { track_id: 5, track_name: 'T', artist_name: 'A', has_subtitles: 1 } }] } } } };
    }),
  });
  const res = await mxm.searchTracks({ track: 'T', artist: 'A' });
  assert.match(seen, /apikey=SEGRETA/);
  assert.equal(res[0].trackId, 5);
  assert.equal(res[0].hasSubtitles, true);
  assert.doesNotMatch(JSON.stringify(res), /SEGRETA/);
});

test('parseLrc', () => {
  const lines = parseLrc('[00:12.50] prima riga\n[01:02.00] seconda\nspazzatura\n[00:05.1]x');
  assert.deepEqual(lines, [
    { timeMs: 12500, text: 'prima riga' },
    { timeMs: 62000, text: 'seconda' },
    { timeMs: 5100, text: 'x' },
  ]);
});
