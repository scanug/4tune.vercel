'use client';

// Astrazione minima dei provider audio lato client.
// Interfaccia comune (via ref): playClip(), stop(), resume(), currentMs().
// Callback: onReady(), onError(kind, message, code), onState(state)
//   kind: 'content' (contenuto non riproducibile) | 'local' (problema del dispositivo/rete)
//   state: 'playing' | 'ended' | 'blocked' | 'paused'
// YouTube: player ufficiale incorporato e sempre visibile, nessuna copertura.
// La precisione del taglio dipende dal player (polling ~50 ms): non è garantita al millisecondo.

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

let ytPromise = null;
function loadYouTubeApi() {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytPromise) return ytPromise;
  ytPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (typeof prev === 'function') prev(); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => { ytPromise = null; reject(new Error('API YouTube non raggiungibile')); };
    document.head.appendChild(s);
  });
  return ytPromise;
}

// Codici documentati dell'IFrame Player API
const YT_CONTENT_ERRORS = {
  2: 'Parametri del video non validi',
  100: 'Video rimosso, privato o non trovato',
  101: "Il proprietario non consente l'incorporamento",
  150: "Il proprietario non consente l'incorporamento",
};
const YT_LOCAL_ERRORS = {
  5: 'Errore del player HTML5 su questo dispositivo',
  153: 'Il player YouTube ha rifiutato la richiesta (referrer)',
};

const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
let sharedAudio = null;
function getSharedAudio() {
  if (!sharedAudio && typeof Audio !== 'undefined') sharedAudio = new Audio();
  return sharedAudio;
}

// Da chiamare dentro un gesto dell'utente ("Attiva audio / Sono pronto"):
// sblocca l'elemento audio condiviso (iOS) e registra l'attivazione della pagina.
export function unlockAudio() {
  const a = getSharedAudio();
  if (!a) return;
  try {
    if (!a.src) a.src = SILENT_WAV;
    const p = a.play();
    if (p && p.then) p.then(() => a.pause()).catch(() => {});
  } catch {}
}

function useLatest(value) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

const YouTubeClip = forwardRef(function YouTubeClip({ playback, onReady, onError, onState, locked }, ref) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const pollRef = useRef(null);
  const blockedRef = useRef(null);
  const clipActive = useRef(false);
  const cb = useLatest({ onReady, onError, onState });
  const range = useLatest({ startMs: playback.startMs, stopMs: playback.stopMs });
  const lockedRef = useLatest(locked);

  function clearTimers() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (blockedRef.current) clearTimeout(blockedRef.current);
    pollRef.current = null;
    blockedRef.current = null;
  }

  useEffect(() => {
    let destroyed = false;
    const host = hostRef.current;
    loadYouTubeApi().then((YT) => {
      if (destroyed || !host) return;
      const el = document.createElement('div');
      host.appendChild(el);
      playerRef.current = new YT.Player(el, {
        videoId: playback.videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          playsinline: 1,
          rel: 0,
          start: Math.floor((range.current.startMs || 0) / 1000),
          origin: window.location.origin,
        },
        events: {
          onReady: () => { if (!destroyed) cb.current.onReady?.(); },
          onError: (e) => {
            if (destroyed) return;
            clipActive.current = false;
            clearTimers();
            if (YT_CONTENT_ERRORS[e.data]) cb.current.onError?.('content', YT_CONTENT_ERRORS[e.data], e.data);
            else cb.current.onError?.('local', YT_LOCAL_ERRORS[e.data] || `Errore YouTube ${e.data}`, e.data);
          },
          onStateChange: (e) => {
            if (destroyed) return;
            const S = window.YT.PlayerState;
            if (e.data === S.PLAYING) {
              if (blockedRef.current) { clearTimeout(blockedRef.current); blockedRef.current = null; }
              // Ascolto chiuso: se qualcuno riavvia il video lo rimettiamo in pausa
              if (lockedRef.current && !clipActive.current) { playerRef.current?.pauseVideo(); return; }
              cb.current.onState?.('playing');
            } else if (e.data === S.PAUSED && clipActive.current) {
              cb.current.onState?.('paused');
            }
          },
        },
      });
    }).catch((err) => { if (!destroyed) cb.current.onError?.('local', err.message || 'Player YouTube non disponibile'); });

    return () => {
      destroyed = true;
      clearTimers();
      try { playerRef.current?.destroy(); } catch {}
      playerRef.current = null;
      if (host) host.innerHTML = '';
    };
  }, [playback.videoId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (locked && !clipActive.current) {
      try { playerRef.current?.pauseVideo?.(); } catch {}
    }
  }, [locked]);

  useImperativeHandle(ref, () => ({
    playClip() {
      const p = playerRef.current;
      if (!p?.seekTo) return false;
      clearTimers();
      clipActive.current = true;
      const { startMs } = range.current;
      p.seekTo(startMs / 1000, true);
      p.playVideo();
      // Se dopo qualche secondo non è partito, probabilmente l'autoplay è bloccato
      blockedRef.current = setTimeout(() => {
        const st = p.getPlayerState?.();
        if (clipActive.current && st !== window.YT.PlayerState.PLAYING && st !== window.YT.PlayerState.BUFFERING) {
          cb.current.onState?.('blocked');
        }
      }, 2500);
      pollRef.current = setInterval(() => {
        const t = (p.getCurrentTime?.() || 0) * 1000;
        if (t >= range.current.stopMs - 40) {
          clipActive.current = false;
          clearTimers();
          p.pauseVideo();
          cb.current.onState?.('ended');
        }
      }, 50);
      return true;
    },
    resume() {
      // Chiamato da un tocco dell'utente se l'autoplay era bloccato
      const p = playerRef.current;
      if (!p) return;
      clipActive.current = true;
      if ((p.getCurrentTime?.() || 0) * 1000 < range.current.startMs - 500) p.seekTo(range.current.startMs / 1000, true);
      p.playVideo();
    },
    stop() {
      clipActive.current = false;
      clearTimers();
      try { playerRef.current?.pauseVideo(); } catch {}
    },
    currentMs() {
      return Math.round((playerRef.current?.getCurrentTime?.() || 0) * 1000);
    },
  }));

  return (
    <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
});

const DeezerClip = forwardRef(function DeezerClip({ playback, onReady, onError, onState }, ref) {
  const pollRef = useRef(null);
  const clipActive = useRef(false);
  const cb = useLatest({ onReady, onError, onState });
  const range = useLatest({ startMs: playback.startMs, stopMs: playback.stopMs });

  useEffect(() => {
    const a = getSharedAudio();
    if (!a) return undefined;
    let done = false;
    const ready = () => { if (!done) { done = true; cb.current.onReady?.(); } };
    const fail = () => { if (!done) { done = true; cb.current.onError?.('local', 'Preview Deezer non caricabile'); } };
    a.pause();
    a.addEventListener('canplay', ready);
    a.addEventListener('error', fail);
    a.preload = 'auto';
    a.src = playback.previewUrl;
    a.load();
    return () => {
      a.removeEventListener('canplay', ready);
      a.removeEventListener('error', fail);
      if (pollRef.current) clearInterval(pollRef.current);
      a.pause();
    };
  }, [playback.previewUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  function startPoll(a) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (a.currentTime * 1000 >= range.current.stopMs - 30) {
        clipActive.current = false;
        clearInterval(pollRef.current);
        a.pause();
        cb.current.onState?.('ended');
      }
    }, 40);
  }

  function play(a) {
    a.play().then(() => cb.current.onState?.('playing')).catch((e) => {
      cb.current.onState?.(e?.name === 'NotAllowedError' ? 'blocked' : 'paused');
    });
    startPoll(a);
  }

  useImperativeHandle(ref, () => ({
    playClip() {
      const a = getSharedAudio();
      if (!a) return false;
      clipActive.current = true;
      a.currentTime = range.current.startMs / 1000;
      play(a);
      return true;
    },
    resume() {
      const a = getSharedAudio();
      if (a) play(a);
    },
    stop() {
      clipActive.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
      getSharedAudio()?.pause();
    },
    currentMs() {
      return Math.round((getSharedAudio()?.currentTime || 0) * 1000);
    },
  }));

  return (
    <div style={{ padding: 14, borderRadius: 12, background: '#111827', color: '#fff', fontSize: 12, textAlign: 'center' }}>
      🎧 Anteprima audio di 30 secondi fornita da Deezer
    </div>
  );
});

const ClipPlayer = forwardRef(function ClipPlayer({ playback, ...rest }, ref) {
  if (!playback) return null;
  if (playback.provider === 'youtube') return <YouTubeClip ref={ref} playback={playback} {...rest} />;
  if (playback.provider === 'deezer') return <DeezerClip ref={ref} playback={playback} {...rest} />;
  return <p style={{ color: '#dc2626' }}>Provider audio non supportato</p>;
});

export default ClipPlayer;
