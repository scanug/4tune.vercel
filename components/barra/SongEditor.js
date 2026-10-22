'use client';

import { useEffect, useState } from 'react';
import { adminApi, formatMs } from '@/lib/barraAdmin';
import ChallengeList from './ChallengeList';
import { Banner, Chip, muted, panelStyle, readable } from './ui';

const inputStyle = { ...readable, fontSize: 15 };

function fromSong(s) {
  return {
    id: s?.id, title: s?.title || '', artist_id: s?.artist_id || '', genre_id: s?.genre_id || '',
    tags: (s?.tags || []).join(', '), collection_ids: s?.collection_ids || [],
    audio_provider: s?.audio_provider || 'youtube', audio_ref: s?.audio_ref || '',
    deezer_track_id: s?.deezer_track_id || '', musixmatch_track_id: s?.musixmatch_track_id || '',
    source_notes: s?.source_notes || '', rights_notes: s?.rights_notes || '',
    lyrics_source: s?.lyrics_source || 'manual', is_published: !!s?.is_published,
  };
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 700 }}>{label}</span>
      {children}
    </label>
  );
}

function DeezerLookup({ form, onPick }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  async function search() {
    setError('');
    try {
      const json = await adminApi.deezerSearch(q || form.title);
      setResults(json.data || []);
    } catch (e) { setError(e.message); }
  }
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input className="input-modern" style={inputStyle} placeholder="Cerca su Deezer (titolo artista)" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="btn-3d" onClick={search}>Cerca</button>
      </div>
      {error && <Banner tone="error">{error}</Banner>}
      {results.map((r) => (
        <button key={r.id} type="button" onClick={() => { onPick(r); setResults([]); }}
          style={{ ...readable, textAlign: 'left', padding: 8, borderRadius: 8, border: '1px solid rgba(17,24,39,0.15)', background: '#fff', cursor: 'pointer' }}>
          {r.title} – {r.artist} <span style={muted}>({r.album}{r.durationSec ? `, ${formatMs(r.durationSec * 1000)}` : ''})</span>
        </button>
      ))}
    </div>
  );
}

function MusixmatchPanel({ status, form, setForm, artistName, onSuggest }) {
  const [results, setResults] = useState([]);
  const [lyrics, setLyrics] = useState(null);
  const [synced, setSynced] = useState(null);
  const [offset, setOffset] = useState('0');
  const [error, setError] = useState('');

  if (!status?.active) {
    return (
      <Banner tone={status?.configured ? 'error' : 'info'}>
        Musixmatch: {status?.message || 'stato sconosciuto'}. Il catalogo manuale funziona comunque.
      </Banner>
    );
  }

  async function run(fn) {
    setError('');
    try { await fn(); } catch (e) { setError(e.message); }
  }
  const search = () => run(async () => {
    const r = await adminApi.musixmatch({ op: 'search', track: form.title, artist: artistName || '' });
    setResults(r.results);
  });
  const loadLyrics = () => run(async () => setLyrics(await adminApi.musixmatch({ op: 'lyrics', trackId: form.musixmatch_track_id })));
  const loadSynced = () => run(async () => setSynced(await adminApi.musixmatch({ op: 'synced', trackId: form.musixmatch_track_id })));

  // Una riga sincronizzata propone: inizio = riga, interruzione = riga successiva.
  // È solo un suggerimento: il video può avere intro o versione diverse.
  function suggest(i) {
    const lines = synced.lines;
    const off = Math.round(Number(String(offset).replace(',', '.')) * 1000) || 0;
    if (!lines[i + 1]) return;
    onSuggest({
      start: formatMs(Math.max(0, lines[i].timeMs + off)),
      stop: formatMs(Math.max(0, lines[i + 1].timeMs + off)),
      answer: lines[i + 1].text,
      internal_note: 'Tempi suggeriti da testo sincronizzato Musixmatch: da verificare sul video',
    });
  }

  return (
    <div style={{ ...panelStyle, display: 'grid', gap: 8 }}>
      <strong style={{ fontSize: 13 }}>Musixmatch (attiva)</strong>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" className="btn-3d" onClick={search}>Cerca brano</button>
        {form.musixmatch_track_id && <button type="button" className="btn-3d" onClick={loadLyrics}>Testo</button>}
        {form.musixmatch_track_id && <button type="button" className="btn-3d" onClick={loadSynced}>Testo sincronizzato</button>}
      </div>
      {error && <Banner tone="error">{error}</Banner>}
      {results.map((r) => (
        <button key={r.trackId} type="button"
          onClick={() => { setForm({ ...form, musixmatch_track_id: r.trackId, lyrics_source: 'musixmatch' }); setResults([]); }}
          style={{ ...readable, textAlign: 'left', padding: 8, borderRadius: 8, border: '1px solid rgba(17,24,39,0.15)', background: '#fff', cursor: 'pointer' }}>
          {r.title} – {r.artist} <span style={muted}>{r.hasSubtitles ? '· sincronizzato' : ''}</span>
        </button>
      ))}
      {lyrics && (
        <div style={{ ...readable, whiteSpace: 'pre-wrap', fontSize: 13, maxHeight: 240, overflow: 'auto', background: '#fff', padding: 8, borderRadius: 8 }}>
          {lyrics.text || 'Testo non disponibile'}
          {lyrics.copyright && <div style={muted}>{lyrics.copyright}</div>}
          {lyrics.pixelTrackingUrl && <img src={lyrics.pixelTrackingUrl} alt="" width={1} height={1} />}
        </div>
      )}
      {synced && (
        <div style={{ display: 'grid', gap: 4 }}>
          <label style={{ ...readable, fontSize: 13 }}>
            Scostamento del video rispetto al testo (s):{' '}
            <input className="input-modern" style={{ width: 80, display: 'inline-block' }} value={offset} onChange={(e) => setOffset(e.target.value)} inputMode="decimal" />
          </label>
          <div style={{ maxHeight: 260, overflow: 'auto', display: 'grid', gap: 2 }}>
            {synced.lines.map((l, i) => (
              <button key={i} type="button" onClick={() => suggest(i)}
                style={{ ...readable, textAlign: 'left', fontSize: 13, border: 0, background: 'transparent', cursor: 'pointer', padding: '2px 4px' }}>
                <span style={muted}>{formatMs(l.timeMs)}</span> {l.text}
              </button>
            ))}
          </div>
          <p style={{ ...muted, ...readable, margin: 0 }}>Tocca una riga per proporre una nuova sfida (riga → riga successiva). Poi prova il frammento e verificalo.</p>
          {synced.copyright && <div style={muted}>{synced.copyright}</div>}
          {synced.pixelTrackingUrl && <img src={synced.pixelTrackingUrl} alt="" width={1} height={1} />}
        </div>
      )}
    </div>
  );
}

export default function SongEditor({ song, catalog, integrations, runOp, onClose }) {
  const [form, setForm] = useState(fromSong(song));
  const [check, setCheck] = useState(null);
  const [newArtist, setNewArtist] = useState('');
  const [suggestion, setSuggestion] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(fromSong(song)); setCheck(null); }, [song?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const artistName = catalog.artists.find((a) => a.id === form.artist_id)?.name;
  const challenges = song ? catalog.challenges.filter((c) => c.song_id === song.id) : [];

  async function verifyAudio() {
    setCheck({ status: 'loading' });
    try {
      if (form.audio_provider === 'youtube') {
        const r = await adminApi.verifyYouTube(form.audio_ref);
        setCheck(r.status === 'ok'
          ? { tone: 'ok', text: `Incorporabile: "${r.title}" – ${r.author}. I blocchi regionali vanno verificati provando il frammento.` }
          : { tone: r.status === 'unknown' ? 'warn' : 'error', text: r.reason });
        if (r.videoId) setForm((f) => ({ ...f, audio_ref: r.videoId }));
      } else {
        const r = await adminApi.verifyDeezer(form.audio_ref);
        setCheck(r.ok
          ? { tone: r.track.previewUrl ? 'ok' : 'error', text: `${r.track.title} – ${r.track.artist}${r.track.previewUrl ? ': preview 30s disponibile' : ': nessuna preview'}` }
          : { tone: 'error', text: r.reason });
      }
    } catch (e) { setCheck({ tone: 'error', text: e.message }); }
  }

  async function addArtist() {
    if (!newArtist.trim()) return;
    const ok = await runOp('artist.save', { name: newArtist });
    if (ok) setNewArtist('');
  }

  async function save() {
    setSaving(true);
    await runOp('song.save', {
      ...form,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    });
    setSaving(false);
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>{song ? 'Modifica brano' : 'Nuovo brano'}</h2>
        <button type="button" className="btn-3d" style={{ background: '#fff', color: '#111827' }} onClick={onClose}>Chiudi</button>
      </div>

      <div style={{ ...panelStyle, display: 'grid', gap: 10 }}>
        <Field label="Titolo"><input className="input-modern" style={inputStyle} value={form.title} onChange={set('title')} /></Field>
        <Field label="Artista">
          <select className="input-modern" style={inputStyle} value={form.artist_id} onChange={set('artist_id')}>
            <option value="">— seleziona —</option>
            {catalog.artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="input-modern" style={inputStyle} placeholder="Nuovo artista" value={newArtist} onChange={(e) => setNewArtist(e.target.value)} />
          <button type="button" className="btn-3d" onClick={addArtist}>Aggiungi</button>
        </div>
        <Field label="Genere">
          <select className="input-modern" style={inputStyle} value={form.genre_id} onChange={set('genre_id')}>
            <option value="">— nessuno —</option>
            {catalog.genres.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Field>
        <Field label="Tag (separati da virgola)"><input className="input-modern" style={inputStyle} value={form.tags} onChange={set('tags')} /></Field>
        {catalog.collections.length > 0 && (
          <div style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>Raccolte</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {catalog.collections.map((c) => (
                <Chip key={c.id} active={form.collection_ids.includes(c.id)}
                  onClick={() => setForm({ ...form, collection_ids: form.collection_ids.includes(c.id) ? form.collection_ids.filter((x) => x !== c.id) : [...form.collection_ids, c.id] })}>
                  {c.name}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ ...panelStyle, display: 'grid', gap: 10 }}>
        <strong style={{ fontSize: 13 }}>Contenuto audio</strong>
        <Field label="Provider">
          <select className="input-modern" style={inputStyle} value={form.audio_provider} onChange={set('audio_provider')}>
            <option value="youtube">YouTube (player ufficiale, predefinito)</option>
            <option value="deezer">Deezer (solo preview 30s)</option>
          </select>
        </Field>
        <Field label={form.audio_provider === 'youtube' ? 'Link o ID del video YouTube' : 'ID traccia Deezer'}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="input-modern" style={inputStyle} value={form.audio_ref} onChange={set('audio_ref')} />
            <button type="button" className="btn-3d" onClick={verifyAudio} disabled={!form.audio_ref}>Verifica</button>
          </div>
        </Field>
        {check?.status === 'loading' && <span style={muted}>Verifica in corso…</span>}
        {check?.text && <Banner tone={check.tone}>{check.text}</Banner>}
        {song && (
          <span style={{ ...muted, ...readable }}>
            Stato salvato: {song.availability_status}{song.availability_note ? ` — ${song.availability_note}` : ''}
            {song.playback_error_count > 0 ? ` · errori segnalati in partita: ${song.playback_error_count}` : ''}
          </span>
        )}
        {song?.id && (
          <button type="button" className="btn-3d" style={{ background: '#fff', color: '#111827' }} onClick={() => runOp('song.check', { id: song.id })}>
            Ricontrolla disponibilità e salva lo stato
          </button>
        )}
        <Field label="Verifica metadati su Deezer (facoltativa)">
          <DeezerLookup form={form} onPick={(r) => setForm({
            ...form, deezer_track_id: r.id, ...(form.audio_provider === 'deezer' ? { audio_ref: String(r.id) } : {}),
          })} />
        </Field>
        {form.deezer_track_id && <span style={muted}>Deezer ID collegato: {form.deezer_track_id}</span>}
      </div>

      <MusixmatchPanel status={integrations?.musixmatch} form={form} setForm={setForm} artistName={artistName} onSuggest={setSuggestion} />
      {form.musixmatch_track_id && <span style={muted}>Musixmatch ID collegato: {form.musixmatch_track_id}</span>}

      <div style={{ ...panelStyle, display: 'grid', gap: 10 }}>
        <Field label="Provenienza del contenuto audio">
          <textarea className="input-modern" style={{ ...inputStyle, minHeight: 50 }} value={form.source_notes} onChange={set('source_notes')} placeholder="Es. canale ufficiale dell'artista / Vevo" />
        </Field>
        <Field label="Autorizzazione testo e audio (obbligatoria per pubblicare)">
          <textarea className="input-modern" style={{ ...inputStyle, minHeight: 50 }} value={form.rights_notes} onChange={set('rights_notes')} placeholder="Es. testo da licenza Musixmatch / autorizzazione editore…" />
        </Field>
        <Field label="Origine del testo">
          <select className="input-modern" style={inputStyle} value={form.lyrics_source} onChange={set('lyrics_source')}>
            <option value="manual">Inserito manualmente</option>
            <option value="musixmatch">Musixmatch</option>
          </select>
        </Field>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', ...readable }}>
          <input type="checkbox" checked={form.is_published} onChange={set('is_published')} style={{ width: 20, height: 20 }} />
          Brano pubblicato (in gioco vanno solo le sfide verificate e pubblicate)
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn-3d" onClick={save} disabled={saving}>{saving ? 'Salvataggio…' : 'Salva brano'}</button>
          {song?.id && (
            <button type="button" className="btn-3d" style={{ background: '#fee2e2', color: '#991b1b' }}
              onClick={async () => { if (confirm('Eliminare il brano e tutte le sue sfide?')) { if (await runOp('song.delete', { id: song.id })) onClose(); } }}>
              Elimina brano
            </button>
          )}
        </div>
      </div>

      {song?.id ? (
        <ChallengeList song={song} challenges={challenges} runOp={runOp} suggestion={suggestion} />
      ) : (
        <Banner>Salva il brano per aggiungere le sfide.</Banner>
      )}
    </div>
  );
}
