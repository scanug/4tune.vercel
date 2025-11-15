'use client';

import Link from 'next/link';
import { useMemo } from 'react';

const CATEGORY_PRESETS = [
  { slug: 'rap-hiphop', title: 'Rap / Hip-hop', playlistId: 'spotify:playlist:raphiphop', description: 'Classici e hit urban' },
  { slug: '2000s', title: '2000s Throwback', playlistId: 'spotify:playlist:2000s', description: 'Nostalgia anni 2000' },
  { slug: '2010s', title: '2010s Bangers', playlistId: 'spotify:playlist:2010s', description: 'Hit pop e dance' },
  { slug: '2020s', title: '2020s Fresh', playlistId: 'spotify:playlist:2020s', description: 'Top chart attuali' },
  { slug: 'hits-5y', title: 'Hits ultimi 5 anni', playlistId: 'spotify:playlist:hits5', description: 'Le più ascoltate' },
  { slug: 'rock', title: 'Rock Classics', playlistId: 'spotify:playlist:rock', description: 'Chitarre e riff' },
  { slug: 'metal', title: 'Metal', playlistId: 'spotify:playlist:metal', description: 'Distorsioni pesanti' },
  { slug: 'tiktok', title: 'TikTok Songs', playlistId: 'spotify:playlist:tiktok', description: 'Brani virali' }
];

export default function CategoriesPage() {
  const categories = useMemo(() => CATEGORY_PRESETS, []);
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 'min(980px, 96vw)', border: '2px solid rgba(17,24,39,0.2)', borderRadius: 18, background: '#fff', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Link href="/music" className="btn-3d" style={{ textDecoration: 'none' }}>← Torna</Link>
          <h1 style={{ margin: 0, color: '#111827' }}>Seleziona la categoria</h1>
          <Link href="/hub" className="btn-3d" style={{ textDecoration: 'none' }}>Hub</Link>
        </div>
        <p style={{ marginTop: 16, color: '#6b7280' }}>Ogni categoria è collegata a una playlist Spotify. Dopo la scelta potrai creare la stanza.</p>

        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {categories.map((cat) => (
            <div key={cat.slug} style={{ border: '1px solid rgba(17,24,39,0.15)', borderRadius: 12, padding: 16, background: 'rgba(99,102,241,0.05)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <h2 style={{ margin: 0, color: '#111827', fontSize: '1.1rem' }}>{cat.title}</h2>
                <p style={{ margin: '6px 0', color: '#6b7280', fontSize: '0.9rem' }}>{cat.description}</p>
              </div>
              <Link
                href={{ pathname: '/music/host', query: { playlist: cat.playlistId, title: cat.title } }}
                className="btn-3d"
                style={{ textDecoration: 'none', textAlign: 'center' }}
              >
                Usa playlist
              </Link>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
