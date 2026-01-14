'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { auth } from '@/lib/firebase';

export default function LiarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleHostGame = () => {
    setLoading(true);
    router.push('/liar/host');
  };

  const handleJoinGame = () => {
    setLoading(true);
    router.push('/liar/join');
  };

  if (!auth.currentUser) {
    router.push('/auth');
    return null;
  }

  return (
    <div className="liar-home">
      <h1>🎭 Lucky Liar</h1>
      <p>Il gioco della menzogna psicologica</p>

      <div className="actions">
        <button onClick={handleHostGame} disabled={loading}>
          🎤 Crea Stanza
        </button>
        <button onClick={handleJoinGame} disabled={loading}>
          🎯 Entra in Stanza
        </button>
      </div>
    </div>
  );
}
