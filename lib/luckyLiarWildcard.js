/**
 * LUCKY LIAR - Wildcard System
 * Assegnazione, utilizzo e effetti della wildcard segreta
 */

// ============================================
// COSTANTI
// ============================================

export const WILDCARD_MODES = {
  SINGLE: 'single',     // 1 giocatore ha wildcard
  DOUBLE: 'double',     // 2 giocatori hanno wildcard
};

export const WILDCARD_STATES = {
  UNUSED: 'unused',           // Non ancora usata
  ACTIVATED: 'activated',     // Attivata durante sfida
  EXHAUSTED: 'exhausted',     // Già usata
};

export const WILDCARD_SCENARIOS = {
  CLAIMER_TRUE: 'claimer_true',      // Dichiaratore ha wildcard + dichiarazione vera
  CLAIMER_FALSE: 'claimer_false',    // Dichiaratore ha wildcard + dichiarazione falsa
  CHALLENGER_TRUE: 'challenger_true', // Sfidante ha wildcard + dichiarazione vera
  CHALLENGER_FALSE: 'challenger_false', // Sfidante ha wildcard + dichiarazione falsa
};

// Moltiplicatori di penalità
export const WILDCARD_MULTIPLIERS = {
  REDUCE: 0.5,   // -50% penalità (riduce danno)
  AMPLIFY: 1.5,  // +150% penalità (amplifica danno)
};

// ============================================
// STRUTTURE DATI
// ============================================

/**
 * @typedef {Object} WildcardInfo
 * @property {string} playerId - Chi possiede la wildcard
 * @property {string} playerName
 * @property {string} state - UNUSED, ACTIVATED, EXHAUSTED
 * @property {boolean} isUsedInChallenge - Se è stata usata in questa sfida
 * @property {number} activatedAt - Timestamp di attivazione
 */

/**
 * @typedef {Object} WildcardEffect
 * @property {boolean} wasUsed
 * @property {string} scenario - Quale caso di utilizzo
 * @property {number} originalPenalty - Penalità originale
 * @property {number} modifiedPenalty - Penalità dopo effetto wildcard
 * @property {number} multiplier - Moltiplicatore applicato
 * @property {number} savedCredits - Crediti risparmiati (se reduce)
 * @property {number} additionalPenalty - Crediti aggiunti (se amplify)
 * @property {string} explanation - Descrizione leggibile
 */

// ============================================
// ASSEGNAZIONE WILDCARD
// ============================================

/**
 * Assegna la wildcard a inizio round
 * 
 * @param {string[]} playerIds - Array di ID giocatori
 * @param {string} mode - SINGLE o DOUBLE
 * @returns {WildcardInfo[]} Array di giocatori con wildcard
 */
export function assignWildcards(playerIds, mode = WILDCARD_MODES.SINGLE) {
  if (playerIds.length < 2) {
    throw new Error('Servono almeno 2 giocatori per la wildcard');
  }

  const wildcardPlayers = [];
  const numWildcards = mode === WILDCARD_MODES.DOUBLE ? 2 : 1;
  const selectedIndices = new Set();

  // Selezione casuale senza duplicati
  while (selectedIndices.size < numWildcards && selectedIndices.size < playerIds.length) {
    const idx = Math.floor(Math.random() * playerIds.length);
    selectedIndices.add(idx);
  }

  for (const idx of selectedIndices) {
    wildcardPlayers.push({
      playerId: playerIds[idx],
      playerName: null, // Verrà riempito dal backend
      state: WILDCARD_STATES.UNUSED,
      isUsedInChallenge: false,
      activatedAt: null,
    });
  }

  return wildcardPlayers;
}

/**
 * Verifica se un giocatore ha la wildcard
 * 
 * @param {string} playerId
 * @param {WildcardInfo[]} wildcards
 * @returns {WildcardInfo|null}
 */
export function getWildcardForPlayer(playerId, wildcards) {
  return wildcards.find((w) => w.playerId === playerId) || null;
}

/**
 * Verifica se un giocatore ha wildcard disponibile (non usata)
 * 
 * @param {string} playerId
 * @param {WildcardInfo[]} wildcards
 * @returns {boolean}
 */
export function hasAvailableWildcard(playerId, wildcards) {
  const wc = getWildcardForPlayer(playerId, wildcards);
  return wc && wc.state === WILDCARD_STATES.UNUSED;
}

// ============================================
// ATTIVAZIONE WILDCARD
// ============================================

/**
 * Valida se la wildcard può essere attivata durante una sfida
 * 
 * @param {string} playerId - Chi attiva la wildcard
 * @param {WildcardInfo[]} wildcards - Array wildcard della stanza
 * @param {string} phase - Fase attuale del gioco
 * @returns {Object} { valid: boolean, reason: string }
 */
export function validateWildcardActivation(playerId, wildcards, phase) {
  // Deve essere fase di sfida
  if (phase !== 'challenge') {
    return { valid: false, reason: 'Wildcard attivabile solo durante una sfida' };
  }

  // Giocatore deve avere wildcard disponibile
  if (!hasAvailableWildcard(playerId, wildcards)) {
    return { valid: false, reason: 'Non hai una wildcard disponibile' };
  }

  return { valid: true, reason: '' };
}

/**
 * Attiva la wildcard di un giocatore
 * 
 * @param {string} playerId
 * @param {WildcardInfo[]} wildcards
 * @returns {WildcardInfo[]} Wildcard aggiornate
 */
export function activateWildcard(playerId, wildcards) {
  const updated = wildcards.map((w) => {
    if (w.playerId === playerId) {
      return {
        ...w,
        state: WILDCARD_STATES.ACTIVATED,
        isUsedInChallenge: true,
        activatedAt: Date.now(),
      };
    }
    return w;
  });

  return updated;
}

/**
 * Esaurisce la wildcard (la rende inutilizzabile per il resto del round)
 * 
 * @param {string} playerId
 * @param {WildcardInfo[]} wildcards
 * @returns {WildcardInfo[]}
 */
export function exhaustWildcard(playerId, wildcards) {
  const updated = wildcards.map((w) => {
    if (w.playerId === playerId) {
      return {
        ...w,
        state: WILDCARD_STATES.EXHAUSTED,
      };
    }
    return w;
  });

  return updated;
}

// ============================================
// DETERMINAZIONE SCENARIO
// ============================================

/**
 * Determina quale scenario si è verificato
 * 
 * @param {string} wildcardOwnerId - Chi ha la wildcard
 * @param {string} claimerId - Chi ha fatto la dichiarazione
 * @param {string} challengerId - Chi ha sfidato
 * @param {boolean} claimIsTrue - Se la dichiarazione era vera
 * @returns {string} Uno dei WILDCARD_SCENARIOS
 */
export function determineWildcardScenario(
  wildcardOwnerId,
  claimerId,
  challengerId,
  claimIsTrue
) {
  const isClaimerWithWildcard = wildcardOwnerId === claimerId;

  if (isClaimerWithWildcard) {
    return claimIsTrue
      ? WILDCARD_SCENARIOS.CLAIMER_TRUE
      : WILDCARD_SCENARIOS.CLAIMER_FALSE;
  } else {
    return claimIsTrue
      ? WILDCARD_SCENARIOS.CHALLENGER_TRUE
      : WILDCARD_SCENARIOS.CHALLENGER_FALSE;
  }
}

// ============================================
// CALCOLO EFFETTI WILDCARD
// ============================================

/**
 * Calcola l'effetto della wildcard sulla penalità
 * 
 * @param {string} scenario - Quale caso si è verificato
 * @param {number} originalPenalty - Penalità originale
 * @returns {Object} { multiplier, effect_amount, explanation }
 */
export function calculateWildcardEffect(scenario, originalPenalty) {
  let multiplier = 1;
  let effectAmount = 0;
  let explanation = '';

  switch (scenario) {
    case WILDCARD_SCENARIOS.CLAIMER_TRUE: {
      // Dichiaratore ha wildcard + dichiarazione era vera (sfidante perde)
      // → REDUCE: Sfidante perde il 50% in meno
      // Effetto: riduzione penalità dello sfidante
      multiplier = WILDCARD_MULTIPLIERS.REDUCE; // 0.5
      effectAmount = originalPenalty * (1 - multiplier);
      explanation = 'Wildcard dichiaratore! Sfidante perde il 50% in meno.';
      break;
    }

    case WILDCARD_SCENARIOS.CLAIMER_FALSE: {
      // Dichiaratore ha wildcard + dichiarazione era falsa (dichiaratore perde)
      // → AMPLIFY: Dichiaratore perde il 150% in più
      // Effetto: aumento penalità del dichiaratore
      multiplier = WILDCARD_MULTIPLIERS.AMPLIFY; // 1.5
      effectAmount = originalPenalty * (multiplier - 1);
      explanation = 'Wildcard dichiaratore bluffando! Perde il 150% in più.';
      break;
    }

    case WILDCARD_SCENARIOS.CHALLENGER_TRUE: {
      // Sfidante ha wildcard + dichiarazione era vera (sfidante perde comunque)
      // → AMPLIFY: Sfidante perde il 150% in più (punizione per sfida sbagliata con wildcard)
      multiplier = WILDCARD_MULTIPLIERS.AMPLIFY; // 1.5
      effectAmount = originalPenalty * (multiplier - 1);
      explanation = 'Wildcard sfidante! Perde il 150% in più per sfida fallita.';
      break;
    }

    case WILDCARD_SCENARIOS.CHALLENGER_FALSE: {
      // Sfidante ha wildcard + dichiarazione era falsa (dichiaratore perde)
      // → REDUCE: Dichiaratore perde il 50% in meno (difeso dalla wildcard dello sfidante)
      multiplier = WILDCARD_MULTIPLIERS.REDUCE; // 0.5
      effectAmount = originalPenalty * (1 - multiplier);
      explanation = 'Wildcard sfidante! Dichiaratore perde il 50% in meno.';
      break;
    }

    default:
      throw new Error(`Scenario wildcard sconosciuto: ${scenario}`);
  }

  return { multiplier, effectAmount, explanation };
}

/**
 * Applica l'effetto wildcard alla penalità
 * 
 * @param {number} originalPenalty
 * @param {string} scenario
 * @returns {number} Penalità modificata
 */
export function applyWildcardMultiplier(originalPenalty, scenario) {
  const effect = calculateWildcardEffect(scenario, originalPenalty);
  return Math.round(originalPenalty * effect.multiplier);
}

/**
 * Crea un oggetto WildcardEffect completo
 * 
 * @param {boolean} wasUsed
 * @param {string} scenario
 * @param {number} originalPenalty
 * @returns {WildcardEffect}
 */
export function createWildcardEffect(wasUsed, scenario, originalPenalty) {
  if (!wasUsed) {
    return {
      wasUsed: false,
      scenario: null,
      originalPenalty,
      modifiedPenalty: originalPenalty,
      multiplier: 1,
      savedCredits: 0,
      additionalPenalty: 0,
      explanation: 'Nessuna wildcard utilizzata',
    };
  }

  const effect = calculateWildcardEffect(scenario, originalPenalty);
  const modifiedPenalty = applyWildcardMultiplier(originalPenalty, scenario);

  let savedCredits = 0;
  let additionalPenalty = 0;

  if (effect.multiplier < 1) {
    savedCredits = originalPenalty - modifiedPenalty;
  } else if (effect.multiplier > 1) {
    additionalPenalty = modifiedPenalty - originalPenalty;
  }

  return {
    wasUsed: true,
    scenario,
    originalPenalty,
    modifiedPenalty,
    multiplier: effect.multiplier,
    savedCredits,
    additionalPenalty,
    explanation: effect.explanation,
  };
}

// ============================================
// RESET ROUND
// ============================================

/**
 * Resetta tutte le wildcard per il prossimo round
 * 
 * @param {string[]} playerIds
 * @param {string} mode - SINGLE o DOUBLE
 * @returns {WildcardInfo[]} Nuove wildcard assegnate
 */
export function resetWildcardsForNewRound(playerIds, mode = WILDCARD_MODES.SINGLE) {
  return assignWildcards(playerIds, mode);
}

// ============================================
// UI E NOTIFICHE
// ============================================

/**
 * Crea un messaggio di notifica per l'uso della wildcard
 * (senza rivelare chi l'ha usata fino alla fine)
 * 
 * @param {string} scenario
 * @returns {string} Messaggio da mostrare
 */
export function getWildcardActivationMessage(scenario) {
  const messages = {
    [WILDCARD_SCENARIOS.CLAIMER_TRUE]:
      '🎴 Una wildcard è stata attivata! Lo sfidante riceve una riduzione della penalità.',
    [WILDCARD_SCENARIOS.CLAIMER_FALSE]:
      '🎴 Una wildcard è stata attivata! Il dichiaratore riceve una penalità aumentata.',
    [WILDCARD_SCENARIOS.CHALLENGER_TRUE]:
      '🎴 Una wildcard è stata attivata! Lo sfidante riceve una penalità aumentata.',
    [WILDCARD_SCENARIOS.CHALLENGER_FALSE]:
      '🎴 Una wildcard è stata attivata! Il dichiaratore riceve una riduzione della penalità.',
  };

  return messages[scenario] || 'Una wildcard è stata attivata!';
}

/**
 * Crea un'icona visiva per mostrare l'uso della wildcard
 * 
 * @param {string} scenario
 * @returns {Object} { icon, color, description }
 */
export function getWildcardVisual(scenario) {
  const visuals = {
    [WILDCARD_SCENARIOS.CLAIMER_TRUE]: {
      icon: '🎴✓',
      color: '#8b5cf6', // Purple
      description: 'Wildcard difensiva - Riduce penalità',
    },
    [WILDCARD_SCENARIOS.CLAIMER_FALSE]: {
      icon: '🎴✗',
      color: '#dc2626', // Red
      description: 'Wildcard offensiva - Aumenta penalità',
    },
    [WILDCARD_SCENARIOS.CHALLENGER_TRUE]: {
      icon: '🎴✗',
      color: '#dc2626', // Red
      description: 'Wildcard sfidante - Aumenta penalità',
    },
    [WILDCARD_SCENARIOS.CHALLENGER_FALSE]: {
      icon: '🎴✓',
      color: '#8b5cf6', // Purple
      description: 'Wildcard sfidante - Riduce penalità',
    },
  };

  return visuals[scenario] || { icon: '🎴', color: '#666', description: 'Wildcard usata' };
}

// ============================================
// STATISTICHE WILDCARD
// ============================================

/**
 * Genera statistiche sull'uso di wildcard durante il round
 * 
 * @param {Object[]} challengeLogs - Array di challenge logs
 * @returns {Object} Statistiche
 */
export function generateWildcardStats(challengeLogs) {
  const stats = {
    totalWildcardsUsed: 0,
    wildcardsByScenario: {},
    totalCreditsAffected: 0,
    totalSavedCredits: 0,
    totalAdditionalPenalties: 0,
  };

  for (const log of challengeLogs) {
    if (log.wildcardEffect && log.wildcardEffect.wasUsed) {
      stats.totalWildcardsUsed++;
      const scenario = log.wildcardEffect.scenario;
      stats.wildcardsByScenario[scenario] = (stats.wildcardsByScenario[scenario] || 0) + 1;
      stats.totalCreditsAffected += Math.abs(log.wildcardEffect.modifiedPenalty);
      stats.totalSavedCredits += log.wildcardEffect.savedCredits;
      stats.totalAdditionalPenalties += log.wildcardEffect.additionalPenalty;
    }
  }

  return stats;
}

/**
 * Crea un log completo di un'attivazione wildcard
 * 
 * @param {string} playerId - Chi ha attivato
 * @param {string} playerName
 * @param {string} scenario
 * @param {number} originalPenalty
 * @param {number} modifiedPenalty
 * @returns {Object} Log strutturato
 */
export function createWildcardLog(playerId, playerName, scenario, originalPenalty, modifiedPenalty) {
  const effect = calculateWildcardEffect(scenario, originalPenalty);

  return {
    playerId,
    playerName,
    scenario,
    originalPenalty,
    modifiedPenalty,
    multiplier: effect.multiplier,
    difference: modifiedPenalty - originalPenalty,
    timestamp: Date.now(),
    explanation: effect.explanation,
  };
}
