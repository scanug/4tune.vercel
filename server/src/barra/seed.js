import { createHash } from 'node:crypto';

const COLLECTION_NAME = 'Top 500 hits italiane 2010-2019';
const COLLECTION_DESCRIPTION = 'Classifica Newsic: https://www.newsic.it/top-500-hits-italiane-del-decennio/';
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stableId(key) {
  const bytes = createHash('sha256').update(`4tune:barra:${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function nameKey(name) {
  return name.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function validate(entries) {
  if (!Array.isArray(entries)) throw new Error('Catalogo iniziale di Barra non valido');
  const ids = new Set();
  for (const entry of entries) {
    if (!entry?.title || !entry.artist || !YT_ID.test(entry.audioRef || '')
      || !UUID.test(entry.songId || '') || !UUID.test(entry.challengeId || '')
      || ids.has(entry.songId) || ids.has(entry.challengeId)) {
      throw new Error(`Sfida iniziale non valida o duplicata: ${entry?.title || 'senza titolo'}`);
    }
    ids.add(entry.songId);
    ids.add(entry.challengeId);
    if (!Number.isInteger(entry.startMs) || !Number.isInteger(entry.stopMs)
      || entry.startMs < 0 || entry.stopMs < entry.startMs + 1000 || entry.stopMs - entry.startMs > 60000
      || !String(entry.answer || '').trim() || String(entry.answer).length > 200) {
      throw new Error(`Tempi o risposta non validi: ${entry.title}`);
    }
  }
}

export async function seedBarraCatalog(db, entries) {
  validate(entries);
  if (!entries.length) return { songs: 0 };
  const q = (sql, params = []) => db.query(sql, params);
  const collectionId = stableId(`collection:${COLLECTION_NAME}`);
  const existing = await q('SELECT COUNT(*)::int AS count FROM barra_song_collections WHERE collection_id = $1', [collectionId]);
  if (existing.rows[0].count === entries.length) return { songs: entries.length, unchanged: true };

  await q('BEGIN');
  try {
    await q(
      `INSERT INTO barra_collections (id, name, name_key, description, is_published)
       VALUES ($1, $2, $3, $4, true) ON CONFLICT (id) DO NOTHING`,
      [collectionId, COLLECTION_NAME, nameKey(COLLECTION_NAME), COLLECTION_DESCRIPTION],
    );
    for (const entry of entries) {
      const artistId = stableId(`artist:${nameKey(entry.artist)}`);
      await q(
        'INSERT INTO barra_artists (id, name, name_key) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
        [artistId, entry.artist, nameKey(entry.artist)],
      );
      await q(
        `INSERT INTO barra_songs (
          id, title, artist_id, tags, audio_provider, audio_ref, availability_status,
          availability_checked_at, is_published, source_notes, rights_notes, lyrics_source
        ) VALUES ($1, $2, $3, $4::jsonb, 'youtube', $5, 'ok', now(), true, $6, $7, 'manual')
        ON CONFLICT (id) DO NOTHING`,
        [entry.songId, entry.title, artistId, JSON.stringify(['Top 500', `Posizione ${entry.rank}`]), entry.audioRef,
          String(entry.sourceNotes || '').slice(0, 1000), String(entry.rightsNotes || '').slice(0, 1000)],
      );
      const withoutBacking = entry.answer.replace(/\s*\([^)]*\)/g, '').trim();
      const variants = [...new Set([...(entry.acceptedVariants || []), ...(withoutBacking !== entry.answer && withoutBacking.length >= 3 ? [withoutBacking] : [])])];
      await q(
        `INSERT INTO barra_challenges (
          id, song_id, start_ms, stop_ms, answer, accepted_variants, difficulty,
          is_verified, verified_at, is_published, internal_note
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, true, now(), true, $8)
        ON CONFLICT (id) DO NOTHING`,
        [entry.challengeId, entry.songId, entry.startMs, entry.stopMs, entry.answer,
          JSON.stringify(variants), entry.difficulty || 2, `Importazione automatica; LRCLIB #${entry.lyricsId}; ${entry.videoTitle || ''}`.slice(0, 1000)],
      );
      await q(
        'INSERT INTO barra_song_collections (song_id, collection_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [entry.songId, collectionId],
      );
    }
    await q('COMMIT');
  } catch (error) {
    await q('ROLLBACK');
    throw error;
  }
  return { songs: entries.length, unchanged: false };
}
