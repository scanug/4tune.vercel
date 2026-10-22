'use client';

// Stili condivisi delle pagine "Completa la barra", coerenti con il resto del sito
export const pageStyle = { minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px 12px 40px' };
export const cardStyle = {
  width: 'min(680px, 100%)', border: '2px solid rgba(17,24,39,0.2)', borderRadius: 18,
  background: 'rgba(255,255,255,0.94)', boxShadow: '0 20px 50px rgba(0,0,0,0.25)', padding: 'clamp(14px, 4vw, 28px)', color: '#111827',
};
export const panelStyle = { border: '1px solid rgba(17,24,39,0.12)', borderRadius: 14, padding: 14, background: 'rgba(99,102,241,0.04)' };
export const readable = { fontFamily: 'var(--font-geist-sans), Arial, sans-serif', letterSpacing: 0 };
export const muted = { color: '#6b7280', fontSize: 12 };

export function Chip({ active, onClick, children, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...readable, padding: '8px 12px', borderRadius: 999, fontSize: 14, cursor: disabled ? 'default' : 'pointer',
        border: active ? '2px solid #4f46e5' : '1px solid rgba(17,24,39,0.2)',
        background: active ? 'rgba(79,70,229,0.12)' : '#fff', color: '#111827', fontWeight: active ? 700 : 500,
      }}
    >
      {children}
    </button>
  );
}

export function Banner({ tone = 'info', children }) {
  const tones = {
    info: { bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.35)', color: '#312e81' },
    warn: { bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.45)', color: '#92400e' },
    error: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.4)', color: '#991b1b' },
    ok: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.4)', color: '#065f46' },
  }[tone];
  return (
    <div style={{ ...readable, padding: '10px 12px', borderRadius: 12, background: tones.bg, border: `1px solid ${tones.border}`, color: tones.color, fontSize: 14 }}>
      {children}
    </div>
  );
}

export function Loading({ text = 'Caricamento...' }) {
  return <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{text}</main>;
}
