import Link from 'next/link';

const GAMES = [
  {
    href: '/gts',
    emoji: '🎵',
    title: 'GTS – Guess the Song',
    description: 'Indovina il brano prima degli altri con clip sincronizzate. Online, con codice stanza.',
    background: '#fdf4ff',
  },
  {
    href: '/anno',
    emoji: '📅',
    title: "Indovina l'Anno",
    description: 'Quando è nato Vasco? In che anno è uscito Titanic? Chi si avvicina di più vince. Online, con codice stanza.',
    background: '#fefce8',
  },
  {
    href: '/impostore',
    emoji: '🕵️',
    title: 'Impostore',
    description: 'Scopri chi sta bluffando tra i tuoi amici. Un solo telefono, si gioca dal vivo.',
    background: '#f0f9ff',
  },
];

export default function HomePage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 'min(800px, 94vw)', textAlign: 'center', border: '2px solid #111827', borderRadius: 12, background: 'rgba(255,255,255,0.9)', boxShadow: '0 12px 0 #111827, 0 12px 24px rgba(0,0,0,0.2)', padding: 32 }}>
        <h1 style={{ margin: '0 0 12px', letterSpacing: 2, textTransform: 'uppercase', color: '#111827', fontSize: '2.2rem' }}>
          🎲 4Tune 🎵
        </h1>
        <p style={{ margin: '0 0 24px', color: '#111827', opacity: 0.85 }}>
          Party game gratuiti, senza registrazione. Scegli e gioca.
        </p>

        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12, textAlign: 'left' }}>
          {GAMES.map((game) => (
            <li key={game.href} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, border: '1px solid rgba(17,24,39,0.2)', borderRadius: 10, padding: '12px 14px', background: game.background }}>
              <div>
                <div style={{ fontWeight: 800, color: '#111827' }}>{game.emoji} {game.title}</div>
                <div style={{ fontSize: 13, opacity: 0.85, color: '#111827', marginTop: 4 }}>{game.description}</div>
              </div>
              <Link href={game.href} className="btn-3d" style={{ textDecoration: 'none', flexShrink: 0 }}>Gioca</Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
