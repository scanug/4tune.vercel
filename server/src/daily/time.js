// Il "giorno" della sfida è quello del calendario di Roma: cambia a
// mezzanotte ora italiana, con l'ora legale gestita da Intl.

const TZ = 'Europe/Rome';
export const DAY_ONE = '2026-10-04'; // sfida #1

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

// "YYYY-MM-DD" del giorno di Roma che contiene l'istante `now`.
export function romeDay(now = Date.now()) {
  return dayFormat.format(new Date(now));
}

function dayToUtcMs(day) {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(day, n) {
  return new Date(dayToUtcMs(day) + n * 86_400_000).toISOString().slice(0, 10);
}

export function daysBetween(from, to) {
  return Math.round((dayToUtcMs(to) - dayToUtcMs(from)) / 86_400_000);
}

export function dayNumber(day) {
  return daysBetween(DAY_ONE, day) + 1;
}

// Scarto (ms) di Roma rispetto a UTC in un certo istante: +1h o +2h.
function romeOffsetMs(at) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' })
    .formatToParts(new Date(at));
  const name = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT+1';
  const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 3_600_000 + Number(m[3] || 0) * 60_000);
}

// Istante UTC della prossima mezzanotte di Roma.
export function nextRomeMidnight(now = Date.now()) {
  const tomorrow = addDays(romeDay(now), 1);
  const guess = dayToUtcMs(tomorrow);
  // L'offset va letto attorno alla mezzanotte stessa (cambi d'ora a fine marzo/ottobre).
  return guess - romeOffsetMs(guess - romeOffsetMs(guess));
}
