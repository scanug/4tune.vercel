import Link from 'next/link';
import PixelIcon from '../components/PixelIcon';
import { GAMES } from '../lib/games';

export default function HomePage() {
  return (
    <main className="home">
      <header className="home-hero">
        <p className="home-kicker"><span className="blink">★</span> INSERT COIN <span className="blink">★</span></p>
        <h1 className="home-logo" aria-label="4Tune">
          <span className="home-logo-4">4</span>TUNE
        </h1>
        <p className="home-sub">Party game gratis · niente registrazione</p>
      </header>

      <nav aria-label="Giochi">
        <ul className="home-grid">
          {GAMES.map((game, i) => (
            <li key={game.id} style={{ '--i': i }}>
              <Link href={game.href} className="game-card" style={{ '--accent': game.accent }}>
                <span className="game-icon">
                  <PixelIcon name={game.icon} size={48} />
                </span>
                <span className="game-body">
                  <span className="game-title">
                    {game.title}
                    {game.isNew && <span className="game-new">NEW</span>}
                  </span>
                  <span className="game-desc">{game.description}</span>
                  <span className="game-tags">
                    {game.tags.map((t) => <span key={t}>{t}</span>)}
                  </span>
                </span>
                <span className="game-play" aria-hidden="true">▶</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <footer className="home-foot">
        <span>{GAMES.length} giochi</span>
        <span aria-hidden="true">·</span>
        <span>free to play</span>
      </footer>

      <Link href="/sala" className="room-fab" aria-label="Apri la Sala Trofei 3D">
        <PixelIcon name="trophy" size={28} />
        <span>Sala 3D</span>
      </Link>
    </main>
  );
}
