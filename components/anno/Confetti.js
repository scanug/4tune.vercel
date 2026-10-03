'use client';

import { useMemo } from 'react';

const COLORS = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#a855f7', '#ec4899', '#fde047'];

// Pioggia di coriandoli solo CSS: nessuna dipendenza, si smonta da sola col componente.
export default function Confetti({ count = 60 }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    left: Math.random() * 100,
    color: COLORS[i % COLORS.length],
    delay: Math.random() * 0.35,
    dur: 1.6 + Math.random() * 1.4,
    dx: (Math.random() - 0.5) * 220,
    rot: (Math.random() - 0.5) * 1440,
    round: Math.random() < 0.3,
  })), [count]);

  return (
    <div className="anno-confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p.left}%`,
            background: p.color,
            borderRadius: p.round ? '50%' : 2,
            width: p.round ? 10 : 8,
            height: p.round ? 10 : 14,
            '--delay': `${p.delay}s`,
            '--dur': `${p.dur}s`,
            '--dx': `${p.dx}px`,
            '--rot': `${p.rot}deg`,
          }}
        />
      ))}
    </div>
  );
}
