// Logica di gioco pura del GTS: nessun timer, nessuna rete, nessuno stato
// globale. Tutto quello che qui dentro dipende dal caso riceve un `rng`
// iniettabile, così i test sono deterministici.

export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // niente I/O/0/1

export const LIMITS = {
  maxRounds: [1, 20],
  roundMs: [5000, 30000],
  prepMs: [1000, 10000],
  nameLength: 20,
  maxPlayers: 32,
  optionsPerRound: 4,
};

export const SCORING = {
  base: 50,
  maxSpeedBonus: 50,
};

export class GameError extends Error {
  constructor(message, code = 'game') {
    super(message);
    this.name = 'GameError';
    this.code = code;
  }
}

export function generateCode(length = 4, rng = Math.random) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS.charAt(Math.floor(rng() * CODE_CHARS.length));
  }
  return code;
}

export function shuffle(array, rng = Math.random) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function clamp(value, [min, max], fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function clampSettings(input = {}) {
  return {
    maxRounds: clamp(input.maxRounds, LIMITS.maxRounds, 5),
    roundMs: clamp(input.roundMs, LIMITS.roundMs, 15000),
    prepMs: clamp(input.prepMs, LIMITS.prepMs, 3000),
  };
}

export function sanitizeName(raw) {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.nameLength);
  if (!name) throw new GameError('Inserisci un nickname', 'name');
  return name;
}

// Due tracce con lo stesso titolo (remix, live, edizioni diverse) devono
// contare come una sola, altrimenti tra le opzioni compaiono due risposte
// identiche e una delle due viene segnata sbagliata.
export function normalizeTitle(title) {
  return String(title ?? '')
    .toLowerCase()
    .replace(/\s*[([].*?[)\]]\s*/g, ' ') // (feat. X), [Remastered]
    .replace(/\s*-\s*(remaster(ed)?|live|radio edit|remix|version|edit).*$/i, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function dedupeTracks(tracks) {
  const seen = new Set();
  const out = [];
  for (const t of tracks || []) {
    if (!t || !t.previewUrl || !t.title) continue;
    const key = normalizeTitle(t.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

// Costruisce tutti i round in anticipo: nessuna canzone si ripete e ogni
// round ha 4 titoli distinti. Restituisce meno round di `maxRounds` se la
// playlist non ne ha abbastanza.
export function buildRounds(tracks, maxRounds, rng = Math.random) {
  const unique = dedupeTracks(tracks);
  if (unique.length < LIMITS.optionsPerRound) {
    throw new GameError('La playlist ha meno di 4 brani utilizzabili', 'playlist');
  }
  const order = shuffle(unique, rng);
  const targets = order.slice(0, Math.min(maxRounds, unique.length));
  return targets.map((track) => {
    const others = shuffle(unique.filter((t) => t !== track), rng).slice(0, LIMITS.optionsPerRound - 1);
    const options = shuffle([track, ...others], rng).map((t) => t.title);
    return {
      track,
      options,
      correctIndex: options.indexOf(track.title),
    };
  });
}

// Punti per una risposta corretta: base fissa più bonus lineare che scende
// da `maxSpeedBonus` (risposta istantanea) a 0 (fine round).
export function scoreAnswer(deltaMs, roundMs, scoring = SCORING) {
  const ratio = Math.min(1, Math.max(0, deltaMs / Math.max(1, roundMs)));
  return scoring.base + Math.round(scoring.maxSpeedBonus * (1 - ratio));
}
