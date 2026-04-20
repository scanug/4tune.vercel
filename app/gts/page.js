'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function GTSLandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/'); return; }
      setLoading(false);
    });
  }, [router]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Caricamento...</div>
      </div>
    );
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative' }}>
      <div style={{ width: 'min(900px, 94vw)', border: '2px solid rgba(17,24,39,0.2)', borderRadius: 18, background: 'rgba(255,255,255,0.92)', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Link href="/hub" className="btn-3d" style={{ textDecoration: 'none' }}>Hub Giochi</Link>
          <h1 style={{ margin: 0, color: '#111827' }}>GTS – Guess The Song</h1>
          <span />
        </div>

        <section className="fade-up" style={{ marginTop: 24, display: 'grid', gap: 18 }}>
          <p style={{ fontSize: '1.1rem', color: '#111827' }}>
            Riconosci il brano più velocemente degli altri. Scegli una categoria, crea o entra in una stanza e sfida i tuoi amici su clip audio sincronizzate.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/gts/categories" className="btn-3d" style={{ textDecoration: 'none', minWidth: 160, textAlign: 'center' }}>Gioca</Link>
            <button
              type="button"
              className="btn-3d"
              onClick={() => setShowRules(true)}
              style={{ minWidth: 160, textAlign: 'center', background: '#fff', color: '#111827' }}
            >
              Regole
            </button>
          </div>
        </section>
      </div>

      {showRules && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowRules(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
        >
          <div style={{ width: 'min(520px, 92vw)', background: '#111827', color: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h2 style={{ marginTop: 0, marginBottom: 12 }}>Regole</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
              <li>Ogni round parte un pezzo di 30 secondi</li>
              <li>Hai 4 opzioni tra cui scegliere</li>
              <li>Vince chi indovina più velocemente</li>
              <li>Punti calcolati sul tempo di risposta</li>
              <li>Alla fine c'è il podio!</li>
            </ul>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-3d" onClick={() => setShowRules(false)}>Chiudi</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
