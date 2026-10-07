// Costruisce il mazzo di "Quanto costa?" (data/prezzo/cards.json) a partire
// dalle carte scritte a mano in data/prezzo/source/<categoria>.json.
//
// Al contrario degli anni, i prezzi non si possono verificare in automatico:
// ogni carta deve dire esattamente cos'è il prezzo e quando (`note`) e dove
// lo si può controllare (`source`). Lo script controlla la forma delle carte
// e si ferma al primo dubbio, così nel mazzo non entra nulla di incompleto.
//
//   npm run deck:prezzo               tutte le categorie, scrive cards.json
//   npm run deck:prezzo -- --check    solo verifica, non scrive nulla
//   npm run deck:prezzo -- calcio     solo le categorie indicate (implica --check)
//
// Formato di una carta sorgente:
//   {
//     "id": "tecnologia-iphone-16",          opzionale, di default categoria + titolo
//     "title": "iPhone 16 (128 GB)",         domanda mostrata ai giocatori
//     "subtitle": "Apple, settembre 2024",   opzionale, aiuta a capire di cosa si parla
//     "price": 979,                          prezzo vero, nella valuta `unit`
//     "unit": "EUR",                         "EUR" oppure "USD"
//     "note": "Prezzo di listino al lancio in Italia, settembre 2024",
//     "source": "Apple Newsroom Italia"      dove si può controllare
//   }

import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PREZZO_CATEGORIES, PREZZO_UNITS } from '../src/games/prezzo.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = path.join(ROOT, 'data/prezzo/source');
const OUT_FILE = path.join(ROOT, 'data/prezzo/cards.json');

const CATEGORIES = PREZZO_CATEGORIES.map((c) => c.id);
const FIELDS = ['id', 'title', 'subtitle', 'price', 'unit', 'note', 'source'];

function slug(text) {
  return String(text).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

async function loadSources(only) {
  const files = (await readdir(SOURCE_DIR)).filter((f) => f.endsWith('.json')).sort();
  const cards = [];
  const problems = [];
  for (const file of files) {
    const category = file.replace(/\.json$/, '');
    if (!CATEGORIES.includes(category)) { problems.push(`${file}: categoria sconosciuta`); continue; }
    if (only.length && !only.includes(category)) continue;
    let list;
    try { list = JSON.parse(await readFile(path.join(SOURCE_DIR, file), 'utf8')); } catch (err) {
      problems.push(`${file}: JSON non valido (${err.message})`); continue;
    }
    if (!Array.isArray(list)) { problems.push(`${file}: deve essere un array`); continue; }
    list.forEach((c, i) => cards.push({ ...c, category, where: `${file}#${i + 1}` }));
  }
  return { cards, problems };
}

function validateShape(card) {
  const errs = [];
  for (const key of Object.keys(card)) {
    if (!FIELDS.includes(key) && key !== 'category' && key !== 'where') errs.push(`campo sconosciuto "${key}"`);
  }
  if (card.id != null && (typeof card.id !== 'string' || !/^[a-z0-9-]{3,80}$/.test(card.id))) errs.push('id non valido');
  if (typeof card.title !== 'string' || card.title.trim().length < 3) errs.push('title mancante');
  else if (card.title.length > 80) errs.push('title oltre 80 caratteri');
  if (card.subtitle != null && (typeof card.subtitle !== 'string' || !card.subtitle.trim() || card.subtitle.length > 80)) errs.push('subtitle non valido (max 80)');
  if (typeof card.price !== 'number' || !Number.isFinite(card.price) || card.price <= 0) errs.push('price deve essere un numero positivo');
  if (!PREZZO_UNITS.includes(card.unit)) errs.push(`unit deve essere ${PREZZO_UNITS.join(' o ')}`);
  if (typeof card.note !== 'string' || card.note.trim().length < 10) errs.push('note mancante (cos\'è il prezzo e quando)');
  else if (!/\b(1[5-9]|20)\d{2}\b/.test(card.note)) errs.push('la note deve dire l\'anno del prezzo');
  if (typeof card.source !== 'string' || card.source.trim().length < 3) errs.push('source mancante (dove si controlla)');
  // La domanda non deve contenere la risposta: niente simboli di valuta.
  for (const field of ['title', 'subtitle']) {
    if (typeof card[field] === 'string' && /[€$]/.test(card[field])) errs.push(`il ${field} contiene un simbolo di valuta`);
  }
  return errs;
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.filter((a) => !a.startsWith('--'));
  const checkOnly = args.includes('--check') || only.length > 0;

  const { cards, problems } = await loadSources(only);
  const seenId = new Map();
  const seenTitle = new Map();
  const out = [];
  for (const card of cards) {
    const errs = validateShape(card);
    for (const e of errs) problems.push(`${card.where} "${card.title}": ${e}`);
    if (errs.length) continue;

    const id = card.id || `${card.category}-${slug(card.title)}`;
    if (seenId.has(id)) problems.push(`${card.where}: id "${id}" già usato in ${seenId.get(id)}`);
    seenId.set(id, card.where);
    const tk = card.title.trim().toLowerCase();
    if (seenTitle.has(tk)) problems.push(`${card.where}: titolo duplicato di ${seenTitle.get(tk)}`);
    seenTitle.set(tk, card.where);

    out.push({
      id,
      category: card.category,
      title: card.title.trim(),
      subtitle: card.subtitle?.trim() || null,
      price: card.price,
      unit: card.unit,
      note: card.note.trim(),
      source: card.source.trim(),
    });
  }

  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, out.filter((x) => x.category === c).length]));
  console.log('Carte valide per categoria:', counts, `totale ${out.length}`);

  if (problems.length) {
    console.error(`\n${problems.length} problemi:`);
    for (const p of problems) console.error(' -', p);
    process.exit(1);
  }
  if (checkOnly) { console.log('Verifica ok (nessun file scritto).'); return; }

  out.sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.price - b.price || a.title.localeCompare(b.title));
  await writeFile(OUT_FILE, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`Scritto ${path.relative(ROOT, OUT_FILE)}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
