// Trofei sbloccabili: si calcolano dalle statistiche personali (lib/stats.js)
// e restano nel browser insieme alla data di sblocco. Quando se ne sblocca
// uno parte l'evento TROPHY_EVENT, che TrophyToast trasforma in un avviso.

const KEY = '4tune_trophies';
export const TROPHY_EVENT = '4tune:trophy';

export const TIERS = {
  bronzo: { label: 'Bronzo', color: '#e0894a', dark: '#8a4a1f' },
  argento: { label: 'Argento', color: '#dfe3f0', dark: '#8c90a8' },
  oro: { label: 'Oro', color: '#ffd23f', dark: '#c27a12' },
  platino: { label: 'Platino', color: '#a8f0ff', dark: '#3a8fb0' },
};
const TIER_ORDER = Object.keys(TIERS);

// Colori per ricolorare l'icona 'trophy' di PixelIcon
export function cupColors(tier, unlocked = true) {
  if (!unlocked) return { Y: '#4a4270', O: '#2e2752', N: '#2e2752', W: '#5d5590' };
  const t = TIERS[tier];
  return { Y: t.color, O: t.dark, W: '#ffffff' };
}

// Ogni trofeo si sblocca quando la statistica `stat` del gioco arriva a `min`.
// Gli id dei primi quattro di ogni gioco sono quelli della prima versione:
// non vanno cambiati, altrimenti chi li aveva li perde.
const t = (game, n, tier, title, goal, stat, min) => ({ id: `${game}-${n}`, game, tier, title, goal, stat, min });

export const TROPHIES = [
  t('gts', 1, 'bronzo', 'Prima nota', 'Finisci una partita', 'played', 1),
  t('gts', 5, 'bronzo', 'Sul podio', 'Arriva tra i primi tre (almeno in due)', 'podiums', 1),
  t('gts', 6, 'bronzo', 'Playlist infinita', 'Finisci 10 partite', 'played', 10),
  t('gts', 2, 'argento', 'Primo posto', 'Vinci una partita (almeno in due)', 'wins', 1),
  t('gts', 3, 'argento', 'Orecchio fino', 'Fai almeno 400 punti in una partita', 'best', 400),
  t('gts', 7, 'argento', 'Doppietta', 'Vinci 2 partite di fila', 'bestWinStreak', 2),
  t('gts', 8, 'argento', 'Festa grande', 'Gioca una partita con almeno 6 persone', 'maxPlayers', 6),
  t('gts', 4, 'oro', 'Re del juke-box', 'Vinci 10 partite', 'wins', 10),
  t('gts', 9, 'oro', "Disco d'oro", 'Accumula 10.000 punti in totale', 'total', 10000),
  t('gts', 10, 'platino', 'Imbattibile', 'Vinci 5 partite di fila', 'bestWinStreak', 5),

  t('anno', 1, 'bronzo', 'Viaggiatore del tempo', 'Finisci una partita', 'played', 1),
  t('anno', 5, 'bronzo', 'Sul podio', 'Arriva tra i primi tre (almeno in due)', 'podiums', 1),
  t('anno', 6, 'bronzo', 'Macchina del tempo', 'Finisci 10 partite', 'played', 10),
  t('anno', 2, 'argento', 'Primo posto', 'Vinci una partita (almeno in due)', 'wins', 1),
  t('anno', 3, 'argento', 'Memoria storica', 'Fai almeno 1200 punti in una partita', 'best', 1200),
  t('anno', 7, 'argento', 'Doppietta', 'Vinci 2 partite di fila', 'bestWinStreak', 2),
  t('anno', 8, 'argento', 'Aula piena', 'Gioca una partita con almeno 6 persone', 'maxPlayers', 6),
  t('anno', 4, 'oro', 'Storico', 'Vinci 10 partite', 'wins', 10),
  t('anno', 9, 'oro', 'Enciclopedia', 'Accumula 20.000 punti in totale', 'total', 20000),
  t('anno', 10, 'platino', 'Signore del tempo', 'Vinci 5 partite di fila', 'bestWinStreak', 5),

  t('giorno', 1, 'bronzo', 'Prima sfida', 'Completa una sfida del giorno', 'played', 1),
  t('giorno', 2, 'bronzo', 'Tre di fila', 'Gioca 3 giorni di fila', 'bestStreak', 3),
  t('giorno', 5, 'bronzo', 'Buon inizio', 'Fai almeno 600 punti in una sfida', 'best', 600),
  t('giorno', 3, 'argento', 'Mille', 'Fai almeno 1000 punti in una sfida', 'best', 1000),
  t('giorno', 6, 'argento', 'Settimana', 'Completa 7 sfide', 'played', 7),
  t('giorno', 4, 'oro', 'Settimana perfetta', 'Gioca 7 giorni di fila', 'bestStreak', 7),
  t('giorno', 7, 'oro', 'Fuoriclasse', 'Fai almeno 1250 punti in una sfida', 'best', 1250),
  t('giorno', 8, 'oro', 'Un mese', 'Completa 30 sfide', 'played', 30),
  t('giorno', 9, 'platino', 'Mese perfetto', 'Gioca 30 giorni di fila', 'bestStreak', 30),
  t('giorno', 10, 'platino', 'Centenario', 'Completa 100 sfide', 'played', 100),

  t('impostore', 1, 'bronzo', 'Primo sospetto', 'Gioca un round', 'rounds', 1),
  t('impostore', 5, 'bronzo', 'Prima partita', 'Chiudi una partita', 'played', 1),
  t('impostore', 6, 'bronzo', 'Smascherato!', "Scoprite l'impostore in un round", 'caught', 1),
  t('impostore', 7, 'argento', "L'ha fatta franca", "L'impostore non viene scoperto in un round", 'escaped', 1),
  t('impostore', 2, 'argento', 'Detective', 'Chiudi 10 partite', 'played', 10),
  t('impostore', 3, 'argento', 'Interrogatorio', 'Gioca 25 round', 'rounds', 25),
  t('impostore', 8, 'argento', 'Tavolata', 'Gioca con almeno 8 persone', 'maxPlayers', 8),
  t('impostore', 4, 'oro', 'Mente criminale', 'Gioca 100 round', 'rounds', 100),
  t('impostore', 9, 'oro', 'Sherlock', "Scoprite l'impostore in 25 round", 'caught', 25),
  t('impostore', 10, 'platino', 'Leggenda del bluff', 'Chiudi 50 partite', 'played', 50),

  t('bomba', 1, 'bronzo', 'Prima esplosione', 'Gioca un round', 'played', 1),
  t('bomba', 5, 'bronzo', 'Sillabatore', 'Gioca un round con le sillabe', 'sillabe', 1),
  t('bomba', 6, 'bronzo', 'Fai da te', 'Gioca un round con una categoria scritta da te', 'custom', 1),
  t('bomba', 2, 'argento', 'Nervi saldi', 'Arriva a una miccia di 45 secondi', 'longest', 45),
  t('bomba', 3, 'argento', 'Artificiere', 'Gioca 50 round', 'played', 50),
  t('bomba', 7, 'argento', 'Festa grande', 'Gioca con almeno 8 giocatori in elenco', 'maxPlayers', 8),
  t('bomba', 8, 'argento', 'Miccia lunga', 'Gioca 10 round con la miccia lunga', 'lunga', 10),
  t('bomba', 4, 'oro', 'Miccia infinita', 'Arriva a una miccia di 70 secondi', 'longest', 70),
  t('bomba', 9, 'oro', 'Demolitore', 'Gioca 200 round', 'played', 200),
  t('bomba', 10, 'platino', 'Re delle sillabe', 'Gioca 100 round con le sillabe', 'sillabe', 100),

  t('prezzo', 1, 'bronzo', 'Primo scontrino', 'Finisci una partita', 'played', 1),
  t('prezzo', 5, 'bronzo', 'Sul podio', 'Arriva tra i primi tre (almeno in due)', 'podiums', 1),
  t('prezzo', 2, 'argento', 'Occhio al prezzo', 'Vinci una partita (almeno in due)', 'wins', 1),
  t('prezzo', 3, 'argento', 'Cliente fisso', 'Finisci 10 partite', 'played', 10),
  t('prezzo', 6, 'argento', 'Affare fatto', 'Fai almeno 1200 punti in una partita', 'best', 1200),
  t('prezzo', 7, 'argento', 'Doppietta', 'Vinci 2 partite di fila', 'bestWinStreak', 2),
  t('prezzo', 8, 'argento', 'Saldi di gruppo', 'Gioca una partita con almeno 6 persone', 'maxPlayers', 6),
  t('prezzo', 4, 'oro', 'Re dello sconto', 'Vinci 10 partite', 'wins', 10),
  t('prezzo', 9, 'oro', 'Milionario', 'Accumula 20.000 punti in totale', 'total', 20000),
  t('prezzo', 10, 'platino', 'Lupo di Wall Street', 'Vinci 5 partite di fila', 'bestWinStreak', 5),
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

// Trofei di un gioco, dal bronzo al platino
export function trophiesFor(gameId) {
  return TROPHIES
    .filter((tr) => tr.game === gameId)
    .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
}

// A che punto si è: [valore attuale (fermo al traguardo), traguardo]
export function progressOf(trophy, gameStats = {}) {
  const value = Number(gameStats[trophy.stat]) || 0;
  return [Math.min(value, trophy.min), trophy.min];
}

export function formatUnlockedAt(ts) {
  return new Date(ts).toLocaleString('it-IT', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// Confronta le statistiche con i trofei: salva e annuncia quelli nuovi.
export function checkTrophies(allStats) {
  const unlocked = loadUnlocked();
  const fresh = TROPHIES.filter((tr) => !unlocked[tr.id] && (Number(allStats[tr.game]?.[tr.stat]) || 0) >= tr.min);
  if (fresh.length === 0) return [];
  const now = Date.now();
  fresh.forEach((tr) => { unlocked[tr.id] = now; });
  try { localStorage.setItem(KEY, JSON.stringify(unlocked)); } catch { /* storage pieno o bloccato */ }
  const detail = fresh.map((tr) => ({ ...tr, unlockedAt: now }));
  try { window.dispatchEvent(new CustomEvent(TROPHY_EVENT, { detail })); } catch { /* ignora */ }
  return fresh;
}
