// Aritmetica e formattazione dei prezzi di "Quanto costa?", condivise da
// slider e reveal. Lo slider lavora in scala logaritmica: le stesse
// arrotondature del server (games/prezzo.js) così il valore mostrato è
// esattamente quello che viene inviato.

export const SLIDER_STEPS = 1000;

const SYMBOL = { EUR: '€', USD: '$' };

// Al centesimo sotto i 10, a tre cifre significative sopra (979, 1.490, 222 milioni).
export function roundPrice(value) {
  if (value < 10) return Math.max(0.01, Math.round(value * 100) / 100);
  const unit = 10 ** (Math.floor(Math.log10(value)) - 2);
  return Number((Math.round(value / unit) * unit).toPrecision(12));
}

// Il passo più piccolo che l'arrotondamento lascia distinguere.
function smallestStep(value) {
  return value < 10 ? 0.01 : 10 ** (Math.floor(Math.log10(value)) - 2);
}

function clampTo(range, value) {
  return Math.min(range.max, Math.max(range.min, value));
}

export function sliderToPrice(position, range) {
  const k = position / SLIDER_STEPS;
  return clampTo(range, roundPrice(range.min * (range.max / range.min) ** k));
}

export function priceToSlider(value, range) {
  const k = Math.log(value / range.min) / Math.log(range.max / range.min);
  return Math.round(Math.min(1, Math.max(0, k)) * SLIDER_STEPS);
}

// Il centro "visivo" dello slider: la media geometrica dei bordi.
export function middlePrice(range) {
  return clampTo(range, roundPrice(Math.sqrt(range.min * range.max)));
}

// Sposta il prezzo di una percentuale (±1%, ±10%). Se l'arrotondamento lo
// lascerebbe fermo, avanza comunque di un passo.
export function stepPrice(value, pct, range) {
  let next = roundPrice(value * (1 + pct));
  if (next === value) next = roundPrice(value + Math.sign(pct) * smallestStep(value));
  return clampTo(range, next);
}

// "1234567.5" → "1.234.567,5": il punto per le migliaia sempre, anche a
// quattro cifre (toLocaleString in italiano scrive "1000").
function formatNumber(n, decimals, { keepZeros = false } = {}) {
  let [int, frac = ''] = n.toFixed(decimals).split('.');
  if (!keepZeros) frac = frac.replace(/0+$/, '');
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return frac ? `${int},${frac}` : int;
}

// Tre cifre significative per i milioni e i miliardi dello slider ("1,5",
// "222", "44"); con `exact` il prezzo del reveal senza perdere decimali.
function formatScaled(n, exact) {
  if (exact) return formatNumber(n, 3);
  const decimals = Math.max(0, 2 - Math.floor(Math.log10(n)));
  return formatNumber(Number(n.toPrecision(3)), decimals);
}

// "1,20 €", "979 €", "1.490 €", "1,5 mln $", "44 mld $". Senza `unit` niente
// simbolo (per le tacche dell'asse).
export function formatPrice(value, unit, { exact = false } = {}) {
  const v = Number(value);
  if (!Number.isFinite(v)) return '—';
  const sym = unit ? ` ${SYMBOL[unit] || unit}` : '';
  if (v >= 1e9) return `${formatScaled(v / 1e9, exact)} mld${sym}`;
  if (v >= 1e6) return `${formatScaled(v / 1e6, exact)} mln${sym}`;
  if (Number.isInteger(v) || (v >= 1000 && !exact)) return `${formatNumber(Math.round(v), 0)}${sym}`;
  return `${formatNumber(v, 2, { keepZeros: true })}${sym}`;
}

// Quanto si è sbagliato rispetto al prezzo vero: "+12%", "−40%"; oltre ×10
// in eccesso o in difetto la percentuale non dice più nulla e si usa "×12" / "÷12".
export function formatOff(guess, price) {
  const ratio = guess / price;
  if (ratio >= 10) return `×${Math.round(ratio)}`;
  if (ratio <= 0.1) return `÷${Math.round(1 / ratio)}`;
  const pct = Math.round((ratio - 1) * 100);
  if (pct === 0) return '±0%';
  return pct > 0 ? `+${pct}%` : `−${Math.abs(pct)}%`;
}

// Corpo dei numeri grandi in base alla lunghezza: il font pixel è largo e
// "34.000 mld $" deve stare in un telefono quanto "979 €".
export function bigFontSize(text, maxPx = 56) {
  const vw = Math.min(11, 72 / Math.max(4, String(text).length));
  return `clamp(20px, ${vw.toFixed(2)}vw, ${maxPx}px)`;
}
