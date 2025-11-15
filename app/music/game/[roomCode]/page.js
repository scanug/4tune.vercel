'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function GuessTheSongGamePage() {
  const { roomCode } = useParams();
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 'min(980px, 96vw)', border: '2px solid rgba(17,24,39,0.2)', borderRadius: 18, background: '#fff', padding: 28, boxShadow: '0 20px 50px rgba(0,0,0,0.12)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Link href="/music" className="btn-3d" style={{ textDecoration: 'none' }}>← Menu</Link>
          <h1 style={{ margin: 0, color: '#111827' }}>Room: {roomCode}</h1>
          <span />
        </div>

        <p style={{ marginTop: 16, color: '#6b7280' }}>
          Questa pagina ospiterà il flusso completo di Guess The Song: countdown, clip audio sincronizzato, pulsanti di risposta e classifica live.
        </p>

        <div style={{ marginTop: 24, border: '1px dashed rgba(17,24,39,0.3)', borderRadius: 12, padding: 24, textAlign: 'center' }}>
          <p style={{ marginBottom: 8, color: '#111827', fontWeight: 700 }}>TODO:</p>
          <ul style={{ listStyle: 'disc', textAlign: 'left', margin: '0 auto', paddingLeft: 20, maxWidth: 520, color: '#111827' }}>
            <li>Sincronizzare il countdown con `startAt`.</li>
            <li>Riprodurre il clip audio (`current.clipUrl`).</li>
            <li>Generare 4 opzioni e bloccare l’input dopo il click.</li>
            <li>Aggiornare la scoreboard e mostrare il podio finale.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
