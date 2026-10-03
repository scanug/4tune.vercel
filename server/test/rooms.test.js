import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from '../src/rooms.js';

// Orologio e timer finti: `clock.advance(ms)` fa scattare i timer in ordine.
function fakeClock(start = 1_000_000) {
  let now = start;
  let nextId = 1;
  const timers = new Map();
  return {
    now: () => now,
    setTimer: (fn, ms) => { const id = nextId++; timers.set(id, { at: now + ms, fn }); return id; },
    clearTimer: (id) => timers.delete(id),
    advance(ms) {
      const target = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at);
        if (due.length === 0) break;
        const [id, t] = due[0];
        timers.delete(id);
        now = t.at;
        t.fn();
      }
      now = target;
    },
    pending: () => timers.size,
  };
}

function playlist(n = 10) {
  return {
    id: '1', name: 'Test', image: null,
    tracks: Array.from({ length: n }, (_, i) => ({ id: i + 1, title: `Brano ${i + 1}`, artist: 'A', previewUrl: `u${i + 1}` })),
  };
}

function setup() {
  const clock = fakeClock();
  const emitted = [];
  const removed = [];
  const manager = new RoomManager({
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
    emit: (room) => emitted.push(manager.publicState(room)),
    onRoomRemoved: (room) => removed.push(room.code),
  });
  const { room, player: host } = manager.createRoom({ hostName: 'Host', playlist: playlist(), settings: { maxRounds: 2, roundMs: 10000, prepMs: 2000 } });
  manager.setConnected(room.code, host.id, true);
  const { player: guest } = manager.joinRoom(room.code, { name: 'Guest' });
  manager.setConnected(room.code, guest.id, true);
  return { clock, manager, room, host, guest, emitted, removed };
}

test('lo stato pubblico non contiene mai la risposta corretta durante il round', () => {
  const { clock, manager, room, host } = setup();
  manager.startGame(room.code, host.id);
  clock.advance(2000);
  const state = manager.publicState(room);
  assert.equal(state.status, 'playing');
  assert.equal(state.reveal, null);
  assert.equal(state.round.options.length, 4);
  assert.ok(!('correctIndex' in state.round));
  assert.ok(!JSON.stringify(state).includes('"correctIndex"'));
});

test('lo stato pubblico anticipa la clip del round successivo', () => {
  const { clock, manager, room, host } = setup();
  manager.startGame(room.code, host.id);
  clock.advance(2000);
  const state = manager.publicState(room);
  assert.equal(state.nextClipUrl, room.rounds[1].track.previewUrl);
  assert.notEqual(state.nextClipUrl, state.round.clipUrl);
});

test('flusso completo: countdown → playing → reveal → round 2 → finished, guidato dai timer del server', () => {
  const { clock, manager, room, host } = setup();
  manager.startGame(room.code, host.id);
  assert.equal(room.status, 'countdown');
  assert.equal(room.roundIndex, 1);
  clock.advance(2000);
  assert.equal(room.status, 'playing');
  clock.advance(10000);
  assert.equal(room.status, 'reveal');
  clock.advance(5000);
  assert.equal(room.status, 'countdown');
  assert.equal(room.roundIndex, 2);
  clock.advance(2000 + 10000);
  assert.equal(room.status, 'reveal');
  assert.equal(room.lastReveal.isLast, true);
  clock.advance(8000);
  assert.equal(room.status, 'finished');
});

test('punteggio: tempo misurato dal server, risposta sbagliata 0 punti, doppia risposta rifiutata', () => {
  const { clock, manager, room, host, guest } = setup();
  manager.startGame(room.code, host.id);
  clock.advance(2000);
  const correct = room.rounds[0].correctIndex;
  const wrong = (correct + 1) % 4;

  clock.advance(1000); // host risponde dopo 1s → bonus 45
  manager.submitAnswer(room.code, host.id, correct);
  assert.throws(() => manager.submitAnswer(room.code, host.id, correct), /già risposto/);
  clock.advance(1000);
  manager.submitAnswer(room.code, guest.id, wrong);

  // tutti hanno risposto → reveal immediato
  assert.equal(room.status, 'reveal');
  assert.equal(room.players.get(host.id).score, 95);
  assert.equal(room.players.get(guest.id).score, 0);
  assert.equal(room.lastReveal.firstCorrect.playerId, host.id);
  assert.equal(room.lastReveal.results.length, 2);
});

test('rifiuta risposte fuori dal momento giusto e con indice non valido', () => {
  const { clock, manager, room, host } = setup();
  assert.throws(() => manager.submitAnswer(room.code, host.id, 0), /momento/);
  manager.startGame(room.code, host.id);
  assert.throws(() => manager.submitAnswer(room.code, host.id, 0), /momento/); // countdown
  clock.advance(2000);
  assert.throws(() => manager.submitAnswer(room.code, host.id, 7), /non valida/);
  assert.throws(() => manager.submitAnswer(room.code, host.id, -1), /non valida/);
});

test('solo l\'host può avviare; join a partita in corso; rejoin con stesso playerId', () => {
  const { clock, manager, room, host, guest } = setup();
  assert.throws(() => manager.startGame(room.code, guest.id), /host/);
  manager.startGame(room.code, host.id);
  clock.advance(2000);
  const { player: late } = manager.joinRoom(room.code, { name: 'Late' });
  assert.equal(room.players.size, 3);
  assert.equal(late.score, 0);
  const again = manager.joinRoom(room.code, { name: 'Late2', playerId: late.id });
  assert.equal(again.rejoined, true);
  assert.equal(again.player.id, late.id);
  assert.equal(room.players.size, 3);
});

test('l\'host disconnesso viene sostituito dopo il periodo di grazia, non prima', () => {
  const { clock, manager, room, host, guest } = setup();
  manager.setConnected(room.code, host.id, false);
  clock.advance(9999);
  assert.equal(room.hostId, host.id);
  clock.advance(1);
  assert.equal(room.hostId, guest.id);
});

test('l\'host che rientra in tempo mantiene il ruolo', () => {
  const { clock, manager, room, host } = setup();
  manager.setConnected(room.code, host.id, false);
  clock.advance(5000);
  manager.setConnected(room.code, host.id, true);
  clock.advance(20000);
  assert.equal(room.hostId, host.id);
});

test('la partita continua anche se l\'host se ne va', () => {
  const { clock, manager, room, host } = setup();
  manager.startGame(room.code, host.id);
  manager.leaveRoom(room.code, host.id);
  clock.advance(2000 + 10000 + 5000 + 2000 + 10000 + 8000);
  assert.equal(room.status, 'finished');
});

test('un giocatore disconnesso non blocca il reveal anticipato', () => {
  const { clock, manager, room, host, guest } = setup();
  manager.startGame(room.code, host.id);
  clock.advance(2000);
  manager.setConnected(room.code, guest.id, false);
  manager.submitAnswer(room.code, host.id, 0);
  assert.equal(room.status, 'reveal');
});

test('restart riporta in lobby con punteggi a zero', () => {
  const { clock, manager, room, host } = setup();
  manager.startGame(room.code, host.id);
  clock.advance(60000);
  assert.equal(room.status, 'finished');
  manager.restartGame(room.code, host.id);
  assert.equal(room.status, 'lobby');
  for (const p of room.players.values()) assert.equal(p.score, 0);
});

test('la stanza si elimina quando nessuno è connesso da un po\'', () => {
  const { clock, manager, room, host, guest, removed } = setup();
  manager.setConnected(room.code, host.id, false);
  manager.setConnected(room.code, guest.id, false);
  clock.advance(5 * 60_000);
  assert.deepEqual(removed, [room.code]);
  assert.equal(manager.hasRoom(room.code), false);
});

test('la stanza non si elimina a metà partita con gente connessa', () => {
  const { clock, manager, room, host } = setup();
  manager.createRoom({ hostName: 'X', playlist: playlist(), settings: { maxRounds: 20, roundMs: 30000, prepMs: 10000 } });
  manager.startGame(room.code, host.id);
  clock.advance(60 * 60_000 + 1);
  assert.equal(manager.hasRoom(room.code), true);
});

test('createRoom valida nome e playlist', () => {
  const { manager } = setup();
  assert.throws(() => manager.createRoom({ hostName: '', playlist: playlist(), settings: {} }), /nickname/);
  assert.throws(() => manager.createRoom({ hostName: 'A', playlist: playlist(3), settings: {} }), /meno di 4/);
  assert.throws(() => manager.createRoom({ hostName: 'A', playlist: null, settings: {} }), /Playlist/);
});
