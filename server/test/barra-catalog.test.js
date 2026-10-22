import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { createCatalog } from '../src/barra/catalog.js';
import { createBarraRoutes } from '../src/barra/http.js';

// Un solo database per tutto il file (avviare PGlite costa): si svuota a ogni test.
let shared = null;
async function setup() {
  if (!shared) {
    const db = new PGlite();
    await db.waitReady;
    const catalog = createCatalog({ db });
    await catalog.init();
    await catalog.init(); // idempotente
    shared = { db, catalog };
  }
  await shared.db.exec('TRUNCATE barra_challenges, barra_song_collections, barra_songs, barra_collections, barra_genres, barra_artists CASCADE');
  return shared;
}

// Un brano pubblicato con una sfida verificata e pubblicata
async function seed(catalog, { title = 'Brano', artist = 'Artista', genre, collection } = {}) {
  await catalog.saveNamed('artist', { name: artist });
  let all = await catalog.loadAll();
  const artistId = all.artists.find((a) => a.name === artist).id;
  let genreId = null;
  let collectionIds = [];
  if (genre) {
    await catalog.saveNamed('genre', { name: genre }).catch(() => {});
    all = await catalog.loadAll();
    genreId = all.genres.find((g) => g.name === genre).id;
  }
  if (collection) {
    await catalog.saveNamed('collection', { name: collection }).catch(() => {});
    all = await catalog.loadAll();
    collectionIds = [all.collections.find((c) => c.name === collection).id];
  }
  const songId = await catalog.saveSong({
    title, artist_id: artistId, genre_id: genreId, collection_ids: collectionIds,
    audio_provider: 'youtube', audio_ref: 'https://youtu.be/dQw4w9WgXcQ',
    rights_notes: 'Test', is_published: true, tags: ['rap'],
  });
  const challengeId = await catalog.saveChallenge({
    song_id: songId, start_ms: 10000, stop_ms: 18000, answer: 'SEGRETO risposta', accepted_variants: ['VARIANTE'],
  });
  await catalog.verifyChallenge({ id: challengeId, verified: true });
  await catalog.publishChallenge({ id: challengeId, published: true });
  return { songId, challengeId, artistId, genreId, collectionIds };
}

test('catalogo: il link YouTube viene ridotto all\'ID e la sfida pubblicata è giocabile', async () => {
  const { catalog } = await setup();
  const { songId, challengeId } = await seed(catalog);
  const song = await catalog.getSong(songId);
  assert.equal(song.audio_ref, 'dQw4w9WgXcQ');
  assert.deepEqual(song.tags, ['rap']);
  assert.deepEqual(await catalog.listCandidates({}), [{ id: challengeId, songId }]);
  const full = await catalog.getChallenge(challengeId);
  assert.equal(full.challenge.answer, 'SEGRETO risposta');
  assert.deepEqual(full.challenge.accepted_variants, ['VARIANTE']);
  assert.equal(full.song.artist_name, 'Artista');
});

test('catalogo: solo sfide verificate e pubblicate di brani pubblicati e disponibili', async () => {
  const { catalog } = await setup();
  const { songId, challengeId } = await seed(catalog);

  // Una sfida non verificata non si può pubblicare
  const draft = await catalog.saveChallenge({ song_id: songId, start_ms: 30000, stop_ms: 35000, answer: 'altra' });
  await assert.rejects(catalog.publishChallenge({ id: draft, published: true }), /verificate/);
  assert.equal((await catalog.listCandidates({})).length, 1);

  // Modificare tempi o risposta toglie verifica e pubblicazione
  await catalog.saveChallenge({ id: challengeId, song_id: songId, start_ms: 11000, stop_ms: 18000, answer: 'SEGRETO risposta', accepted_variants: ['VARIANTE'] });
  assert.equal((await catalog.listCandidates({})).length, 0);
  await catalog.verifyChallenge({ id: challengeId, verified: true });
  await catalog.publishChallenge({ id: challengeId, published: true });

  // Cambiare solo la nota interna non la toglie
  await catalog.saveChallenge({ id: challengeId, song_id: songId, start_ms: 11000, stop_ms: 18000, answer: 'SEGRETO risposta', accepted_variants: ['VARIANTE'], internal_note: 'ok' });
  assert.equal((await catalog.listCandidates({})).length, 1);

  // Brano segnato non disponibile: fuori dal gioco
  await catalog.reportSongError(songId, 'Video rimosso', true);
  assert.equal((await catalog.listCandidates({})).length, 0);
  assert.equal((await catalog.getSong(songId)).playback_error_count, 1);
});

test('catalogo: regole di pubblicazione e validazione', async () => {
  const { catalog } = await setup();
  await catalog.saveNamed('artist', { name: 'X' });
  const artistId = (await catalog.loadAll()).artists[0].id;
  await assert.rejects(catalog.saveSong({ title: 'T', artist_id: artistId, is_published: true, rights_notes: 'ok' }), /contenuto audio/);
  await assert.rejects(catalog.saveSong({ title: 'T', artist_id: artistId, audio_ref: 'dQw4w9WgXcQ', is_published: true }), /autorizzazione/);
  await assert.rejects(catalog.saveSong({ title: 'T', artist_id: artistId, audio_ref: 'https://vimeo.com/12345' }), /YouTube/);
  await assert.rejects(catalog.saveNamed('artist', { name: ' x ' }), /già/);

  const deezerSong = await catalog.saveSong({ title: 'D', artist_id: artistId, audio_provider: 'deezer', audio_ref: '123' });
  await assert.rejects(catalog.saveChallenge({ song_id: deezerSong, start_ms: 25000, stop_ms: 31000, answer: 'a' }), /30s/);
  await assert.rejects(catalog.saveChallenge({ song_id: deezerSong, start_ms: 1000, stop_ms: 1500, answer: 'a' }), /1s/);
  await assert.rejects(catalog.deleteNamed('artist', { id: artistId }), /in uso/);
});

test('catalogo: filtri per artista, genere e raccolta (si sommano)', async () => {
  const { catalog } = await setup();
  const a = await seed(catalog, { title: 'A', artist: 'Tiziano Ferro', genre: 'Pop italiano', collection: 'Anni 2000' });
  const b = await seed(catalog, { title: 'B', artist: 'Fabri Fibra', genre: 'Rap' });
  assert.equal((await catalog.listCandidates({})).length, 2);
  assert.deepEqual((await catalog.listCandidates({ genreIds: [b.genreId] })).map((c) => c.songId), [b.songId]);
  assert.deepEqual((await catalog.listCandidates({ collectionIds: a.collectionIds })).map((c) => c.songId), [a.songId]);
  assert.equal((await catalog.listCandidates({ artistIds: [a.artistId], genreIds: [b.genreId] })).length, 2);

  const options = await catalog.filterOptions();
  assert.deepEqual(options.artists.map((x) => [x.name, x.songs]), [['Fabri Fibra', 1], ['Tiziano Ferro', 1]]);
  assert.deepEqual(options.collections.map((x) => x.name), ['Anni 2000']);
});

function req(method, headers = {}) {
  return { method, headers, socket: { remoteAddress: '1.2.3.4' } };
}

test('http: la rotta pubblica non espone soluzioni; la gestione richiede ADMIN_TOKEN', async () => {
  const { catalog } = await setup();
  await seed(catalog);
  const musixmatch = { status: async () => ({ configured: false, active: false, message: 'Predisposta' }) };
  const routes = createBarraRoutes({ getCatalog: () => catalog, providers: {}, musixmatch, adminToken: 'segreto-admin' });

  const pub = await routes(req('GET'), new URL('http://x/barra/catalog'), null);
  assert.equal(pub.status, 200);
  assert.equal(pub.payload.summary.challenges, 1);
  assert.doesNotMatch(JSON.stringify(pub.payload), /SEGRETO|VARIANTE|start_ms/);

  const noAuth = await routes(req('GET'), new URL('http://x/barra/admin/catalog'), null);
  assert.equal(noAuth.status, 401);
  const wrong = await routes(req('GET', { authorization: 'Bearer sbagliato' }), new URL('http://x/barra/admin/catalog'), null);
  assert.equal(wrong.status, 401);
  const ok = await routes(req('GET', { authorization: 'Bearer segreto-admin' }), new URL('http://x/barra/admin/catalog'), null);
  assert.equal(ok.status, 200);
  assert.equal(ok.payload.challenges[0].answer, 'SEGRETO risposta');
  assert.equal(ok.payload.integrations.musixmatch.active, false);

  const disabled = createBarraRoutes({ getCatalog: () => catalog, providers: {}, musixmatch, adminToken: '' });
  assert.equal((await disabled(req('GET', { authorization: 'Bearer x' }), new URL('http://x/barra/admin/catalog'), null)).status, 503);
});

test('http: troppi tentativi sbagliati bloccano temporaneamente', async () => {
  const { catalog } = await setup();
  const routes = createBarraRoutes({ getCatalog: () => catalog, providers: {}, musixmatch: { status: async () => ({}) }, adminToken: 'giusto' });
  for (let i = 0; i < 10; i++) {
    assert.equal((await routes(req('GET', { authorization: 'Bearer no' }), new URL('http://x/barra/admin/catalog'), null)).status, 401);
  }
  const blocked = await routes(req('GET', { authorization: 'Bearer giusto' }), new URL('http://x/barra/admin/catalog'), null);
  assert.equal(blocked.status, 429);
});

test('http: catalogo assente → 503 senza crash', async () => {
  const routes = createBarraRoutes({ getCatalog: () => null, providers: {}, musixmatch: { status: async () => ({}) }, adminToken: 't' });
  assert.equal((await routes(req('GET'), new URL('http://x/barra/catalog'), null)).status, 503);
});
