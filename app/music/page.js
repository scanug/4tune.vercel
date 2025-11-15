'use client';

import Link from 'next/link';

export default function MusicLandingPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 'min(900px, 94vw)', border: '2px solid rgba(17,24,39,0.2)', borderRadius: 18, background: '#fff', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Link href="/hub" className="btn-3d" style={{ textDecoration: 'none' }}>Hub Giochi</Link>
          <h1 style={{ margin: 0, color: '#111827' }}>GTS – Guess The Song</h1>
          <span />
        </div>

        <section className="fade-up" style={{ marginTop: 24, display: 'grid', gap: 18 }}>
          <p style={{ fontSize: '1.1rem', color: '#111827' }}>
            Riconosci il brano più velocemente degli altri. Seleziona una categoria musicale, crea o entra in una stanza e sfida i tuoi amici su clip audio sincronizzate.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/music/categories" className="btn-3d" style={{ textDecoration: 'none', minWidth: 160, textAlign: 'center' }}>Gioca</Link>
            <a
              href="#regole"
              className="btn-3d"
              style={{ textDecoration: 'none', minWidth: 160, textAlign: 'center', background: '#fff', color: '#111827' }}
            >
              Regole
            </a>
          </div>
        </section>

        <section id="regole" style={{ marginTop: 32 }}>
          <h2 style={{ marginBottom: 12, color: '#111827' }}>Come funziona</h2>
          <ol style={{ paddingLeft: 20, color: '#111827', lineHeight: 1.6 }}>
            <li>Scegli una categoria/playlist (Rap, 2000s, TikTok Songs…).</li>
            <li>Crea una stanza con codice o unisciti con un codice esistente.</li>
            <li>L’host avvia ogni round: 3s di countdown, poi parte il clip audio.</li>
            <li>Scegli rapidamente il titolo corretto tra 4 opzioni generate dalla playlist.</li>
            <li>Il primo che risponde correttamente ottiene il punteggio massimo.</li>
            <li>Dopo N round, la classifica finale mostra il podio e i premi suggeriti.</li>
          </ol>
        </section>
      </div>
    </main>
  );
}
