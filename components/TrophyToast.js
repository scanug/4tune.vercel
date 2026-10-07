'use client';

import { useEffect, useRef, useState } from 'react';
import PixelIcon from './PixelIcon';
import { getMusic } from '@/lib/chiptune';
import { GAMES } from '@/lib/games';
import { TIERS, TROPHY_EVENT, cupColors } from '@/lib/trophies';
import { syncTrophies } from '@/lib/stats';

const SHOW_MS = 4200;
const gameTitle = (id) => GAMES.find((g) => g.id === id)?.title || '';

// Avviso "Trofeo sbloccato" con fanfara, dovunque ci si trovi nel sito.
export default function TrophyToast() {
  const [current, setCurrent] = useState(null); // { trophy, more }
  const queue = useRef([]);
  const timer = useRef(null);

  useEffect(() => {
    const showNext = () => {
      const next = queue.current.shift();
      setCurrent(next || null);
      if (!next) { timer.current = null; return; }
      getMusic()?.fanfare();
      timer.current = setTimeout(showNext, SHOW_MS);
    };
    const onTrophy = (e) => {
      const list = e.detail || [];
      if (list.length === 0) return;
      // Tanti trofei insieme (es. statistiche vecchie): un avviso solo
      const items = list.length > 2
        ? [{ trophy: list[0], more: list.length - 1 }]
        : list.map((trophy) => ({ trophy, more: 0 }));
      queue.current.push(...items);
      if (!timer.current) showNext();
    };
    window.addEventListener(TROPHY_EVENT, onTrophy);
    // Trofei già meritati con le statistiche salvate prima dei trofei
    syncTrophies();
    return () => {
      window.removeEventListener(TROPHY_EVENT, onTrophy);
      clearTimeout(timer.current);
    };
  }, []);

  if (!current) return <div className="sr-only" aria-live="polite" />;
  const { trophy, more } = current;
  return (
    <div key={trophy.id} className="trophy-toast" role="status" aria-live="polite" style={{ '--tier': TIERS[trophy.tier].color }}>
      <PixelIcon name="trophy" size={40} colors={cupColors(trophy.tier)} />
      <div>
        <div className="trophy-toast-kicker">{more ? `${more + 1} trofei sbloccati!` : 'Trofeo sbloccato!'}</div>
        <div className="trophy-toast-title">{trophy.title}{more ? ` e altri ${more}` : ''}</div>
        {!more && <div className="trophy-toast-goal">{trophy.goal}</div>}
        <div className="trophy-toast-game">{gameTitle(trophy.game)} · {TIERS[trophy.tier].label}</div>
      </div>
    </div>
  );
}
