// Simulazione end-to-end di "Completa la barra" contro un server acceso:
//   SERVER=http://localhost:4000 ADMIN_TOKEN=... npm run smoke:barra
// Crea un brano e una sfida dalla gestione (video YouTube reale), poi host e
// guest giocano un round sul namespace /barra. Usa il database del server:
// lanciarlo solo in locale (PGlite) o su un database di prova.
import { io } from 'socket.io-client';

const URL = process.env.SERVER || 'http://localhost:4000';
const TOKEN = process.env.ADMIN_TOKEN;
const log = (...a) => console.log(new Date().toISOString().slice(11, 23), ...a);
const fail = (m) => { console.error('FAIL:', m); process.exit(1); };
const assert = (c, m) => { if (!c) fail(m); };
const SECRET = 'smoke risposta segreta';

if (!TOKEN) fail('serve ADMIN_TOKEN (lo stesso del server)');

async function admin(path, body) {
  const res = await fetch(`${URL}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) fail(`${path}: ${json.error}`);
  return json;
}

// ---------- gestione: artista, brano, sfida verificata e pubblicata ----------
const stamp = Date.now().toString(36);
let cat = await admin('/barra/admin/op', { op: 'artist.save', data: { name: `Smoke ${stamp}` } });
const artistId = cat.artists.find((a) => a.name === `Smoke ${stamp}`).id;
const verify = await admin('/barra/admin/verify?youtube=https://www.youtube.com/watch?v=dQw4w9WgXcQ');
log('verifica YouTube:', verify.status, verify.title || verify.reason);
cat = await admin('/barra/admin/op', {
  op: 'song.save',
  data: { title: `Brano ${stamp}`, artist_id: artistId, audio_provider: 'youtube', audio_ref: 'https://youtu.be/dQw4w9WgXcQ', rights_notes: 'smoke test', is_published: true },
});
const songId = cat.savedId;
cat = await admin('/barra/admin/op', { op: 'challenge.save', data: { song_id: songId, start_ms: 18000, stop_ms: 21000, answer: SECRET, accepted_variants: ['variante smoke'] } });
const challengeId = cat.savedId;
await admin('/barra/admin/op', { op: 'challenge.verify', data: { id: challengeId, verified: true } });
await admin('/barra/admin/op', { op: 'challenge.publish', data: { id: challengeId, published: true } });
const publicCatalog = await fetch(`${URL}/barra/catalog?artists=${artistId}`).then((r) => r.json());
log('catalogo pubblico:', JSON.stringify(publicCatalog.summary));
assert(publicCatalog.summary.challenges === 1, 'la sfida pubblicata non risulta giocabile');
assert(!JSON.stringify(publicCatalog).includes(SECRET), 'soluzione nel catalogo pubblico');

// ---------- partita ----------
function connect(name) {
  const s = io(`${URL}/barra`, { transports: ['websocket'] });
  s.states = [];
  s.on('room:state', (st) => {
    s.states.push(st);
    if (!['reveal', 'finished'].includes(st.status)) {
      assert(!JSON.stringify(st).includes(SECRET), `${name}: soluzione trapelata in ${st.status}`);
    }
  });
  s.ask = (ev, payload = {}) => new Promise((res, rej) => s.timeout(15000).emit(ev, payload, (err, r) => (err ? rej(err) : r?.ok ? res(r) : rej(Object.assign(new Error(`${ev}: ${r?.error}`), { code: r?.code })))));
  s.waitStatus = (status, ms = 30000) => new Promise((res, rej) => {
    const last = s.states.at(-1);
    if (last?.status === status) return res(last);
    const t = setTimeout(() => rej(new Error(`${name}: timeout aspettando ${status}`)), ms);
    const h = (st) => { if (st.status === status) { clearTimeout(t); s.off('room:state', h); res(st); } };
    s.on('room:state', h);
  });
  return new Promise((res) => s.on('connect', () => res(s)));
}

const host = await connect('host');
const guest = await connect('guest');
const created = await host.ask('room:create', { name: 'Host', maxRounds: 1, roundMs: 5000, filters: { artistIds: [artistId] } });
log('stanza', created.code);
await guest.ask('room:join', { code: created.code, name: 'Guest' });

await host.ask('game:start', {});
// La preparazione si annuncia prima senza round (scelta in corso), poi con il round
let st = host.states.findLast((s) => s.status === 'preparing' && s.round)
  || await new Promise((res) => host.on('room:state', (s) => { if (s.status === 'preparing' && s.round) res(s); }));
log('round', st.round.number, st.round.song.title, JSON.stringify(st.round.playback));
await host.ask('player:ready', { roundId: st.round.id });
await guest.ask('player:ready', { roundId: st.round.id });
st = await host.waitStatus('countdown');
log('countdown, frammento', st.round.answerOpenAt - st.round.playAt, 'ms');

await host.waitStatus('listening');
try { await host.ask('game:answer', { choice: 'troppo presto' }); fail('risposta accettata durante l\'ascolto'); } catch (e) { assert(e.code === 'early', `atteso early, ricevuto ${e.code}`); }
await host.waitStatus('answering');
const ack = await host.ask('game:answer', { choice: 'Smoke, RISPOSTA segreta!' });
assert(!('correct' in ack), "l'ack non deve dire se è corretta");
try { await host.ask('game:answer', { choice: 'di nuovo' }); fail('doppia risposta accettata'); } catch (e) { assert(e.code === 'dup', `atteso dup, ricevuto ${e.code}`); }
await guest.ask('game:answer', { choice: 'boh' });

st = await host.waitStatus('reveal');
log('reveal:', st.reveal.answer, '|', st.reveal.results.map((r) => `${r.name}=${r.points}${r.correct ? '✓' : '✗'}`).join(' '));
assert(st.reveal.answer === SECRET, 'soluzione assente al reveal');
assert(st.reveal.results.find((r) => r.name === 'Host').points === 100, 'host doveva fare 100');
assert(st.reveal.results.find((r) => r.name === 'Guest').points === 0, 'guest doveva fare 0');
st = await host.waitStatus('finished', 20000);
log('finita:', st.players.map((p) => `${p.name}=${p.score}`).join(' '));

// Pulizia: il brano di prova non resta nel catalogo
await admin('/barra/admin/op', { op: 'song.delete', data: { id: songId } });
await admin('/barra/admin/op', { op: 'artist.delete', data: { id: artistId } });
host.close();
guest.close();
log('OK');
process.exit(0);
