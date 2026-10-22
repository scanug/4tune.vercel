// Estrazione casuale di una sfida evitando ripetizioni finché possibile.
// candidates: [{ id, songId }]
// history: [{ challengeId, songId }] dei round già giocati nella stanza
// exclude: Set di challengeId da non usare (es. falliti in questo round)

function pickRandom(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function countBy(items, key) {
  const m = new Map();
  for (const it of items) {
    if (it[key] == null) continue;
    m.set(it[key], (m.get(it[key]) || 0) + 1);
  }
  return m;
}

export function pickChallenge(candidates, history = [], exclude = new Set(), rng = Math.random) {
  const usable = candidates.filter((c) => !exclude.has(c.id));
  if (usable.length === 0) return null;

  const songUses = countBy(history, 'songId');
  const challengeUses = countBy(history, 'challengeId');

  // 1) brani mai usati; 2) sfide mai usate; 3) minimo utilizzo
  let pool = usable.filter((c) => !songUses.has(c.songId));
  if (pool.length === 0) {
    pool = usable.filter((c) => !challengeUses.has(c.id));
    if (pool.length > 0) {
      const minSong = Math.min(...pool.map((c) => songUses.get(c.songId) || 0));
      pool = pool.filter((c) => (songUses.get(c.songId) || 0) === minSong);
    }
  }
  if (pool.length === 0) {
    const minUse = Math.min(...usable.map((c) => challengeUses.get(c.id) || 0));
    pool = usable.filter((c) => (challengeUses.get(c.id) || 0) === minUse);
  }

  // Prima il brano (uniforme), poi una delle sue sfide: un brano con molte
  // sfide non viene favorito.
  const songIds = [...new Set(pool.map((c) => c.songId))];
  const songId = pickRandom(songIds, rng);
  return pickRandom(pool.filter((c) => c.songId === songId), rng);
}

export function catalogSummary(candidates) {
  return {
    challenges: candidates.length,
    songs: new Set(candidates.map((c) => c.songId)).size,
  };
}
