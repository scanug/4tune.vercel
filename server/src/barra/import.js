const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…',
  egrave: 'è', eacute: 'é', agrave: 'à', ugrave: 'ù', ograve: 'ò', igrave: 'ì',
  Egrave: 'È', Eacute: 'É', Agrave: 'À', Ugrave: 'Ù', Ograve: 'Ò', Igrave: 'Ì',
};

export function decodeHtml(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
      if (entity[0] === '#') {
        const hex = entity[1]?.toLowerCase() === 'x';
        const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return ENTITIES[entity] ?? match;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseTop500(html) {
  const rows = [];
  for (const row of String(html || '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => decodeHtml(cell[1]));
    const rank = Number(cells[0]);
    if (!Number.isInteger(rank) || !cells[1] || !cells[2]) continue;
    rows.push({ rank, artist: cells[1], title: cells[2] });
  }
  return rows.sort((a, b) => a.rank - b.rank);
}

export function normalizeMetadata(value) {
  return String(value || '')
    .normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function mainArtist(value) {
  return String(value || '').split(/\s+(?:FEAT\.?|FEATURING|VS\.?|X|&|,)\s+/i)[0].trim();
}

export function featuredArtists(value) {
  const match = String(value || '').match(/\bFEAT\.?\s+(.+)$/i);
  return match ? match[1].split(/\s+(?:&|X|,)\s+/i).map((name) => name.trim()).filter(Boolean) : [];
}

export function baseTitle(value) {
  return String(value || '')
    .replace(/\s*[\[(](?:feat(?:uring)?|ft\.?|with|prod\.?|remix|version|edit|20\d\d)\b.*?[\])]/gi, '')
    .replace(/\s+(?:feat(?:uring)?|ft\.?)\b.*$/i, '')
    .trim();
}

export function collectVideos(data) {
  const videos = [];
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (value.videoRenderer) videos.push(value.videoRenderer);
    for (const child of Object.values(value)) walk(child);
  }
  walk(data);
  return videos.map((video) => ({
    videoId: video.videoId,
    title: video.title?.runs?.map((run) => run.text).join('') || video.title?.simpleText || '',
    channel: video.ownerText?.runs?.[0]?.text || '',
    durationSec: parseDuration(video.lengthText?.simpleText || video.lengthText?.accessibility?.accessibilityData?.label),
  })).filter((video) => /^[\w-]{11}$/.test(video.videoId || ''));
}

export function parseDuration(value) {
  const parts = String(value || '').match(/\d+/g)?.map(Number) || [];
  if (!parts.length) return null;
  return parts.reduceRight((total, part, index) => total + part * 60 ** (parts.length - index - 1), 0);
}

export function chooseSyncedChallenge(syncedLyrics, durationSec) {
  const lines = [];
  for (const raw of String(syncedLyrics || '').split(/\r?\n/)) {
    const match = raw.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s?(.*)$/);
    if (!match) continue;
    const text = match[3].replace(/\[[^\]]*]/g, '').replace(/\s+/g, ' ').trim();
    const timeMs = Math.round((Number(match[1]) * 60 + Number(match[2])) * 1000);
    if (text) lines.push({ timeMs, text });
  }
  const candidates = [];
  for (let i = 2; i < lines.length; i++) {
    const target = lines[i];
    const startMs = lines[i - 2].timeMs;
    const stopMs = target.timeMs;
    const clipMs = stopMs - startMs;
    const words = target.text.split(' ').filter(Boolean).length;
    if (clipMs < 3500 || clipMs > 25000 || words < 2 || target.text.length < 5 || target.text.length > 180) continue;
    if (stopMs > (durationSec - 1) * 1000) continue;
    const middle = (startMs + stopMs) / 2000;
    const score = Math.abs(middle - durationSec * 0.45) + Math.abs(clipMs / 1000 - 10) * 0.2;
    candidates.push({ startMs, stopMs, answer: target.text, score });
  }
  candidates.sort((a, b) => a.score - b.score);
  if (!candidates[0]) return null;
  const { score, ...challenge } = candidates[0];
  return challenge;
}
