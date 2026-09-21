// Layer Socket.IO: traduce gli eventi dei client in chiamate al RoomManager e
// ritrasmette lo stato pubblico della stanza a chi ci sta dentro.
//
// Eventi client → server (tutti con ack `{ ok, ...}` oppure `{ ok:false, error }`):
//   time:sync    (clientSent)                                  → { clientSent, serverNow }
//   room:create  ({ name, playlistId, maxRounds, roundMs, prepMs }) → { code, playerId, state }
//   room:join    ({ code, name?, playerId? })                  → { code, playerId, state, rejoined }
//   room:leave   ()          esce davvero dalla stanza
//   room:detach  ()          stacca il socket ma tiene il posto (cambio pagina)
//   game:start   ()          solo host
//   game:restart ()          solo host, a partita finita
//   game:answer  ({ choice })
// Eventi server → client:
//   room:state   (state)     ad ogni cambiamento

import { GameError } from './engine.js';
import { fetchPlaylist } from './deezer.js';

function fail(ack, err) {
  const message = err instanceof GameError ? err.message : 'Errore del server';
  if (!(err instanceof GameError)) console.error('[socket]', err);
  ack?.({ ok: false, error: message, code: err.code || 'server' });
}

export function attachSockets(io, manager) {
  manager.emit = (room) => io.to(room.code).emit('room:state', manager.publicState(room));

  // Quale socket "possiede" ogni giocatore. Con un refresh della pagina il
  // nuovo socket rientra prima che il vecchio risulti disconnesso: senza questa
  // mappa la disconnessione del vecchio marcherebbe il giocatore come assente.
  const owners = new Map(); // `${code}:${playerId}` -> socket
  const keyOf = (code, playerId) => `${code}:${playerId}`;

  const previousRemoved = manager.onRoomRemoved;
  manager.onRoomRemoved = (room) => {
    for (const key of owners.keys()) if (key.startsWith(`${room.code}:`)) owners.delete(key);
    previousRemoved(room);
  };

  io.on('connection', (socket) => {
    socket.data.code = null;
    socket.data.playerId = null;

    // Stacca il socket dal giocatore. `silent` quando il posto passa a un
    // altro socket dello stesso giocatore: non va segnato come disconnesso.
    const unbind = ({ silent = false } = {}) => {
      const { code, playerId } = socket.data;
      if (!code) return;
      socket.leave(code);
      socket.data.code = null;
      socket.data.playerId = null;
      if (owners.get(keyOf(code, playerId)) === socket) owners.delete(keyOf(code, playerId));
      if (!silent) manager.setConnected(code, playerId, false);
    };

    const bind = (room, player) => {
      unbind();
      const key = keyOf(room.code, player.id);
      const previous = owners.get(key);
      if (previous && previous !== socket) {
        previous.leave(room.code);
        previous.data.code = null;
        previous.data.playerId = null;
      }
      owners.set(key, socket);
      socket.data.code = room.code;
      socket.data.playerId = player.id;
      socket.join(room.code);
      manager.setConnected(room.code, player.id, true);
    };

    socket.on('time:sync', (clientSent, ack) => {
      ack?.({ clientSent, serverNow: Date.now() });
    });

    socket.on('room:create', async (payload = {}, ack) => {
      try {
        const playlist = await fetchPlaylist(payload.playlistId);
        const { room, player } = manager.createRoom({
          hostName: payload.name,
          playlist,
          settings: payload,
        });
        bind(room, player);
        ack?.({ ok: true, code: room.code, playerId: player.id, state: manager.publicState(room) });
      } catch (err) { fail(ack, err); }
    });

    socket.on('room:join', (payload = {}, ack) => {
      try {
        const { room, player, rejoined } = manager.joinRoom(payload.code, {
          name: payload.name,
          playerId: payload.playerId,
        });
        bind(room, player);
        ack?.({ ok: true, code: room.code, playerId: player.id, rejoined, state: manager.publicState(room) });
      } catch (err) { fail(ack, err); }
    });

    socket.on('room:leave', (_payload, ack) => {
      try {
        const { code, playerId } = socket.data;
        if (code) {
          unbind({ silent: true });
          manager.leaveRoom(code, playerId);
        }
        ack?.({ ok: true });
      } catch (err) { fail(ack, err); }
    });

    socket.on('game:start', (_payload, ack) => {
      try {
        manager.startGame(socket.data.code, socket.data.playerId);
        ack?.({ ok: true });
      } catch (err) { fail(ack, err); }
    });

    socket.on('game:restart', (_payload, ack) => {
      try {
        manager.restartGame(socket.data.code, socket.data.playerId);
        ack?.({ ok: true });
      } catch (err) { fail(ack, err); }
    });

    socket.on('game:answer', (payload = {}, ack) => {
      try {
        const result = manager.submitAnswer(socket.data.code, socket.data.playerId, payload.choice);
        ack?.({ ok: true, ...result });
      } catch (err) { fail(ack, err); }
    });

    // Il client cambia pagina senza uscire dalla stanza: resta come giocatore
    // disconnesso e può rientrare con lo stesso playerId.
    socket.on('room:detach', () => {
      unbind();
    });

    socket.on('disconnect', () => {
      unbind();
    });
  });
}
