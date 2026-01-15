/**
 * LUCKY LIAR - Challenge System
 * Attivazione sfida, risoluzione e calcolo risultati
 */

import { WILDCARD_VALUE } from './luckyLiarDeclarations';
import {
  determineWildcardScenario,
  createWildcardEffect,
  activateWildcard,
  exhaustWildcard,
  getWildcardActivationMessage,
  getWildcardVisual,
} from './luckyLiarWildcard';

// ============================================
// COSTANTI
// ============================================

export const CHALLENGE_STATES = {
  PENDING: 'pending',        // Sfida lanciata, attesa risoluzione
  RESOLVED: 'resolved',      // Sfida risolta
  APPLYING_PENALTY: 'applying_penalty', // Applicazione penalità
  COMPLETE: 'complete',      // Sfida completata
};

export const CHALLENGE_OUTCOMES = {
  CLAIM_TRUE: 'claim_true',    // Dichiarazione vera
  CLAIM_FALSE: 'claim_false',  // Dichiarazione falsa (bluff scoperto)
};

// ============================================
// STRUTTURE DATI
// ============================================

/**
 * @typedef {Object} Challenge
 * @property {string} challengerId - Chi sfida
 * @property {string} challengerName
 * @property {string} claimerId - Chi ha fatto la dichiarazione
 * @property {string} claimerName
 * @property {Object} claim - { quantity, value }
 * @property {number} timestamp
 * @property {string} state - PENDING, RESOLVED, APPLYING_PENALTY, COMPLETE
 * @property {ChallengeResult} result - null finché non risolta
 */

/**
 * @typedef {Object} ChallengeResult
 * @property {string} outcome - CLAIM_TRUE o CLAIM_FALSE
 * @property {number} actualCount - Numero reale di carte
 * @property {number} claimedQuantity - Numero dichiarato
 * @property {number} difference - Distanza dalla verità (abs)
 * @property {string} loserId - Chi ha perso
 * @property {string} loserName
 * @property {number} penalty - Crediti persi
 * @property {number} penalty_reason - Motivo della penalità
 * @property {string} explanation - Descrizione leggibile
 */

// ============================================
// VALIDAZIONE SFIDA
// ============================================

/**
 * Verifica se una sfida può essere lanciata
 * 
 * @param {string} challengerId - Chi sfida
 * @param {Turn} turn - Stato turno attuale
 * @param {string} phase - Fase del gioco
 * @returns {Object} { valid: boolean, reason: string }
 */
export function validateChallenge(challengerId, turn, phase) {
  // Deve esserci una dichiarazione da sfidare
  if (!turn.lastClaim) {
    return { valid: false, reason: 'Nessuna dichiarazione da sfidare' };
  }

  // Non puoi sfidare te stesso
  if (challengerId === turn.lastClaim.playerId) {
    return { valid: false, reason: 'Non puoi sfidare la tua dichiarazione' };
  }

  // Deve essere il turno di chi sfida (solo dopo la dichiarazione precedente)
  if (!turn.canChallenge) {
    return { valid: false, reason: 'Non è ancora possibile sfidare in questo momento' };
  }

  return { valid: true, reason: '' };
}

/**
 * Crea un oggetto Challenge
 * 
 * @param {string} challengerId
 * @param {string} challengerName
 * @param {string} claimerId
 * @param {string} claimerName
 * @param {Object} claim - { quantity, value }
 * @returns {Challenge}
 */
export function createChallenge(challengerId, challengerName, claimerId, claimerName, claim) {
  return {
    challengerId,
    challengerName,
    claimerId,
    claimerName,
    claim,
    timestamp: Date.now(),
    state: CHALLENGE_STATES.PENDING,
    result: null,
  };
}

// ============================================
// VERIFICA DICHIARAZIONE
// ============================================

/**
 * Conta le carte di un valore/wildcard nella mano di un giocatore
 * 
 * @param {Card[]} hand - Mano del giocatore
 * @param {string} value - Valore da cercare
 * @returns {number}
 */
export function countCardsInHand(hand, value) {
  if (value === WILDCARD_VALUE) {
    // Wildcard non conta, è solo una gestione speciale
    return 0;
  }
  return hand.filter((card) => card.value === value).length;
}

/**
 * Conta le carte di un valore in tutte le mani (inclusa wildcard)
 * 
 * @param {Object} playerHands - { playerId: Card[] }
 * @param {string} value - Valore da cercare
 * @returns {number}
 */
export function countTotalCards(playerHands, value) {
  let total = 0;

  for (const playerId in playerHands) {
    const hand = playerHands[playerId];
    if (value === WILDCARD_VALUE) {
      // Wildcard: non ha carte nel mazzo, è valore speciale
      // Comportamento: wildcard non può essere verificata (sempre vera?)
      // O: wildcard conta sempre come vera fino a 8 carte max
      continue;
    }
    total += countCardsInHand(hand, value);
  }

  return total;
}

/**
 * Verifica una dichiarazione e ritorna i dettagli
 * 
 * @param {Object} claim - { quantity, value }
 * @param {Object} playerHands - { playerId: Card[] }
 * @returns {Object} { actualCount, isTrueDeclaration }
 */
export function verifyClaim(claim, playerHands) {
  const actualCount = countTotalCards(playerHands, claim.value);
  const isTrueDeclaration = actualCount >= claim.quantity;

  return { actualCount, isTrueDeclaration };
}

// ============================================
// RISOLUZIONE SFIDA
// ============================================

/**
 * Valida se un giocatore può attivare wildcard durante la sfida
 * 
 * @param {string} playerId - Chi vuole attivare la wildcard
 * @param {Object[]} wildcards - Array di wildcard disponibili
 * @returns {Object} { valid: boolean, reason: string }
 */
export function validateWildcardActivationInChallenge(playerId, wildcards) {
  // Giocatore deve avere wildcard disponibile
  const playerWildcard = wildcards?.find((w) => w.playerId === playerId);
  
  if (!playerWildcard) {
    return { valid: false, reason: 'Non hai una wildcard disponibile' };
  }

  if (playerWildcard.state !== 'unused') {
    return { valid: false, reason: 'Hai già usato la tua wildcard' };
  }

  return { valid: true, reason: '' };
}

/**
 * Risolve una sfida e calcola il risultato
 * 
 * @param {Challenge} challenge
 * @param {Object} playerHands - { playerId: Card[] }
 * @param {Object[]} wildcards - Array wildcard della stanza (opzionale)
 * @param {boolean} activateWildcardFor - ID del giocatore che attiva la wildcard (opzionale)
 * @returns {ChallengeResult con wildcard effect}
 */
export function resolveChallenge(challenge, playerHands, wildcards = null, activateWildcardFor = null) {
  // Verifica la dichiarazione
  const verification = verifyClaim(challenge.claim, playerHands);
  const actualCount = verification.actualCount;
  const isTrueClaim = verification.isTrueDeclaration;

  // Calcola distanza dalla verità
  const difference = Math.abs(actualCount - challenge.claim.quantity);

  // Determina outcome e perdente (nessun valore di crediti - è un party game)
  let outcome, loserId, loserName, explanation;

  if (isTrueClaim) {
    // ✓ Dichiarazione vera
    outcome = CHALLENGE_OUTCOMES.CLAIM_TRUE;
    loserId = challenge.challengerId;
    loserName = challenge.challengerName;
    explanation = `${challenge.claimerName} aveva ragione! C'erano davvero ${actualCount} ${challenge.claim.value}(i).`;
  } else {
    // ✗ Dichiarazione falsa
    outcome = CHALLENGE_OUTCOMES.CLAIM_FALSE;
    loserId = challenge.claimerId;
    loserName = challenge.claimerName;
    explanation = `BLUFF SCOPERTO! ${challenge.claimerName} ha dichiarato ${challenge.claim.quantity} ma ce n'erano solo ${actualCount}.`;
  }

  // ============================================
  // WILDCARD EFFECT (per la UI, non per crediti)
  // ============================================

  let wildcardEffect = null;
  let updatedWildcards = wildcards;

  if (activateWildcardFor && wildcards) {
    // Valida attivazione wildcard
    const validation = validateWildcardActivationInChallenge(activateWildcardFor, wildcards);
    
    if (validation.valid) {
      // Determina lo scenario
      const scenario = determineWildcardScenario(
        activateWildcardFor,
        challenge.claimerId,
        challenge.challengerId,
        isTrueClaim
      );

      // Crea effetto wildcard (solo per display)
      wildcardEffect = createWildcardEffect(true, scenario, 0);

      // Aggiorna wildcards: attiva e poi esaurisce
      updatedWildcards = wildcards.map((w) => {
        if (w.playerId === activateWildcardFor) {
          return {
            ...w,
            state: 'exhausted',
            isUsedInChallenge: true,
            activatedAt: Date.now(),
          };
        }
        return w;
      });

      // Aggiorna spiegazione con messaggio wildcard
      const wildcardMsg = getWildcardActivationMessage(scenario);
      explanation = `${explanation} 🎴 ${wildcardMsg}`;
    }
  }

  return {
    outcome,
    actualCount,
    claimedQuantity: challenge.claim.quantity,
    difference,
    loserId,
    loserName,
    explanation,
    wildcardEffect,
    updatedWildcards,
  };
}

/**
 * Completa una sfida aggiornando lo stato
 * 
 * @param {Challenge} challenge
 * @param {ChallengeResult} result
 * @returns {Challenge}
 */
export function completeChallenge(challenge, result) {
  return {
    ...challenge,
    state: CHALLENGE_STATES.COMPLETE,
    result,
  };
}


// ============================================
// ANIMAZIONE E UI
// ============================================

/**
 * Prepara i dati per l'animazione di reveal della mano
 * 
 * @param {Card[]} hand - Mano del dichiaratore
 * @param {string} targetValue - Valore che cercava
 * @param {number} actualCount - Numero reale
 * @param {number} claimedQuantity - Numero dichiarato
 * @returns {Object} Dati per UI animazione
 */
export function prepareRevealAnimation(hand, targetValue, actualCount, claimedQuantity) {
  // Ordina le carte: prima quelle del valore cercato
  const targetCards = hand.filter((card) => card.value === targetValue);
  const otherCards = hand.filter((card) => card.value !== targetValue);
  
  const orderedHand = [...targetCards, ...otherCards];

  return {
    orderedHand,
    targetValue,
    actualCount,
    claimedQuantity,
    matchCount: targetCards.length,
    difference: Math.abs(actualCount - claimedQuantity),
    isBluff: actualCount < claimedQuantity,
  };
}

/**
 * Crea un oggetto di visualizzazione per la wildcard attivata
 * 
 * @param {Object} wildcardEffect - Dall'oggetto result
 * @returns {Object} Dati per UI display
 */
export function getWildcardDisplayData(wildcardEffect) {
  if (!wildcardEffect || !wildcardEffect.wasUsed) {
    return null;
  }

  const visual = getWildcardVisual(wildcardEffect.scenario);

  return {
    icon: visual.icon,
    color: visual.color,
    description: visual.description,
    originalPenalty: wildcardEffect.originalPenalty,
    modifiedPenalty: wildcardEffect.modifiedPenalty,
    difference: Math.abs(wildcardEffect.modifiedPenalty - wildcardEffect.originalPenalty),
    multiplier: wildcardEffect.multiplier,
    explanation: wildcardEffect.explanation,
    wasSaved: wildcardEffect.savedCredits > 0,
    amountSaved: wildcardEffect.savedCredits,
    wasAmplified: wildcardEffect.additionalPenalty > 0,
    amountAdded: wildcardEffect.additionalPenalty,
  };
}

/**
 * Genera testo evidenziazione per il risultato
 * 
 * @param {ChallengeResult} result
 * @returns {Object} { title, color, icon }
 */
export function getResultHighlight(result) {
  if (result.outcome === CHALLENGE_OUTCOMES.CLAIM_TRUE) {
    return {
      title: '✓ DICHIARAZIONE VERA',
      color: '#16a34a', // Green
      icon: '✓',
      bgColor: 'rgba(16,185,129,0.1)',
    };
  } else {
    return {
      title: '✗ BLUFF SCOPERTO',
      color: '#dc2626', // Red
      icon: '✗',
      bgColor: 'rgba(220,38,38,0.1)',
    };
  }
}

/**
 * Calcola il timing per le animazioni di reveal
 * 
 * @param {Card[]} hand
 * @returns {Object} { totalMs, perCardMs, startDelay }
 */
export function calculateRevealTiming(hand) {
  const perCardMs = 150; // 150ms per carta
  const totalMs = hand.length * perCardMs;
  const startDelay = 500; // Attesa prima di iniziare

  return { totalMs, perCardMs, startDelay };
}

// ============================================
// LOGGING E STATISTICHE
// ============================================

/**
 * Crea un log della sfida per la cronologia
 * 
 * @param {Challenge} challenge
 * @param {ChallengeResult} result
 * @returns {Object} Log strutturato
 */
export function createChallengeLog(challenge, result) {
  return {
    timestamp: challenge.timestamp,
    challenger: challenge.challengerName,
    claimer: challenge.claimerName,
    claim: `${challenge.claim.quantity} ${challenge.claim.value}(i)`,
    actual: result.actualCount,
    outcome: result.outcome,
    loser: result.loserName,
    penalty: result.penalty,
    explanation: result.explanation,
  };
}

/**
 * Genera statistiche di sfida per il round
 * 
 * @param {Object[]} challengeLogs - Array di challenge logs
 * @returns {Object} Statistiche
 */
export function generateChallengeStats(challengeLogs) {
  const stats = {
    totalChallenges: challengeLogs.length,
    successfulChallenges: 0,
    successfulBluffs: 0,
    totalPenalties: 0,
    penaltiesByPlayer: {},
  };

  for (const log of challengeLogs) {
    if (log.outcome === CHALLENGE_OUTCOMES.CLAIM_FALSE) {
      stats.successfulChallenges++;
    } else {
      stats.successfulBluffs++;
    }
    stats.totalPenalties += log.penalty;

    if (!stats.penaltiesByPlayer[log.loser]) {
      stats.penaltiesByPlayer[log.loser] = 0;
    }
    stats.penaltiesByPlayer[log.loser] += log.penalty;
  }

  return stats;
}
