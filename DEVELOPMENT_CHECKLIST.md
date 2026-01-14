# 🚀 LUCKY LIAR - DEVELOPMENT CHECKLIST

## Phase 1: Backend ✅ COMPLETATO
- [x] Card system (`lib/cards.js`)
- [x] Game logic (`lib/luckyLiarGameLogic.js`)
- [x] Declaration system (`lib/luckyLiarDeclarations.js`)
- [x] Challenge system (`lib/luckyLiarChallenge.js`)
- [x] **Wildcard system** (`lib/luckyLiarWildcard.js`)
- [x] Firebase rules update
- [x] Documentation (5 complete docs)

---

## Phase 2: React Pages (🔲 TO DO)

### Page 1: Host Page (`app/liar/host/page.js`)
**Purpose**: Create a new Lucky Liar game room

#### Requirements
- [ ] Auth check (redirect to /auth if not logged in)
- [ ] Form fields:
  - [ ] Input: Max Rounds (1-10, default 3)
  - [ ] Input: Wager per player (10-500 credits, default 50)
  - [ ] Select: Wildcard Mode (SINGLE or DOUBLE, default SINGLE)
  - [ ] Display: Your credits (read from Firebase)
- [ ] Validation:
  - [ ] Max rounds is valid number
  - [ ] Wager is valid and player has enough credits
  - [ ] At least 2 players can join
- [ ] Actions:
  - [ ] Deduct wager from user credits
  - [ ] Generate room code (8 characters, alphanumeric)
  - [ ] Create room in Firebase:
    ```javascript
    await set(ref(db, `rooms_liar/${roomCode}`), {
      hostId: userId,
      createdAt: Date.now(),
      status: 'waiting',
      maxRounds: maxRounds,
      wager: wager,
      declarationMode: 'free', // or 'assisted'
      players: { [userId]: { name, avatar, credits } },
      scoreboard: { [userId]: { points: 0, name, avatar } },
      current: {
        roundNumber: 0,
        phase: 'setup',
        // ... initialized by game logic
      }
    });
    ```
  - [ ] Redirect to lobby page

#### UI Elements
```
┌────────────────────────────────────────┐
│ CREA PARTITA - LUCKY LIAR 🎴            │
├────────────────────────────────────────┤
│                                        │
│ I Tuoi Crediti: 5,000 💰               │
│                                        │
│ IMPOSTAZIONI:                          │
│ ┌──────────────────────────────────┐  │
│ │ Numero di Round: [3     ] ▼       │  │
│ │ Scommessa per giocatore: [50  ]   │  │
│ │ Modalità Dichiarazione: [Free ] ▼│  │
│ │ Wildcard Mode: [SINGLE  ] ▼      │  │
│ └──────────────────────────────────┘  │
│                                        │
│ Costo totale: 50 crediti               │
│                                        │
│ [CREA STANZA]                          │
│                                        │
└────────────────────────────────────────┘
```

#### Code Template
```javascript
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import { ref, set, get, update } from 'firebase/database';

export default function HostPage() {
  const [userId, setUserId] = useState(null);
  const [userCredits, setUserCredits] = useState(0);
  const [maxRounds, setMaxRounds] = useState(3);
  const [wager, setWager] = useState(50);
  const [wildcardMode, setWildcardMode] = useState('single');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.push('/auth');
        return;
      }
      setUserId(user.uid);
      
      // Read user credits from Firebase
      const creditsRef = ref(db, `users/${user.uid}/credits`);
      const snapshot = await get(creditsRef);
      if (snapshot.exists()) {
        setUserCredits(snapshot.val());
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleCreateRoom = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validation
      if (maxRounds < 1 || maxRounds > 10) {
        throw new Error('Round deve essere tra 1 e 10');
      }
      if (wager < 10 || wager > 500) {
        throw new Error('Scommessa deve essere tra 10 e 500');
      }
      if (userCredits < wager) {
        throw new Error('Crediti insufficienti');
      }

      // Generate room code
      const roomCode = Math.random().toString(36).substring(2, 10).toUpperCase();

      // Deduct credits
      await update(ref(db, `users/${userId}`), {
        credits: userCredits - wager
      });

      // Create room
      const userName = auth.currentUser.displayName || 'Host';
      const userAvatar = auth.currentUser.photoURL || '';

      await set(ref(db, `rooms_liar/${roomCode}`), {
        hostId: userId,
        createdAt: Date.now(),
        status: 'waiting',
        maxRounds,
        wager,
        declarationMode: 'free',
        players: {
          [userId]: { name: userName, avatar: userAvatar, credits: userCredits - wager }
        },
        scoreboard: {
          [userId]: { points: 0, name: userName, avatar: userAvatar }
        },
        current: {
          roundNumber: 0,
          phase: 'setup'
        }
      });

      // Redirect to lobby
      router.push(`/liar/${roomCode}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (!userId) return <div>Caricamento...</div>;

  return (
    <div className="host-page">
      <h1>🎴 Crea Partita - Lucky Liar</h1>
      
      <div className="credits-display">
        Crediti disponibili: <strong>{userCredits}</strong> 💰
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleCreateRoom(); }}>
        <div className="form-group">
          <label>Numero di Round</label>
          <select value={maxRounds} onChange={(e) => setMaxRounds(Number(e.target.value))}>
            {[1, 2, 3, 5, 10].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label>Scommessa per Giocatore</label>
          <input
            type="number"
            min="10"
            max="500"
            value={wager}
            onChange={(e) => setWager(Number(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label>Wildcard Mode</label>
          <select value={wildcardMode} onChange={(e) => setWildcardMode(e.target.value)}>
            <option value="single">SINGLE (1 giocatore)</option>
            <option value="double">DOUBLE (2 giocatori)</option>
          </select>
        </div>

        <div className="cost-display">
          Costo: {wager} crediti
        </div>

        {error && <div className="error">{error}</div>}

        <button type="submit" disabled={loading || userCredits < wager}>
          {loading ? 'Creando...' : 'Crea Stanza'}
        </button>
      </form>
    </div>
  );
}
```

---

### Page 2: Lobby Page (`app/liar/[roomCode]/page.js`)
**Purpose**: Wait for players before game starts

#### Requirements
- [ ] Auth check
- [ ] Display room settings:
  - [ ] Max rounds
  - [ ] Wager
  - [ ] Declaration mode
  - [ ] Wildcard mode
- [ ] Display player list (real-time):
  - [ ] Player name
  - [ ] Avatar
  - [ ] "Ready" status
- [ ] Actions (for each player):
  - [ ] "Ready" button (toggles state)
  - [ ] "Leave" button (remove from room)
- [ ] Host-only:
  - [ ] "Start Game" button (enabled when 2+ players ready)
- [ ] Real-time sync:
  - [ ] Players added/removed
  - [ ] Ready status changes
  - [ ] Game start redirect

#### UI Elements
```
┌────────────────────────────────────────┐
│ SALA D'ATTESA 🎴 ABC123                │
├────────────────────────────────────────┤
│                                        │
│ IMPOSTAZIONI STANZA:                  │
│ • Round: 3                             │
│ • Scommessa: 50 crediti                │
│ • Modalità: Free (Natural Language)    │
│ • Wildcard: SINGLE                     │
│                                        │
│ GIOCATORI (2/4):                       │
│ ┌──────────────────────────────────┐  │
│ │ 👤 Marco (Host) ✓ Ready          │  │
│ │ 👤 Anna                           │  │
│ │ [Pronto] [Esci]                   │  │
│ └──────────────────────────────────┘  │
│                                        │
│ [AVVIA PARTITA]                        │
│                                        │
└────────────────────────────────────────┘
```

---

### Page 3: Game Page (`app/liar/game/[roomCode]/page.js`)
**Purpose**: Main gameplay (with wildcard integration)

#### Requirements
- [ ] Auth check
- [ ] Hand display (5 cards):
  - [ ] Show only to current player
  - [ ] Hide for other players
- [ ] Turn indicator:
  - [ ] Highlight current player
  - [ ] Show whose turn it is
- [ ] Declaration phase:
  - [ ] If free mode:
    - [ ] Text input with placeholder
    - [ ] Parse and validate input
  - [ ] If assisted mode:
    - [ ] Show valid next declarations as buttons
- [ ] Challenge phase:
  - [ ] **Wildcard button** (if player has wildcard):
    - [ ] Show only if available
    - [ ] Show only during challenge phase
    - [ ] Disabled if already used
  - [ ] Challenge info display
- [ ] Result display:
  - [ ] Show claim outcome
  - [ ] Show penalty
  - [ ] **Show wildcard effect** (if used):
    - [ ] Icon and color
    - [ ] Penalty before/after
    - [ ] Explanation
- [ ] Scoreboard (real-time)
- [ ] Claim history (sidebar)
- [ ] Real-time sync

#### Wildcard-Specific UI

**Wildcard Button** (if `hasAvailableWildcard(userId, wildcards)`)
```
┌─────────────────────┐
│ 🎴 Attiva Wildcard  │
│                     │
│ Disponibile! Usala  │
│ per modificare il   │
│ risultato della     │
│ sfida.              │
│                     │
│ ⚠️ Una sola volta!   │
└─────────────────────┘
```

**Wildcard Effect Display** (after challenge)
```
┌─────────────────────────────────────────┐
│ 🎴✓ Wildcard difensiva - Riduce penalità│
├─────────────────────────────────────────┤
│                                         │
│ Wildcard dichiaratore!                  │
│ Sfidante riceve una riduzione della     │
│ penalità.                               │
│                                         │
│ Penalità: 100 crediti → 50 crediti      │
│ 💰 Crediti salvati: 50                  │
│                                         │
└─────────────────────────────────────────┘
```

#### Code Template
See [GAME_PAGE_TEMPLATE.jsx](GAME_PAGE_TEMPLATE.jsx) for complete implementation

---

## Phase 3: Testing (🔲 TO DO)

### Unit Tests
- [ ] Run `window.runWildcardTests()` in console
- [ ] All 7 tests pass

### Integration Tests
- [ ] Create room (host page)
  - [ ] Room created in Firebase
  - [ ] Credits deducted
  - [ ] Redirect to lobby
- [ ] Join room (lobby page)
  - [ ] Player added to room
  - [ ] Player list updates in real-time
  - [ ] "Ready" toggle works
- [ ] Start game (game page)
  - [ ] Round initialized with wildcard
  - [ ] Hand dealt correctly
  - [ ] Turn starts with correct player

### Game Flow Tests
- [ ] Declare (free mode)
  - [ ] Input parsed correctly
  - [ ] Declaration validated
  - [ ] Turn advances
- [ ] Declare (assisted mode)
  - [ ] Buttons show valid options
  - [ ] Selected declaration applies
- [ ] Challenge
  - [ ] Challenge activates
  - [ ] Wildcard button appears (if available)
  - [ ] Wildcard activates correctly
  - [ ] Penalty calculated with wildcard
- [ ] Wildcard Effect
  - [ ] Hidden during challenge
  - [ ] Revealed in result
  - [ ] Penalty modified correctly
  - [ ] State persists

### UI/UX Tests
- [ ] Mobile responsive
- [ ] All buttons clickable
- [ ] All forms validating
- [ ] Real-time updates smooth
- [ ] No console errors

---

## QA Checklist

### Wildcard System
- [ ] Assignment: Random and fair
- [ ] Availability: Only to owner
- [ ] Visibility: Hidden during use
- [ ] Reveal: Complete after challenge
- [ ] Penalty: Calculated correctly
- [ ] State: Properly exhausted
- [ ] Reset: New wildcard next round

### Firebase
- [ ] Data structure correct
- [ ] Real-time sync working
- [ ] Rules allowing correct access
- [ ] No permission errors
- [ ] Data persistence verified

### Game Logic
- [ ] Turns advance correctly
- [ ] Claims validate properly
- [ ] Challenges resolve correctly
- [ ] Penalties applied correctly
- [ ] Rounds reset properly
- [ ] Game end detected

---

## Performance Checklist

- [ ] No memory leaks (unsubscribe properly)
- [ ] No unnecessary re-renders
- [ ] Firebase queries optimized
- [ ] Images lazy-loaded
- [ ] Bundle size acceptable
- [ ] Mobile load time < 3s

---

## Security Checklist

- [ ] Auth required on all pages
- [ ] User can only see own hand
- [ ] Credits deducted server-side
- [ ] Penalties applied server-side
- [ ] Challenge verified server-side
- [ ] No client-side tampering possible

---

## Deployment Checklist

- [ ] All code reviewed
- [ ] All tests passing
- [ ] No console errors
- [ ] No console warnings
- [ ] Environment variables set
- [ ] Firebase rules deployed
- [ ] Database structure verified
- [ ] Error handling complete
- [ ] Loading states working
- [ ] Logout functionality working

---

## Documentation Checklist

- [ ] Code commented
- [ ] README updated
- [ ] API docs complete
- [ ] User guide written
- [ ] Troubleshooting guide
- [ ] Deployment instructions

---

## Timeline Estimate

| Task | Estimated Time | Status |
|------|---|---|
| Host Page | 2 hours | 🔲 |
| Lobby Page | 2 hours | 🔲 |
| Game Page | 2 hours | 🔲 |
| Testing | 2 hours | 🔲 |
| QA/Polish | 2 hours | 🔲 |
| Deployment | 1 hour | 🔲 |
| **Total** | **11 hours** | 🔲 |

---

## Success Criteria

- ✅ All pages implemented
- ✅ All features working
- ✅ All tests passing
- ✅ All documentation complete
- ✅ No console errors
- ✅ Mobile responsive
- ✅ Fast load times
- ✅ Ready for production

---

**Start Date**: [TO BE FILLED]
**Completion Target**: [TO BE FILLED]
**Status**: 🚀 Ready to begin Phase 2

Good luck! 🎴✨

