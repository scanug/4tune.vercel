'use client';

import Link from 'next/link';

export default function HubPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 'min(800px, 94vw)', textAlign: 'center', border: '2px solid #111827', borderRadius: 12, background: 'rgba(255,255,255,0.9)', boxShadow: '0 12px 0 #111827, 0 12px 24px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12 }}>
          <Link href="/" className="btn-3d" style={{ textDecoration: 'none' }}>Home</Link>
          <h1 style={{ margin: 0, letterSpacing: 1, textTransform: 'uppercase', color: '#111827' }}>Hub Giochi</h1>
          <span />
        </div>

        <div style={{ padding: 16, textAlign: 'left' }}>
          <p style={{ marginTop: 0, color: '#111827' }}>Scegli il tuo party-game preferito: 4Tune per i numeri, GTS per la musica.</p>

          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(17,24,39,0.2)', borderRadius: 10, padding: '10px 12px', background: '#fff' }}>
              <div>
                <div style={{ fontWeight: 800, color: '#111827' }}>4Tune - Your Lucky Numbers</div>
                <div style={{ fontSize: 13, opacity: 0.85, color: '#111827' }}>Scommetti sui numeri, gira la ruota, vinci crediti!</div>
              </div>
              <Link href="/" className="btn-3d" style={{ textDecoration: 'none' }}>Vai a 4Tune</Link>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(17,24,39,0.2)', borderRadius: 10, padding: '10px 12px', background: '#fdf4ff' }}>
              <div>
                <div style={{ fontWeight: 800, color: '#111827' }}>GTS - Guess the Song</div>
                <div style={{ fontSize: 13, opacity: 0.85, color: '#111827' }}>Indovina il brano prima degli altri con clip sincronizzate e buzzer.</div>
              </div>
              <Link href="/music" className="btn-3d" style={{ textDecoration: 'none' }}>Vai a GTS</Link>
            </li>

            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px dashed rgba(17,24,39,0.2)', borderRadius: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.6)' }}>
              <div>
                <div style={{ fontWeight: 800, color: '#111827' }}>Prossimamente...</div>
                <div style={{ fontSize: 13, opacity: 0.85, color: '#111827' }}>Nuovi giochi in arrivo nell'hub.</div>
              </div>
              <button className="btn-3d" disabled>In arrivo</button>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}


