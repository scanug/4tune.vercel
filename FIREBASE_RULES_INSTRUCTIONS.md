# Istruzioni per applicare le regole Firebase

## Problema risolto: PERMISSION_DENIED su "Avvia partita"

Il file `database.rules.json` contiene le regole Firebase aggiornate che risolvono il problema di PERMISSION_DENIED.

## Come applicare le regole

1. Apri la [Console Firebase](https://console.firebase.google.com/)
2. Seleziona il tuo progetto
3. Vai su **Realtime Database** → **Regole** (o **Rules**)
4. Copia il contenuto del file `database.rules.json`
5. Incolla nella console Firebase
6. Clicca **Pubblica** (o **Publish**)

## Modifiche principali

- ✅ Aggiunta regola esplicita per `startedAt` con validazione numerica
- ✅ Aggiunta regola per `phase`, `betEndTime`, `maxRounds`, `betTimeSeconds`
- ✅ Aggiunta regola per `winningNumber`, `winningNumbers`, `roundResults`, `sideBetResults`
- ✅ Regole migliorate per `players` (permesso anche all'host di scrivere)
- ✅ Regole per `bets` e `sideBets` (solo il proprietario può scrivere)

## Debug nel codice

Il codice ora include logging dettagliato:

- `startGame()`: log di uid vs hostId
- `startRound()`: log di uid vs hostId  
- `nextRound()`: log di uid vs hostId
- `createRoom()`: log dell'hostId salvato

Controlla la console del browser per vedere i log quando si verifica un errore PERMISSION_DENIED.

## Verifica rapida

Dopo aver applicato le regole, verifica:

1. `rooms/<code>/hostId` deve essere uguale all'UID dell'utente che clicca "Avvia"
2. Dopo il click, devono comparire:
   - `status: "playing"`
   - `startedAt: <timestamp>`
   - `round: 1`
   - `currentRange: {min:1, max:10}`

Se persistono problemi, controlla i log nella console del browser per vedere se uid ≠ hostId.

