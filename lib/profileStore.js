// Copia locale del profilo condiviso: l'id di questo dispositivo e gli spazi
// degli altri dispositivi scaricati all'ultima sincronizzazione (lib/profile.js).
// Le statistiche e i trofei di questo dispositivo restano dove erano
// (lib/stats.js, lib/trophies.js), che li uniscono a quelli qui.

const DEVICE_KEY = '4tune_device';
const REMOTE_KEY = '4tune_profile_remote'; // { syncedAt, devices: { [deviceId]: { stats, trophies, updatedAt } } }

function storage() {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}

export function deviceId() {
  const store = storage();
  let id = store?.getItem(DEVICE_KEY);
  if (!id) {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    try { store?.setItem(DEVICE_KEY, id); } catch { /* storage bloccato: un id nuovo a ogni visita */ }
  }
  return id;
}

export function readRemote() {
  try {
    const data = JSON.parse(storage()?.getItem(REMOTE_KEY) || 'null');
    if (data && typeof data.devices === 'object' && data.devices) return data;
  } catch { /* dati rovinati: si riscaricano */ }
  return { syncedAt: 0, devices: {} };
}

export function writeRemote(data) {
  try { storage()?.setItem(REMOTE_KEY, JSON.stringify(data)); } catch { /* storage pieno o bloccato */ }
}

// Spazi degli altri dispositivi, come lista.
export function remoteSlots() {
  return Object.values(readRemote().devices).filter((d) => d && typeof d === 'object');
}
