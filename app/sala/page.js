'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import Room3D from '@/components/sala/Room3D';
import PixelIcon from '@/components/PixelIcon';
import { MuteButton } from '@/components/MusicController';
import { GAMES } from '@/lib/games';
import { readStats, statRows } from '@/lib/stats';

export default function SalaPage() {
  const router = useRouter();
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [index, setIndex] = useState(0);
  const [stats, setStats] = useState({});

  useEffect(() => { setStats(readStats()); }, []);

  const go = useCallback((delta) => setIndex((i) => (i + delta + GAMES.length) % GAMES.length), []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') router.push('/');
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router, go]);

  const game = GAMES[index];
  const rows = statRows(game.id, stats[game.id]);

  return (
    <main className="sala">
      <Room3D index={index} onSelect={setIndex} onReady={() => setStatus('ready')} onError={() => setStatus('error')} />

      {status === 'loading' && <div className="sala-loading" role="status">CARICAMENTO<span className="blink">_</span></div>}
      {status === 'error' && (
        <div className="sala-loading" role="alert" style={{ padding: 24, textAlign: 'center', lineHeight: 1.8 }}>
          Questo browser non riesce a mostrare il 3D.
        </div>
      )}

      <header className="sala-hud">
        <Link href="/" className="btn-3d" style={{ textDecoration: 'none' }}>← Esci</Link>
        <MuteButton />
      </header>

      <section className="sala-card" aria-label={`Statistiche di ${game.title}`} aria-live="polite" style={{ '--accent': game.accent }}>
        <div className="sala-card-head">
          <button type="button" className="sala-arrow" onClick={() => go(-1)} aria-label="Cabinato precedente">◀</button>
          <div className="sala-card-title">
            <PixelIcon name={game.icon} size={32} />
            <h2>{game.title}</h2>
          </div>
          <button type="button" className="sala-arrow" onClick={() => go(1)} aria-label="Cabinato successivo">▶</button>
        </div>
        <dl>
          {rows.map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
        <div className="sala-card-foot">
          <span className="sala-dots" aria-hidden="true">
            {GAMES.map((g, i) => <span key={g.id} className={i === index ? 'on' : ''} />)}
          </span>
          <Link href={game.href} className="btn-3d" style={{ textDecoration: 'none', background: game.accent, color: '#120b2e' }}>Gioca ▶</Link>
        </div>
      </section>

      <p className="sala-help">◀ ▶ per cambiare cabinato · trascina per girare · Esc per uscire</p>
    </main>
  );
}
