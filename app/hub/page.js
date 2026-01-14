'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { ref, onValue } from 'firebase/database';
import { auth, db } from '@/lib/firebase';

export default function HubPage() {
  const router = useRouter();
  const [credits, setCredits] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (!u) {
        setCredits(null);
        setLoggedIn(false);
        setLoading(false);
        // Utente non loggato → torna alla landing
        router.push("/");
        return;
      }
      setLoggedIn(true);
      setLoading(false);
      const userRef = ref(db, `users/${u.uid}`);
      const unsub = onValue(userRef, (snap) => {
        const val = snap.val();
        if (val && typeof val.credits === 'number') setCredits(val.credits);
      });
      return () => unsub();
    });
    return () => unsubAuth();
  }, [router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Errore logout:", error);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Caricamento...</div>
      </div>
    );
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 'min(800px, 94vw)', textAlign: 'center', border: '2px solid #111827', borderRadius: 12, background: 'rgba(255,255,255,0.9)', boxShadow: '0 12px 0 #111827, 0 12px 24px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12 }}>
          <Link href="/" className="btn-3d" style={{ textDecoration: 'none' }}>Home</Link>
          <h1 style={{ margin: 0, letterSpacing: 1, textTransform: 'uppercase', color: '#111827' }}>Hub Giochi</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {credits != null && (
              <span style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', fontWeight: 700, color: '#111827' }}>
                {credits} 🪙
              </span>
            )}
            {loggedIn && (
              <>
                <Link href="/profile" className="btn-3d" style={{ textDecoration: 'none' }}>Profilo</Link>
                <button className="btn-3d" onClick={handleLogout}>Logout</button>
              </>
            )}
          </div>
        </div>

        <div style={{ padding: 16, textAlign: 'left' }}>
          <p style={{ marginTop: 0, color: '#111827' }}>Scegli il tuo party-game preferito: 4Tune per i numeri, GTS per la musica.</p>

          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(17,24,39,0.2)', borderRadius: 10, padding: '10px 12px', background: '#fff' }}>
              <div>
                <div style={{ fontWeight: 800, color: '#111827' }}>4Tune - Your Lucky Numbers</div>
                <div style={{ fontSize: 13, opacity: 0.85, color: '#111827' }}>Scommetti sui numeri, gira la ruota, vinci crediti!</div>
              </div>
              <Link href="/fourtune" className="btn-3d" style={{ textDecoration: 'none' }}>Vai a 4Tune</Link>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(17,24,39,0.2)', borderRadius: 10, padding: '10px 12px', background: '#fdf4ff' }}>
              <div>
                <div style={{ fontWeight: 800, color: '#111827' }}>GTS - Guess the Song</div>
                <div style={{ fontSize: 13, opacity: 0.85, color: '#111827' }}>Indovina il brano prima degli altri con clip sincronizzate e buzzer.</div>
              </div>
              <Link href="/music" className="btn-3d" style={{ textDecoration: 'none' }}>Vai a GTS</Link>
            </li>

            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(17,24,39,0.2)', borderRadius: 10, padding: '10px 12px', background: '#f0f9ff' }}>
              <div>
                <div style={{ fontWeight: 800, color: '#111827' }}>🎭 Lucky Liar</div>
                <div style={{ fontSize: 13, opacity: 0.85, color: '#111827' }}>Il gioco della menzogna psicologica: dichiarazioni, sfide e wildcard!</div>
              </div>
              <Link href="/liar" className="btn-3d" style={{ textDecoration: 'none' }}>Vai a Lucky Liar</Link>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}


