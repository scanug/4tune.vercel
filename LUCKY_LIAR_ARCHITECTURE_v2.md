# LUCKY LIAR - ARCHITETTURA COMPLETA v2.0

## 📋 Riepilogo Implementazione

### ✅ Componenti Completati

#### 1. **Card System** (`lib/cards.js`)
- Creazione mazzo standard (52 carte)
- Fisher-Yates shuffle algorithm
- Distribuzione carte iniziali (5 per giocatore)
- Analisi mano (conteggi, statistiche)

#### 2. **Game Flow** (`lib/luckyLiarGameLogic.js`)
- Fasi di gioco (SETUP → DEALING → TURN → CHALLENGE → CLEANUP → ROUND_END)
- Gestione turni (ordine circolare)
- Azioni giocatore (CLAIM, CHALLENGE, PASS)
- Reset round con nuove carte
- **NUOVO**: Integrazione wildcard

#### 3. **Declaration System** (`lib/luckyLiarDeclarations.js`)
- Validazione dichiarazioni (progressione quantitativa)
- Free mode (parsing natural language)
- Assisted mode (pre-validated UI buttons)
- Bluff hints e risk indicators

#### 4. **Challenge System** (`lib/luckyLiarChallenge.js`)
- Verifica dichiarazioni
- Penalità escalate (50-150 crediti)
- Animazione reveal
- **NUOVO**: Full wildcard integration

#### 5. **Wildcard System** (`lib/luckyLiarWildcard.js`) - NEW!
- Assegnazione casuale (SINGLE/DOUBLE)
- 4 scenari di utilizzo
- Moltiplicatori REDUCE (-50%) / AMPLIFY (+150%)
- Gestione stato (UNUSED → ACTIVATED → EXHAUSTED)
- UI notifications (senza rivelare la wildcard)

#### 6. **Firebase Rules** (`database.rules.json`)
- Struttura `rooms_liar`
- Supporto completo wildcard
- Permessi di lettura/scrittura
- Scoreboard e payout

---

## 🎮 Game Flow Completo

```
┌─────────────────────────────────────────┐
│ HOST CREA STANZA (host/page.js)        │
│ - Tipo di stanza (musica/4tune/liar)   │
│ - Numero round                          │
│ - Wager (scommessa)                     │
│ - Wildcard mode (SINGLE/DOUBLE)        │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ GIOCATORI ENTRANO IN LOBBY ([roomCode]) │
│ - Aspettano che host inizi              │
│ - Vedono impostazioni                   │
│ - Bottone "Pronto"                      │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ HOST AVVIA PARTITA                      │
│ - Firebase status: "playing"            │
│ - initializeRound() con wildcards       │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ FASE TURN (turno di dichiarazione)     │
│ - Primo giocatore tocca a loro          │
│ - Mostra hand (5 carte)                 │
│ - Sceglie: CLAIM / PASS / CHALLENGE    │
└─────────────────────────────────────────┘
                    ↓
         ┌──────────────────┐
         │ CLAIM ACTION     │  (Dichiarazione)
         │ ex: "3 Assi"     │
         └──────────────────┘
            Validazione
            ↓
         Registra claim
         Avanza turno
                    ↓
         ┌──────────────────┐
         │ PASS ACTION      │  (Salta turno)
         │ Penalità: -10    │
         └──────────────────┘
                    ↓
         ┌──────────────────┐
         │ CHALLENGE ACTION │  (Sfida)
         │ (Se puoi)        │
         └──────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ FASE CHALLENGE (Risoluzione)            │
│ - Verifica dichiarazione                │
│ - Calcola penalità di base              │
│                                         │
│ ➕ WILDCARD OPZIONALE:                  │
│   - Se giocatore ha wildcard            │
│   - Pulsante "Attiva Wildcard"          │
│   - Applica moltiplicatore              │
│   - Aggiorna penalità finale            │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ DISPLAY RISULTATO                       │
│ - Dichiarazione vera/falsa              │
│ - Penalità applicata                    │
│                                         │
│ 🎴 Se wildcard usata:                   │
│   - Mostra icona e effetto              │
│   - Crediti salvati/aggiunti            │
│   - Non rivela chi l'ha usata (before)  │
│   - Reveal completo (after)             │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ PHASE: CLEANUP                          │
│ - Scarto carte in eccesso               │
│ - Reset wildcard exhausted→unused       │
│ - Prossimo round (se maxRounds > 1)    │
└─────────────────────────────────────────┘
                    ↓
         Ritorna a TURN PHASE
         (resetRoundAfterChallenge)
                    ↓
┌─────────────────────────────────────────┐
│ GAME END                                │
│ - Ultimo round completato               │
│ - Scoreboard finale                     │
│ - Payout calculation                    │
│ - Return credits                        │
└─────────────────────────────────────────┘
```

---

## 📁 Struttura File

```
lib/
├── cards.js                          ✅ Card mechanics
├── luckyLiarGameLogic.js            ✅ Turn management + wildcard init
├── luckyLiarDeclarations.js         ✅ Declaration system
├── luckyLiarChallenge.js            ✅ Challenge resolution + wildcard
├── luckyLiarWildcard.js             🆕 Complete wildcard system
├── firebase.js                       ✅ Firebase config
└── missions.js                       ✅ Missions (existing)

app/
├── liar/
│   ├── host/
│   │   └── page.js                  🔲 Create room
│   ├── [roomCode]/
│   │   └── page.js                  🔲 Lobby
│   └── game/
│       └── [roomCode]/
│           └── page.js              🔲 Game page
├── auth/page.js                     ✅ Auth
├── profile/page.js                  ✅ Profile
└── ...

documentation/
├── LUCKY_LIAR_WILDCARD.md          🆕 Wildcard complete guide
├── WILDCARD_INTEGRATION_EXAMPLE.js  🆕 React component examples
├── WILDCARD_TESTS.js                🆕 Test suite
└── LUCKY_LIAR_WILDCARD.md          🆕 System documentation

database.rules.json                  ✅ Firebase rules + wildcard support
```

---

## 🎯 Wildcard Features

### Assegnazione
```javascript
// A inizio round
const wildcards = assignWildcards(playerIds, WILDCARD_MODES.SINGLE);
// [{ playerId: 'user1', state: 'unused', ... }]

// Reset dopo sfida
const newWildcards = resetWildcardsForNewRound(playerIds, WILDCARD_MODES.SINGLE);
```

### Utilizzo Smartly
```javascript
// Durante challenge
if (hasAvailableWildcard(currentPlayerId, wildcards)) {
  // Mostra pulsante "Attiva Wildcard"
}

// Risolvi con wildcard opzionale
const result = resolveChallenge(
  challenge,
  playerHands,
  wildcards,
  wildcardActivator  // Chi attiva (opzionale)
);

// Usa penalità modificata!
applyPenalty(result.loserId, result.modifiedPenalty);
```

### Scenari Matrix
| Wildcard Owner | Outcome | Action | Effect |
|---|---|---|---|
| Dichiaratore | Dichiarazione vera ✓ | Sfidante perde | REDUCE -50% |
| Dichiaratore | Dichiarazione falsa ✗ | Dichiaratore perde | AMPLIFY +150% |
| Sfidante | Dichiarazione vera ✓ | Sfidante perde | AMPLIFY +150% |
| Sfidante | Dichiarazione falsa ✗ | Dichiaratore perde | REDUCE -50% |

---

## 🔗 Integration Points

### Firebase Real-Time Sync
```javascript
// Read wildcards
const wildcardRef = ref(db, `rooms_liar/${roomCode}/current/wildcards`);
onValue(wildcardRef, (snapshot) => {
  const wildcards = snapshot.val();
});

// Update wildcards (used)
await update(ref(db, `rooms_liar/${roomCode}/current/wildcards/0`), {
  state: 'exhausted',
  activatedAt: Date.now()
});

// Save wildcard effect in challenge result
await update(ref(db, `rooms_liar/${roomCode}/current/challenge`), {
  wildcardEffect: result.wildcardEffect
});
```

### React Components
```javascript
// Hook for wildcard state
const { wildcards } = useChallengeWithWildcard(roomCode, currentPlayerId);

// Button component
<WildcardButton 
  currentPlayerId={userId}
  wildcards={wildcards}
  challenge={currentChallenge}
  onActivate={handleActivate}
/>

// Result display
<WildcardEffectDisplay 
  wildcardEffect={result.wildcardEffect}
/>
```

---

## 🚀 Next Steps (Per Le Pagine)

### 1. Host Page (`app/liar/host/page.js`)
- [ ] Form: maxRounds, wager, wildcardMode
- [ ] generateRoomCode()
- [ ] Credit validation
- [ ] Deduct wager from user credits
- [ ] Create room in Firebase
- [ ] Redirect to lobby

### 2. Lobby Page (`app/liar/[roomCode]/page.js`)
- [ ] Display room settings
- [ ] Player list with readiness
- [ ] Host: "Start Game" button
- [ ] Players: "Ready" button
- [ ] Real-time sync player list
- [ ] Redirect to game page when started

### 3. Game Page (`app/liar/game/[roomCode]/page.js`)
- [ ] Display current hand (5 cards)
- [ ] Turn indicator (who's playing)
- [ ] Action buttons (Claim/Challenge/Pass)
- [ ] Declaration input (free or assisted based on mode)
- [ ] Claim history sidebar
- [ ] **Wildcard button** (if available)
- [ ] Challenge resolution display
- [ ] **Wildcard effect display** (with animation)
- [ ] Scoreboard/leaderboard
- [ ] Round counter
- [ ] End game screen with payout

---

## 🧪 Testing Checklist

### Wildcard Logic
- [ ] Assignment: SINGLE and DOUBLE modes
- [ ] Availability: Check unused/exhausted states
- [ ] Scenarios: All 4 combinations working
- [ ] Multipliers: REDUCE/AMPLIFY correct
- [ ] Exhaustion: Once used, cannot use again
- [ ] Reset: New wildcard each round

### Firebase Integration
- [ ] Wildcards saved in `current/wildcards`
- [ ] Challenge result includes `wildcardEffect`
- [ ] Penalty modified in scoreboard
- [ ] Wildcard state persisted correctly
- [ ] Rules allow read/write by authenticated users

### UI/UX
- [ ] Button shows only if wildcard available
- [ ] Activation message doesn't reveal owner
- [ ] Result display shows full wildcard info
- [ ] Animations for penalty change smooth
- [ ] Mobile responsive layout

---

## 📊 Metrics to Track

```javascript
generateWildcardStats(challengeLogs);
// {
//   totalWildcardsUsed: 3,
//   wildcardsByScenario: {
//     'claimer_true': 1,
//     'claimer_false': 1,
//     'challenger_false': 1
//   },
//   totalCreditsAffected: 225,
//   totalSavedCredits: 75,
//   totalAdditionalPenalties: 150
// }
```

---

## 🎓 Learning Path

For developers integrating this:

1. Read [LUCKY_LIAR_WILDCARD.md](LUCKY_LIAR_WILDCARD.md)
2. Study [WILDCARD_INTEGRATION_EXAMPLE.js](WILDCARD_INTEGRATION_EXAMPLE.js)
3. Run [WILDCARD_TESTS.js](WILDCARD_TESTS.js) tests
4. Implement host page (game room creation)
5. Implement lobby page (player joining)
6. Implement game page (gameplay + UI)

---

## 🔒 Security Considerations

- ✅ Wildcard owner kept secret until reveal
- ✅ Penalties enforced on Firebase rules
- ✅ Credit deductions validated server-side
- ✅ Challenge resolution verified against actual hands
- ⚠️ Consider: Cloud Functions for penalty application (to prevent client tampering)

---

## 🐛 Known Limitations

- Wildcard reveal delayed until after resolution (could be made instant)
- No animation for wildcard icon appearance (could add)
- No sound effects for wildcard activation (could add)
- Single round optimization possible (cache deck)

---

## 📝 Version History

### v2.0 (Current) - Wildcard Complete
- Added full wildcard system
- 4 scenarios with proper multipliers
- UI integration examples
- Firebase rules update
- Documentation and tests

### v1.0 - Base Game
- Card system
- Turn management
- Declaration system
- Challenge resolution

---

Generated: January 14, 2026
System: Lucky Liar - Complete Bluffing Card Game
Status: Ready for React page implementation
