// Statistiche personali dei giochi, salvate solo nel browser (niente account).
// Le legge la Sala 3D; le scrivono le pagine dei giochi a fine partita.
// Ogni aggiornamento ricontrolla i trofei (lib/trophies.js).

import { checkTrophies } from './trophies';

const KEY = '4tune_stats';
const SEEN_MAX = 30;

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || '{}');
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage pieno o bloccato */ }
}

// Applica `fn` alle statistiche del gioco. Con `matchKey` la stessa partita
// conta una volta sola, anche se la pagina si ricarica sul podio.
function update(gameId, fn, matchKey) {
  const all = load();
  const s = { played: 0, ...(all[gameId] || {}) };
  if (matchKey) {
    const seen = Array.isArray(s.seen) ? s.seen : [];
    if (seen.includes(matchKey)) return;
    s.seen = [...seen, matchKey].slice(-SEEN_MAX);
  }
  fn(s);
  s.lastAt = Date.now();
  all[gameId] = s;
  save(all);
  checkTrophies(all);
}

export function readStats() {
  return load();
}

// Recupera i trofei già meritati con statistiche salvate prima che esistessero
export function syncTrophies() {
  return checkTrophies(load());
}

// GTS, Indovina l'Anno e Quanto costa?: una partita online finita.
// `rank` parte da 1 (a pari punti si è primi insieme), `players` è quanti
// erano nella stanza: vittorie e podi contano solo se si era almeno in due.
export function recordOnlineMatch(gameId, { matchKey, score, rank, players }) {
  update(gameId, (s) => {
    const contested = players >= 2;
    const won = contested && rank === 1;
    s.played += 1;
    s.wins = (s.wins || 0) + (won ? 1 : 0);
    s.podiums = (s.podiums || 0) + (contested && rank <= 3 ? 1 : 0);
    s.winStreak = won ? (s.winStreak || 0) + 1 : 0;
    s.bestWinStreak = Math.max(s.bestWinStreak || 0, s.winStreak);
    s.best = Math.max(s.best || 0, score || 0);
    s.total = (s.total || 0) + (score || 0);
    s.last = score || 0;
    s.maxPlayers = Math.max(s.maxPlayers || 0, players || 0);
  }, matchKey);
}

// Giorni consecutivi che finiscono con l'ultimo giorno dell'elenco (YYYY-MM-DD)
function streakOf(days) {
  const sorted = [...new Set(days)].sort();
  let streak = 0;
  let prev = null;
  for (const d of sorted) {
    const t = Date.parse(`${d}T00:00:00Z`);
    streak = prev !== null && t - prev === 86400000 ? streak + 1 : 1;
    prev = t;
  }
  return streak;
}

// L'Anno del Giorno: la sfida di un giorno completata.
export function recordDaily({ day, score }) {
  update('giorno', (s) => {
    s.played += 1;
    s.best = Math.max(s.best || 0, score || 0);
    s.last = score || 0;
    s.days = [...(Array.isArray(s.days) ? s.days : []), day].slice(-60);
    s.streak = streakOf(s.days);
    s.bestStreak = Math.max(s.bestStreak || 0, s.streak);
  }, `day:${day}`);
}

// Impostore: un round concluso (scoperto o no), oppure la partita chiusa.
export function recordImpostoreRound({ caught, players }) {
  update('impostore', (s) => {
    s.rounds = (s.rounds || 0) + 1;
    if (caught) s.caught = (s.caught || 0) + 1;
    else s.escaped = (s.escaped || 0) + 1;
    s.maxPlayers = Math.max(s.maxPlayers || 0, players || 0);
  });
}
export function recordImpostoreMatch() {
  update('impostore', (s) => { s.played += 1; });
}

// Passa la Bomba: un round finito con lo scoppio.
export function recordBombaRound({ fuseSeconds, mode, fuse, custom, players }) {
  update('bomba', (s) => {
    s.played += 1;
    s.longest = Math.max(s.longest || 0, Math.round(fuseSeconds || 0));
    if (mode === 'sillabe') s.sillabe = (s.sillabe || 0) + 1;
    if (fuse === 'lunga') s.lunga = (s.lunga || 0) + 1;
    if (custom) s.custom = (s.custom || 0) + 1;
    s.maxPlayers = Math.max(s.maxPlayers || 0, players || 0);
  });
}

function when(ts) {
  if (!ts) return '---';
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return 'Oggi';
  if (days === 1) return 'Ieri';
  if (days < 30) return `${days} giorni fa`;
  return new Date(ts).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}

const n = (v) => (v ? String(v) : '0');

// Righe da mostrare nella Sala per ogni gioco: [etichetta, valore].
export function statRows(gameId, s = {}) {
  switch (gameId) {
    case 'gts':
    case 'anno':
    case 'prezzo':
      return [
        ['Partite', n(s.played)],
        ['Vittorie', n(s.wins)],
        ['Record punti', n(s.best)],
        ['Ultima partita', when(s.lastAt)],
      ];
    case 'giorno':
      return [
        ['Giorni giocati', n(s.played)],
        ['Serie migliore', s.bestStreak ? `${s.bestStreak} giorni` : '---'],
        ['Record', n(s.best)],
        ['Ultimo punteggio', s.played ? String(s.last) : '---'],
        ['Ultima sfida', when(s.lastAt)],
      ];
    case 'impostore':
      return [
        ['Partite', n(s.played)],
        ['Round', n(s.rounds)],
        ['Ultima partita', when(s.lastAt)],
      ];
    case 'bomba':
      return [
        ['Round', n(s.played)],
        ['Miccia più lunga', s.longest ? `${s.longest}s` : '---'],
        ['Ultima partita', when(s.lastAt)],
      ];
    default:
      return [];
  }
}
