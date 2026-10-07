// Musica 16-bit generata al volo con WebAudio: niente file audio da scaricare.
// Un solo motore per tutto il sito; MusicController decide quale brano suona.

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function freq(name) {
  const m = /^([A-G]#?)(\d)$/.exec(name);
  const midi = (Number(m[2]) + 1) * 12 + NOTE[m[1]];
  return 440 * 2 ** ((midi - 69) / 12);
}

const CHORDS = {
  C: ['C', 'E', 'G'], Am: ['A', 'C', 'E'], F: ['F', 'A', 'C'], G: ['G', 'B', 'D'],
  Em: ['E', 'G', 'B'], Dm: ['D', 'F', 'A'],
};

// Melodia: per ogni battuta una lista di [passo, nota, durata] in sedicesimi.
const TRACKS = {
  menu: {
    bpm: 128,
    chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'],
    drums: true,
    lead: [
      [[0, 'E5', 2], [2, 'G5', 2], [4, 'C6', 4], [8, 'B5', 2], [10, 'G5', 2], [12, 'E5', 4]],
      [[0, 'A5', 2], [2, 'C6', 2], [4, 'E6', 4], [8, 'D6', 2], [10, 'C6', 2], [12, 'A5', 4]],
      [[0, 'F5', 2], [2, 'A5', 2], [4, 'C6', 2], [6, 'A5', 2], [8, 'F5', 2], [10, 'A5', 2], [12, 'C6', 4]],
      [[0, 'B5', 2], [2, 'D6', 2], [4, 'G6', 4], [8, 'F6', 2], [10, 'D6', 2], [12, 'B5', 2], [14, 'G5', 2]],
      [[0, 'E5', 2], [2, 'G5', 2], [4, 'C6', 4], [8, 'E6', 2], [10, 'D6', 2], [12, 'C6', 4]],
      [[0, 'C6', 2], [2, 'B5', 2], [4, 'A5', 4], [8, 'E5', 2], [10, 'A5', 2], [12, 'C6', 4]],
      [[0, 'A5', 3], [3, 'G5', 3], [6, 'F5', 2], [8, 'A5', 2], [10, 'C6', 2], [12, 'F6', 4]],
      [[0, 'D6', 4], [4, 'B5', 4], [8, 'G5', 8]],
    ],
  },
  sala: {
    bpm: 92,
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'Em'],
    drums: false,
    lead: [
      [[0, 'A4', 4], [4, 'C5', 4], [8, 'E5', 6], [14, 'D5', 2]],
      [[0, 'C5', 4], [4, 'A4', 4], [8, 'F4', 8]],
      [[0, 'E5', 4], [4, 'G5', 4], [8, 'E5', 4], [12, 'C5', 4]],
      [[0, 'D5', 6], [6, 'B4', 2], [8, 'G4', 8]],
      [[0, 'A4', 4], [4, 'E5', 4], [8, 'A5', 6], [14, 'G5', 2]],
      [[0, 'F5', 4], [4, 'E5', 4], [8, 'C5', 8]],
      [[0, 'D5', 4], [4, 'F5', 4], [8, 'A5', 4], [12, 'F5', 4]],
      [[0, 'E5', 6], [6, 'G5', 2], [8, 'B4', 8]],
    ],
  },
};

const STEPS_PER_BAR = 16;
const LOOKAHEAD = 0.15;
const MUTE_KEY = '4tune_muted';

class Chiptune {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.track = null;      // brano richiesto
    this.playing = null;    // brano che sta suonando
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.listeners = new Set();
    this.suppressed = 0;    // pagine che chiedono silenzio (es. partita in corso)
    this.muted = false;
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* default: audio acceso */ }
  }

  // Da chiamare dentro un gesto dell'utente (tap, tasto): i browser lo esigono.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      document.addEventListener('visibilitychange', () => this._sync());
    }
    this.ctx.resume?.();
    this._sync();
  }

  get unlocked() { return !!this.ctx; }

  setTrack(id) {
    this.track = TRACKS[id] ? id : null;
    this._sync();
  }

  setMuted(muted) {
    this.muted = muted;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* ignora */ }
    this._sync();
    this.listeners.forEach((fn) => fn());
  }

  // Silenzia la musica finché non si chiama la funzione restituita
  suppress() {
    this.suppressed += 1;
    this._sync();
    let done = false;
    return () => {
      if (done) return;
      done = true;
      this.suppressed -= 1;
      this._sync();
    };
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _sync() {
    if (!this.ctx) return;
    const want = !this.muted && !this.suppressed && !document.hidden ? this.track : null;
    if (want === this.playing) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    if (!want) {
      this.master.gain.linearRampToValueAtTime(0, t + 0.3);
      clearInterval(this.timer);
      this.timer = null;
      this.playing = null;
      return;
    }
    this.playing = want;
    this.step = 0;
    this.nextTime = t + 0.05;
    this.master.gain.linearRampToValueAtTime(0.13, t + 0.6);
    clearInterval(this.timer);
    this.timer = setInterval(() => this._schedule(), 30);
    this._schedule();
  }

  _schedule() {
    const track = TRACKS[this.playing];
    if (!track) return;
    const stepDur = 60 / track.bpm / 4;
    const total = track.chords.length * STEPS_PER_BAR;
    // Se il timer è rimasto indietro (tab lenta) si riparte da adesso invece di recuperare
    if (this.nextTime < this.ctx.currentTime - 0.2) this.nextTime = this.ctx.currentTime + 0.02;
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD) {
      this._playStep(track, this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % total;
    }
  }

  _playStep(track, step, t, dur) {
    const bar = Math.floor(step / STEPS_PER_BAR);
    const s = step % STEPS_PER_BAR;
    const chord = CHORDS[track.chords[bar]];

    for (const [at, note, len] of track.lead[bar]) {
      if (at === s) this._tone('square', freq(note), t, dur * len * 0.92, 0.22);
    }
    // Arpeggio veloce sugli accordi
    const arpNote = chord[s % 3] + (s % 6 < 3 ? '4' : '5');
    this._tone('square', freq(arpNote), t, dur * 0.6, 0.06);
    // Basso a ottave
    if (s % 2 === 0) {
      const oct = (s / 2) % 2 === 0 ? '2' : '3';
      this._tone('triangle', freq(chord[0] + oct), t, dur * 1.8, 0.5);
    }
    if (track.drums) {
      if (s === 0 || s === 8) this._kick(t);
      if (s === 4 || s === 12) this._noise(t, 0.12, 0.35, 1500);
      if (s % 2 === 0) this._noise(t, 0.03, 0.12, 7000);
    } else if (s % 4 === 2) {
      this._noise(t, 0.03, 0.05, 8000);
    }
  }

  _tone(type, f, t, dur, vol) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = f;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.setValueAtTime(vol * 0.7, t + Math.min(0.05, dur * 0.5));
    g.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noise(t, dur, vol, hp) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.01);
  }

  _kick(t) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.15);
  }
}

let instance = null;
export function getMusic() {
  if (typeof window === 'undefined') return null;
  if (!instance) instance = new Chiptune();
  return instance;
}

// Vale anche per gli effetti sonori del sito (es. Passa la Bomba)
export function isAudioMuted() {
  return getMusic()?.muted ?? false;
}
