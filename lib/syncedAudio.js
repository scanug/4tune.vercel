// Riproduzione sincronizzata delle clip con la Web Audio API.
// A differenza di <audio>.play(), AudioBufferSourceNode.start(when, offset)
// parte al campione esatto sull'orologio audio, senza la latenza variabile
// di avvio e senza dipendere da quanto è stato bufferizzato: la clip viene
// scaricata e decodificata tutta prima, poi programmata per l'istante del server.
// Il CDN delle preview Deezer risponde con Access-Control-Allow-Origin: *.

const MAX_CACHED = 3;

export function createSyncedAudio() {
  let ctx = null;
  let source = null;
  let token = 0;
  const buffers = new Map(); // url -> Promise<AudioBuffer>

  function context() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC({ latencyHint: 'interactive' });
    }
    return ctx;
  }

  function decode(data) {
    const c = context();
    // Safari vecchi conoscono solo la versione a callback.
    return new Promise((resolve, reject) => {
      const p = c.decodeAudioData(data, resolve, reject);
      if (p?.then) p.then(resolve, reject);
    });
  }

  // Scarica e decodifica in anticipo; più chiamate sullo stesso URL condividono il lavoro.
  function preload(url) {
    if (!url) return null;
    if (buffers.has(url)) return buffers.get(url);
    const job = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Clip non disponibile (${res.status})`);
        return res.arrayBuffer();
      })
      .then(decode)
      .catch((err) => {
        buffers.delete(url); // si riprova al prossimo tentativo
        throw err;
      });
    buffers.set(url, job);
    while (buffers.size > MAX_CACHED) buffers.delete(buffers.keys().next().value);
    return job;
  }

  // Da chiamare dentro un gesto dell'utente (Safari iOS lo pretende).
  function unlock() {
    // Senza questo, su iOS la Web Audio tace con l'interruttore silenzioso attivo.
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* non supportato */ }
    const c = context();
    c.resume?.();
    const silent = c.createBuffer(1, 1, 22050);
    const s = c.createBufferSource();
    s.buffer = silent;
    s.connect(c.destination);
    s.start(0);
  }

  function stop() {
    token += 1;
    if (source) {
      try { source.stop(); } catch { /* già fermo */ }
      source.disconnect();
      source = null;
    }
  }

  // Fa uscire dagli altoparlanti l'istante `startAt` (ora del server, ms) della
  // clip in coincidenza con lo stesso istante sugli altri dispositivi. Se si
  // arriva in ritardo (download lento, ingresso a round iniziato) si salta avanti.
  async function play(url, startAt, serverNow) {
    stop();
    const mine = token;
    const c = context();
    if (c.state !== 'running') await c.resume?.().catch(() => {});
    const buffer = await preload(url);
    if (mine !== token) return;

    // outputLatency: tempo tra la programmazione e l'uscita reale (Bluetooth incluso
    // dove il browser lo sa). Safari espone solo baseLatency.
    const latency = c.outputLatency || c.baseLatency || 0;
    const lead = (startAt - serverNow()) / 1000 - latency;
    const offset = Math.max(0, -lead);
    if (offset >= buffer.duration) return;

    const s = c.createBufferSource();
    s.buffer = buffer;
    s.connect(c.destination);
    s.start(c.currentTime + Math.max(0, lead), offset);
    source = s;
  }

  function close() {
    stop();
    buffers.clear();
    ctx?.close?.().catch(() => {});
    ctx = null;
  }

  return { unlock, preload, play, stop, close };
}
