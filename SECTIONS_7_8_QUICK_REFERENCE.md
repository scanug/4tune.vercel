# ⚡ SEZIONI 7-8 QUICK REFERENCE

## File Creati

| File | Linee | Funzione |
|------|-------|---------|
| `lib/luckyLiarGameEnd.js` | 350 | Fine partita, vincitore, recap |
| `lib/luckyLiarBehaviorMetrics.js` | 500 | Timeline, indicatori, metriche |
| `LUCKY_LIAR_COMPONENTS_7_8.jsx` | 700 | React components |
| `LUCKY_LIAR_GAME_END_TIMELINE_METRICS.md` | 400 | Documentazione |

---

## SEZIONE 7.1 - Timeline

### Funzioni Principali
```javascript
import { 
  addClaimToTimeline,      // Aggiunge dichiarazione
  getActiveClaim,          // Ottiene quella da sfidare
  markClaimChallenged      // Marca come sfidata
} from '@/lib/luckyLiarBehaviorMetrics';
```

### Struttura Dichiarazione
```javascript
{
  playerId, playerName,
  quantity, value,          // Es: 2x Assi
  timestamp,
  isChallenged,             // true se sfidata
  challengeSuccess          // true = bluff scoperto
}
```

### Componente React
```jsx
<DeclarationTimeline
  timeline={timeline}
  activeClaim={activeClaim}
  onChallengeClick={(index) => {...}}
/>
```

---

## SEZIONE 7.2 - Indicatori

### 6 Indicatori
```javascript
🎭 Bluff Frequente   → Scopre bluff (win rate > 60%)
❌ Sfide Perse       → Sbaglia sfide (win rate < 40%)
⚡ Wildcard User     → Usa wildcard frequente
🛡️  Safe Player      → Gioca conservativo
⚔️  Challenger       → Sfida spesso (≥ 4)
⭐ Lucky            → Vince sfide (≥ 70%)
```

### Metriche Tracciamento
```javascript
import { 
  recordClaim,             // Aggiungi dichiarazione
  recordChallenge,         // Aggiungi sfida (+ vittoria)
  recordWildcardUsage,     // Aggiungi wildcard
  recordCreditChange,      // +/- crediti
  recordRoundParticipation // Round partecipato
} from '@/lib/luckyLiarBehaviorMetrics';
```

### Generare Indicatori
```javascript
import { generateBehaviorIndicators } from '@/lib/luckyLiarBehaviorMetrics';

const indicators = generateBehaviorIndicators(playerMetrics);
// [{ type, icon, color, description, tooltip }, ...]
```

### Componente React
```jsx
<BehaviorIndicators 
  indicators={indicators}
  maxDisplay={3}
/>
```

---

## SEZIONE 8.1 - Fine Partita

### Verificare Fine
```javascript
import { checkGameEnd, GAME_END_REASONS } from '@/lib/luckyLiarGameEnd';

const { gameOver, reason } = checkGameEnd(
  playerIds,           // ['p1', 'p2', 'p3']
  playerCredits,       // { p1: 100, p2: -5, ... }
  currentRound,        // es: 5
  maxRounds            // es: 10
);

// reason = 'one_player_left' | 'max_rounds_reached'
```

### Condizioni Fine
```javascript
1. Resta 1 giocatore        // Crediti altri < 0
2. Max round raggiunto       // currentRound >= maxRounds
```

---

## SEZIONE 8.2 - Vincitore

### Determinare Vincitore
```javascript
import { determineWinner } from '@/lib/luckyLiarGameEnd';

const { 
  winner,              // { playerId, name, credits, rank: 1 }
  ranking,             // Array ordinato per crediti
  isDraw,              // boolean
  drawPlayers          // Se isDraw, chi pari
} = determineWinner(playerIds, playerNames, playerCredits);
```

### Generare Recap
```javascript
import { generateGameSummary } from '@/lib/luckyLiarGameEnd';

const { 
  gameSummary,         // Info generale
  playerSummaries      // Array con dati ogni giocatore
} = generateGameSummary(
  playerIds, playerNames,
  playerStartCredits, playerFinalCredits,
  playerMetrics, ranking,
  gameEndReason
);
```

### Dati Recap Giocatore
```javascript
{
  playerId, name,
  startingCredits, finalCredits,
  netGain,             // Guadagno/Perdita
  percentageChange,    // % di variazione
  claimsCount,         // Dichiarazioni
  challengesCount,     // Sfide lanciate
  challengesWon,       // Sfide vinte
  challengeWinRate,    // % successo sfide
  wildcardsUsed,       // Wildcard attivate
  isWinner, rank       // 1=primo, 2=secondo, etc
}
```

### Componente React
```jsx
<GameEndScreen
  gameSummary={gameSummary}
  playerSummaries={playerSummaries}
  isDraw={isDraw}
  onPlayAgain={() => {...}}
  onLeave={() => {...}}
/>
```

---

## Firebase Schema (Aggiunto)

```json
rooms_liar/$roomCode/current/
├── declarationTimeline[]
│   ├── playerId, playerName
│   ├── quantity, value
│   ├── timestamp
│   ├── isChallenged, challengeSuccess
├── playerMetrics/$playerId
│   ├── claimsCount, challengesCount, challengesWon
│   ├── wildcardsUsed, roundsParticipated
│   └── creditsLost, creditsGained
```

---

## Flusso Integrazione

### Durante Round
```javascript
// Dichiarazione
timeline = addClaimToTimeline(timeline, claim);
playerMetrics[pid] = recordClaim(playerMetrics[pid]);

// Sfida
activeClaim = getActiveClaim(timeline);
timeline = markClaimChallenged(timeline, idx, true);
playerMetrics[challenger] = recordChallenge(metrics, true);

// Wildcard (se usata)
playerMetrics[pid] = recordWildcardUsage(playerMetrics[pid]);
```

### Fine Round
```javascript
// Aggiorna metriche
playerMetrics[pid] = recordCreditChange(metrics, -50);

// Resetta timeline per nuovo round
timeline = [];
```

### Fine Partita
```javascript
// Verifica
const { gameOver, reason } = checkGameEnd(...);

if (gameOver) {
  // Determina vincitore
  const { winner, ranking } = determineWinner(...);
  
  // Genera recap
  const { gameSummary, playerSummaries } = generateGameSummary(...);
  
  // Mostra schermata
  return <GameEndScreen ... />;
}
```

---

## Testing Rapido

```javascript
// Test 1: Timeline
const t = [];
addClaimToTimeline(t, { playerName: 'Marco', ... });
console.assert(getActiveClaim(t) !== null);

// Test 2: Indicatori
const ind = generateBehaviorIndicators({
  challengesCount: 5, challengesWon: 4, ...
});
console.assert(ind.some(i => i.type === 'lucky'));

// Test 3: Fine partita
const { gameOver } = checkGameEnd(['p1'], { p1: 100 }, 0, 1);
console.assert(gameOver === false);

// Test 4: Vincitore
const { winner } = determineWinner(
  ['p1', 'p2'], 
  { p1: 'Marco', p2: 'Lucia' },
  { p1: 150, p2: 100 }
);
console.assert(winner.name === 'Marco');
```

---

## Costanti Utili

```javascript
// Motivi fine partita
GAME_END_REASONS.ONE_PLAYER_LEFT
GAME_END_REASONS.MAX_ROUNDS_REACHED
GAME_END_REASONS.HOST_QUIT
GAME_END_REASONS.DRAW

// Indicatori
BEHAVIOR_INDICATORS.BLUFF_FREQUENTE
BEHAVIOR_INDICATORS.SFIDE_PERSE
BEHAVIOR_INDICATORS.WILDCARD_USER
BEHAVIOR_INDICATORS.SAFE_PLAYER
BEHAVIOR_INDICATORS.CHALLENGER
BEHAVIOR_INDICATORS.LUCKY

// Colori indicatori
INDICATOR_COLORS = {
  bluff_frequente: '#fbbf24',
  sfide_perse: '#ef4444',
  wildcard_user: '#8b5cf6',
  safe_player: '#3b82f6',
  challenger: '#dc2626',
  lucky: '#ec4899'
}
```

---

## Checklist Implementazione

### Backend Setup
- [ ] Estendere Firebase rules (declarationTimeline, playerMetrics)
- [ ] Creare state management per timeline
- [ ] Creare state management per metriche
- [ ] Integrare checkGameEnd nel game loop

### Game Page
- [ ] Importare DeclarationTimeline
- [ ] Integrare nella sezione dichiarazioni
- [ ] Collegare al game state

### Player Cards
- [ ] Importare BehaviorIndicators
- [ ] Integrare nei card giocatori
- [ ] Collegare alle metriche

### Game End
- [ ] Importare GameEndScreen
- [ ] Integrare dopo checkGameEnd
- [ ] Implementare onPlayAgain callback
- [ ] Implementare onLeave callback

### Testing
- [ ] Test timeline CRUD
- [ ] Test generazione indicatori
- [ ] Test fine partita
- [ ] Test determinazione vincitore

---

## Docs da Leggere

1. `SECTIONS_7_8_COMPLETE.md` ← Panoramica globale
2. `LUCKY_LIAR_GAME_END_TIMELINE_METRICS.md` ← Dettagliato
3. `LUCKY_LIAR_COMPONENTS_7_8.jsx` ← Source code

---

## Tips & Tricks

### Timeline
- Ultimo entry = dichiarazione più recente
- `getActiveClaim()` ritorna con `.index` per marcare
- `formatTimelineForDisplay()` inverte l'ordine (più recente primo)

### Indicatori
- NON mostrare percentuali! Usa solo icone + colore
- Max 3 indicatori per spazio limitato
- `getTopIndicators()` per limitare a 3

### Game End
- Controllare `isDraw` prima di mostrare vincitore
- `getRankEmoji()` per medaglie (🥇🥈🥉)
- `getNetGainColor()` per colorare gain/loss (verde/rosso)

### Performance
- Timeline: Max 50 entry per round (scroll)
- Metriche: Calcola `.derivate` solo quando serve
- GameEnd: Generate summary solo a fine, non ogni frame

---

**Status**: ✅ COMPLETE & READY
**Next**: Implement React pages (Host, Lobby, Game)

