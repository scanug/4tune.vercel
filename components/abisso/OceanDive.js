import PixelIcon from '@/components/PixelIcon';

const MARKERS = [
  { depth: 0, label: 'Superficie' },
  { depth: 200, label: 'La luce si affievolisce' },
  { depth: 1000, label: 'Zona crepuscolare' },
  { depth: 2000, label: 'Zona di mezzanotte' },
  { depth: 3800, label: 'Pianura abissale' },
  { depth: 6000, label: 'Fosse oceaniche' },
  { depth: 7000, label: 'Fondo della sfida' },
];

export default function OceanDive({ depth = 0, maxDepth = 7000, result = null, compact = false }) {
  const progress = Math.max(0, Math.min(1, depth / maxDepth));
  return (
    <section className={`ocean-dive${compact ? ' compact' : ''}${result ? ' sinking' : ''}`} aria-label={`Profondità raggiunta: ${depth} metri su ${maxDepth}`}>
      <div className="ocean-head">
        <span>Profondità</span>
        <strong>{depth.toLocaleString('it-IT')} m</strong>
      </div>
      <div className="ocean-water">
        <div className="ocean-rays" aria-hidden="true" />
        <div className="ocean-bubbles" aria-hidden="true"><i /><i /><i /><i /></div>
        {MARKERS.map((marker) => (
          <div
            key={marker.depth}
            className={`ocean-marker${depth >= marker.depth ? ' passed' : ''}`}
            style={{ '--at': `${(marker.depth / maxDepth) * 100}%` }}
          >
            <span>{marker.label}</span>
          </div>
        ))}
        <div className="ocean-line" aria-hidden="true" style={{ height: `${progress * 100}%` }} />
        <div className="ocean-sub" aria-hidden="true" style={{ top: `${progress * 100}%` }}>
          <PixelIcon name="submarine" size={compact ? 32 : 42} />
        </div>
      </div>
      <div className="ocean-foot"><span>0 m</span><span>{maxDepth.toLocaleString('it-IT')} m</span></div>
    </section>
  );
}
