// Client della gestione catalogo di "Completa la barra". Niente account:
// l'accesso è il codice ADMIN_TOKEN impostato sul server, che il browser
// ricorda dopo il primo inserimento.

import { SERVER_URL } from './gameClient';

const TOKEN_KEY = '4tune_barra_admin';

function storage() {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}

export function getAdminToken() {
  return storage()?.getItem(TOKEN_KEY) || '';
}

export function setAdminToken(token) {
  if (token) storage()?.setItem(TOKEN_KEY, token);
  else storage()?.removeItem(TOKEN_KEY);
}

export async function adminFetch(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${SERVER_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${getAdminToken()}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new Error('Server di gioco non raggiungibile');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Errore ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const adminApi = {
  catalog: () => adminFetch('/barra/admin/catalog'),
  op: (op, data) => adminFetch('/barra/admin/op', { method: 'POST', body: { op, data } }),
  verifyYouTube: (ref) => adminFetch(`/barra/admin/verify?youtube=${encodeURIComponent(ref)}`),
  verifyDeezer: (id) => adminFetch(`/barra/admin/verify?deezer=${encodeURIComponent(id)}`),
  deezerSearch: (q) => adminFetch(`/barra/admin/deezer?q=${encodeURIComponent(q)}`),
  musixmatch: (params) => adminFetch(`/barra/admin/musixmatch?${new URLSearchParams(params)}`),
};

export function formatMs(ms) {
  if (ms == null || !Number.isFinite(ms)) return '';
  const total = Math.max(0, ms) / 1000;
  const m = Math.floor(total / 60);
  const s = (total - m * 60).toFixed(2).padStart(5, '0');
  return `${m}:${s}`;
}

// Accetta "1:23.45", "83.45", "83"
export function parseTime(str) {
  const s = String(str || '').trim().replace(',', '.');
  if (!s) return null;
  const parts = s.split(':');
  if (parts.length > 2) return null;
  const sec = Number(parts.pop());
  const min = parts.length ? Number(parts[0]) : 0;
  if (!Number.isFinite(sec) || !Number.isFinite(min) || sec < 0 || min < 0) return null;
  return Math.round((min * 60 + sec) * 1000);
}
