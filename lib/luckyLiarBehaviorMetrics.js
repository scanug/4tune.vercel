/**
 * LUCKY LIAR - Behavior Metrics & Indicators
 * Tracciamento metriche comportamentali (bluff, sfide, wildcard)
 * Indicatori VISIVI non numerici per evitare meta-gaming
 */

// ============================================
// COSTANTI METRICHE
// ============================================

export const BEHAVIOR_INDICATORS = {
  BLUFF_FREQUENTE: 'bluff_frequente',      // Ha fatto molti bluff (sfide perse)
  SFIDE_PERSE: 'sfide_perse',              // Molte sfide lanciate ma perse
  WILDCARD_USER: 'wildcard_user',          // Usa frequentemente la wildcard
  SAFE_PLAYER: 'safe_player',              // Giocatore conservatore (pochi bluff)
  CHALLENGER: 'challenger',                // Sfida spesso
  LUCKY: 'lucky',                          // Vince spesso le sfide
};

export const INDICATOR_ICONS = {
  bluff_frequente: '🎭',       // Maschera (bugiardo)
  sfide_perse: '❌',           // X (sbagliato)
  wildcard_user: '⚡',         // Fulmine (wild)
  safe_player: '🛡️',          // Scudo (protetto)
  challenger: '⚔️',            // Spada (sfidante)
  lucky: '⭐',                 // Stella (fortunato)
};

export const INDICATOR_COLORS = {
  bluff_frequente: '#fbbf24',  // Giallo (avvertimento)
  sfide_perse: '#ef4444',      // Rosso (pericolo)
  wildcard_user: '#8b5cf6',    // Viola (magico)
  safe_player: '#3b82f6',      // Blu (tranquillo)
  challenger: '#dc2626',       // Rosso scuro (aggressivo)
  lucky: '#ec4899',            // Rosa (fortuna)
};

export const INDICATOR_DESCRIPTIONS = {
  bluff_frequente: 'Fa molti bluff',
  sfide_perse: 'Perde spesso le sfide',
  wildcard_user: 'Usa spesso la wildcard',
  safe_player: 'Gioca in sicurezza',
  challenger: 'Sfida frequentemente',
  lucky: 'Vince le sfide',
};

// ============================================
// RACCOLTA METRICHE
// ============================================

/**
 * @typedef {Object} PlayerMetrics
 * @property {number} claimsCount - Dichiarazioni fatte
 * @property {number} challengesCount - Sfide lanciate
 * @property {number} challengesWon - Sfide vinte
 * @property {number} bluffDetected - Bluff scoperti (sfide vinte)
 * @property {number} wildcardsUsed - Wildcard usate
 * @property {number} roundsParticipated - Round in cui ha partecipato
 * @property {number} creditsLost - Crediti persi totali
 * @property {number} creditsGained - Crediti guadagnati totali
 */

/**
 * Crea oggetto metriche vuoto per un giocatore
 * @param {string} playerId
 * @returns {Object} Metriche inizializzate
 */
export function initializePlayerMetrics(playerId) {
  return {
    playerId,
    claimsCount: 0,
    challengesCount: 0,
    challengesWon: 0,
    bluffDetected: 0,
    wildcardsUsed: 0,
    roundsParticipated: 0,
    creditsLost: 0,
    creditsGained: 0,
  };
}

/**
 * Registra una dichiarazione (claim)
 * @param {Object} metrics - Metriche giocatore
 * @returns {Object} Metriche aggiornate
 */
export function recordClaim(metrics) {
  return {
    ...metrics,
    claimsCount: metrics.claimsCount + 1,
  };
}

/**
 * Registra una sfida lanciate
 * @param {Object} metrics
 * @param {boolean} won - Se la sfida è stata vinta
 * @returns {Object} Metriche aggiornate
 */
export function recordChallenge(metrics, won) {
  const updated = {
    ...metrics,
    challengesCount: metrics.challengesCount + 1,
  };

  if (won) {
    updated.challengesWon += 1;
    updated.bluffDetected += 1; // Ha scoperto un bluff
  }

  return updated;
}

/**
 * Registra uso wildcard
 * @param {Object} metrics
 * @returns {Object} Metriche aggiornate
 */
export function recordWildcardUsage(metrics) {
  return {
    ...metrics,
    wildcardsUsed: metrics.wildcardsUsed + 1,
  };
}

/**
 * Registra gain/loss di crediti
 * @param {Object} metrics
 * @param {number} amount - Positivo = guadagno, negativo = perdita
 * @returns {Object} Metriche aggiornate
 */
export function recordCreditChange(metrics, amount) {
  return {
    ...metrics,
    creditsGained: amount > 0 ? metrics.creditsGained + amount : metrics.creditsGained,
    creditsLost: amount < 0 ? metrics.creditsLost + Math.abs(amount) : metrics.creditsLost,
  };
}

/**
 * Registra partecipazione a un round
 * @param {Object} metrics
 * @returns {Object} Metriche aggiornate
 */
export function recordRoundParticipation(metrics) {
  return {
    ...metrics,
    roundsParticipated: metrics.roundsParticipated + 1,
  };
}

// ============================================
// CALCOLO METRICHE DERIVATE
// ============================================

/**
 * Calcola metriche derivate utili per indicatori
 * @param {Object} metrics
 * @returns {Object} Metriche con percentuali calcolate
 */
export function calculateDerivedMetrics(metrics) {
  const {
    claimsCount,
    challengesCount,
    challengesWon,
    bluffDetected,
    wildcardsUsed,
  } = metrics;

  return {
    ...metrics,
    challengeWinRate: challengesCount > 0 
      ? Math.round((challengesWon / challengesCount) * 100)
      : 0,
    bluffDetectionRate: claimsCount > 0
      ? Math.round((bluffDetected / claimsCount) * 100)
      : 0,
    wildcardsPerRound: metrics.roundsParticipated > 0
      ? (wildcardsUsed / metrics.roundsParticipated).toFixed(2)
      : 0,
  };
}

// ============================================
// GENERAZIONE INDICATORI VISIVI
// ============================================

/**
 * Determina quali indicatori mostrare per un giocatore
 * Logica VISIVA - basata su comportamento, non su numeri
 * @param {Object} metrics - Metriche calcolate con calculateDerivedMetrics()
 * @returns {Array} Array di { type, icon, color, description, tooltip }
 */
export function generateBehaviorIndicators(metrics) {
  const indicators = [];
  const derived = calculateDerivedMetrics(metrics);

  // 1. BLUFF FREQUENTE
  // Se: molte sfide lanciate E molte vinte (scopre bluff) E poche riuscite lui
  const iBluffFrequente = 
    derived.challengeWinRate > 60 && metrics.challengesCount >= 3;
  
  if (iBluffFrequente) {
    indicators.push({
      type: BEHAVIOR_INDICATORS.BLUFF_FREQUENTE,
      icon: INDICATOR_ICONS.bluff_frequente,
      color: INDICATOR_COLORS.bluff_frequente,
      description: INDICATOR_DESCRIPTIONS.bluff_frequente,
      tooltip: `Scopre bluff al ${derived.challengeWinRate}%`,
    });
  }

  // 2. SFIDE PERSE
  // Se: molte sfide lanciate MA poca percentuale di successo
  const iSfidePerse = 
    metrics.challengesCount >= 3 && derived.challengeWinRate < 40;
  
  if (iSfidePerse) {
    indicators.push({
      type: BEHAVIOR_INDICATORS.SFIDE_PERSE,
      icon: INDICATOR_ICONS.sfide_perse,
      color: INDICATOR_COLORS.sfide_perse,
      description: INDICATOR_DESCRIPTIONS.sfide_perse,
      tooltip: `Solo ${derived.challengeWinRate}% di sfide vinte`,
    });
  }

  // 3. WILDCARD USER
  // Se: usa la wildcard frequentemente (più di 1 ogni 2 round)
  const isWildcardUser = 
    metrics.roundsParticipated > 0 && derived.wildcardsPerRound > 0.4;
  
  if (isWildcardUser) {
    indicators.push({
      type: BEHAVIOR_INDICATORS.WILDCARD_USER,
      icon: INDICATOR_ICONS.wildcard_user,
      color: INDICATOR_COLORS.wildcard_user,
      description: INDICATOR_DESCRIPTIONS.wildcard_user,
      tooltip: `${metrics.wildcardsUsed} wildcard usate`,
    });
  }

  // 4. SAFE PLAYER
  // Se: poche sfide lanciate E pochi bluff scoperti
  const isSafePlayer = 
    metrics.challengesCount <= 1 && metrics.claimsCount >= 2;
  
  if (isSafePlayer) {
    indicators.push({
      type: BEHAVIOR_INDICATORS.SAFE_PLAYER,
      icon: INDICATOR_ICONS.safe_player,
      color: INDICATOR_COLORS.safe_player,
      description: INDICATOR_DESCRIPTIONS.safe_player,
      tooltip: 'Gioca con prudenza',
    });
  }

  // 5. CHALLENGER
  // Se: molte sfide lanciate (più della media)
  const isChallengeHappy = metrics.challengesCount >= 4;
  
  if (isChallengeHappy && !iSfidePerse) { // Non mostrare se già ha "sfide perse"
    indicators.push({
      type: BEHAVIOR_INDICATORS.CHALLENGER,
      icon: INDICATOR_ICONS.challenger,
      color: INDICATOR_COLORS.challenger,
      description: INDICATOR_DESCRIPTIONS.challenger,
      tooltip: `${metrics.challengesCount} sfide lanciate`,
    });
  }

  // 6. LUCKY (fortunato)
  // Se: più del 70% di sfide vinte
  const isLucky = 
    metrics.challengesCount >= 3 && derived.challengeWinRate >= 70;
  
  if (isLucky) {
    indicators.push({
      type: BEHAVIOR_INDICATORS.LUCKY,
      icon: INDICATOR_ICONS.lucky,
      color: INDICATOR_COLORS.lucky,
      description: INDICATOR_DESCRIPTIONS.lucky,
      tooltip: `${derived.challengeWinRate}% di successo!`,
    });
  }

  return indicators;
}

// ============================================
// TIMELINE DICHIARAZIONI
// ============================================

/**
 * @typedef {Object} ClaimEntry
 * @property {string} playerId
 * @property {string} playerName
 * @property {number} quantity
 * @property {string} value
 * @property {number} timestamp
 * @property {boolean} isChallenged - Se è stata sfidata
 * @property {boolean} challengeSuccess - Se la sfida è riuscita
 */

/**
 * Inizializza timeline vuota
 * @returns {Array} Array vuoto
 */
export function initializeDeclarationTimeline() {
  return [];
}

/**
 * Aggiunge una dichiarazione alla timeline
 * @param {Array} timeline - Timeline corrente
 * @param {Object} claim - Dichiarazione da aggiungere
 * @returns {Array} Timeline aggiornata
 */
export function addClaimToTimeline(timeline, claim) {
  return [
    ...timeline,
    {
      ...claim,
      timestamp: Date.now(),
      isChallenged: false,
      challengeSuccess: null,
    },
  ];
}

/**
 * Marca una dichiarazione come sfidata con risultato
 * @param {Array} timeline
 * @param {number} claimIndex - Indice della dichiarazione
 * @param {boolean} success - Se la sfida è riuscita
 * @returns {Array} Timeline aggiornata
 */
export function markClaimChallenged(timeline, claimIndex, success) {
  const updated = [...timeline];
  if (updated[claimIndex]) {
    updated[claimIndex] = {
      ...updated[claimIndex],
      isChallenged: true,
      challengeSuccess: success,
    };
  }
  return updated;
}

/**
 * Ottiene l'ultima dichiarazione non sfidata
 * @param {Array} timeline
 * @returns {Object|null} Ultima dichiarazione attiva o null
 */
export function getActiveClaim(timeline) {
  if (timeline.length === 0) return null;
  
  // La dichiarazione attiva è l'ultima non ancora sfidata
  for (let i = timeline.length - 1; i >= 0; i--) {
    if (!timeline[i].isChallenged) {
      return {
        ...timeline[i],
        index: i,
      };
    }
  }
  
  return null;
}

/**
 * Resetta timeline per nuovo round
 * @param {Array} timeline - Timeline precedente
 * @returns {Array} Timeline vuota
 */
export function resetTimelineForNewRound(timeline) {
  return [];
}

// ============================================
// STATISTICHE TIMELINE
// ============================================

/**
 * Genera statistiche dalla timeline
 * @param {Array} timeline
 * @returns {Object} Statistiche aggregate
 */
export function getTimelineStatistics(timeline) {
  const totalClaims = timeline.length;
  const challengedClaims = timeline.filter(c => c.isChallenged).length;
  const successfulChallenges = timeline.filter(c => c.isChallenged && c.challengeSuccess).length;
  const failedChallenges = timeline.filter(c => c.isChallenged && !c.challengeSuccess).length;

  return {
    totalClaims,
    challengedClaims,
    successfulChallenges,
    failedChallenges,
    challengeRate: totalClaims > 0 ? Math.round((challengedClaims / totalClaims) * 100) : 0,
    challengeSuccessRate: challengedClaims > 0 ? Math.round((successfulChallenges / challengedClaims) * 100) : 0,
  };
}

/**
 * Ottiene la timeline formattata per UI
 * Mostra diciarazioni in ordine inverso (più recente primo)
 * @param {Array} timeline
 * @returns {Array} Timeline formattata per display
 */
export function formatTimelineForDisplay(timeline) {
  return [...timeline].reverse().map((claim, displayIndex) => ({
    ...claim,
    displayIndex, // Indice per il rendering (0 = più recente)
    timeAgo: getTimeAgoString(claim.timestamp),
  }));
}

/**
 * Converte timestamp in stringa relativa
 * @param {number} timestamp - Timestamp in ms
 * @returns {string} Stringa "1m fa", "30s fa", etc
 */
export function getTimeAgoString(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (seconds < 60) return `${seconds}s fa`;
  if (minutes < 60) return `${minutes}m fa`;
  if (hours < 24) return `${hours}h fa`;
  
  return 'ieri';
}

// ============================================
// UTILITÀ
// ============================================

/**
 * Ottiene il massimo di 3 indicatori più rilevanti
 * Utile per UI con spazio limitato
 * @param {Array} indicators
 * @returns {Array} Array con max 3 indicatori
 */
export function getTopIndicators(indicators) {
  return indicators.slice(0, 3);
}

/**
 * Formatta valore metrica per display
 * @param {number} value
 * @param {string} metric - Tipo di metrica (rate, count, etc)
 * @returns {string} Stringa formattata
 */
export function formatMetricValue(value, metric) {
  const formats = {
    rate: `${value}%`,
    count: `${Math.round(value)}`,
    decimal: value.toFixed(2),
  };
  
  return formats[metric] || `${value}`;
}
