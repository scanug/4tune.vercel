'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function BarraLandingPage() {
  const [showRules, setShowRules] = useState(false);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative' }}>
      <div className="panel" style={{ width: 'min(900px, 94vw)', padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Link href="/" className="btn-3d" style={{ textDecoration: 'none' }}>Hub Giochi</Link>
          <h1 style={{ margin: 0, color: '#111827' }}>🎤 Completa la barra</h1>
          <span />
        </div>

        <section className="fade-up" style={{ marginTop: 24, display: 'grid', gap: 18 }}>
          <p style={{ fontSize: '1.1rem', color: '#111827' }}>
            Tutti ascoltano lo stesso pezzo di una canzone. La musica si ferma prima della frase successiva: scrivi come continua il testo. Rap, hip-hop e pop italiano.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/barra/host" className="btn-3d" style={{ textDecoration: 'none', minWidth: 160, textAlign: 'center' }}>Crea stanza</Link>
            <Link href="/barra/join" className="btn-3d" style={{ textDecoration: 'none', minWidth: 160, textAlign: 'center' }}>Entra con codice</Link>
            <button
              type="button"
              className="btn-3d"
              onClick={() => setShowRules(true)}
              style={{ minWidth: 160, textAlign: 'center', background: '#fff', color: '#111827' }}
            >
              Regole
            </button>
          </div>

          <Link href="/barra/admin" style={{ color: '#6b7280', fontSize: 11, justifySelf: 'start' }}>Gestione catalogo</Link>
        </section>
      </div>

      {showRules && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowRules(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
        >
          <div style={{ width: 'min(560px, 92vw)', background: '#111827', color: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h2 style={{ marginTop: 0, marginBottom: 12 }}>Regole</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10, fontSize: 13, lineHeight: 1.5 }}>
              <li>🔊 Tocca &quot;Attiva audio / Sono pronto&quot;: il video parte da solo, uguale per tutti</li>
              <li>🎧 Durante l&apos;ascolto il campo è chiuso; quando la musica si ferma scrivi come continua</li>
              <li>✍️ Una sola risposta per round: maiuscole, punteggiatura e apostrofi non contano, le parole sì</li>
              <li>💯 100 punti per ogni risposta esatta (bonus velocità fino a +20, se l&apos;host lo attiva)</li>
              <li>🔒 Le risposte restano segrete fino alla fine del round</li>
              <li>📼 Se un video non funziona il round viene sostituito senza penalità</li>
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
