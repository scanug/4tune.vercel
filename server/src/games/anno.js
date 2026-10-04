// Regole di "Indovina l'Anno". Ogni round è una carta del mazzo
// (data/anno/cards.json, generato da scripts/build-anno-deck.mjs): i giocatori
// scelgono un anno dentro un intervallo, chi si avvicina di più vince il round.
//
// L'intervallo dello slider lo sceglie il server per ogni carta: ha una
// larghezza fissa per categoria e l'anno giusto cade in un punto a caso,
// così i bordi non suggeriscono la risposta.

import { readFileSync } from 'node:fs';
import { GameError, shuffle } from '../engine.js';

export const ANNO_CATEGORIES = [
  { id: 'personaggi', label: 'Personaggi', emoji: '🎂', span: 120 },
  { id: 'storia', label: 'Eventi storici', emoji: '🏛️', span: 250 },
  { id: 'invenzioni', label: 'Invenzioni e prodotti', emoji: '💡', span: 200 },
  { id: 'media', label: 'Film, serie e videogiochi', emoji: '🎬', span: 60 },
  { id: 'musica', label: 'Musica', emoji: '🎵', span: 60 },
  { id: 'sport', label: 'Sport', emoji: '⚽', span: 120 },
  { id: 'attualita', label: 'Attualità', emoji: '📰', span: 20 },
];
const CATEGORY = new Map(ANNO_CATEGORIES.map((c) => [c.id, c]));

export const ANNO_LIMITS = {
  maxRounds: [1, 20],
  roundMs: [10000, 60000],
};

export const ANNO_SCORING = {
  maxDistancePoints: 100, // anno esatto
  exactBonus: 50,
  winnerBonus: 50,        // al più vicino del round (a pari distanza: a tutti)
};

const PREP_MS = 2500;

export function currentYear(now = Date.now()) {
  return new Date(now).getUTCFullYear();
}

export function loadDeck(file) {
  try {
    const cards = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(cards) ? cards.filter((c) => CATEGORY.has(c.category) && Number.isInteger(c.year)) : [];
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('[anno] mazzo non leggibile:', err.message);
    return [];
  }
}

export function categorySummary(deck) {
  return ANNO_CATEGORIES.map(({ id, label, emoji }) => ({
    id, label, emoji, count: deck.filter((c) => c.category === id).length,
  }));
}

function clamp(value, [min, max], fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function clampAnnoSettings(input = {}) {
  const wanted = Array.isArray(input.categories) ? input.categories.filter((c) => CATEGORY.has(c)) : [];
  return {
    maxRounds: clamp(input.maxRounds, ANNO_LIMITS.maxRounds, 10),
    roundMs: clamp(input.roundMs, ANNO_LIMITS.roundMs, 20000),
    prepMs: PREP_MS,
    categories: wanted.length ? [...new Set(wanted)] : ANNO_CATEGORIES.map((c) => c.id),
  };
}

// Intervallo [min, max] largo `span` anni che contiene `year` in un punto a
// caso. Il bordo basso è arrotondato a 5 per avere tacche leggibili; se
// sforerebbe nel futuro si fa scorrere indietro fino all'anno corrente.
export function pickRange(year, span, rng = Math.random, maxYear = currentYear()) {
  const r = Math.floor(rng() * (span - 4));
  let min = Math.floor((year - r) / 5) * 5;
  let max = min + span;
  if (max > maxYear) { max = Math.max(maxYear, year); min = max - span; }
  return { min, max };
}

// Punti per distanza: curva quadratica, piena all'anno esatto e a zero a metà
// intervallo. Premia molto chi è preciso, poco chi tira a caso.
export function distancePoints(distance, span, scoring = ANNO_SCORING) {
  const ratio = Math.min(1, Math.abs(distance) / (span / 2));
  return Math.round(scoring.maxDistancePoints * (1 - ratio) ** 2);
}

// Sceglie le carte alternando le categorie (mai tre di fila della stessa se
// ce ne sono altre) e preferendo quelle non ancora uscite in questa stanza.
export function buildAnnoRounds(deck, settings, used = new Set(), rng = Math.random, maxYear = currentYear()) {
  const pools = settings.categories
    .map((id) => {
      const cards = deck.filter((c) => c.category === id);
      const fresh = shuffle(cards.filter((c) => !used.has(c.id)), rng);
      const seen = shuffle(cards.filter((c) => used.has(c.id)), rng);
      return { id, cards: [...fresh, ...seen] };
    })
    .filter((p) => p.cards.length > 0);
  if (pools.length === 0) throw new GameError('Nessuna carta disponibile per le categorie scelte', 'deck');

  const rounds = [];
  let order = [];
  while (rounds.length < settings.maxRounds && pools.some((p) => p.cards.length)) {
    if (order.length === 0) order = shuffle(pools.filter((p) => p.cards.length), rng);
    const pool = order.shift();
    const card = pool.cards.shift();
    if (!card) continue;
    const { span } = CATEGORY.get(card.category);
    rounds.push({ card, span, range: pickRange(card.year, span, rng, maxYear) });
  }
  return rounds;
}

export function scoreAnnoRound(round, answers, scoring = ANNO_SCORING) {
  const { year } = round.card;
  const scored = answers.map(({ playerId, choice, at }) => {
    const distance = Math.abs(choice - year);
    return { playerId, guess: choice, distance, at, exact: distance === 0 };
  });
  const best = scored.length ? Math.min(...scored.map((s) => s.distance)) : null;
  // Chi ha tirato lontanissimo non "vince" solo perché era l'unico a rispondere:
  // serve almeno qualche punto di distanza.
  const winnerIds = scored
    .filter((s) => s.distance === best && distancePoints(s.distance, round.span, scoring) > 0)
    .map((s) => s.playerId);

  const results = scored.map((s) => {
    const base = distancePoints(s.distance, round.span, scoring);
    const winner = winnerIds.includes(s.playerId);
    const points = base + (s.exact ? scoring.exactBonus : 0) + (winner ? scoring.winnerBonus : 0);
    return { playerId: s.playerId, guess: s.guess, distance: s.distance, exact: s.exact, winner, base, points };
  });
  results.sort((a, b) => a.distance - b.distance);
  return { results, winnerIds };
}

export function createAnnoGame(deck, { now = Date.now } = {}) {
  return {
    id: 'anno',
    // Il reveal ha un'animazione di qualche secondo: serve più tempo per goderselo.
    config: { revealMs: 9000, finalRevealMs: 10000 },

    clampSettings: clampAnnoSettings,

    prepare(_input, settings) {
      if (!deck.some((c) => settings.categories.includes(c.category))) {
        throw new GameError('Mazzo non disponibile per le categorie scelte', 'deck');
      }
      return { used: new Set() };
    },

    buildRounds(room, rng) {
      const rounds = buildAnnoRounds(deck, room.settings, room.content.used, rng, currentYear(now()));
      for (const r of rounds) room.content.used.add(r.card.id);
      return rounds;
    },

    publicView(room, current, showRound) {
      const round = showRound ? {
        category: current.card.category,
        title: current.card.title,
        subtitle: current.card.subtitle || null,
        range: current.range,
      } : null;
      return {
        round,
        categories: categorySummary(deck).filter((c) => room.settings.categories.includes(c.id)),
      };
    },

    parseAnswer(current, choice) {
      const year = Number(choice);
      if (!Number.isInteger(year) || year < current.range.min || year > current.range.max) {
        throw new GameError('Anno non valido', 'choice');
      }
      return year;
    },

    score(_room, current, answers) {
      const { results, winnerIds } = scoreAnnoRound(current, answers);
      const { card } = current;
      return {
        results,
        reveal: {
          year: card.year,
          category: card.category,
          title: card.title,
          subtitle: card.subtitle || null,
          description: card.description || null,
          image: card.image || null,
          wikiUrl: card.wikiUrl || null,
          range: current.range,
          winnerIds,
        },
      };
    },
  };
}
