/**
 * LUCKY LIAR - Game Flow & Turn Management
 * Gestione turni, dichiarazioni, sfide e reset di round
 */

import { 
  createDeck, 
  shuffleDeck, 
  dealInitialHand, 
  drawCard, 
  addCardToHand, 
  removeCardFromHand,
  handExceedsLimit,
  getCardsToDiscard,
  analyzeHand 
} from './cards';

import {
  assignWildcards,
  resetWildcardsForNewRound,
  WILDCARD_MODES,
} from './luckyLiarWildcard';

// ============================================
// COSTANTI DI GIOCO
// ============================================

export const GAME_PHASES = {
  SETUP: 'setup',           // Setup iniziale
  DEALING: 'dealing',       // Distribuzione carte
  TURN: 'turn',            // Turno attivo (dichiarazione/sfida/passo)
  CHALLENGE: 'challenge',  // Risoluzione sfida
  CLEANUP: 'cleanup',      // Scarto carte in eccesso
  ROUND_END: 'round_end',  // Fine round
  GAME_END: 'game_end',    // Fine partita
};

export const PLAYER_ACTIONS = {
  CLAIM: 'claim',      // Fa una dichiarazione
  CHALLENGE: 'challenge', // Sfida l'ultima dichiarazione
  PASS: 'pass',        // Passa il turno
};

// ============================================
// STRUTTURE DATI
// ============================================

/**
 * @typedef {Object} Claim
 * @property {string} playerId
 * @property {string} playerName
 * @property {number} quantity - Numero minimo
 * @property {string} value - Valore della carta (es: 'A', 'K', wildcard)
 * @property {number} timestamp
 */

/**
 * @typedef {Object} Turn
 * @property {string} currentPlayerId
 * @property {number} currentPlayerIndex
 * @property {Claim} lastClaim - Ultima dichiarazione
 * @property {string[]} claimHistory - Cronologia dichiarazioni del round
 * @property {boolean} canChallenge - Se il giocatore può sfidare
 * @property {number} turnTimeLimit - Tempo limite per il turno (ms)
 */

/**
 * @typedef {Object} RoundState
 * @property {number} roundNumber
 * @property {string} phase
 * @property {Turn} turn
 * @property {Object} playerHands - { playerId: Card[] }
 * @property {Object} playerWagers - { playerId: number }
 * @property {string} wildcardPlayer - Chi possiede la wildcard
 * @property {number} roundStartTime
 * @property {Object} roundResults - { playerId: { action, penalty, gain } }
 */

// ============================================
// GESTIONE ORDINE GIOCATORI
// ============================================

/**
 * Ottiene l'indice del giocatore successivo in ordine circolare
 * @param {string[]} playerIds - Array di ID giocatori
 * @param {number} currentIndex - Indice attuale
 * @returns {number} Indice successivo
 */
export function getNextPlayerIndex(playerIds, currentIndex) {
  return (currentIndex + 1) % playerIds.length;
}

/**
 * Ottiene l'indice del giocatore precedente in ordine circolare
 * @param {string[]} playerIds - Array di ID giocatori
 * @param {number} currentIndex - Indice attuale
 * @returns {number} Indice precedente
 */
export function getPreviousPlayerIndex(playerIds, currentIndex) {
  return (currentIndex - 1 + playerIds.length) % playerIds.length;
}

/**
 * Verifica se è il turno del giocatore
 * @param {string} playerId
 * @param {Turn} turn
 * @returns {boolean}
 */
export function isPlayerTurn(playerId, turn) {
  return turn.currentPlayerId === playerId;
}

// ============================================
// DICHIARAZIONI (CLAIMS)
// ============================================

/**
 * Crea una dichiarazione
 * @param {string} playerId
 * @param {string} playerName
 * @param {number} quantity - Es: 3 (significa "almeno 3")
 * @param {string} value - Es: 'A', 'K', 'wildcard'
 * @returns {Claim}
 */
export function createClaim(playerId, playerName, quantity, value) {
  if (quantity < 1) throw new Error('Quantità deve essere >= 1');
  if (!value) throw new Error('Valore della dichiarazione richiesto');
  
  return {
    playerId,
    playerName,
    quantity,
    value,
    timestamp: Date.now(),
  };
}

/**
 * Converti una dichiarazione in stringa leggibile
 * @param {Claim} claim
 * @returns {string} Es: "Almeno 3 Assi" o "Almeno 2 Jolly"
 */
export function claimToString(claim) {
  const valueLabel = claim.value === 'wildcard' ? 'Jolly' : claim.value.toUpperCase();
  return `Almeno ${claim.quantity} ${valueLabel}`;
}

/**
 * Verifica se una nuova dichiarazione è valida (deve essere più alta della precedente)
 * @param {Claim} newClaim
 * @param {Claim} previousClaim - Dichiarazione precedente (nullable)
 * @returns {Object} { valid: boolean, reason: string }
 */
export function validateClaim(newClaim, previousClaim) {
  if (!previousClaim) {
    // Prima dichiarazione del round, sempre valida
    return { valid: true, reason: '' };
  }

  // Regola 1: Se cambi valore, la quantità deve aumentare di 1
  if (newClaim.value !== previousClaim.value) {
    if (newClaim.quantity <= previousClaim.quantity) {
      return { 
        valid: false, 
        reason: `Cambiando valore devi aumentare a almeno ${previousClaim.quantity + 1}` 
      };
    }
    return { valid: true, reason: '' };
  }

  // Regola 2: Se mantieni lo stesso valore, la quantità deve aumentare
  if (newClaim.quantity <= previousClaim.quantity) {
    return { 
      valid: false, 
      reason: `Devi dichiarare almeno ${previousClaim.quantity + 1}` 
    };
  }

  return { valid: true, reason: '' };
}

// ============================================
// SFIDE (CHALLENGES)
// ============================================

/**
 * Verifica una dichiarazione contro le carte effettive
 * @param {Claim} claim
 * @param {Object} playerHands - { playerId: Card[] }
 * @returns {Object} { valid: boolean, actualCount: number }
 */
export function verifyClaim(claim, playerHands) {
  if (claim.value === 'wildcard') {
    // Wildcard conta come qualsiasi valore (logica semplificata)
    // In pratica: non si verifica, è sempre vera (o parte della gestione speciale)
    return { valid: true, actualCount: -1 };
  }

  let actualCount = 0;
  for (const playerId in playerHands) {
    const hand = playerHands[playerId];
    actualCount += hand.filter((card) => card.value === claim.value).length;
  }

  const isValid = actualCount >= claim.quantity;
  return { valid: isValid, actualCount };
}

/**
 * Elabora una sfida: determina chi ha perso e applica penalità
 * @param {Claim} claim - Dichiarazione sfidato
 * @param {string} challengerId - Chi ha sfidato
 * @param {Object} playerHands
 * @returns {Object} { challengeValid: boolean, loserIds: string[], reason: string }
 */
export function resolveChallenge(claim, challengerId, playerHands) {
  const verification = verifyClaim(claim, playerHands);

  if (verification.valid) {
    // Dichiarazione era vera → il sfidante perde
    return {
      challengeValid: false,
      loserIds: [challengerId],
      reason: `Dichiarazione corretta! Erano davvero ${verification.actualCount} ${claim.value}(i)`,
    };
  } else {
    // Dichiarazione era falsa → chi l'ha fatta perde
    return {
      challengeValid: true,
      loserIds: [claim.playerId],
      reason: `Bluff scoperto! C'erano solo ${verification.actualCount} ${claim.value}(i), non ${claim.quantity}`,
    };
  }
}

// ============================================
// GESTIONE TURNI
// ============================================

/**
 * Inizializza il primo turno di un round
 * @param {string[]} playerIds
 * @param {string} startingPlayerId - Chi inizia (opzionale, default primo giocatore)
 * @returns {Turn}
 */
export function initializeTurn(playerIds, startingPlayerId = null) {
  const currentPlayerId = startingPlayerId || playerIds[0];
  const currentPlayerIndex = playerIds.indexOf(currentPlayerId);

  if (currentPlayerIndex === -1) {
    throw new Error(`Giocatore ${startingPlayerId} non trovato`);
  }

  return {
    currentPlayerId,
    currentPlayerIndex,
    lastClaim: null,
    claimHistory: [],
    canChallenge: false, // Non puoi sfidare il primo giocatore
    turnTimeLimit: 30000, // 30 secondi per turno
  };
}

/**
 * Avanza al turno successivo (dopo dichiarazione/passo)
 * @param {Turn} turn
 * @param {string[]} playerIds
 * @returns {Turn}
 */
export function advanceTurn(turn, playerIds) {
  const nextIndex = getNextPlayerIndex(playerIds, turn.currentPlayerIndex);
  const nextPlayerId = playerIds[nextIndex];

  return {
    ...turn,
    currentPlayerId: nextPlayerId,
    currentPlayerIndex: nextIndex,
    canChallenge: true, // Puoi sfidare il prossimo giocatore
  };
}

/**
 * Aggiunge una dichiarazione alla cronologia del turno
 * @param {Turn} turn
 * @param {Claim} claim
 * @returns {Turn}
 */
export function recordClaim(turn, claim) {
  return {
    ...turn,
    lastClaim: claim,
    claimHistory: [...turn.claimHistory, claimToString(claim)],
  };
}

// ============================================
// GESTIONE ROUND
// ============================================

/**
 * Inizializza un nuovo round completo
 * @param {string[]} playerIds
 * @param {Object} players - { playerId: { name, avatar } }
 * @param {number} roundNumber
 * @param {string} wildcardMode - SINGLE o DOUBLE (default SINGLE)
 * @returns {RoundState}
 */
export function initializeRound(playerIds, players, roundNumber, wildcardMode = WILDCARD_MODES.SINGLE) {
  // Crea e mischia il mazzo
  const fullDeck = createDeck();
  const shuffled = shuffleDeck(fullDeck);

  // Distribuisce carte iniziali
  const playerHands = {};
  let deckRemaining = shuffled;

  for (const playerId of playerIds) {
    const { hand, deckRemaining: newDeck } = dealInitialHand(deckRemaining, 5);
    playerHands[playerId] = hand;
    deckRemaining = newDeck;
  }

  // Assegna wildcard casualmente (1 o 2 giocatori)
  const wildcards = assignWildcards(playerIds, wildcardMode);

  return {
    roundNumber,
    phase: GAME_PHASES.TURN,
    turn: initializeTurn(playerIds),
    playerHands,
    deckRemaining,
    wildcards, // Array di giocatori con wildcard
    roundStartTime: Date.now(),
    roundResults: {}, // Verrà compilato durante il round
  };
}

/**
 * Reset completo dopo una sfida: nuove carte, wildcard, ecc.
 * @param {RoundState} roundState
 * @param {string[]} playerIds
 * @param {string} wildcardMode - SINGLE o DOUBLE
 * @returns {RoundState}
 */
export function resetRoundAfterChallenge(roundState, playerIds, wildcardMode = WILDCARD_MODES.SINGLE) {
  // Crea nuovo mazzo
  const fullDeck = createDeck();
  const shuffled = shuffleDeck(fullDeck);

  // Distribuisce carte nuove
  const playerHands = {};
  let deckRemaining = shuffled;

  for (const playerId of playerIds) {
    const { hand, deckRemaining: newDeck } = dealInitialHand(deckRemaining, 5);
    playerHands[playerId] = hand;
    deckRemaining = newDeck;
  }

  // Reset wildcard (assegna nuova/e)
  const newWildcards = resetWildcardsForNewRound(playerIds, wildcardMode);

  // Reset turno (ricomincia da chi ha perso la sfida)
  const loserOfChallenge = Object.keys(roundState.roundResults || {}).find(
    (playerId) => roundState.roundResults[playerId].penalty > 0
  ) || playerIds[0];
  const loserIndex = playerIds.indexOf(loserOfChallenge);

  return {
    ...roundState,
    phase: GAME_PHASES.TURN,
    turn: initializeTurn(playerIds, loserOfChallenge),
    playerHands,
    deckRemaining,
    wildcards: newWildcards,
    roundStartTime: Date.now(),
    roundResults: {},
  };
}

/**
 * Applica penalità ai giocatori dopo una sfida
 * @param {string[]} loserIds - Chi perde crediti
 * @param {number} penaltyAmount
 * @returns {Object} Mappa di penalità { playerId: amount }
 */
export function applyPenalties(loserIds, penaltyAmount = PENALTIES.FAILED_CHALLENGE) {
  const penalties = {};
  for (const loserId of loserIds) {
    penalties[loserId] = penaltyAmount;
  }
  return penalties;
}

// ============================================
// AZIONI DI GIOCO
// ============================================

/**
 * Esegui azione di dichiarazione
 * @param {RoundState} roundState
 * @param {string} playerId
 * @param {string} playerName
 * @param {number} quantity
 * @param {string} value
 * @param {string[]} playerIds
 * @returns {Object} { success: boolean, roundState: RoundState, error: string }
 */
export function executeClaimAction(
  roundState,
  playerId,
  playerName,
  quantity,
  value,
  playerIds
) {
  // Verifica che sia il turno del giocatore
  if (!isPlayerTurn(playerId, roundState.turn)) {
    return { success: false, error: 'Non è il tuo turno' };
  }

  // Crea la nuova dichiarazione
  const newClaim = createClaim(playerId, playerName, quantity, value);

  // Valida contro la dichiarazione precedente
  const validation = validateClaim(newClaim, roundState.turn.lastClaim);
  if (!validation.valid) {
    return { success: false, error: validation.reason };
  }

  // Registra la dichiarazione
  const updatedTurn = recordClaim(roundState.turn, newClaim);
  const updatedRoundState = {
    ...roundState,
    turn: updatedTurn,
  };

  // Avanza al turno successivo
  const nextTurn = advanceTurn(updatedTurn, playerIds);

  return {
    success: true,
    roundState: { ...updatedRoundState, turn: nextTurn },
    claim: newClaim,
  };
}

/**
 * Esegui azione di sfida
 * @param {RoundState} roundState
 * @param {string} challengerId
 * @param {string[]} playerIds
 * @returns {Object} { success: boolean, roundState: RoundState, challengeResult: Object }
 */
export function executeChallengeAction(roundState, challengerId, playerIds) {
  // Verifica che sia il turno del giocatore che sfida
  if (!isPlayerTurn(challengerId, roundState.turn)) {
    return { success: false, error: 'Non è il tuo turno per sfidare' };
  }

  // Deve esserci una dichiarazione da sfidare
  if (!roundState.turn.lastClaim) {
    return { success: false, error: 'Nessuna dichiarazione da sfidare' };
  }

  // Risolvi la sfida
  const challengeResult = resolveChallenge(
    roundState.turn.lastClaim,
    challengerId,
    roundState.playerHands
  );

  // Applica penalità
  const penalties = applyPenalties(challengeResult.loserIds, PENALTIES.FAILED_CHALLENGE);

  // Registra i risultati del round
  const roundResults = { ...roundState.roundResults };
  for (const loserId of challengeResult.loserIds) {
    roundResults[loserId] = {
      action: 'challenged',
      penalty: PENALTIES.FAILED_CHALLENGE,
    };
  }

  const updatedRoundState = {
    ...roundState,
    phase: GAME_PHASES.CHALLENGE,
    roundResults,
  };

  return {
    success: true,
    roundState: updatedRoundState,
    challengeResult,
    penalties,
  };
}

/**
 * Esegui azione di passo
 * @param {RoundState} roundState
 * @param {string} playerId
 * @param {string[]} playerIds
 * @returns {Object} { success: boolean, roundState: RoundState }
 */
export function executePassAction(roundState, playerId, playerIds) {
  // Verifica che sia il turno del giocatore
  if (!isPlayerTurn(playerId, roundState.turn)) {
    return { success: false, error: 'Non è il tuo turno' };
  }

  // Registra il passo
  const roundResults = { ...roundState.roundResults };
  roundResults[playerId] = {
    action: 'passed',
    penalty: PENALTIES.PASS_PENALTY,
  };

  // Avanza al turno successivo
  const nextTurn = advanceTurn(roundState.turn, playerIds);

  return {
    success: true,
    roundState: {
      ...roundState,
      turn: nextTurn,
      roundResults,
    },
  };
}
