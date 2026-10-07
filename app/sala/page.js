'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Room3D from '@/components/sala/Room3D';

export default function SalaPage() {
  const router = useRouter();
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') router.push('/'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return (
    <main className="sala">
      <Room3D onReady={() => setStatus('ready')} onError={() => setStatus('error')} />

      {status === 'loading' && <div className="sala-loading" role="status">CARICAMENTO<span className="blink">_</span></div>}
      {status === 'error' && (
        <div className="sala-loading" role="alert" style={{ padding: 24, textAlign: 'center', lineHeight: 1.8 }}>
          Questo browser non riesce a mostrare il 3D.
        </div>
      )}

      <header className="sala-hud">
        <Link href="/" className="btn-3d" style={{ textDecoration: 'none' }}>← Esci</Link>
        <h1 className="sala-title">Sala Trofei</h1>
      </header>

      {/* Segnaposto: le statistiche vere arriveranno con l'espansione della Sala */}
      <section className="sala-card" aria-label="Statistiche del modellino">
        <h2>Cabinato 4Tune</h2>
        <dl>
          <dt>Partite giocate</dt><dd>---</dd>
          <dt>Record</dt><dd>---</dd>
          <dt>Ultima partita</dt><dd>---</dd>
        </dl>
        <p>Statistiche in arrivo.</p>
      </section>

      <p className="sala-help">Trascina per girare · rotella per lo zoom · frecce da tastiera · Esc per uscire</p>
    </main>
  );
}
