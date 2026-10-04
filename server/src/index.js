// Server di gioco 4Tune: HTTP per Deezer, mazzo dell'Anno, Anno del Giorno e
// health check; Socket.IO per le stanze (GTS sul namespace "/", Indovina
// l'Anno su "/anno"). Le stanze vivono in memoria finché dura la partita (un
// redeploy le azzera); solo l'Anno del Giorno salva su Postgres.
//
// Variabili d'ambiente:
//   PORT            porta di ascolto (Render e Railway la impostano da soli)
//   CLIENT_ORIGIN   origin ammessi, separati da virgola (es. https://4tune.vercel.app,http://localhost:3000)
//                   se assente accetta qualsiasi origin (comodo in sviluppo)
//   DATABASE_URL    Postgres per l'Anno del Giorno (Neon). Se assente, in sviluppo
//                   si usa un database in memoria.

import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';

import { RoomManager } from './rooms.js';
import { attachSockets } from './socket.js';
import { fetchPlaylist, getPresets, playlistSummary, searchPlaylists } from './deezer.js';
import { GameError } from './engine.js';
import { categorySummary, createAnnoGame, loadDeck } from './games/anno.js';
import { connectDailyDb } from './daily/db.js';
import { createDailyService } from './daily/service.js';
import { createDailyRoutes } from './daily/http.js';

const annoDeck = loadDeck(fileURLToPath(new URL('../data/anno/cards.json', import.meta.url)));

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

const MAX_BODY = 16 * 1024;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) { reject(new GameError('Richiesta troppo grande', 'body')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new GameError('JSON non valido', 'body')); }
    });
    req.on('error', reject);
  });
}

// L'Anno del Giorno parte appena il database risponde; se non risponde
// (Neon in avvio, rete) si riprova ogni 30 secondi e intanto le sue rotte danno 503.
let dailyService = null;
const dailyRoutes = createDailyRoutes(() => dailyService);

async function startDaily() {
  try {
    const conn = await connectDailyDb();
    if (!conn) { console.warn('[daily] nessun database configurato: Anno del Giorno disattivato'); return; }
    const service = createDailyService({ db: conn.db, deck: annoDeck });
    await service.init();
    dailyService = service;
    console.log(`[daily] pronto (${conn.kind})`);
  } catch (err) {
    console.error('[daily] database non raggiungibile, riprovo tra 30s:', err.message);
    setTimeout(startDaily, 30_000);
  }
}

async function handleHttp(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': corsOrigin(req),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    });
    return res.end();
  }

  if (url.pathname.startsWith('/daily/')) {
    try {
      const body = req.method === 'POST' ? await readJsonBody(req) : null;
      const { status, payload } = await dailyRoutes(req, url, body);
      return sendJson(req, res, status, payload, { 'Cache-Control': 'no-store' });
    } catch (err) {
      return sendJson(req, res, 400, { error: err instanceof GameError ? err.message : 'Richiesta non valida' });
    }
  }

  if (req.method !== 'GET') return sendJson(req, res, 405, { error: 'Metodo non consentito' });

  try {
    if (url.pathname === '/health') {
      return sendJson(req, res, 200, {
        ok: true,
        rooms: manager.rooms.size + annoManager.rooms.size,
        annoCards: annoDeck.length,
        daily: !!dailyService,
        uptime: process.uptime(),
      });
    }
    if (url.pathname === '/anno/categories') {
      return sendJson(req, res, 200, { data: categorySummary(annoDeck) }, { 'Cache-Control': 'public, max-age=300' });
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
  onRoomRemoved: (room) => console.log(`[gts] chiusa ${room.code}`),
});
const annoManager = new RoomManager({
  game: createAnnoGame(annoDeck),
  onRoomRemoved: (room) => console.log(`[anno] chiusa ${room.code}`),
});

const server = http.createServer(handleHttp);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length ? allowedOrigins : true,
    methods: ['GET', 'POST'],
  },
});
attachSockets(io, manager, {
  loadRoomInput: async (payload) => ({ playlist: await fetchPlaylist(payload.playlistId) }),
});
attachSockets(io.of('/anno'), annoManager);

server.listen(port, () => {
  console.log(`4Tune server in ascolto su :${port}` + (allowedOrigins.length ? ` (origin: ${allowedOrigins.join(', ')})` : ' (origin: tutti)'));
  console.log(`[anno] mazzo: ${annoDeck.length} carte`);
  startDaily();
});

process.on('SIGTERM', () => {
  io.close();
  server.close(() => process.exit(0));
});
