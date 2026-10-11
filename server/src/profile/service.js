// Profilo condiviso tra dispositivi. L'identità è quella dell'Anno del Giorno
// (nickname + token segreto): niente password né email.
//
// Ogni dispositivo ha uno spazio suo (`device_id`) dove carica le proprie
// statistiche e i propri trofei così come sono nel browser, e scarica quelli
// degli altri. Unirli tocca al client (lib/stats.js): ogni dispositivo
// sovrascrive solo il suo spazio, quindi sincronizzare due volte non conta
// mai due volte la stessa partita.
//
// Per collegare un dispositivo nuovo, quello già collegato chiede un codice
// breve (valido 10 minuti, usabile una volta); il nuovo lo riscatta e riceve
// un token tutto suo per lo stesso nickname.

import { randomBytes, randomInt } from 'node:crypto';
import { GameError } from '../engine.js';
import { hashToken } from '../daily/service.js';

export const LINK_TTL_MS = 10 * 60_000;
export const CODE_LENGTH = 6;
// Niente 0/O, 1/I/L: il codice si legge ad alta voce o si copia a mano.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MAX_DEVICES = 20;
const MAX_DATA_BYTES = 12 * 1024;
const DEVICE_ID = /^[A-Za-z0-9_-]{8,64}$/;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS profile_devices (
    player_id uuid NOT NULL REFERENCES daily_players(id) ON DELETE CASCADE,
    device_id text NOT NULL,
    data jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (player_id, device_id)
  )`,
  `CREATE TABLE IF NOT EXISTS profile_link_codes (
    code text PRIMARY KEY,
    player_id uuid NOT NULL REFERENCES daily_players(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL
  )`,
];

// "k7q-42m", "K7Q 42M" e "K7Q42M" sono lo stesso codice.
export function normalizeCode(raw) {
  return String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function newCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

// `auth(token) → { id, name }` è quella del servizio dell'Anno del Giorno.
export function createProfileService({ db, auth, now = Date.now }) {
  async function init() {
    for (const sql of SCHEMA) await db.query(sql);
  }

  // Carica lo spazio di questo dispositivo e restituisce quelli di tutti.
  async function sync(token, deviceId, data) {
    const player = await auth(token);
    if (typeof deviceId !== 'string' || !DEVICE_ID.test(deviceId)) throw new GameError('Dispositivo non valido', 'device');
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new GameError('Dati non validi', 'data');
    const json = JSON.stringify(data);
    if (Buffer.byteLength(json) > MAX_DATA_BYTES) throw new GameError('Profilo troppo grande', 'data');

    await db.query(
      `INSERT INTO profile_devices (player_id, device_id, data, updated_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (player_id, device_id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
      [player.id, deviceId, json, new Date(now())],
    );
    // Browser svuotati più e più volte: si tengono i dispositivi più recenti.
    await db.query(
      `DELETE FROM profile_devices WHERE player_id = $1 AND device_id NOT IN (
         SELECT device_id FROM profile_devices WHERE player_id = $1 ORDER BY updated_at DESC LIMIT ${MAX_DEVICES}
       )`,
      [player.id],
    );
    const { rows } = await db.query(
      'SELECT device_id, data, updated_at FROM profile_devices WHERE player_id = $1 ORDER BY updated_at DESC',
      [player.id],
    );
    return {
      playerId: player.id,
      name: player.name,
      devices: rows.map((r) => ({ deviceId: r.device_id, data: r.data, updatedAt: new Date(r.updated_at).getTime() })),
    };
  }

  // Un solo codice attivo per profilo: chiederne un altro annulla il precedente.
  async function createLinkCode(token) {
    const player = await auth(token);
    const t = new Date(now());
    await db.query('DELETE FROM profile_link_codes WHERE expires_at <= $1 OR player_id = $2', [t, player.id]);
    const expiresAt = new Date(now() + LINK_TTL_MS);
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newCode();
      const { rows } = await db.query(
        `INSERT INTO profile_link_codes (code, player_id, expires_at) VALUES ($1, $2, $3)
         ON CONFLICT (code) DO NOTHING RETURNING code`,
        [code, player.id, expiresAt],
      );
      if (rows[0]) return { code, expiresAt: expiresAt.getTime() };
    }
    throw new GameError('Riprova tra un attimo', 'busy');
  }

  // Riscatta il codice (una volta sola) e consegna un token nuovo per il profilo.
  async function link(rawCode) {
    const code = normalizeCode(rawCode);
    if (code.length !== CODE_LENGTH) throw new GameError(`Il codice è di ${CODE_LENGTH} caratteri`, 'code');
    const { rows } = await db.query(
      'DELETE FROM profile_link_codes WHERE code = $1 AND expires_at > $2 RETURNING player_id',
      [code, new Date(now())],
    );
    if (!rows[0]) throw new GameError('Codice sbagliato o scaduto', 'code');
    const playerId = rows[0].player_id;
    const token = randomBytes(24).toString('base64url');
    await db.query('INSERT INTO daily_tokens (token_hash, player_id) VALUES ($1, $2)', [hashToken(token), playerId]);
    const player = await db.query('SELECT name FROM daily_players WHERE id = $1', [playerId]);
    return { playerId, name: player.rows[0].name, token };
  }

  return { init, sync, createLinkCode, link };
}
