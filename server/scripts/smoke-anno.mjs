// Simulazione end-to-end di "Indovina l'Anno" contro un server acceso:
//   SERVER=http://localhost:4000 npm run smoke:anno
// Host e guest giocano 2 round sul namespace /anno, con rientro del guest.
import { io } from 'socket.io-client';

const URL = process.env.SERVER || 'http://localhost:4000';
const log = (...a) => console.log(new Date().toISOString().slice(11, 23), ...a);
const fail = (m) => { console.error('FAIL:', m); process.exit(1); };
const assert = (c, m) => { if (!c) fail(m); };

function connect(name) {
  const s = io(`${URL}/anno`, { transports: ['websocket'] });
  s.states = [];
  s.on('room:state', (st) => {
    s.states.push(st);
    if (['countdown', 'playing'].includes(st.status)) {
      const json = JSON.stringify(st);
      assert(!json.includes('"year"') && !json.includes('wikiUrl'), `${name}: risposta trapelata prima del reveal`);
      assert(st.reveal === null, `${name}: reveal presente fuori dal reveal`);
    }
  });
  s.ask = (ev, payload = {}) => new Promise((res, rej) => s.timeout(15000).emit(ev, payload, (err, r) => err ? rej(err) : r?.ok ? res(r) : rej(new Error(`${ev}: ${r?.error}`))));
  s.waitStatus = (status, ms = 30000) => new Promise((res, rej) => {
    const last = s.states.at(-1);
    if (last?.status === status) return res(last);
    const t = setTimeout(() => rej(new Error(`${name}: timeout aspettando ${status}`)), ms);
    const h = (st) => { if (st.status === status) { clearTimeout(t); s.off('room:state', h); res(st); } };
    s.on('room:state', h);
  });
  return new Promise((res) => s.on('connect', () => res(s)));
}

const cats = await fetch(`${URL}/anno/categories`).then((r) => r.json());
log('categorie:', cats.data.map((c) => `${c.id}=${c.count}`).join(' '));
assert(cats.data.some((c) => c.count > 0), 'mazzo vuoto sul server');
const usable = cats.data.filter((c) => c.count > 0).map((c) => c.id);

const host = await connect('host');
const guest = await connect('guest');

await host.ask('room:create', { name: '' }).then(() => fail('nome vuoto accettato'), (e) => log('ok rifiuto:', e.message));

const created = await host.ask('room:create', { name: 'Host', categories: usable.slice(0, 2), maxRounds: 2, roundMs: 10000 });
const code = created.code;
log('stanza', code, 'categorie', created.state.categories.map((c) => c.id));
assert(created.state.settings.prepMs === 2500, 'prepMs inatteso');

const joined = await guest.ask('room:join', { code, name: 'Guest' });
const guest2 = await connect('guest2');
const rejoin = await guest2.ask('room:join', { code, playerId: joined.playerId });
assert(rejoin.rejoined && rejoin.state.players.length === 2, 'rejoin fallito');
guest.disconnect();

// Il GTS sullo stesso server non vede le stanze dell'Anno.
const gts = io(URL, { transports: ['websocket'] });
await new Promise((r) => gts.on('connect', r));
await new Promise((res) => gts.timeout(5000).emit('room:join', { code, name: 'X' }, (err, r) => {
  assert(!err && r && !r.ok, 'stanza Anno raggiungibile dal namespace GTS');
  res();
}));
gts.disconnect();
log('namespace separati ok');

await host.ask('game:start');
let st = await host.waitStatus('countdown');
assert(st.round?.title && st.round.range, 'round senza carta');
await host.ask('game:answer', { choice: st.round.range.min }).then(() => fail('risposta in countdown accettata'), (e) => log('ok rifiuto:', e.message));

st = await host.waitStatus('playing');
const { range } = st.round;
log('round 1:', st.round.title, `[${range.min}-${range.max}]`);
assert(range.max - range.min >= 20, 'intervallo troppo stretto');
await host.ask('game:answer', { choice: range.max + 1 }).then(() => fail('anno fuori intervallo accettato'), (e) => log('ok rifiuto:', e.message));
await host.ask('game:answer', { choice: Math.round((range.min + range.max) / 2) });
await host.ask('game:answer', { choice: range.min }).then(() => fail('doppia risposta accettata'), (e) => log('ok rifiuto:', e.message));
await guest2.ask('game:answer', { choice: range.min });

st = await host.waitStatus('reveal', 1500);
const rv = st.reveal;
log('reveal 1:', rv.year, rv.title, '| vincitori:', rv.winnerIds.length, '| risultati:', rv.results.map((r) => `${r.guess}→+${r.points}`));
assert(rv.year >= range.min && rv.year <= range.max, 'anno fuori dal suo intervallo');
assert(rv.results.length === 2, 'risultati incompleti');
for (const r of rv.results) {
  const p = st.players.find((x) => x.id === r.playerId);
  assert(p.score === r.points, 'punteggio non coerente');
  assert(r.distance === Math.abs(r.guess - rv.year), 'distanza sbagliata');
}
if (rv.image) {
  const img = await fetch(rv.image.url, { method: 'HEAD', redirect: 'follow' });
  log('foto:', img.status, img.headers.get('content-type'));
  assert(img.ok, 'foto non raggiungibile');
}

// round 2: nessuno risponde → reveal per timeout dopo ~10s
st = await host.waitStatus('countdown', 12000);
st = await host.waitStatus('playing');
const t0 = Date.now();
st = await host.waitStatus('reveal', 13000);
const dur = Date.now() - t0;
log(`reveal 2 dopo ${dur}ms (atteso ~10000)`);
assert(dur > 9500 && dur < 11500, 'timeout round fuori tolleranza');
assert(st.reveal.isLast && st.reveal.results.length === 0 && st.reveal.winnerIds.length === 0, 'reveal finale errato');

st = await host.waitStatus('finished', 12000);
log('finished. classifica:', st.players.map((p) => `${p.name}=${p.score}`));
await host.ask('game:restart');
st = await host.waitStatus('lobby');
assert(st.players.every((p) => p.score === 0), 'punteggi non azzerati');
log('restart ok');

const health = await fetch(`${URL}/health`).then((r) => r.json());
log('health:', health);
console.log('\nSMOKE ANNO OK');
process.exit(0);
