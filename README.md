# 4Tune – Party Games

Giochi da festa gratuiti, senza registrazione.

- **GTS – Guess the Song**: quiz musicale online. L'host sceglie una playlist Deezer, crea una stanza e condivide un codice a 4 lettere. Le clip partono sincronizzate, il server tiene la risposta corretta e calcola i punti.
- **Indovina l'Anno**: quiz online sugli anni. Ogni round esce una carta ("Nasce Vasco Rossi", "Esce al cinema Titanic") e ognuno sceglie l'anno dal suo telefono con uno slider: chi si avvicina di più vince il round. Cinque categorie (personaggi, storia, invenzioni, film/album/videogiochi, attualità) e quasi 600 carte, ogni anno verificato su Wikidata.
- **L'Anno del Giorno**: la versione single player in stile Wordle. Ogni giorno (da mezzanotte, ora italiana) escono 10 carte uguali per tutti; si gioca col proprio nickname riservato e si entra nella classifica del giorno e in quella di sempre. Si può rigiocare per allenarsi, ma conta solo il primo tentativo.
- **Impostore**: gioco dal vivo con un solo telefono che passa di mano. Non usa il server.

## Struttura

```
app/          frontend Next.js (App Router), deploy su Vercel
lib/          gameClient.js: Socket.IO + rotte HTTP del server
server/       server di gioco Node (Socket.IO), deploy su Render
```

Il server è l'unica autorità sul gioco: stanze in memoria, timer dei round, punteggi. Le stanze non usano database: una stanza vive finché dura la partita e un redeploy del server azzera le partite in corso. Solo l'Anno del Giorno salva su Postgres (Neon) nickname, sfide e punteggi; le tabelle le crea il server da solo all'avvio e il browser non parla mai col database. In locale, senza `DATABASE_URL`, il server usa un Postgres in memoria (PGlite) che si azzera al riavvio.

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

## Mazzo di Indovina l'Anno

Le carte si scrivono a mano in `server/data/anno/source/<categoria>.json` (formato descritto in testa a [server/scripts/build-anno-deck.mjs](server/scripts/build-anno-deck.mjs)). Lo script cerca ogni carta su Wikidata e confronta l'anno scritto con quello ufficiale. Se non coincidono si ferma; se coincidono genera `server/data/anno/cards.json`, che è il file letto dal server e va committato.

```bash
cd server
npm run deck -- media   # verifica solo una categoria, non scrive nulla
npm run deck            # verifica tutto e rigenera cards.json
```

Foto e descrizioni arrivano da Wikidata e Wikimedia Commons; la foto si vede solo al reveal e rimanda alla sua pagina su Commons (autore e licenza).

## Deploy

**Server su Render (gratuito)**: da Render scegli *New → Blueprint* e seleziona il repo: [render.yaml](render.yaml) crea il servizio con root `server`, health check su `/health` e piano free. Poi imposta la variabile:

| Variabile | Valore |
|---|---|
| `CLIENT_ORIGIN` | origin del frontend, separati da virgola (es. `https://4tune.vercel.app`) |
| `DATABASE_URL` | stringa di connessione Postgres di Neon (Vercel → Storage → il database → `.env.local`/Quickstart), serve all'Anno del Giorno |

Il piano free si spegne dopo 15 minuti senza traffico e il primo che entra aspetta circa un minuto. Per tenerlo sempre acceso basta un ping gratuito ogni 10 minuti a `/health` (es. cron-job.org): le 750 ore mensili gratuite coprono un servizio acceso tutto il mese.

**Server su Railway**: in alternativa, nuovo servizio dal repo con *Root Directory* = `server` ([railway.json](server/railway.json)), stessa variabile `CLIENT_ORIGIN`.

**Frontend su Vercel**: variabile `NEXT_PUBLIC_GAME_SERVER_URL` = URL pubblico del server (senza slash finale).

## Eventi Socket.IO

Documentati in testa a [server/src/socket.js](server/src/socket.js). Lo stato pubblico della stanza non contiene mai la risposta corretta prima del reveal.
