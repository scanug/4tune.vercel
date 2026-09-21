'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/gameClient';

function hostHref(playlist) {
  return { pathname: '/gts/host', query: { playlist: playlist.id, title: playlist.title } };
}

export default function CategoriesPage() {
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.presets()
      .then((json) => { if (!cancelled) setPresets(json.data || []); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Errore nel recuperare le playlist'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    const q = searchTerm.trim();
    if (!q) return;
    setSearchError('');
    setSearchLoading(true);
    setSearchResults([]);
    try {
      const json = await api.search(q);
      setSearchResults(json.data || []);
      if (!json.data?.length) setSearchError('Nessuna playlist trovata');
    } catch (err) {
      setSearchError(err.message || 'Errore nella ricerca playlist');
    } finally {
      setSearchLoading(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 'min(980px, 96vw)', border: '2px solid rgba(17,24,39,0.2)', borderRadius: 18, background: 'rgba(255,255,255,0.92)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Link href="/gts" className="btn-3d" style={{ textDecoration: 'none' }}>Torna</Link>
          <h1 style={{ margin: 0, color: '#111827' }}>Scegli la playlist</h1>
          <Link href="/gts/join" className="btn-3d" style={{ textDecoration: 'none' }}>Ho un codice</Link>
        </div>
        <p style={{ marginTop: 16, color: '#6b7280' }}>Le categorie usano playlist pubbliche di Deezer. Puoi anche cercarne una tua.</p>

        <form onSubmit={handleSearch} style={{ marginTop: 12, marginBottom: 18, display: 'grid', gap: 10 }}>
          <label style={{ fontWeight: 600, color: '#111827' }}>Cerca una playlist (artista, genere...)</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="es. Dua Lipa, 80s, rock workout"
              className="input-modern"
              style={{ flex: '1 1 240px', width: 'auto' }}
            />
            <button className="btn-3d" type="submit" style={{ minWidth: 120 }} disabled={searchLoading}>
              {searchLoading ? 'Cerca...' : 'Cerca'}
            </button>
          </div>
          {searchError && <p style={{ color: '#dc2626', margin: 0 }}>{searchError}</p>}
        </form>

        {searchResults.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ margin: '0 0 8px', color: '#111827' }}>Risultati ricerca</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {searchResults.map((res) => (
                <div key={res.id} style={{ border: '1px solid rgba(17,24,39,0.15)', borderRadius: 12, padding: 12, background: 'rgba(59,130,246,0.05)' }}>
                  {res.picture && <img src={res.picture} alt="" style={{ width: '100%', borderRadius: 10, marginBottom: 8 }} />}
                  <div style={{ fontWeight: 700, color: '#111827' }}>{res.title || 'Playlist Deezer'}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{res.creator || ''}</div>
                  {res.trackCount && <div style={{ fontSize: 12, color: '#6b7280' }}>{res.trackCount} tracce</div>}
                  <Link
                    href={hostHref({ id: res.id, title: res.title || 'Playlist Deezer' })}
                    className="btn-3d"
                    style={{ textDecoration: 'none', marginTop: 8, display: 'inline-block', textAlign: 'center', width: '100%' }}
                  >
                    Usa questa playlist
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        <h3 style={{ margin: '18px 0 8px', color: '#111827' }}>Categorie</h3>
        {error && <p style={{ color: '#dc2626', marginTop: 8 }}>{error}</p>}
        {loading && <p style={{ color: '#6b7280' }}>Caricamento categorie...</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {presets.map((cat) => (
            <div key={cat.slug} style={{ border: '1px solid rgba(17,24,39,0.15)', borderRadius: 12, padding: 16, background: 'rgba(99,102,241,0.05)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <h2 style={{ margin: 0, color: '#111827', fontSize: '1.1rem' }}>{cat.title}</h2>
                <p style={{ margin: '6px 0', color: '#6b7280', fontSize: '0.9rem' }}>{cat.playlistTitle || 'Playlist non trovata'}</p>
              </div>
              {cat.playlistId ? (
                <Link href={hostHref({ id: cat.playlistId, title: cat.playlistTitle || cat.title })} className="btn-3d" style={{ textDecoration: 'none', textAlign: 'center' }}>
                  Usa playlist
                </Link>
              ) : (
                <button className="btn-3d" disabled style={{ opacity: 0.6 }}>Non disponibile</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
