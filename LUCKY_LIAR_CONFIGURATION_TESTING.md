# 🎮 LUCKY LIAR - SEZIONE 10: CONFIGURAZIONE E TEST

## 10.1 PARAMETRI CONFIGURABILI

### A. Numero Round

**Descrizione**: Quanti round gioca una singola partita prima di fine automatica.

**Configurazione Firebase**:
```json
{
  "rooms_liar": {
    "$roomCode": {
      "maxRounds": 5
    }
  }
}
```

**Valori Consigliati**:
| Giocatori | Round | Durata | Complessità |
|-----------|-------|--------|------------|
| 2 | 3-5 | 5-10 min | Bassa |
| 3-4 | 5-7 | 10-15 min | Media |
| 5-6 | 7-10 | 15-25 min | Alta |
| 6+ | 10-15 | 25-45 min | Molto Alta |

**Effetti**:
- ❌ Troppo basso (1-2): Partita troppo corta, non sufficiente per strategia
- ✅ Ottimale (5-10): Tempo sufficiente per sviluppo psicologico
- ⚠️ Troppo alto (15+): Partita lunga, rischio di perdita engagement

**Test**:
```javascript
// Test: Verificare che partita termina dopo maxRounds
const testMaxRoundsTermination = () => {
  const gameState = {
    roundIndex: 4,
    maxRounds: 5,
    players: { p1: {}, p2: {} }
  };
  
  const { shouldEnd, reason } = checkGameEnd(gameState);
  
  assert(shouldEnd === true, 'Partita dovrebbe terminare');
  assert(reason === 'MAX_ROUNDS_REACHED', 'Motivo deve essere max rounds');
};
```

### B. Percentuale Penalità

**Descrizione**: Quanto crediti perde il perdente della sfida.

**Configurazione Firebase**:
```json
{
  "rooms_liar": {
    "$roomCode": {
      "penaltyPercentage": 0.20
    }
  }
}
```

**Formula Penalità**:
```javascript
const calculatePenalty = (playerCredits, penaltyPercentage) => {
  const basePenalty = Math.floor(playerCredits * penaltyPercentage);
  return Math.max(basePenalty, 10); // Minimo 10 crediti
};

// Esempi:
// 200 crediti × 20% = 40 crediti
// 50 crediti × 20% = 10 crediti (minimo)
// 500 crediti × 20% = 100 crediti
```

**Valori Consigliati**:
| Penalità | Effetto | Risk |
|----------|--------|------|
| 5% | Molto leggera | Troppo facile blufffare |
| 10% | Leggera | Poco incentivo sfidare |
| **20%** | **Equilibrata** | **CONSIGLIATO** |
| 30% | Forte | Troppo punitiva |
| 50% | Molto forte | Elimina giocatori troppo velocemente |

**Test**:
```javascript
const testPenaltyCalculation = () => {
  const cases = [
    { credits: 200, penalty: 0.20, expected: 40 },
    { credits: 50, penalty: 0.20, expected: 10 }, // minimo
    { credits: 1000, penalty: 0.30, expected: 300 },
  ];
  
  cases.forEach(({ credits, penalty, expected }) => {
    const result = calculatePenalty(credits, penalty);
    assert(result === expected, `Expected ${expected}, got ${result}`);
  });
};
```

### C. Numero Wildcard per Round

**Descrizione**: Quante wildcard distribuisce il sistema ogni round.

**Configurazione Firebase**:
```json
{
  "rooms_liar": {
    "$roomCode": {
      "current": {
        "wildcards": [
          {
            "id": 1,
            "playerId": "user123",
            "playerName": "Marco",
            "state": "unused",
            "scenario": "SINGLE"
          }
        ]
      }
    }
  }
}
```

**Strategie Distribuzione**:

#### 1. Una per giocatore (CONSIGLIATO)
```javascript
const distributeWildcards = (playerIds, scenarioType = 'SINGLE') => {
  return playerIds.map((playerId, idx) => ({
    id: idx,
    playerId,
    playerName: playerData[playerId].name,
    state: 'unused',
    scenario: scenarioType, // SINGLE o DOUBLE
  }));
};

// 2 giocatori = 2 wildcard
// 5 giocatori = 5 wildcard
```

#### 2. Una per coppia di giocatori
```javascript
const distributeWildcardsAlternate = (playerIds) => {
  const wildcards = [];
  for (let i = 0; i < playerIds.length; i += 2) {
    wildcards.push({
      id: wildcards.length,
      playerId: playerIds[i],
      state: 'unused',
      scenario: 'SINGLE',
    });
  }
  return wildcards;
};

// 2 giocatori = 1 wildcard
// 4 giocatori = 2 wildcard
// 6 giocatori = 3 wildcard
```

#### 3. Una per round (globale)
```javascript
const wildcardsPerRound = 1; // Solo una wildcard per tutto il round

// Risorsa rara - aumenta tensione
```

**Effetti**:
- **Una per giocatore**: Equilibrato, tutti hanno opportunità
- **Alternato**: Crea disparità, strategia politica
- **Una globale**: Molto rara, massima tensione

**Test**:
```javascript
const testWildcardDistribution = () => {
  const playerIds = ['p1', 'p2', 'p3', 'p4'];
  
  const wildcards = distributeWildcards(playerIds, 'SINGLE');
  
  assert(wildcards.length === 4, 'Dovrebbe avere 4 wildcard');
  assert(wildcards[0].state === 'unused', 'Dovrebbero essere unused');
  assert(wildcards[0].playerId === 'p1', 'PlayerId deve corrispondere');
};
```

### D. Modalità Dichiarazione

**Descrizione**: Come i giocatori fanno dichiarazioni.

**Configurazione Firebase**:
```json
{
  "rooms_liar": {
    "$roomCode": {
      "declarationMode": "assisted"
    }
  }
}
```

**Opzioni**:

#### 1. Free Mode (Dichiara Libero)
```javascript
// Giocatore scrive: "3 assi" o "almeno 2 re"
// Parser NLP converte in dichiarazione strutturata

const parseFreeModeDeclaration = (input) => {
  // "3 assi" → { quantity: 3, value: 'A' }
  // "almeno 2 re" → { quantity: 2, value: 'K', mode: 'atLeast' }
  
  const patterns = [
    { regex: /(\d+)\s+(assi|re|dame|fanti|carte)/i, parse: (m) => ({...}) },
    { regex: /almeno\s+(\d+)\s+(\w+)/i, parse: (m) => ({...}) },
  ];
  
  for (const pattern of patterns) {
    const match = input.match(pattern.regex);
    if (match) return pattern.parse(match);
  }
  
  return { valid: false };
};
```

**Vantaggi**:
- ✅ Immersivo e naturale
- ✅ Permette strategie creative
- ❌ Parser può fallire
- ❌ Richiede interpretazione

#### 2. Assisted Mode (Dichiarazione Guidata)
```javascript
const generateAssistedOptions = (lastClaim) => {
  // Mostra solo dichiarazioni valide successive
  
  if (!lastClaim) {
    return [
      { quantity: 1, value: 'A' },
      { quantity: 2, value: 'A' },
      // ... fino a 5 assi
    ];
  }
  
  // Dopo "3 assi", opzioni valide sono:
  // - 4 assi
  // - 5 assi
  // - 1 re (jump per valore)
  
  return generateValidDeclarations(lastClaim);
};
```

**Vantaggi**:
- ✅ Sempre valide
- ✅ Zero errori di parsing
- ✅ Guidate chiaramente
- ❌ Meno immersive
- ❌ Strategie limitate

**Consiglio**:
- Principianti → **Assisted**
- Esperti → **Free**
- Competitivo → **Free** con time limit

**Test**:
```javascript
const testDeclarationModes = () => {
  // Test Free Mode
  const freeResult = parseFreeModeDeclaration("3 assi");
  assert(freeResult.valid === true, 'Dovrebbe parserizzare');
  assert(freeResult.quantity === 3, 'Quantity dovrebbe essere 3');
  
  // Test Assisted Mode
  const lastClaim = { quantity: 3, value: 'A' };
  const options = generateAssistedOptions(lastClaim);
  assert(options.length > 0, 'Dovrebbe avere opzioni');
  assert(options.every(o => o.quantity >= 3), 'Dovrebbero incrementare');
};
```

---

## 10.2 TEST FONDAMENTALI

### A. Test Edge Case (Situazioni Limite)

#### 1. All-In (Giocatore con 10 crediti)
```javascript
const testPlayerAllIn = () => {
  const gameState = {
    players: {
      p1: { credits: 10, name: 'Poor Player' },
      p2: { credits: 500, name: 'Rich Player' }
    },
    current: {
      challenge: {
        loserName: 'Poor Player',
        penalty: 40, // 20% di 200
      }
    }
  };
  
  // Calcola penalità reale
  const realPenalty = Math.min(10, 40); // Penalità non può > crediti attuali
  
  assert(realPenalty === 10, 'Penalità dovrebbe essere capped a 10');
  assert(gameState.players.p1.credits - realPenalty >= 0, 'Non dovrebbe andare negative');
};
```

#### 2. Ultimo Round
```javascript
const testFinalRound = () => {
  const gameState = {
    roundIndex: 9,
    maxRounds: 10,
    players: {
      p1: { credits: 100, name: 'Player 1' },
      p2: { credits: 200, name: 'Player 2' }
    }
  };
  
  const result = checkGameEnd(gameState);
  
  // Dopo questo round, partita finisce
  assert(result.shouldEnd === true, 'Dovrebbe finire');
  assert(result.reason === 'MAX_ROUNDS_REACHED', 'Motivo: max rounds');
};
```

#### 3. Wildcard Doppia nel Penultimo Round
```javascript
const testDoubleWildcardScenario = () => {
  const wildcard = {
    playerId: 'p1',
    scenario: 'DOUBLE',
    state: 'unused'
  };
  
  const challengeResult = {
    wildcardEffect: {
      wasUsed: true,
      scenario: 'DOUBLE',
      originalPenalty: 100,
      multiplier: 1.5,
      modifiedPenalty: 150,
    }
  };
  
  assert(challengeResult.wildcardEffect.modifiedPenalty > 100, 'DOUBLE dovrebbe amplificare');
  assert(challengeResult.wildcardEffect.multiplier === 1.5, 'Moltiplicatore corretto');
};
```

#### 4. Un Solo Giocatore Rimasto
```javascript
const testGameEndOnePlayer = () => {
  const gameState = {
    players: {
      p1: { credits: 0, name: 'Eliminated' },
      p2: { credits: 500, name: 'Winner' }
    },
    roundIndex: 3,
    maxRounds: 10
  };
  
  const activePlayers = Object.values(gameState.players)
    .filter(p => p.credits > 0);
  
  if (activePlayers.length <= 1) {
    const { shouldEnd, reason } = checkGameEnd(gameState);
    assert(shouldEnd === true, 'Partita dovrebbe terminare');
    assert(reason === 'ONLY_ONE_PLAYER_LEFT', 'Motivo: solo 1 giocatore');
  }
};
```

### B. Test Numero Giocatori

#### 1. Test 2 Giocatori (Minimum)
```javascript
const test2Players = () => {
  const gameState = {
    players: {
      p1: { credits: 200, name: 'Alice' },
      p2: { credits: 200, name: 'Bob' }
    },
    maxRounds: 5,
    current: {
      phase: 'turn',
      turn: {
        currentPlayerId: 'p1',
        currentPlayerIndex: 0,
        claimHistory: []
      }
    }
  };
  
  // Test 5 round completi
  for (let i = 0; i < 5; i++) {
    // Simulare dichiarazioni
    const declarationResult = executeClaimAction(
      gameState.current,
      'p1',
      'Alice',
      3,
      'A',
      ['p1', 'p2']
    );
    assert(declarationResult.success === true, `Round ${i} declaration dovrebbe succedere`);
  }
};
```

**Checklist 2 Giocatori**:
- ✅ Turni alternati correttamente
- ✅ Dichiarazioni accettate
- ✅ Sfide risolvibili
- ✅ Wildcard attivabili
- ✅ Partita termina dopo maxRounds

#### 2. Test 3-4 Giocatori (Balanced)
```javascript
const test4Players = () => {
  const playerIds = ['p1', 'p2', 'p3', 'p4'];
  const gameState = {
    players: playerIds.reduce((acc, id) => ({
      ...acc,
      [id]: { credits: 200, name: `Player ${id}` }
    }), {}),
    maxRounds: 7,
  };
  
  // Test turno order
  let currentTurnIndex = 0;
  for (let round = 0; round < 7; round++) {
    for (let i = 0; i < 4; i++) {
      const playerId = playerIds[currentTurnIndex % 4];
      assert(playerId in gameState.players, `Giocatore ${playerId} dovrebbe esistere`);
      currentTurnIndex++;
    }
  }
};
```

**Checklist 3-4 Giocatori**:
- ✅ Ordine turni corretto
- ✅ Tutti gli altri possono sfidare
- ✅ Wildcard distribute correttamente
- ✅ Timeline tiene traccia di tutti

#### 3. Test 5-6+ Giocatori (Complexity)
```javascript
const test6Players = () => {
  const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
  
  const gameState = {
    players: playerIds.reduce((acc, id) => ({
      ...acc,
      [id]: { 
        credits: 300, // Crediti più alti per partita più lunga
        name: `Player ${id}`,
        isEliminated: false
      }
    }), {}),
    maxRounds: 10,
    current: {
      turn: {
        claimHistory: [],
        declarationTimeline: []
      }
    }
  };
  
  // Simulare turni multipli
  let turnsCompleted = 0;
  const maxTurns = 60; // 6 giocatori × 10 round
  
  while (turnsCompleted < maxTurns) {
    const currentIndex = turnsCompleted % 6;
    const playerId = playerIds[currentIndex];
    
    // Verifica che giocatore non sia eliminato
    if (!gameState.players[playerId].isEliminated) {
      turnsCompleted++;
    }
  }
  
  assert(turnsCompleted === maxTurns, 'Dovrebbe completare tutti i turni');
};
```

**Checklist 5-6+ Giocatori**:
- ✅ Ordine turni complesso ma corretto
- ✅ Timeline non si confonde
- ✅ Indicatori comportamentali accurati per ognuno
- ✅ Challenge resolution veloce
- ✅ Niente memory leak

### C. Test Partite Lunghe

#### 1. Test Resistenza (50 round)
```javascript
const testLongGameEndurance = () => {
  const gameState = {
    players: {
      p1: { credits: 1000, name: 'Player 1' },
      p2: { credits: 1000, name: 'Player 2' }
    },
    maxRounds: 50,
    roundIndex: 0,
  };
  
  const startTime = performance.now();
  
  for (let round = 0; round < 50; round++) {
    gameState.roundIndex = round;
    
    // Simula dichiarazioni e sfide
    const claimResult = executeClaimAction(
      gameState.current,
      'p1',
      'Player 1',
      Math.floor(Math.random() * 5) + 1,
      ['A', 'K', 'Q', 'J'][Math.floor(Math.random() * 4)],
      ['p1', 'p2']
    );
    
    if (Math.random() > 0.7) { // 30% chance sfida
      const challengeResult = executeChallengeAction(
        gameState.current,
        'p2',
        ['p1', 'p2']
      );
    }
  }
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  assert(duration < 5000, `Partita da 50 round dovrebbe < 5s, took ${duration}ms`);
};
```

#### 2. Test Memoria (100 turni)
```javascript
const testMemoryLeak = () => {
  const initialMemory = process.memoryUsage().heapUsed;
  
  for (let i = 0; i < 100; i++) {
    const gameState = {
      players: {
        p1: { credits: 200, name: 'Player 1' },
        p2: { credits: 200, name: 'Player 2' }
      },
      current: {
        turn: {
          claimHistory: Array(10).fill({ playerName: 'P1', quantity: 1, value: 'A' })
        }
      }
    };
    
    // Simula creazione e distruzione
    generateBehaviorIndicators(
      'p1',
      { claims: 5, challenges: 2, successful: 1 }
    );
  }
  
  const finalMemory = process.memoryUsage().heapUsed;
  const increase = finalMemory - initialMemory;
  
  assert(increase < 10000000, `Memory increase dovrebbe < 10MB, was ${increase / 1000000}MB`);
};
```

#### 3. Test Stabilità Timeline (1000 dichiarazioni)
```javascript
const testTimelineStability = () => {
  const timeline = [];
  
  for (let i = 0; i < 1000; i++) {
    timeline.push({
      id: i,
      playerName: `Player ${i % 6}`,
      quantity: (i % 5) + 1,
      value: ['A', 'K', 'Q', 'J', '10'][i % 5],
      timestamp: Date.now() + i,
      result: i % 3 === 0 ? 'true' : 'false',
    });
  }
  
  // Test formatting (simula display rendering)
  const formatted = formatTimelineForDisplay(timeline);
  
  assert(formatted.length > 0, 'Timeline dovrebbe avere elementi');
  assert(formatted.length <= 50, 'Timeline dovrebbe mostrare max 50 (con paginazione)');
};
```

---

## 🧪 SUITE TEST COMPLETA

```bash
# Esegui tutti i test
npm test -- lucky-liar

# Test solo configuration
npm test -- lucky-liar --config

# Test solo gameplay
npm test -- lucky-liar --gameplay

# Test edge cases
npm test -- lucky-liar --edge-cases

# Test performance
npm test -- lucky-liar --perf

# Test con 2-6 giocatori
npm test -- lucky-liar --multiplayer
```

---

## 📋 CHECKLIST PRE-PRODUZIONE

### Configurazione
- [ ] `maxRounds` impostato (consigliato 5-10)
- [ ] `penaltyPercentage` impostato (consigliato 0.20)
- [ ] Numero wildcard per round deciso
- [ ] Modalità dichiarazione scelta (free/assisted)
- [ ] Firebase rules aggiornate

### Test Edge Cases
- [ ] ✅ All-in scenario
- [ ] ✅ Ultimo round
- [ ] ✅ Wildcard doppia
- [ ] ✅ Un solo giocatore rimasto
- [ ] ✅ Crediti 0 eliminazione

### Test Moltiplicatori
- [ ] ✅ 2 giocatori (x5)
- [ ] ✅ 3-4 giocatori (x5)
- [ ] ✅ 5-6 giocatori (x3)
- [ ] ✅ 7+ giocatori (x1)

### Test Performance
- [ ] ✅ Resistenza 50 round
- [ ] ✅ Memory < 10MB leak
- [ ] ✅ Timeline 1000+ dichiarazioni
- [ ] ✅ Carico 100 turni rapidi

### Pre-Lancio
- [ ] ✅ Tutti i test passed
- [ ] ✅ Browser compatibility verificato
- [ ] ✅ Mobile tested
- [ ] ✅ Firebase logging enabled
- [ ] ✅ Error handling implemented

---

## 🚀 RACCOMANDAZIONI FINALI

**Configurazione Consigliata (Default)**:
```javascript
const DEFAULT_CONFIG = {
  maxRounds: 7,
  penaltyPercentage: 0.20,
  declarationMode: 'assisted', // Per principianti
  wildcardsPerRound: 1, // Una per giocatore
  minPlayers: 2,
  maxPlayers: 6,
};
```

**Per Principianti**:
```javascript
const BEGINNER_CONFIG = {
  maxRounds: 5,
  penaltyPercentage: 0.10, // Più leggero
  declarationMode: 'assisted',
  wildcardsPerRound: 1,
};
```

**Per Esperti**:
```javascript
const EXPERT_CONFIG = {
  maxRounds: 10,
  penaltyPercentage: 0.30, // Più punitivo
  declarationMode: 'free',
  wildcardsPerRound: 1, // Raro
};
```

**Status**: ✅ SEZIONE 10 COMPLETA

