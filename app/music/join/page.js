'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function MusicJoinPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  function handleJoin() {
    if (code.length !== 4) {
      setError('Il codice deve avere 4 caratteri');
      return;
    }
    setError('');
    // TODO: push(`/music/game/${code}`)
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 'min(520px, 92vw)', border: '2px solid rgba(17,24,39,0.2)', borderRadius: 16, background: '#fff', padding: 28, boxShadow: '0 16px 40px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <Link href="/music" className="btn-3d" style={{ textDecoration: 'none' }}>← Landing</Link>
          <h1 style={{ margin: 0, color: '#111827' }}>Entra nella stanza GTS</h1>
          <Link href="/music/host" className="btn-3d" style={{ textDecoration: 'none' }}>Crea stanza</Link>
        </div>

        <div style={{ marginTop: 24, display: 'grid', gap: 12 }}>
          <label style={{ fontWeight: 600, color: '#111827' }}>Codice stanza</label>
          <input
            type="text"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            style={{ fontSize: '2rem', textAlign: 'center', padding: '0.5rem', borderRadius: 10, border: '1px solid rgba(17,24,39,0.2)' }}
          />
          <button className="btn-3d" onClick={handleJoin} style={{ minWidth: 160 }}>
            Entra
          </button>
          {error && <p style={{ color: '#dc2626' }}>{error}</p>}
        </div>
      </div>
    </main>
  );
}
