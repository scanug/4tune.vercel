# LUCKY LIAR - Sistema Wildcard

## Panoramica

La wildcard è una carta speciale segreta che ogni giocatore (o 2 giocatori) ricevono a inizio round. Può essere usata una sola volta durante una sfida per modificare l'esito della penalità.

---

## 1. ASSEGNAZIONE (5.1)

### Timing
- **A inizio round**: Quando il round viene inizializzato
- **Reset round**: Dopo ogni sfida vengono assegnate nuove wildcards

### Modalità
```javascript
// SINGLE: 1 giocatore ha wildcard
assignWildcards(playerIds, WILDCARD_MODES.SINGLE)

// DOUBLE: 2 giocatori hanno wildcard
assignWildcards(playerIds, WILDCARD_MODES.DOUBLE)
```

### Caratteristiche
- ✅ **Segreta**: Solo il giocatore che la possiede sa di averla
- ✅ **Casuale**: Assegnazione randomica tra i giocatori
- ✅ **Invisibile in UI**: Non viene mostrata finché non è usata

### Struttura Dati
```javascript
{
  playerId: string,           // Chi la possiede
  playerName: string,         // Per log
  state: 'unused' | 'activated' | 'exhausted',
  isUsedInChallenge: boolean,
  activatedAt: number         // Timestamp di attivazione
}
```

### Integrazione nel Round
```javascript
// Initialization
const roundState = initializeRound(
  playerIds, 
  players, 
  roundNumber,
  initialWager,
  WILDCARD_MODES.SINGLE  // <-- Scegli modalità
);

// roundState.wildcards = [
//   { playerId: 'user123', state: 'unused', ... }
// ]

// Dopo sfida
const newRoundState = resetRoundAfterChallenge(
  roundState, 
  playerIds,
  WILDCARD_MODES.SINGLE  // <-- Reset con nuova assegnazione
);
```

---

## 2. UTILIZZO WILDCARD (5.2)

### Quando Attivare
- ⏰ **Solo durante una sfida** (fase CHALLENGE)
- 🎯 **Una sola volta** per round (poi esaurisce)
- 👤 **Solo da chi ha la wildcard**

### Validazione
```javascript
const validation = validateWildcardActivationInChallenge(
  playerId, 
  wildcards
);

if (validation.valid) {
  // Può attivare
} else {
  // Errore: validation.reason
}
```

### Attivazione Durante Risoluzione Sfida
```javascript
const result = resolveChallenge(
  challenge,
  playerHands,
  wildcards,           // Array wildcards
  'user123'            // ID di chi attiva (opzionale)
);

// result.wildcardEffect = {
//   wasUsed: true,
//   scenario: 'claimer_true',
//   originalPenalty: 50,
//   modifiedPenalty: 25,
//   ...
// }

// result.updatedWildcards = aggiornato con stato 'exhausted'
```

### I 4 Scenari (Matrice)

| Scenario | Situazione | Chi Ha Wildcard | Outcome | Effetto |
|----------|-----------|-----------------|---------|---------|
| **claimer_true** | Dichiaratore bluffa correttamente | Dichiaratore | Sfidante perde | REDUCE: -50% |
| **claimer_false** | Dichiaratore viene scoperto | Dichiaratore | Dichiaratore perde | AMPLIFY: +150% |
| **challenger_true** | Sfida corretta | Sfidante | Sfidante perde comunque | AMPLIFY: +150% |
| **challenger_false** | Sfida sbagliata | Sfidante | Dichiaratore perde | REDUCE: -50% |

#### Esempio: Claimer True
```
Giocatore A (dichiaratore): Ha wildcard
Giocatore B (sfidante): No wildcard

Giocatore A dichiara: "3 Assi"
Realtà: Ci sono 3 Assi (vera!)
Giocatore B sfida

Risultato senza wildcard: B perde 50 crediti
Risultato con wildcard: B perde 25 crediti (-50%)
```

#### Esempio: Claimer False
```
Giocatore A (dichiaratore): Ha wildcard
Giocatore B (sfidante): No wildcard

Giocatore A dichiara: "5 Assi"
Realtà: Ci sono 2 Assi (falsa!)
Giocatore B sfida

Risultato senza wildcard: A perde 100 crediti
Risultato con wildcard: A perde 150 crediti (+150%)
Wildcard PUNISCE il bluff aggressivo!
```

---

## 3. EFFETTI WILDCARD (5.3)

### Moltiplicatori

#### REDUCE: -50% (Difensivo)
- Riduce la penalità del 50%
- Protegge il giocatore che la usa
- Scenari: `claimer_true`, `challenger_false`

```javascript
Penalità originale: 100 crediti
Con wildcard REDUCE: 50 crediti
Crediti salvati: 50
```

#### AMPLIFY: +150% (Offensivo)
- Aumenta la penalità del 150%
- Punisce l'avversario o il bluff aggressivo
- Scenari: `claimer_false`, `challenger_true`

```javascript
Penalità originale: 100 crediti
Con wildcard AMPLIFY: 150 crediti
Penalità aggiunta: 50 crediti
```

### Calcolo Automatico
```javascript
// Sistema calcola automaticamente
const effect = calculateWildcardEffect(scenario, originalPenalty);

effect.multiplier      // 0.5 o 1.5
effect.effectAmount    // Crediti salvati/aggiunti
effect.explanation     // Testo per display
```

### WildcardEffect Object
```javascript
{
  wasUsed: true,
  scenario: 'claimer_true',        // Quale dei 4 casi
  originalPenalty: 50,              // Penalità iniziale
  modifiedPenalty: 25,              // Dopo wildcard
  multiplier: 0.5,                  // Moltiplicatore applicato
  savedCredits: 25,                 // Se REDUCE
  additionalPenalty: 0,             // Se AMPLIFY
  explanation: "Wildcard dichiaratore! Sfidante perde il 50% in meno."
}
```

---

## 4. UI & NOTIFICHE (5.3 - Segnalazione)

### Quando Mostrare la Wildcard

#### PRIMA della Risoluzione
❌ **NON mostrare** chi ha attivato la wildcard
- Solo segno: "🎴 Una wildcard è stata attivata!"
- Effetto: rato?

#### DOPO la Risoluzione
✅ **Rivelazione completa**:
- Chi la aveva
- Quale scenario si è verificato
- Quanto ha cambiato il risultato

### Messaggi di Attivazione
```javascript
const msg = getWildcardActivationMessage(scenario);

// Ritorna:
// "🎴 Una wildcard è stata attivata! Lo sfidante riceve una riduzione della penalità."
// "🎴 Una wildcard è stata attivata! Il dichiaratore riceve una penalità aumentata."
// ecc.
```

### Dati Visuali
```javascript
const visual = getWildcardVisual(scenario);

// Ritorna:
{
  icon: '🎴✓',                    // Icona per UI
  color: '#8b5cf6',               // Colore (purple/red)
  description: 'Wildcard difensiva - Riduce penalità'
}
```

### Display Completo
```javascript
const displayData = getWildcardDisplayData(wildcardEffect);

// Ritorna:
{
  icon: '🎴✓',
  color: '#8b5cf6',
  originalPenalty: 50,
  modifiedPenalty: 25,
  difference: 25,
  multiplier: 0.5,
  explanation: '...',
  wasSaved: true,
  amountSaved: 25,
  wasAmplified: false
}
```

### React Component Example
```jsx
const result = resolveChallenge(challenge, playerHands, wildcards, wildcardActivator);

function ChallengeResult({ result }) {
  const wildcardDisplay = getWildcardDisplayData(result.wildcardEffect);
  
  return (
    <div>
      <h2>{result.explanation}</h2>
      
      <div className="penalty">
        Penalità: {result.penalty} → {result.modifiedPenalty}
      </div>

      {wildcardDisplay && (
        <div className="wildcard-effect" style={{ color: wildcardDisplay.color }}>
          <div className="icon">{wildcardDisplay.icon}</div>
          <div className="explanation">{wildcardDisplay.explanation}</div>
          <div className="amount">
            {wildcardDisplay.wasSaved 
              ? `Crediti salvati: ${wildcardDisplay.amountSaved}`
              : `Penalità aggiunta: ${wildcardDisplay.amountAdded}`
            }
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 5. INTEGRAZIONE NEL FLUSSO DI GIOCO

### Fase Challenge (Completa)
```javascript
// 1. Durante sfida, offri opzione wildcard (solo a chi la ha)
if (hasAvailableWildcard(currentPlayerId, wildcards)) {
  // Mostra pulsante "Attiva Wildcard" nel challenge UI
}

// 2. Giocatore clicca "Attiva Wildcard" (opzionale)
const activator = wildcardActivator; // ID di chi clicca il pulsante

// 3. Risolvi sfida con wildcard
const result = resolveChallenge(
  challenge,
  playerHands,
  wildcards,
  activator  // undefined se non attivata
);

// 4. Applica penalità modificata
const penalties = calculatePenalties({
  loserId: result.loserId,
  penalty: result.modifiedPenalty  // <-- USA modifiedPenalty!
});

// 5. Update wildcards
if (result.updatedWildcards) {
  // Salva le wildcard aggiornate su Firebase
  await updateWildcards(result.updatedWildcards);
}

// 6. Mostra result con wildcard effect
displayChallengeResult(result);
```

### Struttura Firebase
```
rooms_liar/ABC123/current/
├── wildcards/
│   ├── 0: {playerId: 'user1', state: 'unused', ...}
│   ├── 1: {playerId: 'user2', state: 'unused', ...}
├── challenge/
│   ├── challengerId: 'user2'
│   ├── claimerId: 'user1'
│   ├── wildcardActivatedBy: 'user1'  (se attivata)
│   ├── wildcardEffect: { ... }
│   └── result: { ... }
```

---

## 6. STRATEGIE PSICOLOGICHE

La wildcard introduce psicologia al gioco:

### Usarla Subito vs Aspettare
- ⚡ **Subito**: Evita penalità maggiore inizialmente
- ⏳ **Aspettare**: Rischia penalità maggiore ma conserva wildcard per momento critico

### Bluffare Aggressivamente
- 🎲 Se pensi di avere wildcard, puoi bluffare di più
- ⚠️ Ma se scoperto, la penalità aumenta del 150%!

### Leggere gli Avversari
- 👁️ Se qualcuno sfida sempre, potrebbe avere wildcard
- 🛡️ Se qualcuno bluffa molto, potrebbe usarla in difesa

---

## 7. TESTING WILDCARD

### Test Case 1: Assegnazione
```javascript
const players = ['user1', 'user2', 'user3'];
const wc = assignWildcards(players, WILDCARD_MODES.SINGLE);
// ✓ Esattamente 1 wildcard assegnata
// ✓ Stato: 'unused'
```

### Test Case 2: Validazione
```javascript
// Chi NON ha wildcard
const validation = validateWildcardActivationInChallenge('user2', wildcards);
// ✗ valid: false, reason: "Non hai una wildcard disponibile"

// Chi l'ha già usata
const validation2 = validateWildcardActivationInChallenge('user1', wildcards);
// ✗ valid: false, reason: "Hai già usato la tua wildcard"
```

### Test Case 3: Scenario True
```javascript
// Dichiaratore ha wildcard, dichiarazione vera
const result = resolveChallenge(
  challenge,
  playerHands,
  wildcards,
  'dichiaratore_id'  // Attiva
);
// ✓ scenario: 'claimer_true'
// ✓ multiplier: 0.5
// ✓ modifiedPenalty = originalPenalty * 0.5
```

### Test Case 4: Scenario False
```javascript
// Dichiaratore ha wildcard, dichiarazione falsa
const result = resolveChallenge(..., 'dichiaratore_id');
// ✓ scenario: 'claimer_false'
// ✓ multiplier: 1.5
// ✓ modifiedPenalty = originalPenalty * 1.5
```

---

## 8. API SUMMARY

### Assegnazione
- `assignWildcards(playerIds, mode)` - Assign at game start
- `resetWildcardsForNewRound(playerIds, mode)` - Reset after challenge

### Gestione Stato
- `getWildcardForPlayer(playerId, wildcards)` - Find player's wildcard
- `hasAvailableWildcard(playerId, wildcards)` - Check if unused
- `activateWildcard(playerId, wildcards)` - Change state to ACTIVATED
- `exhaustWildcard(playerId, wildcards)` - Change state to EXHAUSTED

### Scenario & Effetti
- `determineWildcardScenario(owner, claimer, challenger, isTrue)` - Determine scenario
- `calculateWildcardEffect(scenario, penalty)` - Calculate multiplier
- `applyWildcardMultiplier(penalty, scenario)` - Apply to penalty
- `createWildcardEffect(wasUsed, scenario, penalty)` - Create full effect object

### Validazione Challenge
- `validateWildcardActivationInChallenge(playerId, wildcards)` - Validate in challenge

### Risoluzione
- `resolveChallenge(challenge, hands, wildcards, activator)` - Resolve with wildcard support

### Display UI
- `getWildcardActivationMessage(scenario)` - Notification message
- `getWildcardVisual(scenario)` - Icon, color, description
- `getWildcardDisplayData(effect)` - Complete display object

---

## 9. CHANGELOG

### v1.0 - Implementazione Completa
- ✅ Assegnazione casuale (SINGLE/DOUBLE)
- ✅ 4 scenari di utilizzo
- ✅ Moltiplicatori REDUCE/AMPLIFY
- ✅ Integrazione con resolveChallenge
- ✅ UI display system
- ✅ Firebase rules update
- ✅ Psychological depth

