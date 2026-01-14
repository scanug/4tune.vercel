# 🎨 LUCKY LIAR - SEZIONE 9: UI/UX DESIGN

## Overview

La Sezione 9 implementa l'interfaccia grafica e l'esperienza dell'utente secondo **principi psicologici**.

**Obiettivi**:
- ✅ Mano privata SEMPRE visibile e leggibile
- ✅ Wildcard indicata in modo discreto (non invadente)
- ✅ Crediti chiari e leggibili in ogni momento
- ✅ Animazioni leggere ma comunicative
- ✅ Feedback immediato su azioni importanti
- ✅ Zero informazioni inutili (information overload evitato)

---

## 📋 SEZIONE 9.1 - UI Giocatore

### A. Mano Privata

**Requisiti**:
- ✅ Sempre visibile (non collassabile)
- ✅ 5 carte disposte orizzontalmente
- ✅ Hover effect per interazione
- ✅ Selezione chiara e evidente

**Implementazione**:

```jsx
import { PlayerHand } from '@/LUCKY_LIAR_UI_COMPONENTS.jsx';

<PlayerHand 
  cards={myCards}
  selectedIndex={selectedIndex}
  onCardSelect={(index) => selectCard(index)}
  isMyTurn={isMyTurn}
/>
```

**Stile**:
```
┌──────────────────────────────────┐
│ La mia mano                   5/5 │
├──────────────────────────────────┤
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐
│ │ A♠ │ │ K♥ │ │ Q♦ │ │10♣ │ │ 5♠ │
│ └────┘ └────┘ └────┘ └────┘ └────┘
└──────────────────────────────────┘
```

**Colori**:
- Rosso: ♥ ♦ (hearts, diamonds)
- Nero: ♠ ♣ (spades, clubs)
- Bordo: Viola (#8b5cf6) al hover
- Sfondo: Blu scuro (tema)

### B. Stato Wildcard (Discreto)

**Requisiti**:
- ✅ Non dominante (non attira troppo)
- ✅ Icona + etichetta discreta
- ✅ Posizionato sopra o sotto mano
- ✅ 3 stati: UNUSED (disponibile), ACTIVATED (usata), EXHAUSTED (esaurita)

**Implementazione**:

```jsx
import { WildcardStatus } from '@/LUCKY_LIAR_UI_COMPONENTS.jsx';

<WildcardStatus
  hasWildcard={true}
  state="unused"  // 'unused' | 'activated' | 'exhausted'
  onClick={() => showWildcardInfo()}
/>
```

**Indicatori di Stato**:

| Stato | Icona | Colore | Label |
|-------|-------|--------|-------|
| UNUSED | ⚡ | Viola (#8b5cf6) | Wildcard disponibile |
| ACTIVATED | ✨ | Verde (#10b981) | Wildcard attivata |
| EXHAUSTED | 💫 | Grigio (#6b7280) | Wildcard usata |

**Posizionamento**:
- Mobile: Sopra la mano privata
- Desktop: Accanto ai crediti

### C. Crediti (Chiari e Leggibili)

**Requisiti**:
- ✅ Numero grande e bold
- ✅ Posizionato in alto fisso (sticky)
- ✅ Icona riconoscibile (💰)
- ✅ Evidenza quando cambiano (animazione)

**Implementazione**:

```jsx
import { CreditDisplay } from '@/LUCKY_LIAR_UI_COMPONENTS.jsx';

<CreditDisplay 
  credits={150}
  changes={+50}  // Se cambiati, mostra animazione
  isHighlighted={creditAlertActive}
/>
```

**Visual**:
```
┌─────────────────┐
│ 💰   150        │  ← Sempre visibile, sticky
│                 │
│ Layout di gioco │
│                 │
└─────────────────┘
```

**Animazione Cambio**:
- Se crediti aumentano: +50 in VERDE che flotta verso l'alto
- Se crediti diminuiscono: -50 in ROSSO che flotta verso l'alto
- Durata: 400ms

### D. Player Cards (nella vista di gioco)

Ogni giocatore ha una card con:
- Nome e status (turno, eliminato)
- Crediti correnti
- Stato wildcard (se ha)
- Max 2 indicatori comportamentali

```jsx
import { GamePlayerCard } from '@/LUCKY_LIAR_UI_COMPONENTS.jsx';

<GamePlayerCard
  playerId="user123"
  playerName="Marco"
  credits={200}
  hasWildcard={true}
  wildcardState="unused"
  indicators={behaviorIndicators}
  isMyTurn={true}
  isEliminated={false}
/>
```

---

## 🎨 SEZIONE 9.2 - UX Psicologica

### A. Animazioni (Leggere ma Leggibili)

**Principi**:
- **Leggere**: 200-500ms (non distrae, ma si vede)
- **Leggibili**: Chiare in intenzione
- **Coerenti**: Stesso stile per azioni simili

#### 1. Card Entrance (Nuova dichiarazione)
```
Timing: 300ms
Effect: Fade in + Slide from left
Psychology: "Nuova informazione importante"
```

#### 2. Challenge Animation
```
Timing: 500ms
Players appear from opposite sides: ← vs →
"VS" text pulsa al centro
Psychology: "Confronto diretto - tensione"
```

#### 3. Bluff Result
```
Timing: 1500ms total
1. Emoji bounce (600ms)
2. Message appear (300ms)
3. Hold visible (600ms)
Psychology: "Climax di scoperta"
```

#### 4. Credit Change
```
Timing: 400ms
Floating text: +50 (verde) o -50 (rosso)
Psychology: "Conseguenza immediata"
```

### B. Feedback Chiaro su Azioni

#### Bluff Riuscito
```
🎭 BLUFF SCOPERTO!
"Marco stava bluffando"

Visual: Rosso (#ef4444)
Timing: Appare subito (< 100ms), dura 1.5s
Audio: Cling! (opzionale)
```

#### Bluff Fallito
```
✓ VERA DICHIARAZIONE
"Hai sbagliato la sfida"

Visual: Verde (#10b981)
Timing: Appare subito, dura 1.5s
Audio: Beep! (opzionale)
```

#### Sfida Vinta/Persa
```
⚔️ SFIDA VINTA!  (verde)
vs
❌ SFIDA PERSA   (rosso)

Toast in basso: 3 secondi
Automatico dopo resultato
```

#### Wildcard Attivata
```
⚡ WILDCARD ATTIVATA!
"L'effetto è stato applicato"

Visual: Viola (#8b5cf6) + glow
Timing: 800ms
```

#### Turno Attivo
```
🎤 È il tuo turno
"Fai una dichiarazione"

Visual: Giallo (#fbbf24)
Timing: Persistente finché non agisci
Pulse animation: Attira attenzione
```

### C. Nessuna Informazione Inutile

**Elimina**:
- ❌ Numeri percentuale nelle metriche (usa solo indicatori)
- ❌ Dettagli di logica interna (versioni, IDs)
- ❌ Messaggi ridondanti (una azione = un feedback)
- ❌ Troppe animazioni contemporanee

**Mantieni**:
- ✅ Nome giocatore
- ✅ Crediti attuali
- ✅ Turno corrente
- ✅ Risultato sfida (win/lose)
- ✅ Stato wildcard (3 soli stati)

---

## 📐 Design System

### Colori (Psicologia)

| Colore | Valore | Uso | Psychology |
|--------|--------|-----|------------|
| Viola | #8b5cf6 | Accent, wildcard, attivo | Magia, potenza, attenzione |
| Verde | #10b981 | Successo, bluff scoperto | Vincita, positivo |
| Rosso | #ef4444 | Errore, bluff fallito | Pericolo, perdita |
| Giallo | #fbbf24 | Avvertimento, turno attivo | Attenzione, urgenza |
| Blu | #3b82f6 | Informazione, secondary | Tranquillità, neutralità |

### Spacing (8px Grid)

```
xs (4px)   - Gap tra piccoli elementi
sm (8px)   - Gap tra card element
md (16px)  - Padding internoprincipi
lg (24px)  - Gap tra sezioni
xl (32px)  - Padding grande
xxl (48px) - Spacing tra aree grandi
```

### Typography

```
H1: 32px bold      - Titoli principali
H2: 24px bold      - Sezioni
H3: 20px semibold  - Sottosezioni
Body: 14px regular - Testo principale
Label: 13px medium - Etichette
Small: 12px regular - Testo secondario
```

### Border Radius

```
none (0px)   - Linee dritte
sm (4px)     - Piccoli elementi
md (8px)     - Card, input
lg (12px)    - Card grandi
xl (16px)    - Modal
full (9999px)- Badge circolari
```

---

## 🎬 Animation Timing

```javascript
// Entrance
cardEnter: 500ms          // Carta entra
playerEnter: 300ms        // Giocatore entra

// Declaration phase
declarationShowActive: 200ms  // Highlight

// Challenge phase
challengeStart: 300ms      // Animazione sfida
challengeReveal: 1500ms    // Reveal risultato

// Result phase
bluffSuccess: 800ms       // Bluff scoperto
bluffFail: 600ms          // Bluff fallito
creditChange: 400ms       // Cambio crediti

// Exit
playerExit: 400ms         // Giocatore esce
gameEndShow: 600ms        // Schermata finale
```

---

## 📱 Responsive Design

### Breakpoints

```
xs: 320px   (Mobile)
sm: 640px   (Mobile landscape)
md: 768px   (Tablet)
lg: 1024px  (Desktop)
xl: 1280px  (Large desktop)
xxl: 1536px (Extra large)
```

### Mobile Optimizations

```
- Hand: 5 carte in scroll orizzontale
- Player Cards: 1 colonna (stack verticale)
- Modals: Full-width con padding
- Buttons: Enlarged (44px height per thumb)
- Text: Responsive (base 16px)
```

### Desktop Optimizations

```
- Hand: 5 carte in una riga (fixed)
- Player Cards: 2-3 colonne (grid)
- Modals: Centered max-width 600px
- Buttons: Standard (36px height)
- Spacing: Aumentato per respirazione
```

---

## ♿ Accessibility

### Color Contrast
- ✅ Text: 4.5:1 WCAG AA
- ✅ Interactive: 3:1 WCAG AA
- ✅ Non affidarsi solo su colore (usa icone/testo)

### Keyboard Navigation
- ✅ Tab order logico
- ✅ Enter/Space per bottoni
- ✅ Arrow keys per selezione card

### Screen Readers
- ✅ ARIA labels su elementi interattivi
- ✅ Descrizione stato wildcard
- ✅ Feedback testuale per animazioni

### Focus States
```css
/* Visibile per keyboard users */
.button:focus {
  outline: 2px solid #8b5cf6;
  outline-offset: 2px;
}
```

---

## 🧠 UX Psychology Principles

### 1. Feedback Immediato (< 100ms)
Utente clicca → azione registrata subito
- Feedback tattico (hover effect)
- Feedback immediato (loading spinner)
- Feedback finale (toast notification)

### 2. Principio di Terzietà
Tre opzioni di azione: DICHIARA | SFIDA | PASSA
- Chiaro
- Decisivo
- Psicologicamente gestibile

### 3. Scarcity (Wildcard Rara)
Wildcard = Limitata (1 per giocatore per round)
- Aumenta valore percepito
- Crea tensione decisionale
- Incentiva uso strategico

### 4. Loss Aversion
Mostri chiaramente quando perdi crediti
- Rosso e minus (-50)
- Animation floating downward
- Non nascondere perdite

### 5. Progress Visibility
Crediti sempre visibili
- Mostra progresso
- Mantiene engagement
- Crea goal chiari

---

## 📊 Component Hierarchy

```
GamePage (container)
├─ Header
│  ├─ CreditDisplay (sticky)
│  └─ GameStatus
├─ MainArea
│  ├─ DeclarationTimeline
│  ├─ ChallengeArea (dinamico)
│  └─ PlayerCards (grid)
├─ Footer
│  ├─ PlayerHand
│  └─ ActionButtons
└─ Overlays
   ├─ BluffResultAnimation
   ├─ ChallengeAnimation
   └─ FeedbackToastContainer
```

---

## 🎮 Usage Examples

### Example 1: Show Bluff Discovery

```jsx
import { BluffResultAnimation, useFeedback } from '@/LUCKY_LIAR_UI_ANIMATIONS.jsx';

function GamePage() {
  const [showBluffResult, setShowBluffResult] = useState(false);
  const { show } = useFeedback();

  const handleChallengeResolved = (success) => {
    setShowBluffResult(true);
    show(success ? 'Bluff scoperto!' : 'Vera dichiarazione', 'info', 3000);
  };

  return (
    <>
      {showBluffResult && (
        <BluffResultAnimation
          success={true}
          playerName="Marco"
          onComplete={() => setShowBluffResult(false)}
        />
      )}

      <FeedbackToastContainer {...feedbackProps} />
    </>
  );
}
```

### Example 2: Display Player Hand

```jsx
import { PlayerHand, WildcardStatus } from '@/LUCKY_LIAR_UI_COMPONENTS.jsx';

function GamePage() {
  const [selectedCard, setSelectedCard] = useState(null);

  return (
    <div className="game-footer">
      <WildcardStatus
        hasWildcard={playerHasWildcard}
        state={wildcardState}
        onClick={() => showWildcardInfo()}
      />

      <PlayerHand
        cards={myCards}
        selectedIndex={selectedCard}
        onCardSelect={setSelectedCard}
        isMyTurn={isMyTurn}
      />

      <button onClick={() => makeClaim(myCards[selectedCard])}>
        Dichiara
      </button>
    </div>
  );
}
```

### Example 3: Credit Animation

```jsx
import { CreditDisplay, CreditChangePopup } from '@/LUCKY_LIAR_UI_COMPONENTS.jsx';

function GamePage() {
  const [credits, setCredits] = useState(200);
  const [creditPopups, setCreditPopups] = useState([]);

  const applyCreditsChange = (amount) => {
    // Mostra popup
    setCreditPopups([...creditPopups, {
      id: Date.now(),
      amount,
      x: 100,
      y: 100,
    }]);

    // Aggiorna crediti
    setCredits(credits + amount);
  };

  return (
    <>
      <CreditDisplay credits={credits} />

      {creditPopups.map(popup => (
        <CreditChangePopup
          key={popup.id}
          amount={popup.amount}
          x={popup.x}
          y={popup.y}
          onComplete={() => {
            setCreditPopups(p => p.filter(pp => pp.id !== popup.id));
          }}
        />
      ))}
    </>
  );
}
```

---

## 🔍 Testing UI/UX

### Visual Testing
- [ ] Hand visibile e leggibile
- [ ] Wildcard status discreto ma chiaro
- [ ] Crediti sempre visibili
- [ ] Nessun text overflow

### Animation Testing
- [ ] Challenge animation smooth
- [ ] Bluff result visible e chiaro
- [ ] Feedback toast appear/disappear
- [ ] No jarring transitions

### Interaction Testing
- [ ] Card selection feedback
- [ ] Button hover states
- [ ] Keyboard navigation works
- [ ] Mobile touch targets 44x44px

### Accessibility Testing
- [ ] Color contrast 4.5:1
- [ ] Screen reader labels
- [ ] Focus states visible
- [ ] Keyboard only navigation

---

## 📋 Checklist Implementazione

### Component Creation
- [ ] PlayerHand component
- [ ] WildcardStatus component
- [ ] CreditDisplay component
- [ ] GamePlayerCard component
- [ ] FeedbackToast component
- [ ] BluffResultAnimation component
- [ ] ChallengeAnimation component
- [ ] CreditChangePopup component

### Styling
- [ ] Design system colors applied
- [ ] Typography consistent
- [ ] Spacing grid used
- [ ] Responsive breakpoints work

### Animations
- [ ] Entrance animations smooth
- [ ] Challenge animation clear
- [ ] Bluff result visible
- [ ] Credit changes animate

### UX
- [ ] Feedback immediate (< 300ms)
- [ ] No information overload
- [ ] Clear game state
- [ ] Obvious player actions

### Accessibility
- [ ] Color contrast checked
- [ ] Keyboard navigation works
- [ ] Screen reader friendly
- [ ] Focus states visible

---

## 📚 Files Created

1. ✅ `lib/uiDesignSystem.js` - Design tokens e costanti
2. ✅ `LUCKY_LIAR_UI_COMPONENTS.jsx` - Componenti UI giocatore
3. ✅ `LUCKY_LIAR_UI_ANIMATIONS.jsx` - Animazioni e feedback
4. ✅ `LUCKY_LIAR_UI_UX_DESIGN.md` - Questa documentazione

---

## 🚀 Next Steps

1. Importa design system in tutti i componenti
2. Applica colori e spacing in game page
3. Integra feedback animations in game flow
4. Test su mobile e desktop
5. Refine timing e easing based on testing

---

**Status**: ✅ DESIGN & COMPONENTS COMPLETE

**Ready for**: Integration in game pages

