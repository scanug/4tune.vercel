'use client';

import { useEffect, useRef, useState } from 'react';
import ClipPlayer from './ClipPlayer';
import { adminApi, formatMs, parseTime } from '@/lib/barraAdmin';
import { Banner, muted, panelStyle, readable } from './ui';

const DIFFICULTY = { 1: 'Facile', 2: 'Media', 3: 'Difficile' };
const inputStyle = { ...readable, fontSize: 15 };

function emptyDraft(prefill = {}) {
  return { start: '', stop: '', answer: '', variants: '', difficulty: 2, internal_note: '', ...prefill };
}

function toDraft(c) {
  return {
    id: c.id, start: formatMs(c.start_ms), stop: formatMs(c.stop_ms), answer: c.answer,
    variants: (c.accepted_variants || []).join('\n'), difficulty: c.difficulty, internal_note: c.internal_note || '',
  };
}

function TimeField({ label, value, onChange, onFromPlayer }) {
  const nudge = (delta) => {
    const ms = parseTime(value);
    if (ms != null) onChange(formatMs(Math.max(0, ms + delta)));
  };
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 700 }}>{label}</span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input-modern" style={{ ...inputStyle, width: 110 }} value={value} placeholder="m:ss.cc"
          onChange={(e) => onChange(e.target.value)} inputMode="decimal" />
        <button type="button" className="btn-3d" style={{ padding: '6px 8px' }} onClick={() => nudge(-250)}>-0.25</button>
        <button type="button" className="btn-3d" style={{ padding: '6px 8px' }} onClick={() => nudge(250)}>+0.25</button>
        <button type="button" className="btn-3d" style={{ padding: '6px 8px', background: '#fff', color: '#111827' }} onClick={onFromPlayer}>⏱ dal player</button>
      </div>
    </div>
  );
}

function ChallengeForm({ draft, setDraft, onTest, onFromPlayer, onSave, saving, challenge, onAction }) {
  const set = (k) => (v) => setDraft({ ...draft, [k]: typeof v === 'object' && v?.target ? v.target.value : v });
  return (
    <div style={{ ...panelStyle, display: 'grid', gap: 10, background: '#fff' }}>
      {challenge && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span className="bubble" style={{ background: challenge.is_verified ? 'rgba(16,185,129,0.18)' : 'rgba(234,179,8,0.2)', color: '#111827' }}>
            {challenge.is_verified ? '✓ Verificata' : 'Da verificare'}
          </span>
          <span className="bubble" style={{ background: challenge.is_published ? 'rgba(79,70,229,0.18)' : 'rgba(17,24,39,0.08)', color: '#111827' }}>
            {challenge.is_published ? 'Pubblicata' : 'Non pubblicata'}
          </span>
          <span className="bubble" style={{ background: 'rgba(17,24,39,0.06)', color: '#111827' }}>{DIFFICULTY[challenge.difficulty]}</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <TimeField label="Inizio" value={draft.start} onChange={set('start')} onFromPlayer={() => onFromPlayer('start')} />
        <TimeField label="Interruzione" value={draft.stop} onChange={set('stop')} onFromPlayer={() => onFromPlayer('stop')} />
      </div>
      <button type="button" className="btn-3d" onClick={onTest}>▶ Prova esattamente il frammento</button>
      <label style={{ display: 'grid', gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>Continuazione corretta</span>
        <input className="input-modern" style={inputStyle} value={draft.answer} onChange={set('answer')} maxLength={200} />
      </label>
      <label style={{ display: 'grid', gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>Varianti accettate (una per riga)</span>
        <textarea className="input-modern" style={{ ...inputStyle, minHeight: 64 }} value={draft.variants} onChange={set('variants')} />
      </label>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Difficoltà</span>
          <select className="input-modern" style={inputStyle} value={draft.difficulty} onChange={(e) => setDraft({ ...draft, difficulty: Number(e.target.value) })}>
            {[1, 2, 3].map((d) => <option key={d} value={d}>{DIFFICULTY[d]}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4, flex: 1, minWidth: 180 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Nota interna</span>
          <input className="input-modern" style={inputStyle} value={draft.internal_note} onChange={set('internal_note')} />
        </label>
      </div>
      <p style={{ ...muted, ...readable, margin: 0 }}>Modificare tempi, risposta o varianti annulla la verifica e ritira la sfida dal gioco.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn-3d" onClick={onSave} disabled={saving}>{challenge ? 'Salva modifiche' : 'Aggiungi sfida'}</button>
        {challenge && (
          <>
            <button type="button" className="btn-3d" style={{ background: '#fff', color: '#111827' }}
              onClick={() => onAction('challenge.verify', { id: challenge.id, verified: !challenge.is_verified })}>
              {challenge.is_verified ? 'Rimuovi verifica' : '✓ Segna verificata'}
            </button>
            <button type="button" className="btn-3d" style={{ background: '#fff', color: '#111827' }} disabled={!challenge.is_verified}
              onClick={() => onAction('challenge.publish', { id: challenge.id, published: !challenge.is_published })}>
              {challenge.is_published ? 'Ritira' : 'Pubblica'}
            </button>
            <button type="button" className="btn-3d" style={{ background: '#fee2e2', color: '#991b1b' }}
              onClick={() => { if (confirm('Eliminare questa sfida?')) onAction('challenge.delete', { id: challenge.id }); }}>
              Elimina
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Sfide di un brano salvato, con player di prova condiviso
export default function ChallengeList({ song, challenges, runOp, suggestion }) {
  const playerRef = useRef(null);
  const [drafts, setDrafts] = useState({});
  const [newDraft, setNewDraft] = useState(emptyDraft());
  const [range, setRange] = useState({ startMs: 0, stopMs: 5000 });
  const [pendingPlay, setPendingPlay] = useState(false);
  const [position, setPosition] = useState(0);
  const [playerError, setPlayerError] = useState('');
  const [deezerPreview, setDeezerPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    setDrafts(Object.fromEntries(challenges.map((c) => [c.id, toDraft(c)])));
  }, [challenges]);

  useEffect(() => {
    if (suggestion) setNewDraft((d) => ({ ...d, ...suggestion, answer: d.answer || suggestion.answer || '' }));
  }, [suggestion]);

  // La preview Deezer ha un URL firmato che scade: la si richiede al momento
  useEffect(() => {
    setDeezerPreview(null);
    if (song.audio_provider !== 'deezer' || !song.audio_ref) return;
    adminApi.verifyDeezer(song.audio_ref)
      .then((r) => setDeezerPreview(r.ok ? r.track.previewUrl : null))
      .catch(() => setDeezerPreview(null));
  }, [song.audio_provider, song.audio_ref]);

  useEffect(() => {
    const id = setInterval(() => setPosition(playerRef.current?.currentMs?.() || 0), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (pendingPlay) {
      setPendingPlay(false);
      playerRef.current?.playClip();
    }
  }, [pendingPlay]);

  let playback = null;
  if (song.audio_provider === 'youtube' && song.audio_ref) playback = { provider: 'youtube', videoId: song.audio_ref, ...range };
  if (song.audio_provider === 'deezer' && deezerPreview) playback = { provider: 'deezer', previewUrl: deezerPreview, ...range };

  function test(draft) {
    const startMs = parseTime(draft.start);
    const stopMs = parseTime(draft.stop);
    if (startMs == null || stopMs == null || stopMs <= startMs) {
      setMessage({ tone: 'error', text: 'Tempi non validi (formato m:ss.cc, interruzione dopo l\'inizio)' });
      return;
    }
    setMessage(null);
    setRange({ startMs, stopMs });
    setPendingPlay(true);
  }

  async function save(draft) {
    const startMs = parseTime(draft.start);
    const stopMs = parseTime(draft.stop);
    if (startMs == null || stopMs == null) { setMessage({ tone: 'error', text: 'Tempi non validi' }); return; }
    setSaving(true);
    const ok = await runOp('challenge.save', {
      id: draft.id, song_id: song.id, start_ms: startMs, stop_ms: stopMs, answer: draft.answer,
      accepted_variants: draft.variants.split('\n'), difficulty: draft.difficulty, internal_note: draft.internal_note,
    });
    setSaving(false);
    if (ok && !draft.id) setNewDraft(emptyDraft());
    if (ok) setMessage({ tone: 'ok', text: 'Sfida salvata' });
  }

  const fromPlayer = (setter, draft) => (field) => setter({ ...draft, [field]: formatMs(playerRef.current?.currentMs?.() || 0) });

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 14 }}>Sfide ({challenges.length})</h3>
      {!song.audio_ref && <Banner tone="warn">Associa un contenuto audio al brano per provare i frammenti.</Banner>}
      {song.audio_provider === 'deezer' && (
        <Banner tone="warn">Deezer: i tempi sono relativi alla preview di 30s scelta da Deezer, non al brano completo.</Banner>
      )}
      {playback && (
        <div style={{ display: 'grid', gap: 6 }}>
          <ClipPlayer
            key={playback.videoId || playback.previewUrl}
            ref={playerRef}
            playback={playback}
            locked={false}
            onReady={() => setPlayerError('')}
            onError={(_kind, msg) => setPlayerError(msg)}
            onState={() => {}}
          />
          <div style={{ ...muted, ...readable }}>
            Posizione: {formatMs(position)} · frammento in prova: {formatMs(range.startMs)} → {formatMs(range.stopMs)}.
            Il taglio dipende dal player: verifica a orecchio, la precisione non è al millisecondo.
          </div>
          {playerError && <Banner tone="error">{playerError}</Banner>}
        </div>
      )}
      {message && <Banner tone={message.tone}>{message.text}</Banner>}

      {challenges.map((c) => drafts[c.id] && (
        <ChallengeForm
          key={c.id}
          challenge={c}
          draft={drafts[c.id]}
          setDraft={(d) => setDrafts((all) => ({ ...all, [c.id]: d }))}
          onTest={() => test(drafts[c.id])}
          onFromPlayer={fromPlayer((d) => setDrafts((all) => ({ ...all, [c.id]: d })), drafts[c.id])}
          onSave={() => save(drafts[c.id])}
          onAction={runOp}
          saving={saving}
        />
      ))}

      <h4 style={{ margin: '6px 0 0', fontSize: 13 }}>Nuova sfida</h4>
      <ChallengeForm
        draft={newDraft}
        setDraft={setNewDraft}
        onTest={() => test(newDraft)}
        onFromPlayer={fromPlayer(setNewDraft, newDraft)}
        onSave={() => save(newDraft)}
        saving={saving}
      />
    </div>
  );
}
