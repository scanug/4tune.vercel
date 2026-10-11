import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { createDailyService } from '../src/daily/service.js';
import { LINK_TTL_MS, createProfileService, normalizeCode } from '../src/profile/service.js';
import { createProfileRoutes } from '../src/profile/http.js';

async function setup() {
  const db = new PGlite();
  const clock = { t: Date.parse('2026-10-08T10:00:00Z') };
  const daily = createDailyService({ db, deck: [], now: () => clock.t });
  await daily.init();
  const profiles = createProfileService({ db, auth: daily.auth, now: () => clock.t });
  await profiles.init();
  await profiles.init(); // idempotente
  return { db, clock, daily, profiles };
}

const stats = (played) => ({ stats: { gts: { played } }, trophies: { 'gts-1': 1 } });

test('normalizeCode: maiuscole, trattini e spazi non contano', () => {
  assert.equal(normalizeCode(' k7q-42m '), 'K7Q42M');
  assert.equal(normalizeCode(null), '');
});

test('sync: ogni dispositivo ha il suo spazio, risincronizzare lo sovrascrive', async () => {
  const { daily, profiles } = await setup();
  const { token } = await daily.register('Giulia');
  let res = await profiles.sync(token, 'telefono-123', stats(2));
  assert.equal(res.name, 'Giulia');
  assert.equal(res.devices.length, 1);
  res = await profiles.sync(token, 'telefono-123', stats(3));
  assert.equal(res.devices.length, 1);
  assert.deepEqual(res.devices[0].data, stats(3));
  res = await profiles.sync(token, 'computer-456', stats(1));
  assert.deepEqual(res.devices.map((d) => d.deviceId).sort(), ['computer-456', 'telefono-123']);
});

test('sync: rifiuta token, dispositivi e dati non validi', async () => {
  const { daily, profiles } = await setup();
  const { token } = await daily.register('Giulia');
  await assert.rejects(profiles.sync('inventato', 'telefono-123', {}), /non riconosciuto/);
  await assert.rejects(profiles.sync(token, 'x', {}), /Dispositivo/);
  await assert.rejects(profiles.sync(token, 'telefono-123', [1, 2]), /Dati/);
  await assert.rejects(profiles.sync(token, 'telefono-123', { big: 'x'.repeat(20_000) }), /troppo grande/);
});

test('collegamento: il codice dà un token nuovo per lo stesso profilo e vale una volta sola', async () => {
  const { daily, profiles } = await setup();
  const first = await daily.register('Giulia');
  await profiles.sync(first.token, 'telefono-123', stats(2));

  const { code, expiresAt } = await profiles.createLinkCode(first.token);
  assert.match(code, /^[A-Z2-9]{6}$/);
  assert.ok(expiresAt > Date.now() - 1e12);

  const linked = await profiles.link(`${code.slice(0, 3)}-${code.slice(3).toLowerCase()}`);
  assert.equal(linked.playerId, first.playerId);
  assert.equal(linked.name, 'Giulia');
  assert.notEqual(linked.token, first.token);

  // Entrambi i token funzionano, anche per l'Anno del Giorno
  assert.equal((await daily.auth(linked.token)).id, first.playerId);
  assert.equal((await daily.auth(first.token)).id, first.playerId);
  const res = await profiles.sync(linked.token, 'computer-456', stats(1));
  assert.equal(res.devices.length, 2);

  await assert.rejects(profiles.link(code), /sbagliato o scaduto/);
});

test('collegamento: il codice scade e uno nuovo annulla il precedente', async () => {
  const { clock, daily, profiles } = await setup();
  const { token } = await daily.register('Giulia');

  const old = await profiles.createLinkCode(token);
  const fresh = await profiles.createLinkCode(token);
  if (old.code !== fresh.code) await assert.rejects(profiles.link(old.code), /sbagliato o scaduto/);

  clock.t += LINK_TTL_MS + 1;
  await assert.rejects(profiles.link(fresh.code), /sbagliato o scaduto/);
  await assert.rejects(profiles.link('ABC'), /6 caratteri/);
});

test('rotte: token dal Bearer, limite ai tentativi di codice', async () => {
  const { daily, profiles } = await setup();
  const { token } = await daily.register('Giulia');
  const routes = createProfileRoutes(() => profiles);
  const req = (method, auth) => ({ method, headers: auth ? { authorization: `Bearer ${auth}` } : {}, socket: { remoteAddress: '1.2.3.4' } });
  const url = (path) => new URL(`http://x${path}`);

  assert.equal(await routes(req('GET'), url('/daily/today')), null);
  const ok = await routes(req('POST', token), url('/profile/sync'), { deviceId: 'telefono-123', data: stats(1) });
  assert.equal(ok.status, 200);
  const noAuth = await routes(req('POST'), url('/profile/link-code'), {});
  assert.equal(noAuth.status, 401);

  let last;
  for (let i = 0; i < 11; i++) last = await routes(req('POST'), url('/profile/link'), { code: 'ZZZZZZ' });
  assert.equal(last.status, 429);

  const off = createProfileRoutes(() => null);
  assert.equal((await off(req('POST'), url('/profile/sync'), {})).status, 503);
});
