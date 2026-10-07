'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import { getMusic } from '@/lib/chiptune';
import PixelIcon from './PixelIcon';

// Pagine di menu con la musica "menu"; dentro le partite la musica tace.
const MENU_ROUTES = new Set([
  '/', '/gts', '/gts/categories', '/gts/host', '/gts/join',
  '/anno', '/anno/host', '/anno/join',
  '/impostore', '/impostore/setup', '/bomba',
]);

function trackFor(pathname) {
  if (pathname === '/sala') return 'sala';
  return MENU_ROUTES.has(pathname) ? 'menu' : null;
}

const subscribe = (fn) => getMusic()?.subscribe(fn) ?? (() => {});
const getMuted = () => getMusic()?.muted ?? false;
const getServerMuted = () => false;

export function useMuted() {
  return useSyncExternalStore(subscribe, getMuted, getServerMuted);
}

// Una pagina chiama useMusicSuppressed(true) per zittire la musica (es. round della Bomba).
export function useMusicSuppressed(active) {
  useEffect(() => {
    if (!active) return undefined;
    return getMusic()?.suppress();
  }, [active]);
}

export function MuteButton({ floating = false }) {
  const muted = useMuted();
  const toggle = () => {
    const music = getMusic();
    if (!music) return;
    music.setMuted(!muted);
    if (muted) music.unlock();
  };
  return (
    <button
      type="button"
      className={`mute-btn${floating ? ' floating' : ''}`}
      onClick={toggle}
      aria-pressed={muted}
      aria-label={muted ? 'Riattiva audio' : 'Silenzia audio'}
      title={muted ? 'Riattiva audio' : 'Silenzia audio'}
    >
      <PixelIcon name={muted ? 'speakerOff' : 'speaker'} size={24} />
    </button>
  );
}

export default function MusicController() {
  const pathname = usePathname();
  const track = trackFor(pathname);

  useEffect(() => {
    getMusic()?.setTrack(track);
  }, [track]);

  // I browser fanno partire l'audio solo dopo un gesto: il primo tocco accende la musica.
  useEffect(() => {
    const music = getMusic();
    if (!music || music.unlocked) return undefined;
    const onGesture = () => {
      music.unlock();
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, []);

  // Nella Sala il tasto sta nella barra in alto
  if (!track || track === 'sala') return null;
  return <MuteButton floating />;
}
