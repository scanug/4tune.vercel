// Simulazione end-to-end contro un server acceso (richiede rete per Deezer):
//   SERVER=http://localhost:4000 npm run smoke
// Host e guest giocano 2 round, con rientro del guest da un nuovo socket.
import { io } from 'socket.io-client';

const URL = process.env.SERVER || 'http://localhost:4000';
const PLAYLIST = process.env.PLAYLIST || '11335739484';
const log = (...a) => console.log(new Date().toISOString().slice(11, 23), ...a);
const fail = (m) => { console.error('FAIL:', m); process.exit(1); };
const assert = (c, m) => { if (!c) fail(m); };

function connect(name) {
  const s = io(URL, { transports: ['websocket'] });
  s.states = [];
  s.on('room:state', (st) => {
    s.states.push(st);
    assert(!JSON.stringify(st.round || {}).includes('correctIndex'), `${name}: correctIndex trapelato nel round`);
    if (st.status !== 'reveal' && st.status !== 'finished') assert(st.reveal === null, `${name}: reveal presente fuori dal reveal`);
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

const host = await connect('host');
const guest = await connect('guest');

// clock sync
const sent = Date.now();
const sync = await new Promise((r) => host.emit('time:sync', sent, r));
assert(Math.abs(sync.serverNow - Date.now()) < 2000, 'time:sync incoerente');
log('time:sync ok');

// errori attesi
await host.ask('room:join', { code: 'ZZZZ', name: 'x' }).then(() => fail('join stanza inesistente accettato'), (e) => log('ok rifiuto:', e.message));
await host.ask('room:create', { name: '', playlistId: PLAYLIST }).then(() => fail('nome vuoto accettato'), (e) => log('ok rifiuto:', e.message));
await host.ask('room:create', { name: 'H', playlistId: 'abc' }).then(() => fail('playlist invalida accettata'), (e) => log('ok rifiuto:', e.message));

// crea + join
const created = await host.ask('room:create', { name: 'Host', playlistId: PLAYLIST, maxRounds: 2, roundMs: 5000, prepMs: 1000 });
const code = created.code;
log('stanza', code, 'tracce', created.state.playlist.trackCount);
assert(created.state.status === 'lobby' && created.state.players.length === 1, 'stato lobby errato');

const joined = await guest.ask('room:join', { code, name: 'Guest' });
assert(joined.state.players.length === 2, 'guest non aggiunto');
await guest.ask('room:join', { code }).then(() => fail('join senza nome accettato'), (e) => assert(e.message.includes('nickname'), 'errore nome atteso'));

// rejoin con stesso playerId da un nuovo socket
const guest2 = await connect('guest2');
const rejoin = await guest2.ask('room:join', { code, playerId: joined.playerId });
assert(rejoin.rejoined === true && rejoin.playerId === joined.playerId, 'rejoin fallito');
assert(rejoin.state.players.length === 2, 'rejoin ha duplicato il giocatore');
guest.disconnect();
log('rejoin ok');

// guest non può avviare
await guest2.ask('game:start').then(() => fail('guest ha avviato'), (e) => log('ok rifiuto:', e.message));

// partita
await host.ask('game:start');
let st = await host.waitStatus('countdown');
assert(st.round?.options?.length === 4 && st.round.clipUrl, 'round senza opzioni/clip');
assert(new Set(st.round.options).size === 4, 'opzioni duplicate');
await host.ask('game:answer', { choice: 0 }).then(() => fail('risposta in countdown accettata'), (e) => log('ok rifiuto:', e.message));

st = await host.waitStatus('playing');
log('round 1 playing, opzioni:', st.round.options);
await new Promise((r) => setTimeout(r, 400));
// host prova tutte le opzioni finché una viene accettata come valida: ne manda una sola
const a1 = await host.ask('game:answer', { choice: 1 });
assert(typeof a1.at === 'number', 'ack risposta senza timestamp');
await host.ask('game:answer', { choice: 2 }).then(() => fail('doppia risposta accettata'), (e) => log('ok rifiuto:', e.message));
await guest2.ask('game:answer', { choice: 9 }).then(() => fail('indice fuori range accettato'), (e) => log('ok rifiuto:', e.message));
await guest2.ask('game:answer', { choice: 2 });

// tutti hanno risposto → reveal immediato (ben prima dei 5s)
st = await host.waitStatus('reveal', 1500);
log('reveal 1:', st.reveal.title, '-', st.reveal.artist, '| corretta:', st.reveal.correctIndex, '| risultati:', st.reveal.results.map((r) => `${r.correct ? '✓' : '✗'}${r.points}`));
assert(st.reveal.results.length === 2, 'risultati incompleti');
for (const r of st.reveal.results) {
  const p = st.players.find((p) => p.id === r.playerId);
  assert(p.score === r.points, 'punteggio non coerente col risultato');
  if (r.correct) assert(r.points >= 50 && r.points <= 100, 'punti fuori range');
  else assert(r.points === 0, 'punti a risposta sbagliata');
}

// round 2: nessuno risponde → reveal per timeout
st = await host.waitStatus('countdown', 8000);
assert(st.roundIndex === 2, 'round 2 non partito');
st = await host.waitStatus('playing');
const t0 = Date.now();
st = await host.waitStatus('reveal', 7000);
const dur = Date.now() - t0;
log(`reveal 2 dopo ${dur}ms (atteso ~5000)`, st.reveal.isLast ? '[ultimo]' : '');
assert(dur > 4500 && dur < 6500, 'timeout round fuori tolleranza');
assert(st.reveal.isLast === true, 'isLast mancante');
assert(st.reveal.results.length === 0, 'risultati fantasma');

st = await host.waitStatus('finished', 10000);
log('finished. classifica:', st.players.map((p) => `${p.name}=${p.score}`));

// restart
await guest2.ask('game:restart').then(() => fail('guest ha fatto restart'), () => {});
await host.ask('game:restart');
st = await host.waitStatus('lobby');
assert(st.players.every((p) => p.score === 0), 'punteggi non azzerati');
log('restart ok');

// leave host → migrazione host immediata
await host.ask('room:leave');
st = await guest2.waitStatus('lobby');
assert(st.hostId === joined.playerId && st.players.length === 1, 'migrazione host dopo leave fallita');
log('host migrato a guest dopo leave ok');

const health = await fetch(`${URL}/health`).then((r) => r.json());
log('health:', health);
console.log('\nSMOKE OK');
process.exit(0);
