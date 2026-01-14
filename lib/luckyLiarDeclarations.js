/**
 * LUCKY LIAR - Declaration System
 * Validazione dichiarazioni e modalità di dichiarazione (libera vs assistita)
 */

import { CARD_VALUES_ARRAY } from './cards';

// ============================================
// COSTANTI
// ============================================

export const DECLARATION_MODES = {
  FREE: 'free',         // Modalità libera (testo/voice)
  ASSISTED: 'assisted', // Modalità assistita (UI con pulsanti)
};

// Wildcard speciale
export const WILDCARD_VALUE = 'wildcard';

// ============================================
// STRUTTURE DATI
// ============================================

/**
 * @typedef {Object} DeclarationOption
 * @property {number} quantity - Quantità minima
 * @property {string} value - Valore ('2'-'A' o 'wildcard')
 * @property {string} display - Testo leggibile (es: "3 Assi")
 * @property {boolean} isValid - Se è una dichiarazione valida dal precedente
 * @property {string} reason - Motivo se non valida
 */

// ============================================
// VALIDAZIONE PROGRESSIONE
// ============================================

/**
 * Valida la progressione tra due dichiarazioni
 * Regole:
 * 1. Se cambi valore → quantità deve aumentare di almeno 1
 * 2. Se mantieni valore → quantità deve aumentare di almeno 1
 * 3. La quantità massima è il numero totale di carte nel mazzo (52)
 * 
 * @param {number} newQuantity
 * @param {string} newValue
 * @param {number} previousQuantity
 * @param {string} previousValue
 * @returns {Object} { valid: boolean, reason: string }
 */
export function validateDeclarationProgression(
  newQuantity,
  newValue,
  previousQuantity,
  previousValue
) {
  // Validazioni base
  if (newQuantity < 1) {
    return { valid: false, reason: 'La quantità deve essere almeno 1' };
  }

  if (newQuantity > 52) {
    return { valid: false, reason: 'Non puoi dichiarare più di 52 carte' };
  }

  // Prima dichiarazione del round
  if (!previousValue || previousQuantity === 0) {
    return { valid: true, reason: '' };
  }

  // Se cambi valore
  if (newValue !== previousValue) {
    // Quando cambi valore, devi aumentare la quantità
    if (newQuantity <= previousQuantity) {
      return {
        valid: false,
        reason: `Cambiando valore, devi dichiarare almeno ${previousQuantity + 1}`,
      };
    }
    return { valid: true, reason: '' };
  }

  // Se mantieni lo stesso valore, quantità deve aumentare
  if (newQuantity <= previousQuantity) {
    return {
      valid: false,
      reason: `Devi dichiarare almeno ${previousQuantity + 1}`,
    };
  }

  return { valid: true, reason: '' };
}

/**
 * Genera un array di tutte le possibili dichiarazioni valide dalla attuale
 * Utile per la modalità assistita
 * 
 * @param {number} previousQuantity - Quantità dichiarata prima (0 se prima dichiarazione)
 * @param {string} previousValue - Valore dichiarato prima (null se prima dichiarazione)
 * @param {number} maxQuantity - Quantità massima da mostrare (es: 15 per UI non troppo carica)
 * @returns {DeclarationOption[]}
 */
export function generateValidDeclarations(
  previousQuantity = 0,
  previousValue = null,
  maxQuantity = 15
) {
  const declarations = [];

  // Se è la prima dichiarazione, mostra quantità 1-5 per tutti i valori
  if (!previousValue || previousQuantity === 0) {
    for (let qty = 1; qty <= 5; qty++) {
      // Numeri
      for (const val of CARD_VALUES_ARRAY) {
        declarations.push({
          quantity: qty,
          value: val,
          display: `${qty} ${getValueLabel(val, qty)}`,
          isValid: true,
          reason: '',
        });
      }

      // Wildcard
      declarations.push({
        quantity: qty,
        value: WILDCARD_VALUE,
        display: `${qty} Jolly`,
        isValid: true,
        reason: '',
      });
    }

    return declarations;
  }

  // MODALITÀ: Mantieni lo stesso valore, aumenta quantità
  for (let qty = previousQuantity + 1; qty <= Math.min(previousQuantity + 8, maxQuantity); qty++) {
    const validation = validateDeclarationProgression(qty, previousValue, previousQuantity, previousValue);
    declarations.push({
      quantity: qty,
      value: previousValue,
      display: `${qty} ${getValueLabel(previousValue, qty)}`,
      isValid: validation.valid,
      reason: validation.reason,
    });
  }

  // MODALITÀ: Cambia valore, aumenta quantità minimo +1
  const minQtyForNewValue = previousQuantity + 1;
  for (const val of CARD_VALUES_ARRAY) {
    if (val === previousValue) continue; // Skip il valore precedente

    for (let qty = minQtyForNewValue; qty <= Math.min(minQtyForNewValue + 3, maxQuantity); qty++) {
      const validation = validateDeclarationProgression(qty, val, previousQuantity, previousValue);
      declarations.push({
        quantity: qty,
        value: val,
        display: `${qty} ${getValueLabel(val, qty)}`,
        isValid: validation.valid,
        reason: validation.reason,
      });
    }
  }

  // MODALITÀ: Cambia a Wildcard
  if (previousValue !== WILDCARD_VALUE) {
    for (let qty = minQtyForNewValue; qty <= Math.min(minQtyForNewValue + 2, maxQuantity); qty++) {
      const validation = validateDeclarationProgression(qty, WILDCARD_VALUE, previousQuantity, previousValue);
      declarations.push({
        quantity: qty,
        value: WILDCARD_VALUE,
        display: `${qty} Jolly`,
        isValid: validation.valid,
        reason: validation.reason,
      });
    }
  }

  // Rimuovi duplicati (usa un Set di stringhe "qty-value")
  const unique = new Map();
  for (const decl of declarations) {
    const key = `${decl.quantity}-${decl.value}`;
    if (!unique.has(key)) {
      unique.set(key, decl);
    }
  }

  return Array.from(unique.values()).sort((a, b) => {
    if (a.quantity !== b.quantity) return a.quantity - b.quantity;
    return a.value.localeCompare(b.value);
  });
}

/**
 * Ottiene l'etichetta leggibile per un valore
 * Es: 'A' → 'Assi' o 'Asso', '7' → 'Sette'
 * 
 * @param {string} value - Valore della carta ('2'-'A' o 'wildcard')
 * @param {number} quantity - Quantità (per plurale)
 * @returns {string}
 */
export function getValueLabel(value, quantity = 1) {
  const labels = {
    '2': { singular: 'Due', plural: 'Due' },
    '3': { singular: 'Tre', plural: 'Tre' },
    '4': { singular: 'Quattro', plural: 'Quattro' },
    '5': { singular: 'Cinque', plural: 'Cinque' },
    '6': { singular: 'Sei', plural: 'Sei' },
    '7': { singular: 'Sette', plural: 'Sette' },
    '8': { singular: 'Otto', plural: 'Otto' },
    '9': { singular: 'Nove', plural: 'Nove' },
    '10': { singular: 'Dieci', plural: 'Dieci' },
    J: { singular: 'Jack', plural: 'Jack' },
    Q: { singular: 'Regina', plural: 'Regine' },
    K: { singular: 'Re', plural: 'Re' },
    A: { singular: 'Asso', plural: 'Assi' },
    wildcard: { singular: 'Jolly', plural: 'Jolly' },
  };

  const label = labels[value];
  if (!label) return value; // Fallback

  return quantity === 1 ? label.singular : label.plural;
}

// ============================================
// MODALITÀ LIBERA (FREE)
// ============================================

/**
 * Analizza una dichiarazione in modalità libera
 * Accetta: "3 assi", "tre assi", "3 A", "almeno 3 assi", etc.
 * 
 * @param {string} freeText - Testo della dichiarazione
 * @param {number} previousQuantity
 * @param {string} previousValue
 * @returns {Object} { success: boolean, quantity: number, value: string, error: string }
 */
export function parseFreeModeDeclaration(freeText, previousQuantity = 0, previousValue = null) {
  const text = freeText.toLowerCase().trim();

  // Regex per estrarre quantità e valore
  // Esempi: "3 assi", "tre assi", "almeno 3 re", "3 figure rosse"
  const quantityMatch = text.match(/\b(almeno\s+)?(\d+|uno|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)\b/i);
  if (!quantityMatch) {
    return { success: false, error: 'Non ho trovato una quantità valida (es: "3", "tre")' };
  }

  // Estrai quantità
  let quantity = 0;
  const qtyStr = quantityMatch[2].toLowerCase();
  if (/^\d+$/.test(qtyStr)) {
    quantity = parseInt(qtyStr);
  } else {
    const numberMap = {
      uno: 1,
      due: 2,
      tre: 3,
      quattro: 4,
      cinque: 5,
      sei: 6,
      sette: 7,
      otto: 8,
      nove: 9,
      dieci: 10,
    };
    quantity = numberMap[qtyStr] || 0;
  }

  if (quantity === 0 || quantity > 52) {
    return { success: false, error: `Quantità non valida: ${quantity}` };
  }

  // Estrai valore
  let value = null;

  // Cerca wildcard/jolly
  if (/jolly|wildcard|joker|matto/.test(text)) {
    value = WILDCARD_VALUE;
  } else {
    // Cerca i nomi delle carte
    const cardMatches = {
      '2': /due|2(?!\d)/,
      '3': /tre|3(?!\d)/,
      '4': /quattro|4(?!\d)/,
      '5': /cinque|5(?!\d)/,
      '6': /sei|6(?!\d)/,
      '7': /sette|7(?!\d)/,
      '8': /otto|8(?!\d)/,
      '9': /nove|9(?!\d)/,
      '10': /dieci|10/,
      J: /jack|j(?![a-z])/,
      Q: /regina|q(?![a-z])/,
      K: /re(?!\s*\d)|king|k(?![a-z])/,
      A: /asso|ace|a(?![a-z])/,
    };

    for (const [cardValue, regex] of Object.entries(cardMatches)) {
      if (regex.test(text)) {
        value = cardValue;
        break;
      }
    }
  }

  if (!value) {
    return { success: false, error: 'Non ho riconosciuto il valore della carta (es: "assi", "re", "jolly")' };
  }

  // Valida la progressione
  const validation = validateDeclarationProgression(quantity, value, previousQuantity, previousValue);
  if (!validation.valid) {
    return { success: false, error: validation.reason };
  }

  return { success: true, quantity, value };
}

// ============================================
// MODALITÀ ASSISTITA (ASSISTED)
// ============================================

/**
 * Genera le opzioni di dichiarazione per la UI assistita
 * Raggruppate per facilità di lettura
 * 
 * @param {number} previousQuantity
 * @param {string} previousValue
 * @returns {Object} { sameValueOptions, newValueOptions, wildcardOptions }
 */
export function generateAssistedModeOptions(previousQuantity = 0, previousValue = null) {
  const allDeclarations = generateValidDeclarations(previousQuantity, previousValue);

  const grouped = {
    sameValue: [],    // Aumenta quantità, mantieni valore
    newValue: [],     // Cambia valore
    wildcard: [],     // Cambia a wildcard
  };

  for (const decl of allDeclarations) {
    if (previousValue && decl.value === previousValue) {
      grouped.sameValue.push(decl);
    } else if (decl.value === WILDCARD_VALUE) {
      grouped.wildcard.push(decl);
    } else {
      grouped.newValue.push(decl);
    }
  }

  return grouped;
}

/**
 * Crea un'opzione di dichiarazione per l'UI assistita
 * 
 * @param {number} quantity
 * @param {string} value
 * @param {number} previousQuantity
 * @param {string} previousValue
 * @returns {DeclarationOption}
 */
export function createDeclarationOption(quantity, value, previousQuantity = 0, previousValue = null) {
  const validation = validateDeclarationProgression(quantity, value, previousQuantity, previousValue);
  
  return {
    quantity,
    value,
    display: `${quantity} ${getValueLabel(value, quantity)}`,
    isValid: validation.valid,
    reason: validation.reason,
  };
}

// ============================================
// CONVERSIONE TRA MODALITÀ
// ============================================

/**
 * Converte una dichiarazione da modalità libera a struttura validata
 * 
 * @param {string} freeText
 * @param {number} previousQuantity
 * @param {string} previousValue
 * @returns {Object} { success: boolean, declaration: {quantity, value}, error: string }
 */
export function parseDeclarationFromFreeMode(freeText, previousQuantity = 0, previousValue = null) {
  const result = parseFreeModeDeclaration(freeText, previousQuantity, previousValue);
  
  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    declaration: {
      quantity: result.quantity,
      value: result.value,
    },
  };
}

/**
 * Converte una dichiarazione da modalità assistita
 * 
 * @param {DeclarationOption} option
 * @returns {Object} { success: boolean, declaration: {quantity, value} }
 */
export function parseDeclarationFromAssistedMode(option) {
  if (!option.isValid) {
    return { success: false, error: option.reason };
  }

  return {
    success: true,
    declaration: {
      quantity: option.quantity,
      value: option.value,
    },
  };
}

// ============================================
// UTILITY
// ============================================

/**
 * Formatta una dichiarazione in stringa leggibile
 * 
 * @param {number} quantity
 * @param {string} value
 * @returns {string} Es: "Almeno 3 Assi"
 */
export function formatDeclaration(quantity, value) {
  return `Almeno ${quantity} ${getValueLabel(value, quantity)}`;
}

/**
 * Verifica se una dichiarazione è "azzardata" (bluff probabile)
 * Base semplice: > 5 carte dello stesso valore = difficile (bluff probabile)
 * 
 * @param {number} quantity
 * @param {string} value
 * @returns {boolean}
 */
export function isRiskyDeclaration(quantity, value) {
  // In un mazzo di 52 carte, ci sono 4 di ogni valore
  // Dichiarare >5 dello stesso valore è molto azzardato
  if (value === WILDCARD_VALUE) return quantity > 8; // Wildcard più comuni
  return quantity > 5;
}

/**
 * Calcola un "suggerimento di bluff" basato sulla mano e sulla dichiarazione
 * 
 * @param {number} actualCount - Quante carte hai effettivamente
 * @param {number} claimedQuantity - Quanto dichiarato
 * @returns {string} Suggerimento per il giocatore
 */
export function getBluffHint(actualCount, claimedQuantity) {
  const difference = claimedQuantity - actualCount;

  if (difference === 0) {
    return '✓ Dichiarazione veritiera';
  } else if (difference === 1) {
    return '⚠ Bluff minore (dai 1)';
  } else if (difference <= 3) {
    return '⚠⚠ Bluff moderato';
  } else {
    return '⚠⚠⚠ Bluff aggressivo!';
  }
}
