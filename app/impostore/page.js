'use client';

import Link from 'next/link';

export default function ImpostorePage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="panel" style={{ width: 'min(700px, 94vw)', textAlign: 'center', padding: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Link href="/" className="btn-3d" style={{ textDecoration: 'none' }}>Hub Giochi</Link>
          <span />
        </div>

        <h1 style={{ color: '#111827', fontSize: '2rem', margin: '0 0 16px' }}>🕵️ Impostore</h1>
        <p style={{ fontSize: '1.1rem', color: '#111827', opacity: 0.85, marginBottom: 20 }}>
          Scopri chi sta bluffando tra i tuoi amici!
        </p>

        <div style={{ textAlign: 'left', marginBottom: 24, padding: 20, border: '1px solid rgba(99,102,241,0.3)', borderRadius: 14, background: 'rgba(99,102,241,0.05)' }}>
          <h3 style={{ margin: '0 0 12px', color: '#4f46e5' }}>Come si gioca</h3>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8, color: '#111827' }}>
            <li><strong>Preparazione:</strong> L&apos;host inserisce i nomi di chi gioca, sceglie la modalità e le impostazioni.</li>
            <li><strong>Distribuzione:</strong> Ci si passa il telefono. Ogni giocatore tocca per vedere la sua parola segreta (o scoprire di essere l&apos;Impostore!).</li>
            <li><strong>Discussione:</strong> Parte un timer. A turno si danno indizi sulla parola e si discute per trovare l&apos;Impostore.</li>
            <li><strong>Votazione:</strong> Ognuno vota chi crede sia l&apos;Impostore.</li>
            <li><strong>Reveal:</strong> Si scopre se avete votato bene... o se l&apos;Impostore l&apos;ha fatta franca!</li>
          </ol>
        </div>

        <Link href="/impostore/setup" className="btn-3d" style={{ textDecoration: 'none', fontSize: '1.2rem', padding: '12px 40px' }}>
          Inizia
        </Link>
      </div>
    </main>
  );
}
