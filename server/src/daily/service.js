// "L'Anno del Giorno": sfida quotidiana single player sulle carte di
// Indovina l'Anno, con classifica condivisa salvata su Postgres.
//
// Il server resta l'unica autorità: sceglie le carte del giorno, le consegna
// una alla volta e rivela l'anno solo dopo aver ricevuto la risposta.
// Il database lo usa solo questo modulo (nessun accesso dal browser).
//
// `db` è qualunque oggetto con `query(text, params) → { rows }`: un Pool di
// `pg` in produzione, PGlite nei test e in sviluppo.

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { GameError, sanitizeName, shuffle } from '../engine.js';
import { ANNO_CATEGORIES, ANNO_SCORING, currentYear, distancePoints, pickRange } from '../games/anno.js';
import { addDays, dayNumber, nextRomeMidnight, romeDay } from './time.js';

// 10 carte: una per categoria, più qualche extra da categorie estratte a caso.
export const DAILY_TOTAL = 10;
const EXTRA_CARDS = DAILY_TOTAL - ANNO_CATEGORIES.length;
export const MAX_SCORE = DAILY_TOTAL * (ANNO_SCORING.maxDistancePoints + ANNO_SCORING.exactBonus);
const LEADERBOARD_SIZE = 50;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS daily_players (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    name_key text NOT NULL UNIQUE,
    token_hash text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS daily_days (
    day text PRIMARY KEY,
    cards jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS daily_attempts (
    player_id uuid NOT NULL REFERENCES daily_players(id) ON DELETE CASCADE,
    day text NOT NULL REFERENCES daily_days(day),
    answers jsonb NOT NULL DEFAULT '[]'::jsonb,
    score integer NOT NULL DEFAULT 0,
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    PRIMARY KEY (player_id, day)
  )`,
  `CREATE INDEX IF NOT EXISTS daily_attempts_day_score ON daily_attempts (day, score DESC) WHERE completed_at IS NOT NULL`,
];

function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

// Chiave per l'unicità del nickname: "Giulia", "giulia" e " GIULIA " sono lo stesso.
export function nameKey(name) {
  return name.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function cardPoints(distance, span) {
  return distancePoints(distance, span) + (distance === 0 ? ANNO_SCORING.exactBonus : 0);
}

// Quadratino per la condivisione: dice quanto ci sei andato vicino senza svelare l'anno.
export function resultEmoji({ distance, base }) {
  if (distance === 0) return '🎯';
  if (base >= 80) return '🟩';
  if (base >= 40) return '🟨';
  if (base > 0) return '🟧';
  return '🟥';
}

function publicCard(card, index) {
  return { index, category: card.category, title: card.title, subtitle: card.subtitle, range: card.range };
}

function revealOf(card) {
  return {
    year: card.year,
    category: card.category,
    title: card.title,
    subtitle: card.subtitle,
    description: card.description,
    image: card.image,
    wikiUrl: card.wikiUrl,
    range: card.range,
  };
}

// Serie di giorni consecutivi. `days` ordinati dal più recente. La serie
// attuale resta viva se oggi non hai ancora giocato ma ieri sì.
export function streaks(days, today) {
  const set = new Set(days);
  let current = 0;
  let cursor = set.has(today) ? today : addDays(today, -1);
  while (set.has(cursor)) { current += 1; cursor = addDays(cursor, -1); }
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of [...days].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best };
}

// Riordina in modo che due carte della stessa categoria non siano vicine
// (con 10 carte su 7 categorie è sempre possibile).
export function spreadCategories(cards) {
  const out = [];
  const rest = [...cards];
  while (rest.length) {
    const prev = out[out.length - 1]?.category;
    // Prima la categoria con più carte rimaste, così le ripetute non finiscono in coda insieme.
    const counts = rest.reduce((m, c) => m.set(c.category, (m.get(c.category) || 0) + 1), new Map());
    let best = -1;
    for (let i = 0; i < rest.length; i++) {
      if (rest[i].category === prev) continue;
      if (best === -1 || counts.get(rest[i].category) > counts.get(rest[best].category)) best = i;
    }
    out.push(rest.splice(best === -1 ? 0 : best, 1)[0]);
  }
  return out;
}

export function createDailyService({ db, deck, now = Date.now, rng = Math.random }) {
  const categoryOf = new Map(ANNO_CATEGORIES.map((c) => [c.id, c]));

  async function init() {
    for (const sql of SCHEMA) await db.query(sql);
  }

  // ---------- giocatori ----------

  async function register(rawName) {
    const name = sanitizeName(rawName);
    const token = randomBytes(24).toString('base64url');
    const id = randomUUID();
    const { rows } = await db.query(
      `INSERT INTO daily_players (id, name, name_key, token_hash) VALUES ($1, $2, $3, $4)
       ON CONFLICT (name_key) DO NOTHING RETURNING id`,
      [id, name, nameKey(name), hashToken(token)],
    );
    if (rows.length === 0) throw new GameError(`Il nickname "${name}" è già preso`, 'taken');
    return { playerId: id, name, token };
  }

  async function auth(token) {
    if (!token) throw new GameError('Serve un nickname per giocare', 'auth');
    const { rows } = await db.query('SELECT id, name FROM daily_players WHERE token_hash = $1', [hashToken(token)]);
    if (!rows[0]) throw new GameError('Nickname non riconosciuto su questo dispositivo', 'auth');
    return rows[0];
  }

  // ---------- carte del giorno ----------

  // Una carta per categoria più EXTRA_CARDS da categorie diverse a caso,
  // evitando quelle già uscite nei giorni precedenti (riconosciute anche dal
  // titolo: una carta spostata di categoria cambia id). Finite le carte nuove
  // di una categoria si ricomincia da quella intera.
  async function pickCards() {
    const { rows } = await db.query('SELECT cards FROM daily_days');
    const usedIds = new Set(rows.flatMap((r) => r.cards.map((c) => c.id)));
    const usedTitles = new Set(rows.flatMap((r) => r.cards.map((c) => c.title)));
    const isUsed = (c) => usedIds.has(c.id) || usedTitles.has(c.title);
    const maxYear = currentYear(now());

    const pools = ANNO_CATEGORIES
      .map(({ id }) => {
        const all = deck.filter((c) => c.category === id);
        const fresh = all.filter((c) => !isUsed(c));
        return { id, cards: shuffle(fresh.length >= 2 ? fresh : all, rng) };
      })
      .filter((p) => p.cards.length > 0);
    if (pools.length === 0) throw new GameError('Mazzo non disponibile', 'deck');

    const picked = pools.map((p) => p.cards.shift());
    const extraFrom = shuffle(pools.filter((p) => p.cards.length > 0), rng).slice(0, Math.max(0, DAILY_TOTAL - picked.length));
    for (const p of extraFrom) picked.push(p.cards.shift());

    return spreadCategories(shuffle(picked, rng)).map((c) => {
      const { span } = categoryOf.get(c.category);
      return {
        id: c.id,
        category: c.category,
        title: c.title,
        subtitle: c.subtitle || null,
        year: c.year,
        description: c.description || null,
        image: c.image || null,
        wikiUrl: c.wikiUrl || null,
        span,
        range: pickRange(c.year, span, rng, maxYear),
      };
    });
  }

  // Le carte di un giorno si scelgono alla prima richiesta e restano salvate:
  // aggiungere carte al mazzo non cambia le sfide passate.
  async function cardsFor(day) {
    const found = await db.query('SELECT cards FROM daily_days WHERE day = $1', [day]);
    if (found.rows[0]) return found.rows[0].cards;
    const cards = await pickCards();
    await db.query('INSERT INTO daily_days (day, cards) VALUES ($1, $2) ON CONFLICT (day) DO NOTHING', [day, JSON.stringify(cards)]);
    const { rows } = await db.query('SELECT cards FROM daily_days WHERE day = $1', [day]);
    return rows[0].cards;
  }

  async function attemptOf(playerId, day) {
    const { rows } = await db.query(
      'SELECT answers, score, completed_at FROM daily_attempts WHERE player_id = $1 AND day = $2',
      [playerId, day],
    );
    return rows[0] || null;
  }

  function info(day) {
    return { day, number: dayNumber(day), total: DAILY_TOTAL, maxScore: MAX_SCORE, nextAt: nextRomeMidnight(now()) };
  }

  // Stato della sfida di oggi per chi la chiede (con o senza nickname).
  async function today(token) {
    const day = romeDay(now());
    const out = { ...info(day), me: null };
    if (!token) return out;
    const player = await auth(token);
    const attempt = await attemptOf(player.id, day);
    out.me = {
      name: player.name,
      status: !attempt ? 'new' : attempt.completed_at ? 'done' : 'playing',
      answered: attempt ? attempt.answers.length : 0,
      score: attempt ? attempt.score : 0,
    };
    return out;
  }

  // Inizia o riprende il tentativo di oggi: restituisce la carta a cui si è arrivati.
  async function start(token) {
    const player = await auth(token);
    const day = romeDay(now());
    const cards = await cardsFor(day);
    await db.query(
      'INSERT INTO daily_attempts (player_id, day) VALUES ($1, $2) ON CONFLICT (player_id, day) DO NOTHING',
      [player.id, day],
    );
    const attempt = await attemptOf(player.id, day);
    const index = attempt.answers.length;
    return {
      ...info(day),
      index,
      score: attempt.score,
      done: !!attempt.completed_at,
      card: index < cards.length ? publicCard(cards[index], index) : null,
    };
  }

  async function answer(token, index, rawYear) {
    const player = await auth(token);
    const day = romeDay(now());
    const cards = await cardsFor(day);
    const i = Number(index);
    const card = cards[i];
    if (!Number.isInteger(i) || !card) throw new GameError('Carta non valida', 'index');
    const year = Number(rawYear);
    if (!Number.isInteger(year) || year < card.range.min || year > card.range.max) {
      throw new GameError('Anno non valido', 'choice');
    }

    const distance = Math.abs(year - card.year);
    const base = distancePoints(distance, card.span);
    const points = cardPoints(distance, card.span);
    const entry = { guess: year, distance, base, points, exact: distance === 0 };
    const last = i === cards.length - 1;

    // Aggiornamento condizionato: vale solo se è proprio la carta attesa, così
    // un doppio invio o una carta saltata non passano.
    const { rows } = await db.query(
      `UPDATE daily_attempts
         SET answers = answers || $3::jsonb,
             score = score + $4,
             completed_at = CASE WHEN $5 THEN now() ELSE completed_at END
       WHERE player_id = $1 AND day = $2 AND completed_at IS NULL AND jsonb_array_length(answers) = $6
       RETURNING score`,
      [player.id, day, JSON.stringify([entry]), points, last, i],
    );
    if (!rows[0]) {
      const attempt = await attemptOf(player.id, day);
      if (!attempt) throw new GameError('Sfida non iniziata', 'state');
      if (attempt.completed_at) throw new GameError('Hai già completato la sfida di oggi', 'done');
      throw new GameError('Questa carta è già stata giocata', 'dup');
    }
    return {
      result: { ...entry, ...revealOf(card) },
      score: rows[0].score,
      done: last,
      next: last ? null : publicCard(cards[i + 1], i + 1),
    };
  }

  // A sfida completata: tutte le carte con le risposte, per il riepilogo, la
  // condivisione e la rigiocata d'allenamento (che non tocca la classifica).
  async function review(token, rawDay) {
    const player = await auth(token);
    const day = rawDay || romeDay(now());
    const attempt = await attemptOf(player.id, day);
    if (!attempt?.completed_at) throw new GameError('Completa prima la sfida', 'state');
    const cards = await cardsFor(day);
    return {
      ...info(day),
      score: attempt.score,
      cards: cards.map((c, i) => ({ ...revealOf(c), index: i, span: c.span, answer: attempt.answers[i] || null })),
    };
  }

  // ---------- classifiche e statistiche ----------

  async function leaderboard(scope, token) {
    const player = token ? await auth(token).catch(() => null) : null;
    const day = romeDay(now());
    const ranked = scope === 'all'
      ? `SELECT p.id, p.name, SUM(a.score)::int AS score, COUNT(*)::int AS days,
                RANK() OVER (ORDER BY SUM(a.score) DESC)::int AS rank
           FROM daily_attempts a JOIN daily_players p ON p.id = a.player_id
          WHERE a.completed_at IS NOT NULL
          GROUP BY p.id, p.name`
      : `SELECT p.id, p.name, a.score, 1 AS days,
                RANK() OVER (ORDER BY a.score DESC)::int AS rank
           FROM daily_attempts a JOIN daily_players p ON p.id = a.player_id
          WHERE a.completed_at IS NOT NULL AND a.day = $1`;
    const params = scope === 'all' ? [] : [day];
    const n = params.length;
    const { rows } = await db.query(
      `WITH ranked AS (${ranked})
       SELECT * FROM ranked ORDER BY rank, name LIMIT ${LEADERBOARD_SIZE}`,
      params,
    );
    const count = await db.query(`WITH ranked AS (${ranked}) SELECT COUNT(*)::int AS players FROM ranked`, params);
    let me = null;
    if (player) {
      const mine = await db.query(`WITH ranked AS (${ranked}) SELECT rank, score, days FROM ranked WHERE id = $${n + 1}`, [...params, player.id]);
      if (mine.rows[0]) me = mine.rows[0];
    }
    return {
      scope: scope === 'all' ? 'all' : 'today',
      ...info(day),
      players: count.rows[0].players,
      rows: rows.map((r) => ({ rank: r.rank, name: r.name, score: r.score, days: r.days, me: player?.id === r.id })),
      me,
    };
  }

  async function stats(token) {
    const player = await auth(token);
    const day = romeDay(now());
    const { rows } = await db.query(
      `SELECT day, score FROM daily_attempts
        WHERE player_id = $1 AND completed_at IS NOT NULL ORDER BY day DESC`,
      [player.id],
    );
    const days = rows.map((r) => r.day);
    const { current, best } = streaks(days, day);
    const scores = rows.map((r) => r.score);
    return {
      name: player.name,
      daysPlayed: rows.length,
      currentStreak: current,
      bestStreak: best,
      bestScore: scores.length ? Math.max(...scores) : 0,
      average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      total: scores.reduce((a, b) => a + b, 0),
      maxScore: MAX_SCORE,
      history: rows.slice(0, 30).map((r) => ({ day: r.day, number: dayNumber(r.day), score: r.score })),
    };
  }

  return { init, register, auth, today, start, answer, review, leaderboard, stats };
}
