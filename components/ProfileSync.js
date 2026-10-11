'use client';

import { useEffect } from 'react';
import { syncProfile } from '@/lib/profile';
import { STATS_EVENT } from '@/lib/stats';

const AFTER_MATCH_MS = 2000; // a fine partita si aspetta che si siano salvati tutti i round

// Sincronizza il profilo condiviso in sottofondo: all'apertura del sito, a
// fine partita e quando si torna sulla scheda. Senza profilo non fa nulla.
export default function ProfileSync() {
  useEffect(() => {
    let timer = null;
    const onStats = () => {
      clearTimeout(timer);
      timer = setTimeout(() => syncProfile({ force: true }), AFTER_MATCH_MS);
    };
    const onVisible = () => { if (document.visibilityState === 'visible') syncProfile(); };
    syncProfile({ force: true });
    window.addEventListener(STATS_EVENT, onStats);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(STATS_EVENT, onStats);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
