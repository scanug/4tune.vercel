'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function HubPage() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel;
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/'); return; }
      if (cancelled) return;
      const uid = session.user.id;
      supabase.from('profiles').select('name').eq('id', uid).single().then(({ data }) => {
        if (cancelled) return;
        if (data) { setUserName(data.name); }
        setLoading(false);
      });
      channel = supabase.channel('hub-profile-' + Date.now())
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` },
          (payload) => { if (!cancelled) setUserName(payload.new.name); })
        .subscribe();
    });
    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); };
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Caricamento...</div>
      </div>
    );
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 'min(800px, 94vw)', textAlign: 'center', border: '2px solid #111827', borderRadius: 12, background: 'rgba(255,255,255,0.9)', boxShadow: '0 12px 0 #111827, 0 12px 24px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12 }}>
          <Link href="/" className="btn-3d" style={{ textDecoration: 'none' }}>Home</Link>
          <h1 style={{ margin: 0, letterSpacing: 1, textTransform: 'uppercase', color: '#111827' }}>Hub Giochi</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn-3d" onClick={handleLogout}>Logout</button>
          </div>
        </div>

        <div style={{ padding: 16, textAlign: 'left' }}>
          <p style={{ marginTop: 0, color: '#111827' }}>
            {userName ? `Ciao ${userName}! ` : ''}Scegli il tuo party-game preferito:
          </p>

          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(17,24,39,0.2)', borderRadius: 10, padding: '10px 12px', background: '#fdf4ff' }}>
              <div>
                <div style={{ fontWeight: 800, color: '#111827' }}>🎵 GTS – Guess the Song</div>
                <div style={{ fontSize: 13, opacity: 0.85, color: '#111827' }}>Indovina il brano prima degli altri con clip sincronizzate.</div>
              </div>
              <Link href="/gts" className="btn-3d" style={{ textDecoration: 'none' }}>Gioca</Link>
            </li>

            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(17,24,39,0.2)', borderRadius: 10, padding: '10px 12px', background: '#f0f9ff' }}>
              <div>
                <div style={{ fontWeight: 800, color: '#111827' }}>🕵️ Impostore</div>
                <div style={{ fontSize: 13, opacity: 0.85, color: '#111827' }}>Scopri chi sta bluffando tra i tuoi amici!</div>
              </div>
              <Link href="/impostore" className="btn-3d" style={{ textDecoration: 'none' }}>Gioca</Link>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}

