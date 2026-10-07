'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function GTSLandingPage() {
  const [showRules, setShowRules] = useState(false);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative' }}>
      <div className="panel" style={{ width: 'min(900px, 94vw)', padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Link href="/" className="btn-3d" style={{ textDecoration: 'none' }}>Hub Giochi</Link>
          <h1 style={{ margin: 0, color: '#111827' }}>GTS – Guess The Song</h1>
          <span />
        </div>

        <section className="fade-up" style={{ marginTop: 24, display: 'grid', gap: 18 }}>
          <p style={{ fontSize: '1.1rem', color: '#111827' }}>
            Riconosci il brano più velocemente degli altri. Scegli una playlist, crea una stanza e condividi il codice: si gioca su clip audio sincronizzate, senza registrazione.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/gts/categories" className="btn-3d" style={{ textDecoration: 'none', minWidth: 160, textAlign: 'center' }}>Crea stanza</Link>
            <Link href="/gts/join" className="btn-3d" style={{ textDecoration: 'none', minWidth: 160, textAlign: 'center' }}>Entra con codice</Link>
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
              <li>Ogni round parte una clip del brano, la durata la decide l&apos;host (15 secondi di default)</li>
              <li>Hai 4 titoli tra cui scegliere, uno solo è giusto</li>
              <li>Risposta corretta: 50 punti più un bonus fino a 50 in base alla velocità</li>
              <li>Quando tutti hanno risposto il round finisce subito</li>
              <li>Nessuna canzone si ripete nella stessa partita</li>
              <li>Alla fine c&apos;è il podio!</li>
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
