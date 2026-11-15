// Importa le 500 hit italiane 2010-2019 di Newsic. Per ogni brano cerca un
// testo sincronizzato LRCLIB e un video YouTube con durata compatibile, verifica
// oEmbed e ricava una sfida da due versi precedenti. Non scarica audio o video.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
  baseTitle, chooseSyncedChallenge, collectVideos, featuredArtists, mainArtist, normalizeMetadata, parseTop500,
} from '../src/barra/import.js';

const CHART_URL = 'https://www.newsic.it/top-500-hits-italiane-del-decennio/';
const OUTPUT = new URL('../data/barra/top500.json', import.meta.url);
const HEADERS = { 'User-Agent': '4Tune/0.2 (https://4tune.vercel.app)' };
const args = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')));
const offset = Number(args.offset || 0);
const limit = Number(args.limit || 500);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(url, { json = true, attempts = 5 } = {}) {
  let lastError;
  const address = new URL(url);
  const headers = address.hostname === 'lrclib.net' ? HEADERS : { 'User-Agent': 'Mozilla/5.0 (compatible; 4Tune/0.2)' };
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(url, { headers, signal: controller.signal }).finally(() => clearTimeout(timer));
      if (response.status === 429 || response.status === 503) {
        const retry = Number(response.headers.get('retry-after')) || Math.min(30, 2 ** attempt);
        await sleep(retry * 1000 + Math.random() * 300);
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return json ? await response.json() : await response.text();
    } catch (error) {
      lastError = error;
      await sleep(Math.min(10000, 1000 * 2 ** attempt));
    }
  }
  const detail = lastError?.cause?.code || lastError?.cause?.message;
  throw new Error(`${address.hostname}: ${lastError?.message || 'richiesta non riuscita'}${detail ? ` (${detail})` : ''}`);
}

const SOURCE_FIXES = {
  113: { artist: 'MICHAEL FRANTI', displayArtist: 'MICHAEL FRANTI FEAT. JOVANOTTI' },
  259: { title: 'Riviera Life' },
  324: { artist: 'MÅNESKIN', displayArtist: 'MÅNESKIN' },
  377: { lyricId: 4317257, displayArtist: 'DANI FAIV, THA SUPREME & FABRI FIBRA' },
  390: { title: "Tu t'e scurdat' 'e me", displayTitle: "Tu t'e scurdat' 'e me" },
  468: { artist: 'PIERDAVIDE CARONE', displayArtist: 'PIERDAVIDE CARONE' },
  471: { lyricArtist: 'VA', lyricTitle: "Marco Carta - Necessita' lunatica" },
};
const VIDEO_FIXES = {
  48: { videoId: 'kb5S2zXMhOo', title: 'Charlie Charles - Calipso (with Dardust) ft. Sfera Ebbasta, Mahmood, Fabri Fibra', channel: 'CharlieCharlesVEVO', durationSec: 209 },
  317: { videoId: 'mt2QuQcb2oU', title: 'Rocco Hunt - Nu juorno buono (Videoclip)', channel: 'RoccoHunt', durationSec: 199 },
  377: { videoId: 'cGFd2uUj9WI', title: 'YOSHI (Prod. Strage) official', channel: 'Machete - Prod', durationSec: 211 },
  497: { videoId: '7U-nRW1BSNE', title: 'Giovanni Caccamo - Ritornerò da te', channel: 'GiovanniCaccamoVEVO', durationSec: 210 },
};

function lyricCandidates(song, records) {
  const title = normalizeMetadata(baseTitle(song.title));
  const artist = normalizeMetadata(mainArtist(song.artist));
  return records.filter((record) => record.syncedLyrics && !record.instrumental)
    .map((record) => {
      const gotTitle = normalizeMetadata(baseTitle(record.trackName));
      const gotArtist = normalizeMetadata(mainArtist(record.artistName));
      const titleScore = gotTitle === title ? 10 : gotTitle.includes(title) || title.includes(gotTitle) ? 5 : -100;
      const artistScore = gotArtist === artist ? 6 : gotArtist.includes(artist) || artist.includes(gotArtist) ? 3 : -100;
      return { record, score: titleScore + artistScore };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

function videoCandidates(song, videos) {
  const title = normalizeMetadata(baseTitle(song.title));
  const artist = normalizeMetadata(mainArtist(song.artist));
  const featured = featuredArtists(song.artist).map(normalizeMetadata);
  return videos.filter((video) => video.durationSec)
    .map((video) => {
      const fullTitle = normalizeMetadata(video.title);
      const gotTitle = normalizeMetadata(baseTitle(video.title));
      const gotArtist = normalizeMetadata(`${video.channel} ${video.title}`);
      if (!gotTitle.includes(title) && !title.includes(gotTitle)) return null;
      if (!gotArtist.includes(artist)) return null;
      const missingFeatured = featured.filter((name) => !gotArtist.includes(name));
      if (missingFeatured.length && /\b(?:feat|ft)\b/.test(fullTitle)) return null;
      let score = missingFeatured.length * 8;
      if (/\b(live|cover|karaoke|reaction|tutorial)\b/.test(gotTitle)) score += 60;
      if (/\bofficial\b|\bvideo ufficiale\b|\baudio\b/.test(gotTitle)) score -= 4;
      if (/vevo/.test(normalizeMetadata(video.channel))) score -= 3;
      if (gotTitle === title) score -= 3;
      return { video, score };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score)
    .slice(0, 10);
}

async function findLyrics(originalSong) {
  const fix = SOURCE_FIXES[originalSong.rank] || {};
  const song = {
    ...originalSong,
    artist: fix.lyricArtist || fix.artist || originalSong.artist,
    title: fix.lyricTitle || fix.title || originalSong.title,
  };
  const artist = mainArtist(song.artist);
  if (fix.lyricId) {
    const record = await request(`https://lrclib.net/api/get/${fix.lyricId}`);
    await sleep(300);
    return lyricCandidates(song, [record]);
  }
  const query = new URL('https://lrclib.net/api/search');
  query.searchParams.set('track_name', song.title);
  query.searchParams.set('artist_name', artist);
  const records = await request(query);
  await sleep(300);
  let matches = lyricCandidates(song, Array.isArray(records) ? records : []);
  if (matches.length) return matches;
  const broadQuery = new URL('https://lrclib.net/api/search');
  broadQuery.searchParams.set('q', `${artist} ${song.title}`);
  const broadRecords = await request(broadQuery);
  await sleep(300);
  return lyricCandidates(song, Array.isArray(broadRecords) ? broadRecords : []);
}

async function findVideos(originalSong, suffix) {
  const fix = SOURCE_FIXES[originalSong.rank] || {};
  const song = { ...originalSong, artist: fix.artist || originalSong.artist, title: fix.title || originalSong.title };
  const terms = `${mainArtist(song.artist)} ${song.title}${suffix ? ` ${suffix}` : ''}`;
  const search = `https://www.youtube.com/results?search_query=${encodeURIComponent(terms)}`;
  const html = await request(search, { json: false });
  const match = html.match(/ytInitialData\s*=\s*(\{.+?\});<\/script>/s);
  if (!match) throw new Error('risultati YouTube non leggibili');
  return videoCandidates(song, collectVideos(JSON.parse(match[1])));
}

async function importSong(song) {
  const lyrics = await findLyrics(song);
  if (!lyrics.length) throw new Error('nessun testo sincronizzato corrispondente');
  let videos = [];
  let videoError;
  for (const suffix of ['official', '', 'video ufficiale']) {
    try {
      videos = await findVideos(song, suffix);
      if (videos.length) break;
    } catch (error) { videoError = error; }
  }
  if (!videos.length && VIDEO_FIXES[song.rank]) videos = [{ video: VIDEO_FIXES[song.rank], score: 0 }];
  if (!videos.length) throw videoError || new Error('nessun video corrispondente');

  const pairs = [];
  for (const lyric of lyrics) {
    for (const item of videos) {
      const difference = Math.abs(lyric.record.duration - item.video.durationSec);
      if (difference > 10) continue;
      const challenge = chooseSyncedChallenge(lyric.record.syncedLyrics, item.video.durationSec);
      if (challenge) pairs.push({ ...lyric, ...item, challenge, difference, score: item.score + difference * 1.5 - lyric.score });
    }
  }
  pairs.sort((a, b) => a.score - b.score);
  const best = pairs[0];
  if (!best) throw new Error('nessuna coppia audio/testo con durata e versi compatibili');

  const watchUrl = `https://www.youtube.com/watch?v=${best.video.videoId}`;
  const embed = new URL('https://www.youtube.com/oembed');
  embed.searchParams.set('format', 'json');
  embed.searchParams.set('url', watchUrl);
  await request(embed);
  const fix = SOURCE_FIXES[song.rank] || {};
  return {
    rank: song.rank,
    title: fix.displayTitle || song.title,
    artist: fix.displayArtist || song.artist,
    audioRef: best.video.videoId,
    startMs: best.challenge.startMs,
    stopMs: best.challenge.stopMs,
    answer: best.challenge.answer,
    acceptedVariants: [],
    difficulty: song.rank <= 100 ? 1 : song.rank <= 300 ? 2 : 3,
    songId: randomUUID(),
    challengeId: randomUUID(),
    lyricsId: best.record.id,
    videoTitle: best.video.title,
    videoDuration: best.video.durationSec,
    sourceNotes: song.rank <= 500
      ? `Posizione ${song.rank} nella Top 500 hits italiane 2010-2019 di Newsic; testo sincronizzato LRCLIB #${best.record.id}`
      : `Hit italiana integrativa del decennio 2010-2019; testo sincronizzato LRCLIB #${best.record.id}`,
    rightsNotes: 'Audio tramite player YouTube ufficiale; breve continuazione ottenuta da LRCLIB',
  };
}

const html = await request(CHART_URL, { json: false });
const chart = parseTop500(html);
if (chart.length !== 500) throw new Error(`La classifica contiene ${chart.length} posizioni invece di 500`);
await mkdir(new URL('../data/barra/', import.meta.url), { recursive: true });
let imported = [];
try { imported = args.fresh ? [] : JSON.parse(await readFile(OUTPUT, 'utf8')); } catch {}
imported = imported.map((entry) => {
  const fix = SOURCE_FIXES[entry.rank] || {};
  return { ...entry, artist: fix.displayArtist || entry.artist, title: fix.displayTitle || entry.title };
});
await writeFile(OUTPUT, `${JSON.stringify(imported, null, 2)}\n`);
const known = new Set(imported.map((song) => `${normalizeMetadata(song.artist)}:${normalizeMetadata(song.title)}`));
const knownRanks = new Set(imported.map((song) => song.rank));
const selected = chart.slice(offset, offset + limit);
let failed = 0;
for (const [index, song] of selected.entries()) {
  const key = `${normalizeMetadata(song.artist)}:${normalizeMetadata(song.title)}`;
  if (known.has(key) || knownRanks.has(song.rank)) {
    console.log(`${index + offset + 1}/${selected.length + offset} già importata: ${song.artist} – ${song.title}`);
    continue;
  }
  try {
    const result = await importSong(song);
    imported.push(result);
    known.add(key);
    imported.sort((a, b) => a.rank - b.rank);
    await writeFile(OUTPUT, `${JSON.stringify(imported, null, 2)}\n`);
    console.log(`${song.rank}/500 OK ${song.artist} – ${song.title} [${result.audioRef}] (${imported.length} totali)`);
  } catch (error) {
    failed += 1;
    console.error(`${song.rank}/500 SCARTATA ${song.artist} – ${song.title}: ${error.message}`);
  }
}
if (offset === 0 && limit === 500 && imported.length < 500) {
  const supplements = [{ rank: 501, artist: 'NINA ZILLI', title: '50mila' }];
  for (const song of supplements) {
    if (imported.length >= 500) break;
    const key = `${normalizeMetadata(song.artist)}:${normalizeMetadata(song.title)}`;
    if (known.has(key)) continue;
    try {
      const result = await importSong(song);
      imported.push(result);
      known.add(key);
      imported.sort((a, b) => a.rank - b.rank);
      await writeFile(OUTPUT, `${JSON.stringify(imported, null, 2)}\n`);
      console.log(`INTEGRATIVA OK ${song.artist} – ${song.title} [${result.audioRef}] (${imported.length} totali)`);
    } catch (error) {
      failed += 1;
      console.error(`INTEGRATIVA SCARTATA ${song.artist} – ${song.title}: ${error.message}`);
    }
  }
}
console.log(`Importate ${imported.length}; scartate in questa esecuzione: ${failed}`);
