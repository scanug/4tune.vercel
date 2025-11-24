'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const CATEGORY_PRESETS = [
  { slug: 'rap-hiphop', title: 'Rap / Hip-hop', query: 'rap' },
  { slug: '2000s', title: '2000s Throwback', query: '2000s hits' },
  { slug: '2010s', title: '2010s Bangers', query: '2010s hits' },
  { slug: '2020s', title: '2020s Fresh', query: '2020s hits' },
  { slug: 'hits-5y', title: 'Hits ultimi 5 anni', query: 'top hits' },
  { slug: 'rock', title: 'Rock Classics', query: 'rock classics' },
  { slug: 'metal', title: 'Metal', query: 'metal' },
  { slug: 'tiktok', title: 'TikTok Songs', query: 'tiktok songs' }
];

export default function CategoriesPage() {
  const [resolved, setResolved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const categories = useMemo(() => CATEGORY_PRESETS, []);

  useEffect(() => {
    let aborted = false;
    async function fetchPlaylists() {
      try {
        const results = await Promise.all(
          categories.map(async (cat) => {
            const res = await fetch(`/api/deezer/search?type=playlist&q=${encodeURIComponent(cat.query)}`);
            const json = await res.json();
            const first = Array.isArray(json.data) ? json.data[0] : null;
            return {
              ...cat,
              playlistId: first?.id || null,
              playlistTitle: first?.title || cat.title,
              provider: 'deezer',
            };
          })
        );
        if (!aborted) {
          setResolved(results);
          setLoading(false);
        }
      } catch (e) {
        if (!aborted) {
          setError('Errore nel recuperare le playlist Deezer');
          setLoading(false);
        }
      }
    }
    fetchPlaylists();
    return () => {
      aborted = true;
    };
  }, [categories]);

  async function handleSearch(e) {
    e.preventDefault();
    setSearchError('');
    setSearchLoading(true);
    setSearchResults([]);
    try {
      const res = await fetch(`/api/deezer/search?type=playlist&q=${encodeURIComponent(searchTerm)}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSearchResults(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      setSearchError('Errore nella ricerca playlist');
    } finally {
      setSearchLoading(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative' }}>
      <video
        autoPlay
        muted
        loop
        playsInline
        className="fixed top-0 left-0 w-full h-full object-cover -z-10"
      >
        <source src="/background_gts.mp4" type="video/mp4" />
      </video>
      <div className="fixed inset-0 bg-black/60 -z-10"></div>

      <div style={{ width: 'min(980px, 96vw)', border: '2px solid rgba(17,24,39,0.2)', borderRadius: 18, background: 'rgba(255,255,255,0.92)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Link href="/music" className="btn-3d" style={{ textDecoration: 'none' }}>Torna</Link>
          <h1 style={{ margin: 0, color: '#111827' }}>Seleziona la categoria</h1>
          <Link href="/hub" className="btn-3d" style={{ textDecoration: 'none' }}>Hub</Link>
        </div>
        <p style={{ marginTop: 16, color: '#6b7280' }}>Ogni categoria cerca una playlist Deezer e la usa per il quiz musicale.</p>
        {error && <p style={{ color: '#dc2626', marginTop: 8 }}>{error}</p>}

        <div style={{ marginTop: 10, marginBottom: 14, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/music/join" className="btn-3d" style={{ textDecoration: 'none' }}>
            Entra con codice stanza
          </Link>
        </div>

        <form onSubmit={handleSearch} style={{ marginTop: 12, marginBottom: 18, display: 'grid', gap: 10 }}>
          <label style={{ fontWeight: 600, color: '#111827' }}>Cerca una playlist (artista, genere...)</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="es. Dua Lipa, 80s, rock workout"
              style={{ flex: '1 1 240px', padding: '0.6rem 0.8rem', borderRadius: 10, border: '1px solid rgba(17,24,39,0.2)', color: '#111827' }}
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
                  {res.picture && <img src={res.picture} alt={res.title} style={{ width: '100%', borderRadius: 10, marginBottom: 8 }} />}
                  <div style={{ fontWeight: 700, color: '#111827' }}>{res.title || 'Playlist Deezer'}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{res.creator || ''}</div>
                  {res.trackCount && <div style={{ fontSize: 12, color: '#6b7280' }}>{res.trackCount} tracce</div>}
                  <Link
                    href={{ pathname: '/music/host', query: { playlist: res.id, title: res.title || 'Playlist Deezer', provider: 'deezer' } }}
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

        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {(resolved.length ? resolved : categories).map((cat) => (
            <div key={cat.slug} style={{ border: '1px solid rgba(17,24,39,0.15)', borderRadius: 12, padding: 16, background: 'rgba(99,102,241,0.05)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <h2 style={{ margin: 0, color: '#111827', fontSize: '1.1rem' }}>{cat.title}</h2>
                <p style={{ margin: '6px 0', color: '#6b7280', fontSize: '0.9rem' }}>{cat.playlistTitle || 'Playlist Deezer'}</p>
              </div>
              <Link
                href={{ pathname: '/music/host', query: { playlist: cat.playlistId || '', title: cat.playlistTitle || cat.title, provider: 'deezer' } }}
                className="btn-3d"
                style={{ textDecoration: 'none', textAlign: 'center', pointerEvents: cat.playlistId ? 'auto' : 'none', opacity: cat.playlistId ? 1 : 0.6 }}
              >
                {cat.playlistId ? 'Usa playlist' : (loading ? 'Caricamento...' : 'Playlist non trovata')}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
