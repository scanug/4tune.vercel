// Catalogo di "Completa la barra": brani, sfide e la loro organizzazione
// (artisti, generi, raccolte). Sta su Postgres insieme all'Anno del Giorno e
// lo usa solo il server: le soluzioni non escono mai da qui prima del reveal.
//
// `db` è qualunque oggetto con `query(text, params) → { rows }`: un Pool di
// `pg` in produzione, PGlite nei test e in sviluppo.

import { randomUUID } from 'node:crypto';
import { GameError } from '../engine.js';
import { DEEZER_PREVIEW_MS, parseYouTubeId } from './providers.js';
import { seedBarraCatalog } from './seed.js';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS barra_artists (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    name_key text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS barra_genres (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    name_key text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS barra_collections (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    name_key text NOT NULL UNIQUE,
    description text,
    is_published boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS barra_songs (
    id uuid PRIMARY KEY,
    title text NOT NULL,
    artist_id uuid NOT NULL REFERENCES barra_artists(id),
    genre_id uuid REFERENCES barra_genres(id) ON DELETE SET NULL,
    tags jsonb NOT NULL DEFAULT '[]'::jsonb,
    audio_provider text NOT NULL DEFAULT 'youtube' CHECK (audio_provider IN ('youtube', 'deezer')),
    audio_ref text,
    deezer_track_id bigint,
    musixmatch_track_id bigint,
    availability_status text NOT NULL DEFAULT 'unchecked' CHECK (availability_status IN ('unchecked', 'ok', 'unavailable')),
    availability_note text,
    availability_checked_at timestamptz,
    playback_error_count integer NOT NULL DEFAULT 0,
    is_published boolean NOT NULL DEFAULT false,
    source_notes text,
    rights_notes text,
    lyrics_source text NOT NULL DEFAULT 'manual' CHECK (lyrics_source IN ('manual', 'musixmatch')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS barra_song_collections (
    song_id uuid NOT NULL REFERENCES barra_songs(id) ON DELETE CASCADE,
    collection_id uuid NOT NULL REFERENCES barra_collections(id) ON DELETE CASCADE,
    PRIMARY KEY (song_id, collection_id)
  )`,
  `CREATE TABLE IF NOT EXISTS barra_challenges (
    id uuid PRIMARY KEY,
    song_id uuid NOT NULL REFERENCES barra_songs(id) ON DELETE CASCADE,
    start_ms integer NOT NULL CHECK (start_ms >= 0),
    stop_ms integer NOT NULL,
    answer text NOT NULL DEFAULT '',
    accepted_variants jsonb NOT NULL DEFAULT '[]'::jsonb,
    difficulty smallint NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 3),
    internal_note text,
    is_verified boolean NOT NULL DEFAULT false,
    verified_at timestamptz,
    is_published boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (stop_ms >= start_ms + 1000 AND stop_ms - start_ms <= 60000),
    CHECK (NOT is_published OR (is_verified AND length(trim(answer)) > 0))
  )`,
  `CREATE INDEX IF NOT EXISTS barra_challenges_song ON barra_challenges (song_id)`,
];

const NAMED = {
  artist: 'barra_artists',
  genre: 'barra_genres',
  collection: 'barra_collections',
};

function bad(message) {
  return new GameError(message, 'invalid');
}

function text(v, max = 500) {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
}

function positiveInt(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuidOrNull(v) {
  return typeof v === 'string' && UUID.test(v) ? v : null;
}

function nameKey(name) {
  return name.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

function songRow(r) {
  return {
    ...r,
    tags: asArray(r.tags),
    deezer_track_id: r.deezer_track_id == null ? null : Number(r.deezer_track_id),
    musixmatch_track_id: r.musixmatch_track_id == null ? null : Number(r.musixmatch_track_id),
  };
}

function challengeRow(r) {
  return { ...r, accepted_variants: asArray(r.accepted_variants), difficulty: Number(r.difficulty) };
}

export function createCatalog({ db }) {
  const q = (sql, params = []) => db.query(sql, params);

  async function init() {
    for (const sql of SCHEMA) await q(sql);
  }

  async function seed(entries) {
    return seedBarraCatalog(db, entries);
  }

  // ---------- gioco ----------

  // Sfide giocabili: pubblicate e verificate, di brani pubblicati, con audio
  // associato e non segnati come non disponibili. I filtri si sommano (OR).
  async function listCandidates(filters = {}) {
    const { rows } = await q(
      `SELECT c.id, c.song_id, s.artist_id, s.genre_id,
              COALESCE(array_to_json(array_agg(sc.collection_id) FILTER (WHERE sc.collection_id IS NOT NULL)), '[]'::json) AS collection_ids
         FROM barra_challenges c
         JOIN barra_songs s ON s.id = c.song_id
         LEFT JOIN barra_song_collections sc ON sc.song_id = s.id
        WHERE c.is_published AND c.is_verified AND s.is_published
          AND s.availability_status <> 'unavailable' AND s.audio_ref IS NOT NULL
        GROUP BY c.id, c.song_id, s.artist_id, s.genre_id`,
    );
    const { collectionIds = [], genreIds = [], artistIds = [] } = filters;
    const any = collectionIds.length + genreIds.length + artistIds.length > 0;
    return rows
      .filter((r) => {
        if (!any) return true;
        const cols = asArray(r.collection_ids);
        return artistIds.includes(r.artist_id) || genreIds.includes(r.genre_id) || cols.some((id) => collectionIds.includes(id));
      })
      .map((r) => ({ id: r.id, songId: r.song_id }));
  }

  // Opzioni per i filtri della stanza, con quanti brani giocabili ha ciascuna.
  async function filterOptions() {
    const { rows } = await q(
      `SELECT DISTINCT s.id AS song_id, s.artist_id, s.genre_id, sc.collection_id
         FROM barra_challenges c
         JOIN barra_songs s ON s.id = c.song_id
         LEFT JOIN barra_song_collections sc ON sc.song_id = s.id
        WHERE c.is_published AND c.is_verified AND s.is_published
          AND s.availability_status <> 'unavailable' AND s.audio_ref IS NOT NULL`,
    );
    const count = (key) => {
      const m = new Map();
      for (const r of rows) {
        if (!r[key]) continue;
        if (!m.has(r[key])) m.set(r[key], new Set());
        m.get(r[key]).add(r.song_id);
      }
      return m;
    };
    const by = { artist: count('artist_id'), genre: count('genre_id'), collection: count('collection_id') };
    const [artists, genres, collections] = await Promise.all([
      q('SELECT id, name FROM barra_artists ORDER BY name'),
      q('SELECT id, name FROM barra_genres ORDER BY name'),
      q('SELECT id, name, description FROM barra_collections WHERE is_published ORDER BY name'),
    ]);
    const withCount = (list, map) => list.rows
      .map((r) => ({ ...r, songs: map.get(r.id)?.size || 0 }))
      .filter((r) => r.songs > 0);
    return {
      collections: withCount(collections, by.collection),
      genres: withCount(genres, by.genre),
      artists: withCount(artists, by.artist),
    };
  }

  async function getChallenge(id) {
    const { rows } = await q(
      `SELECT c.*, s.title, s.audio_provider, s.audio_ref, a.name AS artist_name
         FROM barra_challenges c
         JOIN barra_songs s ON s.id = c.song_id
         JOIN barra_artists a ON a.id = s.artist_id
        WHERE c.id = $1`,
      [id],
    );
    if (!rows[0]) return null;
    const r = challengeRow(rows[0]);
    return {
      challenge: {
        id: r.id, song_id: r.song_id, start_ms: r.start_ms, stop_ms: r.stop_ms,
        answer: r.answer, accepted_variants: r.accepted_variants, difficulty: r.difficulty,
      },
      song: { id: r.song_id, title: r.title, artist_name: r.artist_name, audio_provider: r.audio_provider, audio_ref: r.audio_ref },
    };
  }

  async function reportSongError(songId, reason, markUnavailable) {
    await q(
      `UPDATE barra_songs SET playback_error_count = playback_error_count + 1, availability_note = $2,
              availability_status = CASE WHEN $3 THEN 'unavailable' ELSE availability_status END,
              availability_checked_at = CASE WHEN $3 THEN now() ELSE availability_checked_at END
        WHERE id = $1`,
      [songId, String(reason || '').slice(0, 300), !!markUnavailable],
    );
  }

  // ---------- gestione ----------

  async function loadAll() {
    const [artists, genres, collections, songs, links, challenges] = await Promise.all([
      q('SELECT id, name FROM barra_artists ORDER BY name'),
      q('SELECT id, name FROM barra_genres ORDER BY name'),
      q('SELECT id, name, description, is_published FROM barra_collections ORDER BY name'),
      q('SELECT * FROM barra_songs ORDER BY created_at DESC'),
      q('SELECT song_id, collection_id FROM barra_song_collections'),
      q('SELECT * FROM barra_challenges ORDER BY start_ms'),
    ]);
    return {
      artists: artists.rows,
      genres: genres.rows,
      collections: collections.rows,
      songs: songs.rows.map((s) => ({
        ...songRow(s),
        collection_ids: links.rows.filter((l) => l.song_id === s.id).map((l) => l.collection_id),
      })),
      challenges: challenges.rows.map(challengeRow),
    };
  }

  async function saveNamed(kind, data) {
    const table = NAMED[kind];
    const name = text(data.name, 120);
    if (!name) throw bad('Il nome è obbligatorio');
    const key = nameKey(name);
    const id = uuidOrNull(data.id);
    const clash = await q(`SELECT id FROM ${table} WHERE name_key = $1`, [key]);
    if (clash.rows[0] && clash.rows[0].id !== id) throw bad('Esiste già un elemento con questo nome');
    if (kind === 'collection') {
      const description = text(data.description, 300);
      const published = data.is_published !== false;
      if (id) await q(`UPDATE ${table} SET name = $2, name_key = $3, description = $4, is_published = $5 WHERE id = $1`, [id, name, key, description, published]);
      else await q(`INSERT INTO ${table} (id, name, name_key, description, is_published) VALUES ($1, $2, $3, $4, $5)`, [randomUUID(), name, key, description, published]);
    } else if (id) {
      await q(`UPDATE ${table} SET name = $2, name_key = $3 WHERE id = $1`, [id, name, key]);
    } else {
      await q(`INSERT INTO ${table} (id, name, name_key) VALUES ($1, $2, $3)`, [randomUUID(), name, key]);
    }
  }

  async function deleteNamed(kind, data) {
    const id = uuidOrNull(data.id);
    if (!id) throw bad('Elemento non valido');
    if (kind === 'artist') {
      const used = await q('SELECT 1 FROM barra_songs WHERE artist_id = $1 LIMIT 1', [id]);
      if (used.rows.length) throw bad('Artista in uso: elimina o sposta prima i suoi brani');
    }
    await q(`DELETE FROM ${NAMED[kind]} WHERE id = $1`, [id]);
  }

  async function saveSong(data) {
    const title = text(data.title, 200);
    if (!title) throw bad('Titolo obbligatorio');
    const artistId = uuidOrNull(data.artist_id);
    if (!artistId) throw bad('Seleziona un artista');
    const provider = data.audio_provider === 'deezer' ? 'deezer' : 'youtube';
    let audioRef = text(data.audio_ref, 300);
    if (audioRef && provider === 'youtube') {
      audioRef = parseYouTubeId(audioRef);
      if (!audioRef) throw bad('Link o ID YouTube non valido');
    }
    if (audioRef && provider === 'deezer' && !/^\d+$/.test(audioRef)) throw bad("Per Deezer inserisci l'ID numerico della traccia");

    const row = {
      title,
      artist_id: artistId,
      genre_id: uuidOrNull(data.genre_id),
      tags: JSON.stringify((Array.isArray(data.tags) ? data.tags : []).map((t) => text(t, 40)).filter(Boolean).slice(0, 20)),
      audio_provider: provider,
      audio_ref: audioRef,
      deezer_track_id: positiveInt(data.deezer_track_id),
      musixmatch_track_id: positiveInt(data.musixmatch_track_id),
      source_notes: text(data.source_notes, 1000),
      rights_notes: text(data.rights_notes, 1000),
      lyrics_source: data.lyrics_source === 'musixmatch' ? 'musixmatch' : 'manual',
      is_published: !!data.is_published,
    };
    if (row.is_published && !row.audio_ref) throw bad('Per pubblicare serve un contenuto audio associato');
    if (row.is_published && !row.rights_notes) throw bad('Per pubblicare indica provenienza e autorizzazione del testo e dell\'audio');

    let id = uuidOrNull(data.id);
    const cols = Object.keys(row);
    const values = cols.map((k) => row[k]);
    if (id) {
      const prev = (await q('SELECT audio_ref, audio_provider FROM barra_songs WHERE id = $1', [id])).rows[0];
      if (!prev) throw bad('Brano non trovato');
      await q(
        `UPDATE barra_songs SET ${cols.map((c, i) => `${c} = $${i + 2}${c === 'tags' ? '::jsonb' : ''}`).join(', ')}, updated_at = now() WHERE id = $1`,
        [id, ...values],
      );
      if (prev.audio_ref !== row.audio_ref || prev.audio_provider !== row.audio_provider) {
        // Contenuto nuovo: va riverificato e i tempi delle sfide non valgono più
        await q(`UPDATE barra_songs SET availability_status = 'unchecked', availability_note = NULL, playback_error_count = 0 WHERE id = $1`, [id]);
        await q('UPDATE barra_challenges SET is_verified = false, is_published = false, verified_at = NULL WHERE song_id = $1', [id]);
      }
    } else {
      id = randomUUID();
      await q(
        `INSERT INTO barra_songs (id, ${cols.join(', ')}) VALUES ($1, ${cols.map((c, i) => `$${i + 2}${c === 'tags' ? '::jsonb' : ''}`).join(', ')})`,
        [id, ...values],
      );
    }

    const collectionIds = [...new Set((Array.isArray(data.collection_ids) ? data.collection_ids : []).map(uuidOrNull).filter(Boolean))];
    await q('DELETE FROM barra_song_collections WHERE song_id = $1', [id]);
    for (const cid of collectionIds) {
      await q('INSERT INTO barra_song_collections (song_id, collection_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, cid]);
    }
    return id;
  }

  async function setAvailability(id, status, note) {
    await q(
      `UPDATE barra_songs SET availability_status = $2, availability_note = $3, availability_checked_at = now(),
              playback_error_count = CASE WHEN $2 = 'ok' THEN 0 ELSE playback_error_count END
        WHERE id = $1`,
      [id, status, note ? String(note).slice(0, 300) : null],
    );
  }

  async function getSong(id) {
    const { rows } = await q('SELECT * FROM barra_songs WHERE id = $1', [uuidOrNull(id)]);
    return rows[0] ? songRow(rows[0]) : null;
  }

  async function deleteSong(data) {
    await q('DELETE FROM barra_songs WHERE id = $1', [uuidOrNull(data.id)]);
  }

  async function saveChallenge(data) {
    const startMs = Math.round(Number(data.start_ms));
    const stopMs = Math.round(Number(data.stop_ms));
    if (!Number.isFinite(startMs) || startMs < 0) throw bad('Tempo di inizio non valido');
    if (!Number.isFinite(stopMs) || stopMs < startMs + 1000) throw bad("L'interruzione deve essere almeno 1s dopo l'inizio");
    if (stopMs - startMs > 60000) throw bad('Il frammento non può superare 60 secondi');
    const song = (await q('SELECT id, audio_provider FROM barra_songs WHERE id = $1', [uuidOrNull(data.song_id)])).rows[0];
    if (!song) throw bad('Brano non trovato');
    if (song.audio_provider === 'deezer' && stopMs > DEEZER_PREVIEW_MS) {
      throw bad("Con Deezer i tempi sono relativi alla preview: l'interruzione deve stare entro 30s");
    }
    const variants = (Array.isArray(data.accepted_variants) ? data.accepted_variants : [])
      .map((v) => text(v, 200)).filter(Boolean).slice(0, 30);
    const answer = text(data.answer, 200) || '';
    const difficulty = [1, 2, 3].includes(Number(data.difficulty)) ? Number(data.difficulty) : 2;
    const note = text(data.internal_note, 1000);

    const id = uuidOrNull(data.id);
    if (id) {
      const prev = (await q('SELECT * FROM barra_challenges WHERE id = $1', [id])).rows[0];
      if (!prev) throw bad('Sfida non trovata');
      const p = challengeRow(prev);
      const changed = p.start_ms !== startMs || p.stop_ms !== stopMs || p.answer !== answer
        || JSON.stringify(p.accepted_variants) !== JSON.stringify(variants);
      // Ogni modifica a tempi o risposta richiede una nuova verifica
      await q(
        `UPDATE barra_challenges SET start_ms = $2, stop_ms = $3, answer = $4, accepted_variants = $5::jsonb,
                difficulty = $6, internal_note = $7, updated_at = now(),
                is_verified = CASE WHEN $8 THEN false ELSE is_verified END,
                is_published = CASE WHEN $8 THEN false ELSE is_published END,
                verified_at = CASE WHEN $8 THEN NULL ELSE verified_at END
          WHERE id = $1`,
        [id, startMs, stopMs, answer, JSON.stringify(variants), difficulty, note, changed],
      );
      return id;
    }
    const newId = randomUUID();
    await q(
      `INSERT INTO barra_challenges (id, song_id, start_ms, stop_ms, answer, accepted_variants, difficulty, internal_note)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
      [newId, song.id, startMs, stopMs, answer, JSON.stringify(variants), difficulty, note],
    );
    return newId;
  }

  async function verifyChallenge(data) {
    const id = uuidOrNull(data.id);
    const c = (await q('SELECT answer FROM barra_challenges WHERE id = $1', [id])).rows[0];
    if (!c) throw bad('Sfida non trovata');
    if (data.verified) {
      if (!c.answer.trim()) throw bad('Inserisci la continuazione corretta prima di verificare');
      await q('UPDATE barra_challenges SET is_verified = true, verified_at = now() WHERE id = $1', [id]);
    } else {
      await q('UPDATE barra_challenges SET is_verified = false, is_published = false, verified_at = NULL WHERE id = $1', [id]);
    }
  }

  async function publishChallenge(data) {
    const id = uuidOrNull(data.id);
    const c = (await q('SELECT is_verified, answer FROM barra_challenges WHERE id = $1', [id])).rows[0];
    if (!c) throw bad('Sfida non trovata');
    if (data.published && (!c.is_verified || !c.answer.trim())) throw bad('Si possono pubblicare solo sfide verificate e con risposta');
    await q('UPDATE barra_challenges SET is_published = $2 WHERE id = $1', [id, !!data.published]);
  }

  async function deleteChallenge(data) {
    await q('DELETE FROM barra_challenges WHERE id = $1', [uuidOrNull(data.id)]);
  }

  return {
    init,
    seed,
    listCandidates,
    filterOptions,
    getChallenge,
    reportSongError,
    loadAll,
    saveNamed,
    deleteNamed,
    saveSong,
    getSong,
    setAvailability,
    deleteSong,
    saveChallenge,
    verifyChallenge,
    publishChallenge,
    deleteChallenge,
  };
}
