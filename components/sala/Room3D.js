'use client';

import { useEffect, useRef } from 'react';

// three.js si carica solo qui, quando si apre la Sala, e non pesa sul resto del sito.
export default function Room3D({ onReady, onError }) {
  const hostRef = useRef(null);
  const callbacks = useRef({ onReady, onError });
  callbacks.current = { onReady, onError };

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const [THREE, { OrbitControls }, { buildRoom }] = await Promise.all([
        import('three'),
        import('three/examples/jsm/controls/OrbitControls.js'),
        import('./buildRoom'),
      ]);
      if (disposed || !hostRef.current) return;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      cleanup = buildRoom(THREE, OrbitControls, hostRef.current, { reducedMotion });
      callbacks.current.onReady?.();
    })().catch((err) => {
      console.error('Sala 3D non disponibile', err);
      if (!disposed) callbacks.current.onError?.(err);
    });
    return () => { disposed = true; cleanup(); };
  }, []);

  return <div ref={hostRef} className="sala-canvas" />;
}
