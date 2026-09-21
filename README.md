# 4Tune – Party Games

Giochi da festa gratuiti, senza registrazione.

- **GTS – Guess the Song**: quiz musicale online. L'host sceglie una playlist Deezer, crea una stanza e condivide un codice a 4 lettere. Le clip partono sincronizzate, il server tiene la risposta corretta e calcola i punti.
- **Impostore**: gioco dal vivo con un solo telefono che passa di mano. Non usa il server.

## Struttura

```
app/          frontend Next.js (App Router), deploy su Vercel
lib/          gameClient.js: Socket.IO + rotte HTTP del server
server/       server di gioco Node (Socket.IO), deploy su Railway
```

Il server è l'unica autorità sul gioco: stanze in memoria, timer dei round, punteggi. Non c'è database: una stanza vive finché dura la partita e un redeploy del server azzera le partite in corso.

## Sviluppo locale

Servono due terminali.

```bash
# 1. server di gioco (porta 4000)
cd server && npm install && npm run dev

# 2. frontend (porta 3000)
cp .env.local.example .env.local   # punta a http://localhost:4000
npm install && npm run dev
```

Test del motore di gioco:

```bash
npm run test:server
```

## Deploy

**Server su Render (gratuito)**: da Render scegli *New → Blueprint* e seleziona il repo: [render.yaml](render.yaml) crea il servizio con root `server`, health check su `/health` e piano free. Poi imposta la variabile:

| Variabile | Valore |
|---|---|
| `CLIENT_ORIGIN` | origin del frontend, separati da virgola (es. `https://4tune.vercel.app`) |

Il piano free si spegne dopo 15 minuti senza traffico e il primo che entra aspetta circa un minuto. Per tenerlo sempre acceso basta un ping gratuito ogni 10 minuti a `/health` (es. cron-job.org): le 750 ore mensili gratuite coprono un servizio acceso tutto il mese.

**Server su Railway**: in alternativa, nuovo servizio dal repo con *Root Directory* = `server` ([railway.json](server/railway.json)), stessa variabile `CLIENT_ORIGIN`.

**Frontend su Vercel**: variabile `NEXT_PUBLIC_GAME_SERVER_URL` = URL pubblico del server (senza slash finale).

## Eventi Socket.IO

Documentati in testa a [server/src/socket.js](server/src/socket.js). Lo stato pubblico della stanza non contiene mai la risposta corretta prima del reveal.
