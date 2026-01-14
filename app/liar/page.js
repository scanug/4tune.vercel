'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { auth } from '@/lib/firebase';
import Link from 'next/link';

export default function LiarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleHostGame = () => {
    setLoading(true);
    router.push('/liar/host');
  };

  const handleJoinGame = () => {
    setLoading(true);
    router.push('/liar/join');
  };

  if (!auth.currentUser) {
    router.push('/auth');
    return null;
  }

  return (
    <div className="liar-home">
      {/* VIDEO BACKGROUND */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="video-background"
      >
        <source src="/background_ll.mp4" type="video/mp4" />
      </video>
      <div className="video-overlay"></div>

      {/* BACKGROUND DECORATIVE ELEMENTS */}
      <div className="background-blur blur-1"></div>
      <div className="background-blur blur-2"></div>
      <div className="background-blur blur-3"></div>

      {/* HEADER */}
      <header className="liar-header">
        <Link href="/hub" className="back-button">
          ← Indietro
        </Link>
        <h1 className="site-title">🎭 Lucky Liar</h1>
        <div className="spacer"></div>
      </header>

      {/* MAIN CONTENT */}
      <main className="liar-main">
        {/* HERO SECTION */}
        <section className="hero">
          <div className="hero-content">
            <div className="hero-icon">🎭</div>
            <h1 className="hero-title">Lucky Liar</h1>
            <p className="hero-subtitle">Il Gioco della Menzogna Psicologica</p>
            <p className="hero-description">
              Dichiarazioni audaci, sfide strategiche e colpi di scena con i wildcard. 
              Puoi fidarti dei tuoi avversari? O sono abili bugiardi?
            </p>

            {/* FEATURES */}
            <div className="features-grid">
              <div className="feature">
                <div className="feature-icon">📢</div>
                <h3>Dichiarazioni</h3>
                <p>Dichiara le carte che hai (o che non hai)</p>
              </div>
              <div className="feature">
                <div className="feature-icon">⚔️</div>
                <h3>Sfide</h3>
                <p>Sfida gli altri giocatori quando sospetti bugie</p>
              </div>
              <div className="feature">
                <div className="feature-icon">⚡</div>
                <h3>Wildcard</h3>
                <p>Usa power-up per stravolgere il gioco</p>
              </div>
              <div className="feature">
                <div className="feature-icon">💰</div>
                <h3>Crediti</h3>
                <p>Vinci e perdi crediti ad ogni round</p>
              </div>
            </div>
          </div>

          {/* GAME PREVIEW VISUAL */}
          <div className="game-preview">
            <div className="card card-1">
              <span className="card-suit">♠</span>
              <span className="card-value">K</span>
            </div>
            <div className="card card-2">
              <span className="card-suit">♥</span>
              <span className="card-value">7</span>
            </div>
            <div className="card card-3">
              <span className="card-suit">♦</span>
              <span className="card-value">A</span>
            </div>
            <div className="wildcard-badge">⚡ Wildcard</div>
          </div>
        </section>

        {/* STATS SECTION */}
        <section className="stats">
          <div className="stat">
            <div className="stat-number">52</div>
            <div className="stat-label">Carte nel Mazzo</div>
          </div>
          <div className="stat">
            <div className="stat-number">5</div>
            <div className="stat-label">Carte in Mano</div>
          </div>
          <div className="stat">
            <div className="stat-number">2-6+</div>
            <div className="stat-label">Giocatori</div>
          </div>
        </section>

        {/* ACTION BUTTONS */}
        <section className="action-buttons">
          <button 
            className="btn btn-host" 
            onClick={handleHostGame}
            disabled={loading}
          >
            <span className="btn-icon">🎤</span>
            <span className="btn-text">Crea Stanza</span>
            <span className="btn-subtext">Diventa host di una nuova partita</span>
          </button>

          <button 
            className="btn btn-join" 
            onClick={handleJoinGame}
            disabled={loading}
          >
            <span className="btn-icon">🎯</span>
            <span className="btn-text">Entra in Stanza</span>
            <span className="btn-subtext">Unisciti a una partita esistente</span>
          </button>
        </section>

        {/* RULES SECTION */}
        <section className="rules">
          <h2>Come Giocare</h2>
          <div className="rules-grid">
            <div className="rule">
              <div className="rule-number">1</div>
              <h3>Dichiara</h3>
              <p>Il giocatore attivo dichiara quali carte ha</p>
            </div>
            <div className="rule">
              <div className="rule-number">2</div>
              <h3>Sfida</h3>
              <p>Gli altri possono sfidare la dichiarazione</p>
            </div>
            <div className="rule">
              <div className="rule-number">3</div>
              <h3>Risultato</h3>
              <p>Si verifica la dichiarazione e si assegnano crediti</p>
            </div>
            <div className="rule">
              <div className="rule-number">4</div>
              <h3>Turno</h3>
              <p>Passa il turno al prossimo giocatore</p>
            </div>
          </div>
        </section>
      </main>

      <style jsx>{`
        .liar-home {
          min-height: 100vh;
          color: #f1f5f9;
          font-family: 'Press Start 2P', 'Courier New', monospace;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        /* VIDEO BACKGROUND */
        .video-background {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 0;
        }

        .video-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          z-index: 1;
        }

        /* BACKGROUND DECORATIVE BLURS */
        .background-blur {
          position: fixed;
          border-radius: 50%;
          opacity: 0.05;
          z-index: 2;
          pointer-events: none;
        }

        .blur-1 {
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, #8b5cf6, transparent);
          top: -100px;
          right: -100px;
          animation: float 20s infinite ease-in-out;
        }

        .blur-2 {
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, #3b82f6, transparent);
          bottom: 10%;
          left: -150px;
          animation: float 25s infinite ease-in-out reverse;
        }

        .blur-3 {
          width: 250px;
          height: 250px;
          background: radial-gradient(circle, #f59e0b, transparent);
          top: 50%;
          right: 10%;
          animation: float 15s infinite ease-in-out;
        }

        @keyframes float {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(30px, 30px); }
        }

        /* HEADER */
        .liar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem 2rem;
          background: rgba(15, 23, 42, 0.8);
          backdrop-filter: blur(10px);
          border-bottom: 2px solid #8b5cf6;
          position: relative;
          z-index: 50;
        }

        .back-button {
          padding: 0.75rem 1.5rem;
          background: rgba(139, 92, 246, 0.1);
          border: 2px solid #8b5cf6;
          border-radius: 8px;
          color: #c4b5fd;
          text-decoration: none;
          font-weight: 600;
          transition: all 0.3s ease;
          cursor: pointer;
        }

        .back-button:hover {
          background: rgba(139, 92, 246, 0.2);
          transform: translateX(-4px);
        }

        .site-title {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 900;
          background: linear-gradient(135deg, #a78bfa, #60a5fa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: 1px;
        }

        .spacer {
          width: 100px;
        }

        /* MAIN */
        .liar-main {
          position: relative;
          z-index: 10;
          max-width: 1200px;
          margin: 0 auto;
          padding: 3rem 2rem;
        }

        /* HERO SECTION */
        .hero {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4rem;
          align-items: center;
          margin-bottom: 4rem;
        }

        .hero-content {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .hero-icon {
          font-size: 4rem;
          animation: bounce 3s infinite;
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .hero-title {
          margin: 0;
          font-size: 3.5rem;
          font-weight: 900;
          background: linear-gradient(135deg, #a78bfa, #60a5fa, #34d399);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          line-height: 1.1;
          letter-spacing: -1px;
        }

        .hero-subtitle {
          margin: 0;
          font-size: 1.5rem;
          color: #c4b5fd;
          font-weight: 600;
        }

        .hero-description {
          margin: 0;
          font-size: 1.1rem;
          color: #cbd5e1;
          line-height: 1.6;
        }

        /* FEATURES GRID */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem;
          margin-top: 2rem;
        }

        .feature {
          background: rgba(139, 92, 246, 0.05);
          border: 2px solid #8b5cf6;
          border-radius: 12px;
          padding: 1.5rem;
          text-align: center;
          transition: all 0.3s ease;
        }

        .feature:hover {
          background: rgba(139, 92, 246, 0.1);
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(139, 92, 246, 0.2);
        }

        .feature-icon {
          font-size: 2.5rem;
          margin-bottom: 0.75rem;
          display: block;
        }

        .feature h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1.1rem;
          color: #c4b5fd;
        }

        .feature p {
          margin: 0;
          font-size: 0.9rem;
          color: #cbd5e1;
        }

        /* GAME PREVIEW */
        .game-preview {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 400px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.05));
          border: 2px solid #8b5cf6;
          border-radius: 16px;
          overflow: hidden;
        }

        .game-preview::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.1), transparent);
          pointer-events: none;
        }

        .card {
          position: absolute;
          width: 100px;
          height: 140px;
          background: linear-gradient(135deg, #fff, #f3f4f6);
          border: 2px solid #1f2937;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          z-index: 10;
          color: #1f2937;
          font-weight: 900;
        }

        .card:hover {
          transform: translateY(-10px) scale(1.05);
          box-shadow: 0 12px 32px rgba(139, 92, 246, 0.4);
        }

        .card-1 {
          transform: rotate(-15deg) translateY(20px);
          left: 20px;
          animation: cardFloat1 4s infinite ease-in-out;
        }

        .card-2 {
          z-index: 20;
          animation: cardFloat2 4s infinite ease-in-out;
        }

        .card-3 {
          transform: rotate(15deg) translateY(20px);
          right: 20px;
          animation: cardFloat3 4s infinite ease-in-out;
        }

        @keyframes cardFloat1 {
          0%, 100% { transform: rotate(-15deg) translateY(20px); }
          50% { transform: rotate(-15deg) translateY(0px); }
        }

        @keyframes cardFloat2 {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }

        @keyframes cardFloat3 {
          0%, 100% { transform: rotate(15deg) translateY(20px); }
          50% { transform: rotate(15deg) translateY(0px); }
        }

        .card-suit {
          font-size: 2rem;
        }

        .card-value {
          font-size: 2.5rem;
          font-weight: 900;
        }

        .wildcard-badge {
          position: absolute;
          bottom: 20px;
          right: 20px;
          background: linear-gradient(135deg, #8b5cf6, #a78bfa);
          color: #fff;
          padding: 0.75rem 1.5rem;
          border-radius: 50px;
          font-weight: 700;
          box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        /* STATS SECTION */
        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2rem;
          margin: 4rem 0;
          padding: 3rem 2rem;
          background: rgba(139, 92, 246, 0.05);
          border: 2px solid #8b5cf6;
          border-radius: 16px;
        }

        .stat {
          text-align: center;
        }

        .stat-number {
          font-size: 3rem;
          font-weight: 900;
          background: linear-gradient(135deg, #a78bfa, #60a5fa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 0.5rem;
        }

        .stat-label {
          font-size: 1rem;
          color: #cbd5e1;
          font-weight: 600;
        }

        /* ACTION BUTTONS */
        .action-buttons {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 2rem;
          margin: 4rem 0;
        }

        .btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 2rem;
          border: none;
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }

        .btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: rgba(255, 255, 255, 0.1);
          transition: left 0.5s ease;
          z-index: -1;
        }

        .btn:hover::before {
          left: 100%;
        }

        .btn-host {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          border: 2px solid #60a5fa;
          color: #fff;
        }

        .btn-host:hover:not(:disabled) {
          transform: translateY(-4px);
          box-shadow: 0 12px 32px rgba(59, 130, 246, 0.4);
          border-color: #93c5fd;
        }

        .btn-join {
          background: linear-gradient(135deg, #f59e0b, #d97706);
          border: 2px solid #fbbf24;
          color: #fff;
        }

        .btn-join:hover:not(:disabled) {
          transform: translateY(-4px);
          box-shadow: 0 12px 32px rgba(245, 158, 11, 0.4);
          border-color: #fcd34d;
        }

        .btn-icon {
          font-size: 3rem;
        }

        .btn-text {
          font-size: 1.25rem;
          font-weight: 800;
        }

        .btn-subtext {
          font-size: 0.85rem;
          opacity: 0.9;
          font-weight: 400;
          letter-spacing: 0;
          text-transform: none;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* RULES SECTION */
        .rules {
          margin-top: 4rem;
          padding: 3rem 2rem;
          background: rgba(139, 92, 246, 0.05);
          border: 2px solid #8b5cf6;
          border-radius: 16px;
        }

        .rules h2 {
          margin: 0 0 2rem 0;
          font-size: 2rem;
          color: #c4b5fd;
          text-align: center;
        }

        .rules-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.5rem;
        }

        .rule {
          text-align: center;
          padding: 1.5rem;
          background: rgba(15, 23, 42, 0.5);
          border-radius: 12px;
          border: 1px solid #8b5cf6;
          transition: all 0.3s ease;
        }

        .rule:hover {
          background: rgba(139, 92, 246, 0.1);
          transform: translateY(-4px);
        }

        .rule-number {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 50px;
          height: 50px;
          background: linear-gradient(135deg, #8b5cf6, #a78bfa);
          border-radius: 50%;
          font-size: 1.5rem;
          font-weight: 900;
          color: #fff;
          margin-bottom: 1rem;
        }

        .rule h3 {
          margin: 0.5rem 0;
          color: #c4b5fd;
          font-size: 1.1rem;
        }

        .rule p {
          margin: 0;
          color: #cbd5e1;
          font-size: 0.9rem;
        }

        /* RESPONSIVE */
        @media (max-width: 1024px) {
          .hero {
            grid-template-columns: 1fr;
            gap: 2rem;
          }

          .hero-title {
            font-size: 2.5rem;
          }

          .features-grid {
            grid-template-columns: 1fr;
          }

          .action-buttons {
            grid-template-columns: 1fr;
          }

          .rules-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .liar-header {
            padding: 1rem;
          }

          .back-button {
            padding: 0.5rem 1rem;
            font-size: 0.9rem;
          }

          .site-title {
            font-size: 1.25rem;
          }

          .spacer {
            display: none;
          }

          .liar-main {
            padding: 1.5rem 1rem;
          }

          .hero-title {
            font-size: 2rem;
          }

          .hero-subtitle {
            font-size: 1.2rem;
          }

          .stats {
            grid-template-columns: 1fr;
            gap: 1rem;
            padding: 1.5rem 1rem;
          }

          .rules-grid {
            grid-template-columns: 1fr;
          }

          .game-preview {
            height: 250px;
          }

          .card {
            width: 70px;
            height: 100px;
            font-size: 0.9rem;
          }

          .card-suit {
            font-size: 1.5rem;
          }

          .card-value {
            font-size: 1.8rem;
          }

          .btn {
            padding: 1.5rem 1rem;
          }

          .btn-icon {
            font-size: 2rem;
          }

          .btn-text {
            font-size: 1rem;
          }
        }

        @media (max-width: 480px) {
          .liar-header {
            gap: 0.5rem;
          }

          .hero-title {
            font-size: 1.5rem;
          }

          .hero-subtitle {
            font-size: 1rem;
          }

          .hero-description {
            font-size: 0.9rem;
          }

          .stat-number {
            font-size: 2rem;
          }

          .rules h2 {
            font-size: 1.5rem;
          }

          .rules-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
