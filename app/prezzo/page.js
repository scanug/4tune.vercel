'use client';

import Link from 'next/link';
import { useState } from 'react';
import PixelIcon from '@/components/PixelIcon';

export default function PrezzoLandingPage() {
  const [showRules, setShowRules] = useState(false);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative' }}>
      <div className="panel" style={{ width: 'min(900px, 94vw)', padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Link href="/" className="btn-3d" style={{ textDecoration: 'none' }}>Hub Giochi</Link>
          <h1 style={{ margin: 0, color: '#111827', display: 'flex', alignItems: 'center', gap: 12 }}><PixelIcon name="coin" size={36} /> Quanto costa?</h1>
          <span />
        </div>

        <section className="fade-up" style={{ marginTop: 24, display: 'grid', gap: 18 }}>
          <p style={{ fontSize: '1.1rem', color: '#111827' }}>
            Quanto costa un caffè al banco? E l&apos;ultimo iPhone? Quanto ha pagato il PSG per Neymar? Ognuno sceglie un prezzo dal suo telefono: chi si avvicina di più vince il round. Spesa, tecnologia, tariffe, calciomercato, acquisizioni miliardarie, cinema e aste da record, ogni prezzo con la sua fonte.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/prezzo/host" className="btn-3d" style={{ textDecoration: 'none', minWidth: 160, textAlign: 'center' }}>Crea stanza</Link>
            <Link href="/prezzo/join" className="btn-3d" style={{ textDecoration: 'none', minWidth: 160, textAlign: 'center' }}>Entra con codice</Link>
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
          <div style={{ width: 'min(560px, 92vw)', background: '#111827', color: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h2 style={{ marginTop: 0, marginBottom: 12 }}>Regole</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10, fontSize: 13, lineHeight: 1.5 }}>
              <li>💶 Ogni round esce una carta: scegli il prezzo con lo slider e rifinisci con ±1% e ±10%, poi conferma</li>
              <li>📏 Conta la proporzione, non la cifra: sbagliare del doppio pesa uguale su un caffè e su un calciatore</li>
              <li>🎯 Più ti avvicini, più punti fai: fino a 100, che scendono in fretta man mano che ti allontani</li>
              <li>🏆 Chi si avvicina di più vince il round e prende +50 (a pari distanza vincono tutti)</li>
              <li>💯 Entro il 2% dal prezzo vero: altri +50 di bonus</li>
              <li>🎚️ Lo slider ha una scala che cresce in fretta e il suo intervallo cambia a ogni carta: il prezzo giusto può stare ovunque, i bordi non sono un indizio</li>
              <li>⏱️ Se finisce il tempo e hai già mosso lo slider, il tuo prezzo viene inviato da solo</li>
              <li>📎 Al reveal trovi cos&apos;è esattamente il prezzo, di quando è e dove controllarlo</li>
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
