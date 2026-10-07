// Trofei sbloccabili: si calcolano dalle statistiche personali (lib/stats.js)
// e restano nel browser. Quando se ne sblocca uno parte l'evento
// TROPHY_EVENT, che TrophyToast trasforma in un avviso con fanfara.

const KEY = '4tune_trophies';
export const TROPHY_EVENT = '4tune:trophy';

export const TIERS = {
  bronzo: { label: 'Bronzo', color: '#e0894a', dark: '#8a4a1f' },
  argento: { label: 'Argento', color: '#dfe3f0', dark: '#8c90a8' },
  oro: { label: 'Oro', color: '#ffd23f', dark: '#c27a12' },
};

// Colori per ricolorare l'icona 'trophy' di PixelIcon
export function cupColors(tier, unlocked = true) {
  if (!unlocked) return { Y: '#4a4270', O: '#2e2752', N: '#2e2752', W: '#5d5590' };
  const t = TIERS[tier];
  return { Y: t.color, O: t.dark, W: '#ffffff' };
}

// `test(s)` riceve le statistiche del gioco (possono mancare campi).
export const TROPHIES = [
  { id: 'gts-1', game: 'gts', tier: 'bronzo', title: 'Prima nota', hint: 'Finisci una partita', test: (s) => s.played >= 1 },
  { id: 'gts-2', game: 'gts', tier: 'argento', title: 'Primo posto', hint: 'Vinci una partita', test: (s) => s.wins >= 1 },
  { id: 'gts-3', game: 'gts', tier: 'argento', title: 'Orecchio fino', hint: 'Fai almeno 400 punti in una partita', test: (s) => s.best >= 400 },
  { id: 'gts-4', game: 'gts', tier: 'oro', title: 'Re del juke-box', hint: 'Vinci 10 partite', test: (s) => s.wins >= 10 },

  { id: 'anno-1', game: 'anno', tier: 'bronzo', title: 'Viaggiatore del tempo', hint: 'Finisci una partita', test: (s) => s.played >= 1 },
  { id: 'anno-2', game: 'anno', tier: 'argento', title: 'Primo posto', hint: 'Vinci una partita', test: (s) => s.wins >= 1 },
  { id: 'anno-3', game: 'anno', tier: 'argento', title: 'Memoria storica', hint: 'Fai almeno 1200 punti in una partita', test: (s) => s.best >= 1200 },
  { id: 'anno-4', game: 'anno', tier: 'oro', title: 'Storico', hint: 'Vinci 10 partite', test: (s) => s.wins >= 10 },

  { id: 'giorno-1', game: 'giorno', tier: 'bronzo', title: 'Prima sfida', hint: 'Completa una sfida del giorno', test: (s) => s.played >= 1 },
  { id: 'giorno-2', game: 'giorno', tier: 'argento', title: 'Tre di fila', hint: 'Gioca 3 giorni di fila', test: (s) => s.bestStreak >= 3 },
  { id: 'giorno-3', game: 'giorno', tier: 'argento', title: 'Mille', hint: 'Fai almeno 1000 punti in una sfida', test: (s) => s.best >= 1000 },
  { id: 'giorno-4', game: 'giorno', tier: 'oro', title: 'Settimana perfetta', hint: 'Gioca 7 giorni di fila', test: (s) => s.bestStreak >= 7 },

  { id: 'impostore-1', game: 'impostore', tier: 'bronzo', title: 'Primo sospetto', hint: 'Gioca un round', test: (s) => s.rounds >= 1 },
  { id: 'impostore-2', game: 'impostore', tier: 'argento', title: 'Detective', hint: 'Gioca 10 partite', test: (s) => s.played >= 10 },
  { id: 'impostore-3', game: 'impostore', tier: 'argento', title: 'Interrogatorio', hint: 'Gioca 25 round', test: (s) => s.rounds >= 25 },
  { id: 'impostore-4', game: 'impostore', tier: 'oro', title: 'Mente criminale', hint: 'Gioca 100 round', test: (s) => s.rounds >= 100 },

  { id: 'bomba-1', game: 'bomba', tier: 'bronzo', title: 'Prima esplosione', hint: 'Gioca un round', test: (s) => s.played >= 1 },
  { id: 'bomba-2', game: 'bomba', tier: 'argento', title: 'Nervi saldi', hint: 'Arriva a una miccia di 45 secondi', test: (s) => s.longest >= 45 },
  { id: 'bomba-3', game: 'bomba', tier: 'argento', title: 'Artificiere', hint: 'Gioca 50 round', test: (s) => s.played >= 50 },
  { id: 'bomba-4', game: 'bomba', tier: 'oro', title: 'Miccia infinita', hint: 'Arriva a una miccia di 70 secondi', test: (s) => s.longest >= 70 },

  { id: 'prezzo-1', game: 'prezzo', tier: 'bronzo', title: 'Primo scontrino', hint: 'Finisci una partita', test: (s) => s.played >= 1 },
  { id: 'prezzo-2', game: 'prezzo', tier: 'argento', title: 'Occhio al prezzo', hint: 'Vinci una partita', test: (s) => s.wins >= 1 },
  { id: 'prezzo-3', game: 'prezzo', tier: 'argento', title: 'Cliente fisso', hint: 'Gioca 10 partite', test: (s) => s.played >= 10 },
  { id: 'prezzo-4', game: 'prezzo', tier: 'oro', title: 'Re dello sconto', hint: 'Vinci 10 partite', test: (s) => s.wins >= 10 },
];

function loadUnlocked() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || '{}');
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

export function readUnlocked() {
  return loadUnlocked();
}

export function trophiesFor(gameId) {
  return TROPHIES.filter((t) => t.game === gameId);
}

// Confronta le statistiche con i trofei: salva e annuncia quelli nuovi.
export function checkTrophies(allStats) {
  const unlocked = loadUnlocked();
  const fresh = TROPHIES.filter((t) => !unlocked[t.id] && t.test({ ...(allStats[t.game] || {}) }));
  if (fresh.length === 0) return [];
  const now = Date.now();
  fresh.forEach((t) => { unlocked[t.id] = now; });
  try { localStorage.setItem(KEY, JSON.stringify(unlocked)); } catch { /* storage pieno o bloccato */ }
  try { window.dispatchEvent(new CustomEvent(TROPHY_EVENT, { detail: fresh.map(({ id, game, tier, title, hint }) => ({ id, game, tier, title, hint })) })); } catch { /* ignora */ }
  return fresh;
}
