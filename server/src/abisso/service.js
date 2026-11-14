import { readFileSync } from 'node:fs';
import { GameError, shuffle } from '../engine.js';
import { dayNumber, nextRomeMidnight, romeDay } from '../daily/time.js';
import { streaks } from '../daily/service.js';

export const ABISSO_TOTAL = 7;
export const ABISSO_ANSWER_MS = 25_000;
export const ABISSO_MAX_DEPTH = ABISSO_TOTAL * 1000;
const LEADERBOARD_SIZE = 50;

export const ABISSO_TIERS = [
  { id: 'plancton', label: 'Plancton', minShare: 0.35, points: 10 },
  { id: 'ovvia', label: 'Furbo... mica tanto', minShare: 0.2, points: 15 },
  { id: 'branco', label: 'Nel branco', minShare: 0.1, points: 30 },
  { id: 'rara', label: 'Risposta rara', minShare: 0.04, points: 60 },
  { id: 'perla', label: 'Perla degli abissi', minShare: 0.015, points: 85 },
  { id: 'unica', label: 'Creatura abissale', minShare: 0, points: 100 },
];

export function normalizeAnswer(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function tierForShare(share) {
  return ABISSO_TIERS.find((tier) => share >= tier.minShare) || ABISSO_TIERS.at(-1);
}

// Le risposte sono ordinate dalla più prevedibile alla più originale. La curva
// fornisce una distribuzione iniziale anche quando nessuno ha ancora giocato.
export function expectedShare(prompt, answerIndex) {
  if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= prompt.answers.length) return 0;
  const weights = prompt.answers.map((_, index) => Math.exp(-index / 2.2));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return weights[answerIndex] / total;
}

export function loadAbissoPrompts(path) {
  let prompts;
  try { prompts = JSON.parse(readFileSync(path, 'utf8')); } catch (err) {
    throw new Error(`Mazzo di Abisso non leggibile: ${err.message}`);
  }
  if (!Array.isArray(prompts) || prompts.length < ABISSO_TOTAL) throw new Error('Abisso: servono almeno 7 domande');
  const ids = new Set();
  for (const prompt of prompts) {
    if (!prompt?.id || ids.has(prompt.id) || !prompt.question || !Array.isArray(prompt.answers) || prompt.answers.length < 2) {
      throw new Error('Abisso: domanda non valida o id duplicato');
    }
    ids.add(prompt.id);
    const answers = new Set();
    for (const item of prompt.answers) {
      const answer = typeof item === 'string' ? item : item?.answer;
      const aliases = typeof item === 'string' ? [] : item?.aliases || [];
      if (!answer || !Array.isArray(aliases)) throw new Error(`Abisso: risposta non valida in ${prompt.id}`);
      for (const value of [answer, ...aliases]) {
        const key = normalizeAnswer(value);
        if (!key || answers.has(key)) throw new Error(`Abisso: alias vuoto o duplicato in ${prompt.id}`);
        answers.add(key);
      }
    }
  }
  return prompts;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS abisso_days (
    day text PRIMARY KEY,
    prompt_ids jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS abisso_attempts (
    player_id uuid NOT NULL REFERENCES daily_players(id) ON DELETE CASCADE,
    day text NOT NULL REFERENCES abisso_days(day),
    answers jsonb NOT NULL DEFAULT '[]'::jsonb,
    score integer NOT NULL DEFAULT 0,
    deadline_at timestamptz,
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    PRIMARY KEY (player_id, day)
  )`,
  `CREATE TABLE IF NOT EXISTS abisso_answers (
    player_id uuid NOT NULL,
    day text NOT NULL,
    prompt_index integer NOT NULL,
    answer text,
    points integer NOT NULL DEFAULT 0,
    PRIMARY KEY (player_id, day, prompt_index),
    FOREIGN KEY (player_id, day) REFERENCES abisso_attempts(player_id, day) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS abisso_answers_popularity ON abisso_answers (day, prompt_index, answer)`,
  `CREATE INDEX IF NOT EXISTS abisso_attempts_day_score ON abisso_attempts (day, score DESC) WHERE completed_at IS NOT NULL`,
];

function answerData(item) {
  return typeof item === 'string' ? { answer: item, aliases: [] } : item;
}

function timestampMs(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function publicPrompt(prompt, index, deadline = null) {
  return { index, question: prompt.question, deadline };
}

export function createAbissoService({ db, prompts, auth, now = Date.now, rng = Math.random }) {
  const byId = new Map(prompts.map((prompt) => [prompt.id, prompt]));
  const aliases = new Map(prompts.map((prompt) => {
    const map = new Map();
    prompt.answers.forEach((item, answerIndex) => {
      const data = answerData(item);
      for (const value of [data.answer, ...data.aliases]) map.set(normalizeAnswer(value), { answer: data.answer, answerIndex });
    });
    return [prompt.id, map];
  }));

  async function init() {
    for (const sql of SCHEMA) await db.query(sql);
  }

  function info(day) {
    return {
      day,
      number: dayNumber(day),
      total: ABISSO_TOTAL,
      answerMs: ABISSO_ANSWER_MS,
      maxDepth: ABISSO_MAX_DEPTH,
      nextAt: nextRomeMidnight(now()),
    };
  }

  async function promptsFor(day) {
    const found = await db.query('SELECT prompt_ids FROM abisso_days WHERE day = $1', [day]);
    if (found.rows[0]) return found.rows[0].prompt_ids.map((id) => byId.get(id));

    const previous = await db.query('SELECT prompt_ids FROM abisso_days');
    const used = new Set(previous.rows.flatMap((row) => row.prompt_ids));
    const fresh = shuffle(prompts.filter((prompt) => !used.has(prompt.id)), rng);
    const picked = fresh.slice(0, ABISSO_TOTAL);
    if (picked.length < ABISSO_TOTAL) {
      picked.push(...shuffle(prompts.filter((prompt) => !picked.includes(prompt)), rng).slice(0, ABISSO_TOTAL - picked.length));
    }
    const ids = picked.map((prompt) => prompt.id);
    await db.query('INSERT INTO abisso_days (day, prompt_ids) VALUES ($1, $2) ON CONFLICT (day) DO NOTHING', [day, JSON.stringify(ids)]);
    const { rows } = await db.query('SELECT prompt_ids FROM abisso_days WHERE day = $1', [day]);
    return rows[0].prompt_ids.map((id) => byId.get(id));
  }

  async function attemptOf(playerId, day) {
    const { rows } = await db.query(
      'SELECT answers, score, deadline_at, completed_at FROM abisso_attempts WHERE player_id = $1 AND day = $2',
      [playerId, day],
    );
    return rows[0] || null;
  }

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
      depth: (attempt?.score || 0) * 10,
    };
    return out;
  }

  async function submit(player, day, dailyPrompts, index, rawAnswer) {
    const attempt = await attemptOf(player.id, day);
    if (!attempt) throw new GameError('Immersione non iniziata', 'state');
    if (attempt.completed_at) throw new GameError('Hai già completato l’immersione di oggi', 'done');
    if (!Number.isInteger(index) || index !== attempt.answers.length || !dailyPrompts[index]) {
      throw new GameError('Questa domanda è già stata giocata', 'dup');
    }
    const deadline = timestampMs(attempt.deadline_at);
    if (!deadline) throw new GameError('La domanda non è ancora attiva', 'state');

    const expired = now() >= deadline;
    const raw = String(rawAnswer || '').trim().slice(0, 120);
    const prompt = dailyPrompts[index];
    const match = expired ? null : aliases.get(prompt.id).get(normalizeAnswer(raw)) || null;
    const canonical = match?.answer || null;
    if (raw && !canonical && !expired) {
      throw new GameError('Non la riconosco per questa domanda. Prova un’altra risposta!', 'invalid');
    }

    let entry = { answer: null, input: raw || null, count: 0, percentage: 0, tier: 'mancata', label: expired ? 'Tempo scaduto' : 'Nessuna risposta', points: 0, depth: 0 };
    if (canonical) {
      const { rows } = await db.query(
        `SELECT answer, COUNT(*)::int AS count FROM abisso_answers
         WHERE day = $1 AND prompt_index = $2 AND answer IS NOT NULL GROUP BY answer`,
        [day, index],
      );
      const previous = rows.find((row) => row.answer === canonical)?.count || 0;
      const previousTotal = rows.reduce((sum, row) => sum + row.count, 0);
      const count = previous + 1;
      const total = previousTotal + 1;
      const baselinePlayers = 60;
      const baseline = expectedShare(prompt, match.answerIndex) * baselinePlayers;
      const scoringShare = (baseline + previous) / (baselinePlayers + previousTotal);
      const tier = tierForShare(scoringShare);
      entry = {
        answer: canonical,
        input: raw,
        count,
        percentage: Math.round((count / total) * 100),
        tier: tier.id,
        label: tier.label,
        points: tier.points,
        depth: tier.points * 10,
      };
    }

    const last = index === ABISSO_TOTAL - 1;
    const { rows } = await db.query(
      `WITH updated AS (
         UPDATE abisso_attempts
            SET answers = answers || $3::jsonb,
                score = score + $4,
                deadline_at = NULL,
                completed_at = CASE WHEN $5 THEN now() ELSE completed_at END
          WHERE player_id = $1 AND day = $2 AND completed_at IS NULL
            AND jsonb_array_length(answers) = $6 AND deadline_at IS NOT NULL
          RETURNING score
       ), saved AS (
         INSERT INTO abisso_answers (player_id, day, prompt_index, answer, points)
         SELECT $1, $2, $6, $7, $4 FROM updated
         ON CONFLICT (player_id, day, prompt_index) DO NOTHING
         RETURNING player_id
       )
       SELECT score FROM updated`,
      [player.id, day, JSON.stringify([entry]), entry.points, last, index, canonical],
    );
    if (!rows[0]) throw new GameError('Questa domanda è già stata giocata', 'dup');
    return { result: entry, depth: rows[0].score * 10, done: last };
  }

  async function start(token) {
    const player = await auth(token);
    const day = romeDay(now());
    const dailyPrompts = await promptsFor(day);
    await db.query(
      `INSERT INTO abisso_attempts (player_id, day) VALUES ($1, $2)
       ON CONFLICT (player_id, day) DO NOTHING`,
      [player.id, day],
    );

    let attempt = await attemptOf(player.id, day);
    while (attempt && !attempt.completed_at && timestampMs(attempt.deadline_at) !== null && timestampMs(attempt.deadline_at) <= now()) {
      await submit(player, day, dailyPrompts, attempt.answers.length, null);
      attempt = await attemptOf(player.id, day);
    }
    if (attempt.completed_at) return { ...info(day), index: ABISSO_TOTAL, depth: attempt.score * 10, done: true, prompt: null };

    const index = attempt.answers.length;
    if (!attempt.deadline_at) {
      const deadline = now() + ABISSO_ANSWER_MS;
      await db.query(
        `UPDATE abisso_attempts SET deadline_at = to_timestamp($3 / 1000.0)
         WHERE player_id = $1 AND day = $2 AND completed_at IS NULL AND deadline_at IS NULL AND jsonb_array_length(answers) = $4`,
        [player.id, day, deadline, index],
      );
      return { ...info(day), index, depth: attempt.score * 10, done: false, prompt: publicPrompt(dailyPrompts[index], index, deadline) };
    }
    return { ...info(day), index, depth: attempt.score * 10, done: false, prompt: publicPrompt(dailyPrompts[index], index, timestampMs(attempt.deadline_at)) };
  }

  async function answer(token, index, rawAnswer) {
    const player = await auth(token);
    const day = romeDay(now());
    const dailyPrompts = await promptsFor(day);
    return submit(player, day, dailyPrompts, Number(index), rawAnswer);
  }

  async function review(token, rawDay) {
    const player = await auth(token);
    const day = rawDay || romeDay(now());
    const attempt = await attemptOf(player.id, day);
    if (!attempt?.completed_at) throw new GameError('Completa prima l’immersione', 'state');
    const dailyPrompts = await promptsFor(day);
    return {
      ...info(day),
      depth: attempt.score * 10,
      prompts: dailyPrompts.map((prompt, index) => ({ index, question: prompt.question, answer: attempt.answers[index] || null })),
    };
  }

  async function leaderboard(scope, token) {
    const player = token ? await auth(token).catch(() => null) : null;
    const day = romeDay(now());
    const ranked = scope === 'all'
      ? `SELECT p.id, p.name, SUM(a.score)::int AS score, COUNT(*)::int AS days,
                RANK() OVER (ORDER BY SUM(a.score) DESC)::int AS rank
           FROM abisso_attempts a JOIN daily_players p ON p.id = a.player_id
          WHERE a.completed_at IS NOT NULL GROUP BY p.id, p.name`
      : `SELECT p.id, p.name, a.score, 1 AS days,
                RANK() OVER (ORDER BY a.score DESC)::int AS rank
           FROM abisso_attempts a JOIN daily_players p ON p.id = a.player_id
          WHERE a.completed_at IS NOT NULL AND a.day = $1`;
    const params = scope === 'all' ? [] : [day];
    const n = params.length;
    const { rows } = await db.query(`WITH ranked AS (${ranked}) SELECT * FROM ranked ORDER BY rank, name LIMIT ${LEADERBOARD_SIZE}`, params);
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
      rows: rows.map((row) => ({ rank: row.rank, name: row.name, depth: row.score * 10, days: row.days, me: player?.id === row.id })),
      me: me ? { ...me, depth: me.score * 10 } : null,
    };
  }

  async function stats(token) {
    const player = await auth(token);
    const day = romeDay(now());
    const { rows } = await db.query(
      `SELECT day, score, answers FROM abisso_attempts
       WHERE player_id = $1 AND completed_at IS NOT NULL ORDER BY day DESC`,
      [player.id],
    );
    const depths = rows.map((row) => row.score * 10);
    const series = streaks(rows.map((row) => row.day), day);
    return {
      name: player.name,
      daysPlayed: rows.length,
      currentStreak: series.current,
      bestStreak: series.best,
      bestDepth: depths.length ? Math.max(...depths) : 0,
      averageDepth: depths.length ? Math.round(depths.reduce((a, b) => a + b, 0) / depths.length) : 0,
      totalDepth: depths.reduce((a, b) => a + b, 0),
      rareAnswers: rows.reduce((sum, row) => sum + row.answers.filter((answer) => answer.points >= 85).length, 0),
      maxDepth: ABISSO_MAX_DEPTH,
      history: rows.slice(0, 30).map((row) => ({ day: row.day, number: dayNumber(row.day), depth: row.score * 10 })),
    };
  }

  return { init, today, start, answer, review, leaderboard, stats };
}
