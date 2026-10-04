// Costruisce il mazzo di "Indovina l'Anno" (data/anno/cards.json) a partire
// dalle carte scritte a mano in data/anno/source/<categoria>.json.
//
// Ogni carta sorgente dichiara l'anno che ci aspettiamo; lo script lo
// confronta con la data presa da Wikidata (cercando la voce della Wikipedia
// italiana) e si ferma se non coincidono. Così ogni anno del mazzo è
// confermato da due fonti: chi ha scritto la carta e Wikidata.
//
//   npm run deck                 tutte le categorie, scrive cards.json
//   npm run deck -- --check      solo verifica, non scrive nulla
//   npm run deck -- media        solo le categorie indicate (implica --check)
//
// Formato di una carta sorgente:
//   {
//     "title": "Nasce Vasco Rossi",       domanda mostrata ai giocatori
//     "subtitle": "Il Blasco",             opzionale, aiuta a capire di chi/cosa si parla
//     "wiki": "Vasco Rossi",               titolo esatto della voce su it.wikipedia.org
//     "year": 1952,                        anno atteso
//     "prop": "P569",                      opzionale: proprietà Wikidata da usare
//     "manual": "motivo"                   opzionale: Wikidata non ha la data, si usa `year`
//   }

import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = path.join(ROOT, 'data/anno/source');
const OUT_FILE = path.join(ROOT, 'data/anno/cards.json');

export const CATEGORIES = ['personaggi', 'storia', 'invenzioni', 'media', 'musica', 'sport', 'attualita'];

// Proprietà Wikidata da provare in ordine, per categoria.
//   P569 nascita · P585 data · P580 inizio · P571 fondazione/creazione
//   P575 scoperta/invenzione · P577 pubblicazione/uscita
const DEFAULT_PROPS = {
  personaggi: ['P569'],
  storia: ['P585', 'P580', 'P571'],
  invenzioni: ['P575', 'P571', 'P577', 'P585', 'P580'],
  media: ['P577', 'P571', 'P580'],
  musica: ['P577', 'P585', 'P580', 'P571'],
  sport: ['P585', 'P580', 'P577', 'P571'],
  attualita: ['P585', 'P580', 'P577', 'P571'],
};

const MIN_YEAR = 1000;
const MAX_YEAR = 2026;
const BATCH = 50;
const USER_AGENT = '4tune-anno-deck/1.0 (https://4tune.vercel.app)';

function wikiKey(title) {
  const t = String(title).trim().replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

async function fetchEntities(titles) {
  const params = new URLSearchParams({
    action: 'wbgetentities',
    sites: 'itwiki',
    titles: titles.join('|'),
    props: 'claims|descriptions|sitelinks',
    languages: 'it',
    sitefilter: 'itwiki',
    redirects: 'yes',
    format: 'json',
    maxlag: '5',
  });
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`https://www.wikidata.org/w/api.php?${params}`, { headers: { 'User-Agent': USER_AGENT } });
    const json = res.ok ? await res.json().catch(() => null) : null;
    if (json?.entities) return json.entities;
    // maxlag: Wikidata chiede di ripassare quando i suoi server sono in ritardo.
    const lagged = json?.error?.code === 'maxlag';
    if (attempt >= (lagged ? 60 : 4)) throw new Error(`Wikidata non risponde (${res.status}) ${json?.error?.info || ''}`);
    // Ritardi lunghi capitano (manutenzione, carico): si aspetta sempre di più, fino a 15s.
    await new Promise((r) => setTimeout(r, lagged ? Math.min(15000, 3000 + 1000 * attempt) : 2000 * attempt));
  }
}

// Anno più antico tra le date della proprietà (un film ha una data per paese:
// conta la prima uscita). Si scartano date deprecate e precisioni sotto l'anno.
function earliestYear(entity, prop) {
  let best = null;
  for (const claim of entity.claims?.[prop] || []) {
    if (claim.rank === 'deprecated') continue;
    const v = claim.mainsnak?.datavalue?.value;
    if (!v?.time || v.precision < 9) continue;
    const year = Number(v.time.slice(0, v.time.indexOf('-', 1)));
    if (!Number.isFinite(year)) continue;
    if (best === null || year < best) best = year;
  }
  return best;
}

function imageOf(entity) {
  const file = entity.claims?.P18?.find((c) => c.rank !== 'deprecated')?.mainsnak?.datavalue?.value;
  if (!file) return null;
  return {
    url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=480`,
    credit: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`,
  };
}

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
  if (typeof card.title !== 'string' || card.title.trim().length < 3) errs.push('title mancante');
  else if (card.title.length > 70) errs.push('title oltre 70 caratteri');
  if (card.subtitle != null && (typeof card.subtitle !== 'string' || card.subtitle.length > 60)) errs.push('subtitle non valido (max 60)');
  if (typeof card.wiki !== 'string' || !card.wiki.trim()) errs.push('wiki mancante');
  if (!Number.isInteger(card.year) || card.year < MIN_YEAR || card.year > MAX_YEAR) errs.push(`year fuori da ${MIN_YEAR}-${MAX_YEAR}`);
  if (card.prop != null && !/^P\d+$/.test(card.prop)) errs.push('prop non valida');
  if (card.title && card.year && card.title.includes(String(card.year))) errs.push('il title contiene la risposta');
  if (card.subtitle && card.year && card.subtitle.includes(String(card.year))) errs.push('il subtitle contiene la risposta');
  return errs;
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.filter((a) => !a.startsWith('--'));
  const checkOnly = args.includes('--check') || only.length > 0;

  const { cards, problems } = await loadSources(only);
  const seenWiki = new Map();
  const seenTitle = new Map();
  for (const card of cards) {
    for (const e of validateShape(card)) problems.push(`${card.where} "${card.title}": ${e}`);
    const wk = wikiKey(card.wiki || '');
    const key = `${wk}|${card.prop || ''}`;
    if (seenWiki.has(key)) problems.push(`${card.where}: voce "${wk}" già usata in ${seenWiki.get(key)}`);
    seenWiki.set(key, card.where);
    const tk = String(card.title || '').toLowerCase();
    if (seenTitle.has(tk)) problems.push(`${card.where}: titolo duplicato di ${seenTitle.get(tk)}`);
    seenTitle.set(tk, card.where);
  }

  // Wikidata, a gruppi.
  const titles = [...new Set(cards.map((c) => wikiKey(c.wiki || '')).filter(Boolean))];
  const byTitle = new Map();
  for (let i = 0; i < titles.length; i += BATCH) {
    const entities = await fetchEntities(titles.slice(i, i + BATCH));
    for (const [qid, e] of Object.entries(entities)) {
      if (e.missing !== undefined || !e.sitelinks?.itwiki) continue;
      byTitle.set(wikiKey(e.sitelinks.itwiki.title), { qid, entity: e });
    }
    // Le voci arrivate tramite redirect hanno il titolo di destinazione:
    // si riprovano una a una per collegare il titolo scritto nella carta.
    for (const t of titles.slice(i, i + BATCH)) {
      if (byTitle.has(t)) continue;
      const single = await fetchEntities([t]);
      const [qid, e] = Object.entries(single)[0] || [];
      if (e && e.missing === undefined && e.sitelinks?.itwiki) byTitle.set(t, { qid, entity: e, redirectedTo: e.sitelinks.itwiki.title });
    }
    process.stderr.write(`\rWikidata: ${Math.min(i + BATCH, titles.length)}/${titles.length}`);
  }
  process.stderr.write('\n');

  const out = [];
  const qids = new Map();
  for (const card of cards) {
    const hit = byTitle.get(wikiKey(card.wiki || ''));
    if (!hit) { problems.push(`${card.where} "${card.title}": voce it.wikipedia "${card.wiki}" non trovata`); continue; }
    const { qid, entity } = hit;

    const props = card.prop ? [card.prop] : DEFAULT_PROPS[card.category];
    let wdYear = null;
    let usedProp = null;
    for (const p of props) {
      wdYear = earliestYear(entity, p);
      if (wdYear !== null) { usedProp = p; break; }
    }

    let year;
    let source;
    if (wdYear === null) {
      if (!card.manual) {
        problems.push(`${card.where} "${card.title}": nessuna data su Wikidata (${qid}, provate ${props.join(',')}). Usa "prop" o "manual"`);
        continue;
      }
      year = card.year;
      source = 'manual';
    } else {
      if (wdYear !== card.year) {
        problems.push(`${card.where} "${card.title}": anno atteso ${card.year}, Wikidata ${usedProp} dice ${wdYear} (${qid})`);
        continue;
      }
      year = wdYear;
      source = `wikidata:${usedProp}`;
    }

    // Stessa entità e stessa data = stessa domanda. Nascita e morte della
    // stessa persona invece sono domande diverse e possono convivere.
    const dupKey = `${qid}|${usedProp || 'manual'}`;
    if (qids.has(dupKey)) { problems.push(`${card.where}: stessa domanda (${qid}, ${usedProp || 'manual'}) di ${qids.get(dupKey)}`); continue; }
    qids.set(dupKey, card.where);

    const wikiTitle = entity.sitelinks.itwiki.title;
    out.push({
      id: `${card.category}-${slug(card.title)}`,
      category: card.category,
      title: card.title.trim(),
      subtitle: card.subtitle?.trim() || null,
      year,
      description: entity.descriptions?.it?.value || null,
      image: imageOf(entity),
      wikiUrl: `https://it.wikipedia.org/wiki/${encodeURIComponent(wikiTitle.replace(/ /g, '_'))}`,
      qid,
      source,
    });
  }

  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, out.filter((x) => x.category === c).length]));
  console.log('Carte valide per categoria:', counts, `totale ${out.length}`);
  console.log(`Con foto: ${out.filter((c) => c.image).length}`);

  if (problems.length) {
    console.error(`\n${problems.length} problemi:`);
    for (const p of problems) console.error(' -', p);
    process.exit(1);
  }
  if (checkOnly) { console.log('Verifica ok (nessun file scritto).'); return; }

  const ids = new Set();
  for (const c of out) {
    let id = c.id;
    for (let n = 2; ids.has(id); n++) id = `${c.id}-${n}`;
    c.id = id;
    ids.add(id);
  }
  out.sort((a, b) => a.category.localeCompare(b.category) || a.year - b.year || a.title.localeCompare(b.title));
  await writeFile(OUT_FILE, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`Scritto ${path.relative(ROOT, OUT_FILE)}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
