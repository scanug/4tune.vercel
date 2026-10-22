'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi, getAdminToken, setAdminToken } from '@/lib/barraAdmin';
import SongEditor from '@/components/barra/SongEditor';
import { Banner, Loading, muted, pageStyle, panelStyle, readable } from '@/components/barra/ui';

const wideCard = {
  width: 'min(960px, 100%)', padding: 'clamp(12px, 3vw, 24px)', color: '#111827', display: 'grid', gap: 14,
};

function IntegrationStatus({ integrations }) {
  if (!integrations) return null;
  const rows = [
    ['YouTube', integrations.youtube],
    ['Deezer', integrations.deezer],
    ['Musixmatch', integrations.musixmatch],
  ];
  return (
    <div style={{ ...panelStyle, display: 'grid', gap: 6, ...readable, fontSize: 13 }}>
      <strong>Integrazioni</strong>
      {rows.map(([name, s]) => (
        <div key={name}>
          <span className="bubble" style={{ background: s?.active ? 'rgba(16,185,129,0.18)' : s?.configured ? 'rgba(239,68,68,0.15)' : 'rgba(17,24,39,0.08)', color: '#111827', marginRight: 6 }}>
            {s?.active ? 'Attiva' : s?.configured ? 'Errore' : 'Predisposta, non attiva'}
          </span>
          <strong>{name}</strong> — {s?.message}
        </div>
      ))}
    </div>
  );
}

function NamedList({ title, items, onSave, onDelete, withDescription }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState(null);
  return (
    <div style={{ ...panelStyle, display: 'grid', gap: 8 }}>
      <strong style={{ fontSize: 13 }}>{title}</strong>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4, ...readable }}>
        {items.map((it) => (
          <li key={it.id} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {editing?.id === it.id ? (
              <>
                <input className="input-modern" style={{ ...readable, flex: 1, minWidth: 120 }} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                <button className="btn-3d" style={{ padding: '6px 10px' }} onClick={async () => { if (await onSave(editing)) setEditing(null); }}>OK</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1 }}>
                  {it.name}
                  {withDescription && it.is_published === false && <span style={muted}> (nascosta)</span>}
                </span>
                <button className="btn-3d" style={{ padding: '6px 10px', background: '#fff', color: '#111827' }} onClick={() => setEditing({ ...it })}>Rinomina</button>
                {withDescription && (
                  <button className="btn-3d" style={{ padding: '6px 10px', background: '#fff', color: '#111827' }}
                    onClick={() => onSave({ ...it, is_published: it.is_published === false })}>
                    {it.is_published === false ? 'Mostra' : 'Nascondi'}
                  </button>
                )}
                <button className="btn-3d" style={{ padding: '6px 10px', background: '#fee2e2', color: '#991b1b' }}
                  onClick={() => { if (confirm(`Eliminare "${it.name}"?`)) onDelete(it); }}>✕</button>
              </>
            )}
          </li>
        ))}
      </ul>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <input className="input-modern" style={{ ...readable, flex: 1, minWidth: 140 }} placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
        {withDescription && (
          <input className="input-modern" style={{ ...readable, flex: 2, minWidth: 160 }} placeholder="Descrizione (facoltativa)" value={description} onChange={(e) => setDescription(e.target.value)} />
        )}
        <button className="btn-3d" onClick={async () => { if (await onSave({ name, description })) { setName(''); setDescription(''); } }}>Aggiungi</button>
      </div>
    </div>
  );
}

export default function BarraAdminPage() {
  const [data, setData] = useState(null);
  const [needToken, setNeedToken] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState(null);
  const [tab, setTab] = useState('songs');
  const [selected, setSelected] = useState(null); // id brano | 'new' | null
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    if (!getAdminToken()) { setNeedToken(true); return; }
    setError('');
    adminApi.catalog()
      .then((d) => { setData(d); setNeedToken(false); })
      .catch((e) => {
        if (e.status === 401) { setAdminToken(''); setNeedToken(true); setError(e.message); }
        else setError(e.message);
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  const runOp = useCallback(async (op, payload) => {
    setMessage(null);
    try {
      const res = await adminApi.op(op, payload);
      setData((prev) => ({ ...prev, ...res }));
      if (op === 'song.save' && res.savedId) setSelected(res.savedId);
      return true;
    } catch (e) {
      setMessage({ tone: 'error', text: e.message });
      return false;
    }
  }, []);

  const songs = useMemo(() => {
    if (!data) return [];
    const artists = Object.fromEntries(data.artists.map((a) => [a.id, a.name]));
    const q = search.trim().toLowerCase();
    return data.songs
      .map((s) => {
        const ch = data.challenges.filter((c) => c.song_id === s.id);
        return { ...s, artistName: artists[s.artist_id] || '?', total: ch.length, verified: ch.filter((c) => c.is_verified).length, published: ch.filter((c) => c.is_published).length };
      })
      .filter((s) => !q || `${s.title} ${s.artistName} ${(s.tags || []).join(' ')}`.toLowerCase().includes(q));
  }, [data, search]);

  if (needToken) {
    return (
      <main style={pageStyle}>
        <form className="panel" style={{ ...wideCard, width: 'min(460px, 100%)' }} onSubmit={(e) => { e.preventDefault(); setAdminToken(tokenInput.trim()); load(); }}>
          <h1 style={{ fontSize: 18, margin: 0 }}>Gestione catalogo</h1>
          <p style={{ ...readable, fontSize: 13, margin: 0 }}>Inserisci il codice di gestione (la variabile ADMIN_TOKEN del server di gioco). Resta salvato in questo browser.</p>
          <input className="input-modern" type="password" autoComplete="off" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="Codice di gestione" />
          <button className="btn-3d" type="submit" disabled={!tokenInput.trim()}>Entra</button>
          {error && <Banner tone="error">{error}</Banner>}
          <Link href="/barra" style={{ color: '#6b7280', fontSize: 12 }}>Torna al gioco</Link>
        </form>
      </main>
    );
  }
  if (error) {
    return (
      <main style={pageStyle}>
        <div className="panel" style={wideCard}>
          <h1 style={{ fontSize: 18, margin: 0 }}>Gestione – Completa la barra</h1>
          <Banner tone="error">{error}</Banner>
          <button className="btn-3d" onClick={load} style={{ justifySelf: 'start' }}>Riprova</button>
          <Link href="/barra" className="btn-3d" style={{ textDecoration: 'none', justifySelf: 'start' }}>Torna al gioco</Link>
        </div>
      </main>
    );
  }
  if (!data) return <Loading />;

  const selectedSong = selected && selected !== 'new' ? data.songs.find((s) => s.id === selected) : null;

  return (
    <main style={pageStyle}>
      <div className="panel" style={wideCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/barra" className="btn-3d" style={{ textDecoration: 'none' }}>Gioco</Link>
          <h1 style={{ margin: 0, fontSize: 'clamp(14px, 4vw, 20px)' }}>Gestione catalogo</h1>
          <span />
        </div>

        <IntegrationStatus integrations={data.integrations} />
        {message && <Banner tone={message.tone}>{message.text}</Banner>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-3d" style={tab === 'songs' ? {} : { background: '#fff', color: '#111827' }} onClick={() => setTab('songs')}>Brani e sfide</button>
          <button className="btn-3d" style={tab === 'taxonomy' ? {} : { background: '#fff', color: '#111827' }} onClick={() => setTab('taxonomy')}>Artisti, generi, raccolte</button>
        </div>

        {tab === 'taxonomy' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <NamedList title="Artisti" items={data.artists} onSave={(d) => runOp('artist.save', d)} onDelete={(d) => runOp('artist.delete', d)} />
            <NamedList title="Generi" items={data.genres} onSave={(d) => runOp('genre.save', d)} onDelete={(d) => runOp('genre.delete', d)} />
            <NamedList title="Raccolte tematiche" withDescription items={data.collections} onSave={(d) => runOp('collection.save', d)} onDelete={(d) => runOp('collection.delete', d)} />
          </div>
        )}

        {tab === 'songs' && (selected ? (
          <SongEditor
            song={selectedSong}
            catalog={data}
            integrations={data.integrations}
            runOp={runOp}
            onClose={() => setSelected(null)}
          />
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="input-modern" style={{ ...readable, flex: 1, minWidth: 180 }} placeholder="Cerca titolo, artista, tag" value={search} onChange={(e) => setSearch(e.target.value)} />
              <button className="btn-3d" onClick={() => setSelected('new')} disabled={data.artists.length === 0}>+ Nuovo brano</button>
            </div>
            {data.artists.length === 0 && <Banner>Inizia aggiungendo almeno un artista nella scheda “Artisti, generi, raccolte”.</Banner>}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6, ...readable }}>
              {songs.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => setSelected(s.id)}
                    style={{ ...readable, width: '100%', textAlign: 'left', padding: 10, borderRadius: 10, border: '1px solid rgba(17,24,39,0.15)', background: '#fff', cursor: 'pointer', display: 'grid', gap: 4 }}>
                    <span><strong>{s.title}</strong> – {s.artistName}</span>
                    <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <span className="bubble" style={{ background: s.is_published ? 'rgba(79,70,229,0.15)' : 'rgba(17,24,39,0.08)', color: '#111827' }}>{s.is_published ? 'Pubblicato' : 'Bozza'}</span>
                      <span className="bubble" style={{ background: s.availability_status === 'ok' ? 'rgba(16,185,129,0.18)' : s.availability_status === 'unavailable' ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.2)', color: '#111827' }}>
                        {s.audio_provider} · {s.availability_status === 'ok' ? 'disponibile' : s.availability_status === 'unavailable' ? 'non disponibile' : 'da verificare'}
                      </span>
                      <span className="bubble" style={{ background: 'rgba(17,24,39,0.06)', color: '#111827' }}>
                        sfide {s.published}/{s.verified}/{s.total} (pubbl./verif./tot.)
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {songs.length === 0 && <li style={muted}>Nessun brano.</li>}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
