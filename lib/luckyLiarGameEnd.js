/**
 * LUCKY LIAR - Game End & Winner Determination
 * Logica per fine partita, determinazione vincitore, recap finale
 */

// ============================================
// COSTANTI
// ============================================

export const GAME_END_REASONS = {
  ONE_PLAYER_LEFT: 'one_player_left',      // Un solo giocatore rimasto (eliminati gli altri)
  MAX_ROUNDS_REACHED: 'max_rounds_reached', // Raggiunto numero massimo di round
  HOST_QUIT: 'host_quit',                  // Host ha abbandonato la partita
  DRAW: 'draw',                            // Pareggio (raro, < 1%)
};

// ============================================
// DETERMINAZIONE FINE PARTITA
// ============================================

/**
 * Determina se la partita è finita
 * Condizioni: 
 * - Resta solo 1 giocatore (eliminati gli altri per crediti < 0)
 * - Raggiunto numero massimo di round
 * @param {string[]} playerIds - Array di giocatori rimasti
 * @param {Object} playerCredits - { playerId: number (crediti rimasti) }
 * @param {number} currentRound - Round attuale (0-based)
 * @param {number} maxRounds - Numero massimo di round
 * @returns {Object} { gameOver: boolean, reason?: string }
 */
export function checkGameEnd(playerIds, playerCredits, currentRound, maxRounds) {
  // Filtra giocatori attivi (crediti >= 0)
  const activePlayers = playerIds.filter(id => (playerCredits[id] || 0) >= 0);
  
  // Condizione 1: Un solo giocatore rimasto
  if (activePlayers.length <= 1) {
    return {
      gameOver: true,
      reason: GAME_END_REASONS.ONE_PLAYER_LEFT,
    };
  }

  // Condizione 2: Raggiunto max round
  if (currentRound >= maxRounds) {
    return {
      gameOver: true,
      reason: GAME_END_REASONS.MAX_ROUNDS_REACHED,
    };
  }

  return {
    gameOver: false,
  };
}

// ============================================
// DETERMINAZIONE VINCITORE
// ============================================

/**
 * Determina il vincitore basato sui crediti finali
 * Gestisce pareggi rari
 * @param {string[]} playerIds
 * @param {Object} playerNames - { playerId: name }
 * @param {Object} playerCredits - { playerId: credits }
 * @returns {Object} { 
 *   winner: { playerId, name, credits, rank: 1 },
 *   ranking: [ { playerId, name, credits, rank } ],
 *   isDraw: boolean,
 *   drawPlayers?: [ { playerId, name } ]
 * }
 */
export function determineWinner(playerIds, playerNames, playerCredits) {
  // Crea array con dati giocatori
  const playerRanking = playerIds.map(id => ({
    playerId: id,
    name: playerNames[id],
    credits: playerCredits[id] || 0,
  }));

  // Ordina per crediti decrescenti
  playerRanking.sort((a, b) => b.credits - a.credits);

  // Assegna ranking
  const ranking = playerRanking.map((player, index) => ({
    ...player,
    rank: index + 1,
  }));

  // Verifica pareggio (raro)
  const isDraw = ranking.length > 1 && ranking[0].credits === ranking[1].credits;
  const drawPlayers = isDraw 
    ? ranking.filter(p => p.credits === ranking[0].credits)
    : [];

  return {
    winner: ranking[0],
    ranking,
    isDraw,
    drawPlayers: isDraw ? drawPlayers : undefined,
  };
}

// ============================================
// RECAP PARTITA
// ============================================

/**
 * @typedef {Object} PlayerGameSummary
 * @property {string} playerId
 * @property {string} name
 * @property {number} startingCredits
 * @property {number} finalCredits
 * @property {number} netGain - Crediti guadagnati/persi
 * @property {number} percentageChange - Variazione percentuale
 * @property {number} claimsCount - Numero dichiarazioni fatte
 * @property {number} challengesCount - Numero sfide lanciate
 * @property {number} challengesWon - Sfide vinte
 * @property {number} challengeWinRate - % di sfide vinte
 * @property {number} wildcardsUsed - Quante wildcard usate
 * @property {number} eliminatedAtRound - Round in cui eliminato (se applicabile)
 * @property {boolean} isWinner
 * @property {number} rank - Piazzamento finale (1=vincitore)
 */

/**
 * Genera recap completo della partita
 * @param {string[]} playerIds
 * @param {Object} playerNames
 * @param {Object} playerStartCredits - Crediti iniziali
 * @param {Object} playerFinalCredits - Crediti finali
 * @param {Object} playerMetrics - Metriche da behaviorMetrics
 * @param {Object} ranking - Ranking da determineWinner()
 * @param {string} gameEndReason
 * @returns {Object} { gameSummary: {}, playerSummaries: [] }
 */
export function generateGameSummary(
  playerIds,
  playerNames,
  playerStartCredits,
  playerFinalCredits,
  playerMetrics,
  ranking,
  gameEndReason
) {
  // Recap generale
  const gameSummary = {
    endReason: gameEndReason,
    totalPlayers: playerIds.length,
    winnerName: ranking[0].name,
    winnerId: ranking[0].playerId,
    totalCreditsCirculated: playerIds.reduce((sum, id) => 
      sum + (playerStartCredits[id] || 0), 0
    ),
    creditsDuration: new Date().getTime(), // Timestamp per calcolare durata
  };

  // Recap per ogni giocatore
  const playerSummaries = ranking.map(rankedPlayer => {
    const id = rankedPlayer.playerId;
    const startCredits = playerStartCredits[id] || 0;
    const finalCredits = playerFinalCredits[id] || 0;
    const netGain = finalCredits - startCredits;
    const percentageChange = startCredits > 0 
      ? (netGain / startCredits) * 100 
      : 0;

    const metrics = playerMetrics[id] || {};

    return {
      playerId: id,
      name: rankedPlayer.name,
      startingCredits: startCredits,
      finalCredits: finalCredits,
      netGain: netGain,
      percentageChange: Math.round(percentageChange * 10) / 10, // 1 decimale
      claimsCount: metrics.claimsCount || 0,
      challengesCount: metrics.challengesCount || 0,
      challengesWon: metrics.challengesWon || 0,
      challengeWinRate: metrics.challengeWinRate || 0,
      wildcardsUsed: metrics.wildcardsUsed || 0,
      eliminatedAtRound: metrics.eliminatedAtRound || null,
      isWinner: rankedPlayer.rank === 1,
      rank: rankedPlayer.rank,
    };
  });

  return {
    gameSummary,
    playerSummaries,
  };
}

// ============================================
// STATISTICHE FINALI
// ============================================

/**
 * Calcola statistiche aggregate di tutta la partita
 * Utile per leaderboard e analytics
 * @param {Array} playerSummaries - Da generateGameSummary()
 * @returns {Object} statistiche aggregate
 */
export function calculateGameStatistics(playerSummaries) {
  const totalPlayers = playerSummaries.length;
  const totalClaimsCount = playerSummaries.reduce((sum, p) => sum + (p.claimsCount || 0), 0);
  const totalChallengesCount = playerSummaries.reduce((sum, p) => sum + (p.challengesCount || 0), 0);
  const totalChallengesWon = playerSummaries.reduce((sum, p) => sum + (p.challengesWon || 0), 0);
  const totalWildcardsUsed = playerSummaries.reduce((sum, p) => sum + (p.wildcardsUsed || 0), 0);

  const avgClaimsPerPlayer = totalPlayers > 0 ? totalClaimsCount / totalPlayers : 0;
  const avgChallengesPerPlayer = totalPlayers > 0 ? totalChallengesCount / totalPlayers : 0;
  const globalChallengeWinRate = totalChallengesCount > 0 
    ? (totalChallengesWon / totalChallengesCount) * 100 
    : 0;

  return {
    totalPlayers,
    totalClaimsCount,
    totalChallengesCount,
    totalChallengesWon,
    totalWildcardsUsed,
    avgClaimsPerPlayer: Math.round(avgClaimsPerPlayer * 10) / 10,
    avgChallengesPerPlayer: Math.round(avgChallengesPerPlayer * 10) / 10,
    globalChallengeWinRate: Math.round(globalChallengeWinRate * 10) / 10,
  };
}

// ============================================
// GENERAZIONE MESSAGGI
// ============================================

/**
 * Genera messaggio di fine partita personalizzato
 * @param {Object} winner - { playerId, name, credits }
 * @param {string} reason - Motivo fine partita
 * @param {boolean} isDraw - Se è pareggio
 * @returns {Object} { title: string, subtitle: string, emoji: string }
 */
export function getGameEndMessage(winner, reason, isDraw = false) {
  const messages = {
    [GAME_END_REASONS.ONE_PLAYER_LEFT]: {
      title: isDraw ? '🤝 Pareggio!' : '🏆 Partita Finita!',
      subtitle: isDraw 
        ? 'I vincitori hanno gli stessi crediti!'
        : `${winner.name} ha vinto con ${winner.credits} crediti!`,
      emoji: isDraw ? '🤝' : '🏆',
    },
    [GAME_END_REASONS.MAX_ROUNDS_REACHED]: {
      title: '⏱️ Round Finiti!',
      subtitle: `${winner.name} vince con ${winner.credits} crediti finali`,
      emoji: '⏱️',
    },
    [GAME_END_REASONS.HOST_QUIT]: {
      title: '❌ Partita Cancellata',
      subtitle: 'L\'host ha abbandonato la partita',
      emoji: '❌',
    },
  };

  return messages[reason] || {
    title: '🎉 Partita Terminata',
    subtitle: `${winner.name} è il vincitore!`,
    emoji: '🎉',
  };
}

// ============================================
// UTILITÀ
// ============================================

/**
 * Formatta crediti con simbolo e colore
 * @param {number} credits
 * @returns {string} Stringa formattata
 */
export function formatCredits(credits) {
  if (credits > 0) return `+${credits}`;
  if (credits < 0) return `${credits}`;
  return '0';
}

/**
 * Determina colore basato su guadagno/perdita
 * @param {number} netGain
 * @returns {string} Colore (hex o classe CSS)
 */
export function getNetGainColor(netGain) {
  if (netGain > 0) return '#10b981'; // Verde
  if (netGain < 0) return '#ef4444'; // Rosso
  return '#6b7280'; // Grigio
}

/**
 * Genera medaglia emoji basata su rank
 * @param {number} rank
 * @returns {string} Emoji
 */
export function getRankEmoji(rank) {
  const emojis = {
    1: '🥇',
    2: '🥈',
    3: '🥉',
  };
  return emojis[rank] || `#${rank}`;
}
