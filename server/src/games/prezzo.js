// Regole di "Quanto costa?". Ogni round è una carta del mazzo
// (data/prezzo/cards.json, generato da scripts/build-prezzo-deck.mjs): i
// giocatori scelgono un prezzo con lo slider, chi si avvicina di più in
// proporzione vince il round.
//
// I prezzi vanno dall'euro del caffè ai miliardi delle acquisizioni, quindi
// tutto ragiona in scala logaritmica: sbagliare del doppio pesa uguale su un
// cornetto e su un calciatore. Ogni categoria ha uno `span`, il rapporto tra
// massimo e minimo dello slider; il prezzo giusto cade in un punto a caso
// dell'intervallo, così i bordi non suggeriscono la risposta.

import { readFileSync } from 'node:fs';
import { GameError, shuffle } from '../engine.js';

export const PREZZO_CATEGORIES = [
  { id: 'spesa', label: 'Spesa e bar', emoji: '☕', span: 20 },
  { id: 'tecnologia', label: 'Tecnologia', emoji: '📱', span: 20 },
  { id: 'vita', label: 'Vita quotidiana', emoji: '🧾', span: 20 },
  { id: 'calcio', label: 'Calciomercato', emoji: '⚽', span: 100 },
  { id: 'affari', label: 'Affari miliardari', emoji: '💼', span: 100 },
  { id: 'cinema', label: 'Cinema', emoji: '🎬', span: 100 },
  { id: 'aste', label: 'Aste da record', emoji: '🔨', span: 100 },
];
const CATEGORY = new Map(PREZZO_CATEGORIES.map((c) => [c.id, c]));

export const PREZZO_UNITS = ['EUR', 'USD'];

export const PREZZO_LIMITS = {
  maxRounds: [1, 20],
  roundMs: [10000, 60000],
};

export const PREZZO_SCORING = {
  maxDistancePoints: 100, // prezzo esatto
  exactBonus: 50,         // entro il 2%
  winnerBonus: 50,        // al più vicino del round (a pari distanza: a tutti)
  exactRatio: 1.02,
};

const PREP_MS = 2500;

// Posizione del prezzo giusto nell'intervallo, in frazione della scala
// logaritmica: mai a ridosso dei bordi.
const EDGE = 0.1;

// Mantisse "tonde" per i bordi dello slider. Moltiplicate per 20 o 100
// restano tonde, quindi anche il massimo è un numero leggibile.
const NICE = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8];

// Toglie il rumore dei float (0.12000000000000001 → 0.12).
function tidy(n) {
  return Number(n.toPrecision(12));
}

// Arrotondamento di un prezzo come lo mostra lo slider: al centesimo sotto i
// 10, a tre cifre significative sopra (979, 1.490, 222 milioni).
export function roundPrice(value) {
  if (value < 10) return Math.max(0.01, Math.round(value * 100) / 100);
  const unit = 10 ** (Math.floor(Math.log10(value)) - 2);
  return tidy(Math.round(value / unit) * unit);
}

// Il numero tondo più grande che non supera `value`.
export function niceFloor(value) {
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const mantissa = value / base;
  const nice = [...NICE].reverse().find((n) => n <= mantissa + 1e-9) || 1;
  return tidy(nice * base);
}

export function loadDeck(file) {
  try {
    const cards = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(cards)
      ? cards.filter((c) => CATEGORY.has(c.category) && Number.isFinite(c.price) && c.price > 0 && PREZZO_UNITS.includes(c.unit))
      : [];
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('[prezzo] mazzo non leggibile:', err.message);
    return [];
  }
}

export function categorySummary(deck) {
  return PREZZO_CATEGORIES.map(({ id, label, emoji }) => ({
    id, label, emoji, count: deck.filter((c) => c.category === id).length,
  }));
}

function clamp(value, [min, max], fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function clampPrezzoSettings(input = {}) {
  const wanted = Array.isArray(input.categories) ? input.categories.filter((c) => CATEGORY.has(c)) : [];
  return {
    maxRounds: clamp(input.maxRounds, PREZZO_LIMITS.maxRounds, 10),
    roundMs: clamp(input.roundMs, PREZZO_LIMITS.roundMs, 20000),
    prepMs: PREP_MS,
    categories: wanted.length ? [...new Set(wanted)] : PREZZO_CATEGORIES.map((c) => c.id),
  };
}

// Intervallo [min, max] con max/min = `span` che contiene `price` in un punto
// a caso della scala logaritmica, lontano dai bordi. Il minimo è arrotondato
// in basso a un numero tondo: il prezzo si sposta un po' verso destra ma non
// esce mai (al più +0,1 della scala).
export function pickPriceRange(price, span, rng = Math.random) {
  const position = EDGE + rng() * (1 - 3 * EDGE);
  const min = niceFloor(price / span ** position);
  return { min, max: tidy(min * span) };
}

// Distanza in scala logaritmica: sbagliare per eccesso del doppio o per
// difetto della metà vale lo stesso.
export function logDistance(guess, price) {
  return Math.abs(Math.log(guess / price));
}

// Punti per distanza: curva quadratica, piena al prezzo esatto e a zero a
// metà intervallo (in scala logaritmica). Premia molto chi è preciso.
export function distancePoints(distance, span, scoring = PREZZO_SCORING) {
  const ratio = Math.min(1, Math.abs(distance) / (Math.log(span) / 2));
  return Math.round(scoring.maxDistancePoints * (1 - ratio) ** 2);
}

// Sceglie le carte alternando le categorie (mai tre di fila della stessa se
// ce ne sono altre) e preferendo quelle non ancora uscite in questa stanza.
export function buildPrezzoRounds(deck, settings, used = new Set(), rng = Math.random) {
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
    rounds.push({ card, span, range: pickPriceRange(card.price, span, rng) });
  }
  return rounds;
}

export function scorePrezzoRound(round, answers, scoring = PREZZO_SCORING) {
  const { price } = round.card;
  const exactDistance = Math.log(scoring.exactRatio);
  const scored = answers.map(({ playerId, choice, at }) => {
    const distance = logDistance(choice, price);
    return {
      playerId,
      guess: choice,
      distance,
      offPct: Math.round((choice / price - 1) * 100),
      at,
      exact: distance <= exactDistance,
    };
  });
  const best = scored.length ? Math.min(...scored.map((s) => s.distance)) : null;
  // Chi ha tirato lontanissimo non "vince" solo perché era l'unico a rispondere:
  // serve almeno qualche punto di distanza. I float uguali "a occhio" sono pari.
  const winnerIds = scored
    .filter((s) => s.distance - best < 1e-9 && distancePoints(s.distance, round.span, scoring) > 0)
    .map((s) => s.playerId);

  const results = scored.map((s) => {
    const base = distancePoints(s.distance, round.span, scoring);
    const winner = winnerIds.includes(s.playerId);
    const points = base + (s.exact ? scoring.exactBonus : 0) + (winner ? scoring.winnerBonus : 0);
    return {
      playerId: s.playerId,
      guess: s.guess,
      distance: Math.round(s.distance * 10000) / 10000,
      offPct: s.offPct,
      exact: s.exact,
      winner,
      base,
      points,
    };
  });
  results.sort((a, b) => a.distance - b.distance);
  return { results, winnerIds };
}

export function createPrezzoGame(deck) {
  return {
    id: 'prezzo',
    // Il reveal ha un'animazione di qualche secondo: serve più tempo per goderselo.
    config: { revealMs: 9000, finalRevealMs: 10000 },

    clampSettings: clampPrezzoSettings,

    prepare(_input, settings) {
      if (!deck.some((c) => settings.categories.includes(c.category))) {
        throw new GameError('Mazzo non disponibile per le categorie scelte', 'deck');
      }
      return { used: new Set() };
    },

    buildRounds(room, rng) {
      const rounds = buildPrezzoRounds(deck, room.settings, room.content.used, rng);
      for (const r of rounds) room.content.used.add(r.card.id);
      return rounds;
    },

    publicView(room, current, showRound) {
      const round = showRound ? {
        category: current.card.category,
        title: current.card.title,
        subtitle: current.card.subtitle || null,
        unit: current.card.unit,
        range: current.range,
      } : null;
      return {
        round,
        categories: categorySummary(deck).filter((c) => room.settings.categories.includes(c.id)),
      };
    },

    // Il client manda il valore dello slider già arrotondato; qui si accetta
    // un margine minimo per gli arrotondamenti e si riporta dentro l'intervallo.
    parseAnswer(current, choice) {
      const value = typeof choice === 'number' || typeof choice === 'string' ? Number(choice) : NaN;
      const { min, max } = current.range;
      if (!Number.isFinite(value) || value <= 0 || value < min * (1 - 1e-6) || value > max * (1 + 1e-6)) {
        throw new GameError('Prezzo non valido', 'choice');
      }
      return Math.min(max, Math.max(min, roundPrice(value)));
    },

    score(_room, current, answers) {
      const { results, winnerIds } = scorePrezzoRound(current, answers);
      const { card } = current;
      return {
        results,
        reveal: {
          price: card.price,
          unit: card.unit,
          category: card.category,
          title: card.title,
          subtitle: card.subtitle || null,
          note: card.note || null,
          source: card.source || null,
          range: current.range,
          winnerIds,
        },
      };
    },
  };
}
