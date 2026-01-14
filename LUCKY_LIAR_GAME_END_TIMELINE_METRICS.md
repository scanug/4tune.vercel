# 📋 LUCKY LIAR - SEZIONE 7 & 8 IMPLEMENTATION
# Timeline, Indicatori Comportamentali, Fine Partita

## 📚 Indice Completo

1. [SEZIONE 7.1 - Timeline Dichiarazioni](#sezione-71-timeline-dichiarazioni)
2. [SEZIONE 7.2 - Indicatori Comportamentali](#sezione-72-indicatori-comportamentali)
3. [SEZIONE 8.1 - Condizioni Fine Partita](#sezione-81-condizioni-fine-partita)
4. [SEZIONE 8.2 - Determinazione Vincitore](#sezione-82-determinazione-vincitore)
5. [Integrazione Firebase](#integrazione-firebase)
6. [API Reference](#api-reference)
7. [React Components](#react-components)
8. [Testing Guide](#testing-guide)

---

## SEZIONE 7.1 - Timeline Dichiarazioni

### Comportamento

La timeline mostra **tutte le dichiarazioni fatte nel round**, in ordine cronologico dalla più recente.

**Informazioni visualizzate per ogni dichiarazione:**
- **Giocatore** che ha fatto la dichiarazione
- **Valore** dichiarato (es: "3x Assi")
- **Ora relativa** ("1m fa", "30s fa")
- **Stato sfida** (se è stata sfidata e con quale risultato)

### Timeline Visualization

```
DICHIARAZIONI (5 dichiarazioni)
┌─────────────────────────────────┐
│ Marco                      30s fa│
│ 2x Dieci                        │
│ ✓ Bluff scoperto!              │ ← Dichiarazione sfidata CON SUCCESSO
├─────────────────────────────────┤
│ Lucia                      1m fa │
│ 1x Re                           │
│ ✗ Vera dichiarazione           │ ← Dichiarazione sfidata FALLITA
├─────────────────────────────────┤
│ Giovanni                   2m fa │
│ 4x Carte alte                   │
│ ◉ Dichiarazione attiva         │ ← Nessuna sfida (attiva)
├─────────────────────────────────┤
│ ...                             │
└─────────────────────────────────┘
```

### Stato di una Dichiarazione

```javascript
{
  playerId: "user123",
  playerName: "Marco",
  quantity: 2,
  value: "Dieci",
  timestamp: 1705239600000,
  
  // Se sfidata:
  isChallenged: true,
  challengeSuccess: true,  // ✓ Bluff scoperto
  
  // Se non sfidata:
  isChallenged: false,
  challengeSuccess: null
}
```

### Logica di Timeline

**Aggiungere dichiarazione:**
```javascript
import { addClaimToTimeline } from '@/lib/luckyLiarBehaviorMetrics';

const newTimeline = addClaimToTimeline(timeline, {
  playerId: 'user123',
  playerName: 'Marco',
  quantity: 2,
  value: 'Assi',
});
```

**Ottenere dichiarazione attiva (da sfidare):**
```javascript
import { getActiveClaim } from '@/lib/luckyLiarBehaviorMetrics';

const activeClaim = getActiveClaim(timeline);
// { 
//   playerId: 'user456', 
//   playerName: 'Giovanni',
//   quantity: 4,
//   value: 'Carte alte',
//   index: 2  // Indice nella timeline
// }
```

**Marcare dichiarazione come sfidata:**
```javascript
import { markClaimChallenged } from '@/lib/luckyLiarBehaviorMetrics';

const updatedTimeline = markClaimChallenged(timeline, claimIndex, true); // true = bluff scoperto
```

---

## SEZIONE 7.2 - Indicatori Comportamentali

### Cos'è un Indicatore

Un **indicatore comportamentale** è un segnale VISUALE (emoji + colore) che mostra lo **stile di gioco** di un giocatore.

**NON sono numeri!** Sono indicatori psicologici per aiutare i giocatori a leggere gli altri.

### I 6 Indicatori

#### 🎭 BLUFF FREQUENTE
- **Significa**: Scopre spesso bluff altrui (sfida bene)
- **Colore**: Giallo ⚠️
- **Quando mostrare**: Win rate sfide > 60% E almeno 3 sfide lanciate
- **Tooltip**: "Scopre bluff al 75%"

#### ❌ SFIDE PERSE
- **Significa**: Sfida spesso ma sbaglia (perde sfide)
- **Colore**: Rosso 🔴
- **Quando mostrare**: Almeno 3 sfide E win rate < 40%
- **Tooltip**: "Solo 30% di sfide vinte"

#### ⚡ WILDCARD USER
- **Significa**: Usa spesso la wildcard
- **Colore**: Viola 💜
- **Quando mostrare**: Usa wildcard > 1 ogni 2 round
- **Tooltip**: "3 wildcard usate"

#### 🛡️ SAFE PLAYER
- **Significa**: Gioca in sicurezza, pochi rischi
- **Colore**: Blu 🔵
- **Quando mostrare**: Poche sfide (≤ 1) E poche dichiarazioni
- **Tooltip**: "Gioca con prudenza"

#### ⚔️ CHALLENGER
- **Significa**: Sfida frequentemente
- **Colore**: Rosso scuro 🔴
- **Quando mostrare**: Almeno 4 sfide E win rate non basso
- **Tooltip**: "5 sfide lanciate"

#### ⭐ LUCKY
- **Significa**: Vince le sfide (fortunato!)
- **Colore**: Rosa 💗
- **Quando mostrare**: Win rate sfide ≥ 70% E almeno 3 sfide
- **Tooltip**: "75% di successo!"

### Logica di Generazione

```javascript
import { 
  generateBehaviorIndicators,
  calculateDerivedMetrics 
} from '@/lib/luckyLiarBehaviorMetrics';

// Calcola prima le metriche derivate
const derived = calculateDerivedMetrics(playerMetrics);

// Genera indicatori
const indicators = generateBehaviorIndicators(playerMetrics);
// [
//   { type: 'bluff_frequente', icon: '🎭', color: '#fbbf24', ... },
//   { type: 'challenger', icon: '⚔️', color: '#dc2626', ... }
// ]
```

### Metriche Tracciabilità

```javascript
{
  playerId: 'user123',
  claimsCount: 5,          // Quante dichiarazioni fatte
  challengesCount: 4,      // Quante sfide lanciate
  challengesWon: 3,        // Quante sfide vinte
  bluffDetected: 3,        // Quanti bluff scoperti = challengesWon
  wildcardsUsed: 2,        // Wildcard usate
  roundsParticipated: 4,   // Round in cui ha partecipato
  
  // Derivate (calcolate)
  challengeWinRate: 75,    // % sfide vinte
  bluffDetectionRate: 60,  // % dichiarazioni rivelate bluff
  wildcardsPerRound: 0.5   // Media wildcard a round
}
```

### Registrazione Metriche

Durante il round, registra:

```javascript
import { 
  recordClaim,
  recordChallenge,
  recordWildcardUsage,
  recordCreditChange,
  recordRoundParticipation 
} from '@/lib/luckyLiarBehaviorMetrics';

// Giocatore fa dichiarazione
playerMetrics = recordClaim(playerMetrics);

// Giocatore lancia sfida (che vince)
playerMetrics = recordChallenge(playerMetrics, true);

// Giocatore usa wildcard
playerMetrics = recordWildcardUsage(playerMetrics);

// Giocatore perde crediti
playerMetrics = recordCreditChange(playerMetrics, -50);

// Partecipa a questo round
playerMetrics = recordRoundParticipation(playerMetrics);
```

---

## SEZIONE 8.1 - Condizioni Fine Partita

### Quando Finisce una Partita

La partita termina quando:

1. **Resta 1 giocatore** - Tutti gli altri sono stati eliminati (crediti < 0)
2. **Raggiunto maxRounds** - Completati il numero massimo di round (configurabile)

### Logica Implementazione

```javascript
import { checkGameEnd, GAME_END_REASONS } from '@/lib/luckyLiarGameEnd';

const { gameOver, reason } = checkGameEnd(
  playerIds,              // Array di giocatori rimasti
  playerCredits,          // { playerId: credits }
  currentRound,           // Round attuale (0-based)
  maxRounds               // Max round (es: 10)
);

if (gameOver) {
  // reason = 'one_player_left' | 'max_rounds_reached'
  // Procedi con fine partita
}
```

### Ragioni Fine Partita

```javascript
export const GAME_END_REASONS = {
  ONE_PLAYER_LEFT: 'one_player_left',           // Un giocatore rimasto
  MAX_ROUNDS_REACHED: 'max_rounds_reached',     // Limite round raggiunto
  HOST_QUIT: 'host_quit',                       // Host ha abbandonato
  DRAW: 'draw',                                 // Pareggio (raro)
};
```

---

## SEZIONE 8.2 - Determinazione Vincitore

### Criteri Vittoria

**VINCITORE = Chi ha più crediti al termine della partita**

Se pareggio (raro), mostra messaggio speciale con i vincitori.

### Ranking Finale

```javascript
import { determineWinner } from '@/lib/luckyLiarGameEnd';

const { 
  winner,      // { playerId, name, credits, rank: 1 }
  ranking,     // Array ordinato per crediti
  isDraw,      // Se pareggio
  drawPlayers  // Giocatori in pareggio (se isDraw)
} = determineWinner(
  playerIds,           // ['user1', 'user2', 'user3']
  playerNames,         // { user1: 'Marco', user2: 'Lucia', ... }
  playerCredits        // { user1: 250, user2: 180, ... }
);

// ranking = [
//   { playerId: 'user1', name: 'Marco', credits: 250, rank: 1 },
//   { playerId: 'user2', name: 'Lucia', credits: 180, rank: 2 },
//   { playerId: 'user3', name: 'Giovanni', credits: 120, rank: 3 },
// ]
```

### Recap Finale

Genera un sommario completo della partita:

```javascript
import { generateGameSummary } from '@/lib/luckyLiarGameEnd';

const { gameSummary, playerSummaries } = generateGameSummary(
  playerIds,           // Giocatori
  playerNames,         // Nomi
  playerStartCredits,  // Crediti iniziali
  playerFinalCredits,  // Crediti finali
  playerMetrics,       // Metriche da tracking
  ranking,             // Ranking da determineWinner()
  GAME_END_REASONS.MAX_ROUNDS_REACHED
);

// gameSummary = {
//   endReason: 'max_rounds_reached',
//   totalPlayers: 3,
//   winnerName: 'Marco',
//   winnerId: 'user1',
//   ...
// }

// playerSummaries[0] = {
//   playerId: 'user1',
//   name: 'Marco',
//   startingCredits: 200,
//   finalCredits: 250,
//   netGain: 50,                      // ← Guadagno/Perdita
//   percentageChange: 25.0,            // ← % variazione
//   claimsCount: 8,
//   challengesCount: 5,
//   challengesWon: 4,
//   challengeWinRate: 80,
//   wildcardsUsed: 1,
//   eliminatedAtRound: null,           // null = non eliminato
//   isWinner: true,
//   rank: 1,
// }
```

### Schermata Finale

Mostra recap con:
- **Vincitore** con emoji 🏆
- **Ranking** completo con dati
- **Statistiche personali** per ogni giocatore
- **Pulsanti** "Gioca di nuovo" e "Esci"

---

## Integrazione Firebase

### Struttura Database

```javascript
rooms_liar/$roomCode/current/
├── declarationTimeline[]          // Timeline dichiarazioni
│   ├── playerId
│   ├── playerName
│   ├── quantity
│   ├── value
│   ├── timestamp
│   ├── isChallenged
│   └── challengeSuccess
├── playerMetrics                  // Metriche comportamentali
│   ├── playerId
│   │   ├── claimsCount
│   │   ├── challengesCount
│   │   ├── challengesWon
│   │   ├── wildcardsUsed
│   │   └── ...
```

### Rules Firebase

```json
{
  "rooms_liar": {
    "$roomCode": {
      "current": {
        "declarationTimeline": {
          ".write": "auth != null",
          "$timelineIndex": {
            ".write": "auth != null"
          }
        },
        "playerMetrics": {
          ".write": "auth != null",
          "$playerId": {
            ".write": "auth != null"
          }
        }
      }
    }
  }
}
```

---

## API Reference

### Funzioni Disponibili

#### Game End
- `checkGameEnd(playerIds, playerCredits, currentRound, maxRounds)` → `{ gameOver, reason }`
- `determineWinner(playerIds, playerNames, playerCredits)` → `{ winner, ranking, isDraw }`
- `generateGameSummary(...)` → `{ gameSummary, playerSummaries }`
- `calculateGameStatistics(playerSummaries)` → statistiche aggregate
- `getGameEndMessage(winner, reason, isDraw)` → `{ title, subtitle, emoji }`

#### Behavior Metrics
- `generateBehaviorIndicators(metrics)` → Array di indicatori
- `recordClaim(metrics)` → Metriche aggiornate
- `recordChallenge(metrics, won)` → Metriche aggiornate
- `recordWildcardUsage(metrics)` → Metriche aggiornate
- `recordCreditChange(metrics, amount)` → Metriche aggiornate
- `calculateDerivedMetrics(metrics)` → Metriche con percentuali

#### Timeline
- `initializeDeclarationTimeline()` → []
- `addClaimToTimeline(timeline, claim)` → Timeline aggiornata
- `getActiveClaim(timeline)` → { ...claim, index }
- `markClaimChallenged(timeline, index, success)` → Timeline aggiornata
- `formatTimelineForDisplay(timeline)` → Timeline formattata per UI

---

## React Components

### DeclarationTimeline
Mostra timeline dichiarazioni con styling.

```jsx
<DeclarationTimeline
  timeline={timeline}
  activeClaim={activeClaim}
  onChallengeClick={(claimIndex) => {
    // Sfida la dichiarazione all'indice claimIndex
  }}
/>
```

### BehaviorIndicators
Mostra gli indicatori comportamentali di un giocatore.

```jsx
<BehaviorIndicators 
  indicators={indicators}
  maxDisplay={3}  // Mostra max 3
/>
```

### GameEndScreen
Schermata finale con ranking e recap.

```jsx
<GameEndScreen
  gameSummary={gameSummary}
  playerSummaries={playerSummaries}
  isDraw={false}
  onPlayAgain={() => { /* restart game */ }}
  onLeave={() => { /* exit */ }}
/>
```

---

## Testing Guide

### Test Timeline
```javascript
// test-timeline.js
import { 
  addClaimToTimeline, 
  getActiveClaim,
  markClaimChallenged 
} from '@/lib/luckyLiarBehaviorMetrics';

let timeline = [];

// Aggiungi dichiarazioni
timeline = addClaimToTimeline(timeline, {
  playerId: 'p1', playerName: 'Marco', quantity: 2, value: 'Assi'
});
timeline = addClaimToTimeline(timeline, {
  playerId: 'p2', playerName: 'Lucia', quantity: 3, value: 'Re'
});

// Ottieni attiva (dovrebbe essere Lucia)
const active = getActiveClaim(timeline);
console.assert(active.playerName === 'Lucia');

// Sfida e vinci (Lucia bluffava)
timeline = markClaimChallenged(timeline, active.index, true);
console.assert(timeline[active.index].challengeSuccess === true);

console.log('✓ Timeline tests passed');
```

### Test Indicatori
```javascript
import { generateBehaviorIndicators } from '@/lib/luckyLiarBehaviorMetrics';

const metrics = {
  claimsCount: 8,
  challengesCount: 5,
  challengesWon: 4,    // 80% win rate
  wildcardsUsed: 2,
  roundsParticipated: 4,
  bluffDetected: 4,
};

const indicators = generateBehaviorIndicators(metrics);
console.assert(indicators.some(i => i.type === 'bluff_frequente'));
console.assert(indicators.some(i => i.type === 'challenger'));
console.log('✓ Behavior indicators tests passed');
```

### Test Game End
```javascript
import { checkGameEnd, determineWinner } from '@/lib/luckyLiarGameEnd';

// Test condizione 1 giocatore rimasto
const result = checkGameEnd(
  ['p1', 'p2', 'p3'],
  { p1: 100, p2: -10, p3: -5 },  // p2, p3 eliminati
  5,
  10
);
console.assert(result.gameOver === true);
console.assert(result.reason === 'one_player_left');

// Test max round
const result2 = checkGameEnd(['p1', 'p2'], { p1: 150, p2: 100 }, 10, 10);
console.assert(result2.gameOver === true);
console.assert(result2.reason === 'max_rounds_reached');

console.log('✓ Game end tests passed');
```

---

## Esempi Completi

### Integrazione Full Round

```javascript
// Durante il round
const declarationTimeline = [];
const playerMetrics = {
  'user1': initializePlayerMetrics('user1'),
  'user2': initializePlayerMetrics('user2'),
};

// Giocatore 1 dichiara
timeline = addClaimToTimeline(timeline, {
  playerId: 'user1',
  playerName: 'Marco',
  quantity: 3,
  value: 'Assi'
});
playerMetrics['user1'] = recordClaim(playerMetrics['user1']);

// Giocatore 2 sfida e vince (Marco stava bluffando)
const activeClaim = getActiveClaim(timeline);
timeline = markClaimChallenged(timeline, activeClaim.index, true);
playerMetrics['user2'] = recordChallenge(playerMetrics['user2'], true);

// Dai crediti a chi ha vinto la sfida
playerMetrics['user2'] = recordCreditChange(playerMetrics['user2'], +50);
playerMetrics['user1'] = recordCreditChange(playerMetrics['user1'], -50);

// Aggiorna UI
updateTimelineUI(timeline);
updateIndicatorsUI(playerMetrics['user2']);
```

### Integrazione Fine Partita

```javascript
// Al termine del gioco
const { gameOver, reason } = checkGameEnd(
  playerIds,
  playerCredits,
  roundIndex,
  maxRounds
);

if (gameOver) {
  const { winner, ranking, isDraw } = determineWinner(
    playerIds,
    playerNames,
    playerCredits
  );

  const { gameSummary, playerSummaries } = generateGameSummary(
    playerIds,
    playerNames,
    playerStartCredits,
    playerCredits,
    playerMetrics,
    ranking,
    reason
  );

  // Mostra schermata finale
  return (
    <GameEndScreen
      gameSummary={gameSummary}
      playerSummaries={playerSummaries}
      isDraw={isDraw}
      onPlayAgain={handlePlayAgain}
      onLeave={handleLeave}
    />
  );
}
```

---

## File Creati

- ✅ `lib/luckyLiarGameEnd.js` - Logica fine partita (450+ linee)
- ✅ `lib/luckyLiarBehaviorMetrics.js` - Sistema metriche (500+ linee)
- ✅ `LUCKY_LIAR_COMPONENTS_7_8.jsx` - Componenti React (700+ linee)
- ✅ `LUCKY_LIAR_GAME_END_TIMELINE_METRICS.md` - Questo documento

---

## Checklist Implementazione

### Backend
- [ ] Estendere Firebase rules con declarationTimeline
- [ ] Estendere Firebase rules con playerMetrics
- [ ] Integrare checkGameEnd in game loop
- [ ] Integrare determineWinner al termine
- [ ] Tracciare metriche durante il round

### Frontend
- [ ] Importare componenti da LUCKY_LIAR_COMPONENTS_7_8.jsx
- [ ] Integrare DeclarationTimeline nella game page
- [ ] Integrare BehaviorIndicators nei card giocatore
- [ ] Integrare GameEndScreen a fine partita
- [ ] Styl CSS responsivo

### Testing
- [ ] Test timeline add/challenge
- [ ] Test indicatori generazione
- [ ] Test game end conditions
- [ ] Test winner determination
- [ ] Test pareggi

---

## Prossimi Passi

1. **Implementare le pagine React** (Host, Lobby, Game)
2. **Integrare timeline in game page**
3. **Aggiungere indicatori nei card giocatori**
4. **Testare game end flow**
5. **Stylar GameEndScreen**
6. **Deploy su Firebase**

---

**Status**: ✅ DESIGN COMPLETE
**Pronto per**: React page implementation

