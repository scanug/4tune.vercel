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

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 'min(980px, 96vw)', border: '2px solid rgba(17,24,39,0.2)', borderRadius: 18, background: '#fff', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Link href="/music" className="btn-3d" style={{ textDecoration: 'none' }}>Torna</Link>
          <h1 style={{ margin: 0, color: '#111827' }}>Seleziona la categoria</h1>
          <Link href="/hub" className="btn-3d" style={{ textDecoration: 'none' }}>Hub</Link>
        </div>
        <p style={{ marginTop: 16, color: '#6b7280' }}>Ogni categoria cerca una playlist Deezer e la usa per il quiz musicale.</p>
        {error && <p style={{ color: '#dc2626', marginTop: 8 }}>{error}</p>}

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
