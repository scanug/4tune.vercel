// Server di gioco 4Tune: HTTP per Deezer e health check, Socket.IO per le
// stanze GTS. Nessun database: le stanze vivono in memoria finché dura la
// partita (un redeploy le azzera).
//
// Variabili d'ambiente:
//   PORT            porta di ascolto (Railway la imposta da solo)
//   CLIENT_ORIGIN   origin ammessi, separati da virgola (es. https://4tune.vercel.app,http://localhost:3000)
//                   se assente accetta qualsiasi origin (comodo in sviluppo)

import http from 'node:http';
import { Server } from 'socket.io';

import { RoomManager } from './rooms.js';
import { attachSockets } from './socket.js';
import { fetchPlaylist, getPresets, playlistSummary, searchPlaylists } from './deezer.js';
import { GameError } from './engine.js';

const port = Number(process.env.PORT || 4000);
const allowedOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

function corsOrigin(req) {
  const origin = req.headers.origin;
  if (allowedOrigins.length === 0) return '*';
  return origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
}

function sendJson(req, res, status, payload, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': corsOrigin(req),
    'Vary': 'Origin',
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

async function handleHttp(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': corsOrigin(req),
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    });
    return res.end();
  }

  if (req.method !== 'GET') return sendJson(req, res, 405, { error: 'Metodo non consentito' });

  try {
    if (url.pathname === '/health') {
      return sendJson(req, res, 200, { ok: true, rooms: manager.rooms.size, uptime: process.uptime() });
    }
    if (url.pathname === '/deezer/presets') {
      return sendJson(req, res, 200, { data: await getPresets() }, { 'Cache-Control': 'public, max-age=300' });
    }
    if (url.pathname === '/deezer/search') {
      const data = await searchPlaylists(url.searchParams.get('q'));
      return sendJson(req, res, 200, { data }, { 'Cache-Control': 'public, max-age=60' });
    }
    if (url.pathname === '/deezer/playlist') {
      const playlist = await fetchPlaylist(url.searchParams.get('id'));
      return sendJson(req, res, 200, playlistSummary(playlist), { 'Cache-Control': 'public, max-age=60' });
    }
    return sendJson(req, res, 404, { error: 'Non trovato' });
  } catch (err) {
    if (err instanceof GameError) return sendJson(req, res, 400, { error: err.message });
    console.error('[http]', err);
    return sendJson(req, res, 500, { error: 'Errore del server' });
  }
}

const manager = new RoomManager({
  onRoomRemoved: (room) => console.log(`[rooms] chiusa ${room.code}`),
});

const server = http.createServer(handleHttp);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length ? allowedOrigins : true,
    methods: ['GET', 'POST'],
  },
});
attachSockets(io, manager);

server.listen(port, () => {
  console.log(`4Tune server in ascolto su :${port}` + (allowedOrigins.length ? ` (origin: ${allowedOrigins.join(', ')})` : ' (origin: tutti)'));
});

process.on('SIGTERM', () => {
  io.close();
  server.close(() => process.exit(0));
});
