'use client';

import { useEffect, useRef } from 'react';

// three.js si carica solo qui, quando si apre la Sala, e non pesa sul resto del sito.
export default function Room3D({ index, unlocked, onSelect, onReady, onError }) {
  const hostRef = useRef(null);
  const apiRef = useRef(null);
  const indexRef = useRef(index);
  const unlockedRef = useRef(unlocked);
  unlockedRef.current = unlocked;
  const callbacks = useRef({ onSelect, onReady, onError });
  callbacks.current = { onSelect, onReady, onError };
  indexRef.current = index;

  useEffect(() => {
    let disposed = false;
    (async () => {
      const [THREE, { OrbitControls }, { buildRoom }] = await Promise.all([
        import('three'),
        import('three/examples/jsm/controls/OrbitControls.js'),
        import('./buildRoom'),
      ]);
      if (disposed || !hostRef.current) return;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      apiRef.current = buildRoom(THREE, OrbitControls, hostRef.current, {
        reducedMotion,
        onSelect: (i) => callbacks.current.onSelect?.(i),
      });
      apiRef.current.select(indexRef.current);
      apiRef.current.setTrophies(unlockedRef.current);
      callbacks.current.onReady?.();
    })().catch((err) => {
      console.error('Sala 3D non disponibile', err);
      if (!disposed) callbacks.current.onError?.(err);
    });
    return () => {
      disposed = true;
      apiRef.current?.dispose();
      apiRef.current = null;
    };
  }, []);

  useEffect(() => {
    apiRef.current?.select(index);
  }, [index]);

  useEffect(() => {
    apiRef.current?.setTrophies(unlocked);
  }, [unlocked]);

  return <div ref={hostRef} className="sala-canvas" />;
}
