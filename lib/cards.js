/**
 * LUCKY LIAR - Card Game Logic
 * Core sistema di carte e mano dei giocatori
 */

// Enum valori carte
export const CARD_VALUES = {
  TWO: '2',
  THREE: '3',
  FOUR: '4',
  FIVE: '5',
  SIX: '6',
  SEVEN: '7',
  EIGHT: '8',
  NINE: '9',
  TEN: '10',
  JACK: 'J',
  QUEEN: 'Q',
  KING: 'K',
  ACE: 'A',
};

export const CARD_VALUES_ARRAY = Object.values(CARD_VALUES);

// Enum semi
export const CARD_SUITS = {
  SPADES: '♠',
  HEARTS: '♥',
  DIAMONDS: '♦',
  CLUBS: '♣',
};

export const CARD_SUITS_ARRAY = Object.values(CARD_SUITS);

/**
 * Struttura singola carta
 * @typedef {Object} Card
 * @property {string} value - Valore: '2'-'10', 'J', 'Q', 'K', 'A'
 * @property {string} suit - Seme: '♠', '♥', '♦', '♣'
 */

/**
 * Crea una singola carta
 * @param {string} value - Valore della carta
 * @param {string} suit - Seme della carta
 * @returns {Card}
 */
export function createCard(value, suit) {
  return { value, suit };
}

/**
 * Crea un mazzo standard di 52 carte
 * @returns {Card[]}
 */
export function createDeck() {
  const deck = [];
  for (const suit of CARD_SUITS_ARRAY) {
    for (const value of CARD_VALUES_ARRAY) {
      deck.push(createCard(value, suit));
    }
  }
  return deck;
}

/**
 * Fisher-Yates shuffle - sicuro e random
 * @param {Card[]} array - Array da mischiare
 * @returns {Card[]}
 */
export function shuffleDeck(array) {
  const deck = [...array];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * Distribuisce 5 carte iniziali a un giocatore
 * @param {Card[]} deck - Mazzo dal quale pescare
 * @param {number} cardsPerPlayer - Numero di carte da distribuire (default 5)
 * @returns {Object} { hand: Card[], deckRemaining: Card[] }
 */
export function dealInitialHand(deck, cardsPerPlayer = 5) {
  if (deck.length < cardsPerPlayer) {
    throw new Error(`Non abbastanza carte nel mazzo: ${deck.length} < ${cardsPerPlayer}`);
  }
  const hand = deck.slice(0, cardsPerPlayer);
  const deckRemaining = deck.slice(cardsPerPlayer);
  return { hand, deckRemaining };
}

/**
 * Pesca una carta dal mazzo
 * @param {Card[]} deck - Mazzo dal quale pescare
 * @returns {Object} { card: Card, deckRemaining: Card[] }
 */
export function drawCard(deck) {
  if (deck.length === 0) {
    throw new Error('Mazzo vuoto, non è possibile pescare');
  }
  const card = deck[0];
  const deckRemaining = deck.slice(1);
  return { card, deckRemaining };
}

/**
 * Aggiunge una carta alla mano del giocatore
 * @param {Card[]} hand - Mano attuale del giocatore
 * @param {Card} card - Carta da aggiungere
 * @returns {Card[]}
 */
export function addCardToHand(hand, card) {
  return [...hand, card];
}

/**
 * Rimuove una carta dalla mano (scarto)
 * @param {Card[]} hand - Mano del giocatore
 * @param {number} cardIndex - Indice della carta da rimuovere
 * @returns {Card[]}
 */
export function removeCardFromHand(hand, cardIndex) {
  if (cardIndex < 0 || cardIndex >= hand.length) {
    throw new Error(`Indice carta non valido: ${cardIndex}`);
  }
  return hand.filter((_, idx) => idx !== cardIndex);
}

/**
 * Verifica se la mano supera il limite (>5 carte)
 * @param {Card[]} hand - Mano del giocatore
 * @param {number} maxCards - Numero massimo di carte (default 5)
 * @returns {boolean}
 */
export function handExceedsLimit(hand, maxCards = 5) {
  return hand.length > maxCards;
}

/**
 * Ottiene il numero di carte da scartare
 * @param {Card[]} hand - Mano del giocatore
 * @param {number} maxCards - Numero massimo di carte (default 5)
 * @returns {number} Numero di carte da scartare
 */
export function getCardsToDiscard(hand, maxCards = 5) {
  return Math.max(0, hand.length - maxCards);
}

/**
 * Converte una carta in stringa leggibile
 * @param {Card} card - Carta da convertire
 * @returns {string} Es: "A♠", "K♥", "7♦"
 */
export function cardToString(card) {
  return `${card.value}${card.suit}`;
}

/**
 * Converte una mano in array di stringhe
 * @param {Card[]} hand - Mano da convertire
 * @returns {string[]}
 */
export function handToStrings(hand) {
  return hand.map(cardToString);
}

/**
 * Conta le occorrenze di un valore nella mano
 * @param {Card[]} hand - Mano del giocatore
 * @param {string} value - Valore da contare
 * @returns {number}
 */
export function countValueInHand(hand, value) {
  return hand.filter((card) => card.value === value).length;
}

/**
 * Conta le occorrenze di un seme nella mano
 * @param {Card[]} hand - Mano del giocatore
 * @param {string} suit - Seme da contare
 * @returns {number}
 */
export function countSuitInHand(hand, suit) {
  return hand.filter((card) => card.suit === suit).length;
}

/**
 * Analizza una mano e restituisce statistiche
 * @param {Card[]} hand - Mano da analizzare
 * @returns {Object} { totalCards, valueCount, suitCount }
 */
export function analyzeHand(hand) {
  const valueCount = {};
  const suitCount = {};

  for (const card of hand) {
    valueCount[card.value] = (valueCount[card.value] || 0) + 1;
    suitCount[card.suit] = (suitCount[card.suit] || 0) + 1;
  }

  return {
    totalCards: hand.length,
    valueCount,
    suitCount,
  };
}

/**
 * Inizializza lo stato del gioco per un nuovo round
 * Crea un mazzo, lo mischia, e prepara il primo mazzo per le distribuzioni
 * @returns {Object} { deck: Card[], deckForDraw: Card[] }
 */
export function initializeRound() {
  const fullDeck = createDeck();
  const shuffled = shuffleDeck(fullDeck);
  // Split: primi 5*maxPlayers per distribuire, resto per pesca durante il round
  // Questo verrà adattato in base al numero di giocatori nella room
  return { deck: shuffled };
}

/**
 * Resetta la mano di un giocatore (inizio nuovo round)
 * @returns {Card[]}
 */
export function resetPlayerHand() {
  return [];
}
