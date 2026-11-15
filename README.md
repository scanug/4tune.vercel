# 4Tune – Party Games

Giochi da festa gratuiti, senza registrazione.

- **GTS – Guess the Song**: quiz musicale online. L'host sceglie una playlist Deezer, crea una stanza e condivide un codice a 4 lettere. Le clip partono sincronizzate, il server tiene la risposta corretta e calcola i punti.
- **Indovina l'Anno**: quiz online sugli anni. Ogni round esce una carta ("Nasce Vasco Rossi", "Esce al cinema Titanic") e ognuno sceglie l'anno dal suo telefono con uno slider: chi si avvicina di più vince il round. Sette categorie (personaggi, storia, invenzioni, film/serie/videogiochi, musica, sport, attualità) e quasi 1300 carte, ogni anno verificato su Wikidata.
- **L'Anno del Giorno**: la versione single player in stile Wordle. Ogni giorno (da mezzanotte, ora italiana) escono 10 carte uguali per tutti, una per categoria più tre extra; si gioca col proprio nickname riservato e si entra nella classifica del giorno e in quella di sempre. Si può rigiocare per allenarsi, ma conta solo il primo tentativo.
- **Abisso**: sfida quotidiana di risposte rare. Sette domande uguali per tutti e 25 secondi ciascuna: una risposta valida vale da 10 a 100 punti in base a quanti l'hanno scelta, ogni punto fa scendere di 10 metri e il fondo è a 7.000 metri. Una sola immersione ufficiale al giorno, con classifica e statistiche.
- **Quanto costa?**: quiz online sui prezzi, con lo stesso meccanismo di Indovina l'Anno. Ogni round esce una carta ("Un caffè al banco", "iPhone 16 al lancio", "Il PSG compra Neymar") e ognuno sceglie il prezzo con uno slider in scala logaritmica: vince chi si avvicina di più in proporzione. Sette categorie (spesa, tecnologia, vita quotidiana, calciomercato, affari miliardari, cinema, aste da record), 183 carte, ognuna con la nota su cosa indica il prezzo e la fonte.
- **Completa la barra**: quiz musicale online sui testi. Tutti ascoltano lo stesso frammento di una canzone (player YouTube ufficiale, visibile); la musica si ferma prima della frase successiva e ognuno scrive come continua. 100 punti per risposta esatta, bonus velocità facoltativo fino a +20 a scaglioni. Le risposte si confrontano dopo una normalizzazione prevedibile (maiuscole, punteggiatura, apostrofi, Unicode) con la soluzione e le varianti accettate: niente somiglianze approssimative. Il catalogo (brani, sfide, artisti, generi, raccolte) si gestisce da `/barra/admin`. Dettagli più sotto.
- **Impostore**: gioco dal vivo con un solo telefono che passa di mano. Non usa il server.
- **Passa la Bomba**: anche questo con un solo telefono e senza server. Esce una categoria o una sillaba, ognuno dice una parola e passa il telefono; la miccia dura un tempo casuale nascosto e chi ha in mano la bomba quando scoppia perde il round. I nomi dei giocatori sono facoltativi e servono solo per contare le esplosioni. Si possono scrivere categorie o sillabe proprie, da usare insieme a quelle incluse o al loro posto.

Dalla home, il tasto in basso a destra apre la **Sala 3D** (`/sala`): una stanza in three.js con un cabinato arcade per ogni gioco, ognuno con il suo modellino voxel (l'icona del gioco in 3D) e le statistiche personali di chi gioca. Con ◀ ▶, le frecce da tastiera o un tocco sul cabinato la camera vola da un gioco all'altro. three.js si carica solo quando si apre la Sala.

Le **statistiche personali** ([lib/stats.js](lib/stats.js)) restano nel browser, senza account: le pagine dei giochi le salvano a fine partita (podio di GTS e Indovina l'Anno, sfida completata dell'Anno del Giorno, round e partite di Impostore, esplosioni della Bomba) e una partita conta una volta sola anche se si ricarica la pagina.

I **trofei** ([lib/trophies.js](lib/trophies.js)) sono 10 per gioco (bronzo, argento, oro, platino), ognuno legato a una statistica e a una soglia (es. "Vinci 5 partite di fila"). Quando se ne sblocca uno compare un avviso con fanfara e l'obiettivo raggiunto; nella Sala le coppe girano intorno al modellino del cabinato e il pannello mostra, per ogni trofeo, l'obiettivo e la data di sblocco oppure a che punto si è. Gli id dei trofei già esistenti non vanno cambiati, altrimenti chi li ha sbloccati li perde.

La **sveglia del server** ([lib/serverWake.js](lib/serverWake.js)): il piano gratuito di Render spegne il server dopo 15 minuti senza traffico. La home e le pagine online lo chiamano in anticipo su `/health`; se non risponde entro un secondo e mezzo compare una schermata (un banner nelle pagine di menu) che spiega l'attesa con una barra di caricamento.

La **musica 16-bit** ([lib/chiptune.js](lib/chiptune.js)) è generata con WebAudio, senza file audio: un brano per home e menu, uno per la Sala. Parte al primo tocco (i browser non permettono l'autoplay), tace dentro le partite e si silenzia con il tasto in basso a sinistra; il tasto muto vale anche per gli effetti della Bomba e la scelta resta salvata.

Il catalogo dei giochi (titolo, descrizione breve, icona, colore) sta in [lib/games.js](lib/games.js); le icone pixel art 16x16 in [components/PixelIcon.js](components/PixelIcon.js).

## Struttura

```
app/          frontend Next.js (App Router), deploy su Vercel
lib/          gameClient.js: Socket.IO + rotte HTTP del server
server/       server di gioco Node (Socket.IO), deploy su Render
```

Il server è l'unica autorità sul gioco: stanze in memoria, timer dei round, punteggi. Le stanze non usano database: una stanza vive finché dura la partita e un redeploy del server azzera le partite in corso. L'Anno del Giorno e Abisso salvano su Postgres (Neon) nickname, sfide e punteggi; le tabelle le crea il server da solo all'avvio e il browser non parla mai col database. In locale, senza `DATABASE_URL`, il server usa un Postgres in memoria (PGlite) che si azzera al riavvio.

## Abisso

Il mazzo sta in `server/data/abisso/prompts.json`: le 42 domande contengono 1.719 risposte canoniche (da 24 a 54 per domanda) e oltre 100 alias. Il server normalizza maiuscole, accenti, spazi e punteggiatura e accetta solo risposte presenti nell'elenco. Le sette domande del giorno si scelgono una volta sola e non si ripetono finché il mazzo contiene domande nuove.

Il motore ([server/src/abisso/service.js](server/src/abisso/service.js)) conserva la scadenza della domanda: ricaricare o uscire non regala tempo. Le risposte in ogni domanda sono ordinate dalla più prevedibile alla più originale: il classificatore trasforma quest'ordine in una distribuzione iniziale, così anche il primo giocatore ottiene punteggi diversi. La stima equivale a 60 giocatori e viene corretta progressivamente dalle risposte reali del giorno. I punti già assegnati non cambiano quando arrivano nuove risposte. Rotte: `/abisso/today`, `/abisso/start`, `/abisso/answer`, `/abisso/review`, `/abisso/leaderboard` e `/abisso/stats`.

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

## Mazzo di Quanto costa?

Le carte si scrivono a mano in `server/data/prezzo/source/<categoria>.json`. I prezzi non si possono verificare in automatico come gli anni: ogni carta ha una `note` (cosa indica il prezzo e quando) e una `source` (dove controllarlo). Lo script controlla campi, valute (EUR o USD), id e titoli unici, poi genera `server/data/prezzo/cards.json`, che va committato.

```bash
cd server
npm run deck:prezzo
```

## Completa la barra

Il gioco gira sul namespace Socket.IO `/barra` con un `BarraRoomManager` ([server/src/barra/rooms.js](server/src/barra/rooms.js)) che estende il gestore comune. Ogni round passa per `preparing` (il server sceglie la sfida, i telefoni caricano il video e rispondono "pronto"), `countdown`, `listening`, `answering` e `reveal`. La soluzione resta nella memoria del server e compare nello stato pubblico solo al reveal. Il bonus velocità usa il tempo di ricezione del server.

Il catalogo sta su Postgres, nello stesso database dell'Anno del Giorno; le tabelle `barra_*` le crea il server all'avvio. In locale, senza `DATABASE_URL`, il catalogo è in memoria e si azzera al riavvio. In gioco entrano solo le sfide **verificate e pubblicate** di brani pubblicati, con audio associato e non segnati come non disponibili. Modificare tempi, risposta o varianti di una sfida toglie verifica e pubblicazione.

Il catalogo iniziale `server/data/barra/top500.json` segue la classifica Newsic delle 500 hit italiane 2010-2019, con hit integrative dello stesso decennio se manca un testo sincronizzato utilizzabile. `npm --prefix server run import:barra` recupera i testi sincronizzati da LRCLIB e cerca video YouTube con artista, titolo e durata compatibili, verificando oEmbed prima di creare ogni sfida. Il file viene salvato progressivamente e rilanciare il comando salta i brani già importati. All'avvio il server inserisce le sfide una sola volta, senza sovrascrivere le modifiche successive. I controlli automatici non sostituiscono l'ascolto del frammento nella gestione.

**Gestione** (`/barra/admin`): si entra con il codice `ADMIN_TOKEN` impostato sul server. Senza `ADMIN_TOKEN` la gestione è spenta. Per il primo brano:

1. scheda "Artisti, generi, raccolte": aggiungi artista, genere e, se vuoi, una raccolta;
2. "+ Nuovo brano": titolo, artista, link YouTube (premi **Verifica**), provenienza e autorizzazione (obbligatoria per pubblicare), "Brano pubblicato", **Salva brano**;
3. "Nuova sfida": inizio e interruzione (`m:ss.cc`, ±0,25 s o "dal player"), **Prova esattamente il frammento** finché il taglio è giusto, poi continuazione corretta, varianti (una per riga) e difficoltà;
4. **Aggiungi sfida**, **Segna verificata**, **Pubblica**.

**Sorgenti audio**:
- **YouTube** (predefinita): player ufficiale incorporato e sempre visibile, con il taglio fatto dal client (circa 50 ms di precisione, non garantita). La disponibilità si controlla con oEmbed, senza chiave: rileva i video rimossi o non incorporabili, non i blocchi regionali.
- **Deezer**: la preview è di 30 secondi, scelta da Deezer, e l'API non dice da che punto del brano parte. Con Deezer i tempi delle sfide sono quindi relativi alla preview.

**Musixmatch** (facoltativo, `MUSIXMATCH_API_KEY`): ricerca brano, testo e testo sincronizzato nella gestione, solo lato server. Il pannello distingue "predisposta" da "attiva" con una chiamata reale. Il testo sincronizzato suggerisce i tempi, ma vanno sempre provati sul video. I testi non vengono salvati.

```bash
cd server
SERVER=http://localhost:4000 ADMIN_TOKEN=... npm run smoke:barra   # partita di prova end-to-end (crea e cancella un brano)
```

## Deploy

**Server su Render (gratuito)**: da Render scegli *New → Blueprint* e seleziona il repo: [render.yaml](render.yaml) crea il servizio con root `server`, health check su `/health` e piano free. Poi imposta la variabile:

| Variabile | Valore |
|---|---|
| `CLIENT_ORIGIN` | origin del frontend, separati da virgola (es. `https://4tune.vercel.app`) |
| `DATABASE_URL` | stringa di connessione Postgres di Neon (Vercel → Storage → il database → `.env.local`/Quickstart), serve all'Anno del Giorno e al catalogo di Completa la barra |
| `ADMIN_TOKEN` | codice lungo e casuale per la gestione del catalogo di Completa la barra (vuoto = gestione spenta) |
| `MUSIXMATCH_API_KEY` | facoltativa, ricerca testi nella gestione di Completa la barra |

Il piano free si spegne dopo 15 minuti senza traffico e il primo che entra aspetta circa un minuto. Per tenerlo sempre acceso basta un ping gratuito ogni 10 minuti a `/health` (es. cron-job.org): le 750 ore mensili gratuite coprono un servizio acceso tutto il mese.

**Server su Railway**: in alternativa, nuovo servizio dal repo con *Root Directory* = `server` ([railway.json](server/railway.json)), stessa variabile `CLIENT_ORIGIN`.

**Frontend su Vercel**: variabile `NEXT_PUBLIC_GAME_SERVER_URL` = URL pubblico del server (senza slash finale).

## Eventi Socket.IO

Documentati in testa a [server/src/socket.js](server/src/socket.js). Lo stato pubblico della stanza non contiene mai la risposta corretta prima del reveal.
