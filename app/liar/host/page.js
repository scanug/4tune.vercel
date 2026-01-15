'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { ref, set } from 'firebase/database';
import Link from 'next/link';

export default function LiarHostPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [maxRounds, setMaxRounds] = useState(7);
  const [declarationMode, setDeclarationMode] = useState('assisted');
  const [error, setError] = useState(null);

  const handleCreateRoom = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!auth.currentUser) {
        router.push('/auth');
        return;
      }

      // Genera room code
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Crea stanza in Firebase
      const roomRef = ref(db, `rooms_liar/${roomCode}`);
      await set(roomRef, {
        hostId: auth.currentUser.uid,
        status: 'waiting',
        createdAt: Date.now(),
        maxRounds,
        declarationMode,
        players: {
          [auth.currentUser.uid]: {
            name: auth.currentUser.displayName || 'Player',
            alive: true,
          },
        },
      });

      // Naviga alla lobby
      router.push(`/liar/${roomCode}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="liar-host">
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

      {/* HEADER */}
      <header className="host-header">
        <Link href="/liar" className="back-button">
          ← Indietro
        </Link>
        <h1 className="host-title">🎤 Crea Stanza</h1>
        <div className="spacer"></div>
      </header>

      {/* MAIN CONTENT */}
      <main className="host-main">
        <div className="host-card">
          {error && <div className="error-banner">{error}</div>}

          <form className="form" onSubmit={(e) => { e.preventDefault(); handleCreateRoom(); }}>
            <div className="form-group">
              <label htmlFor="rounds">
                <span className="label-text">Round:</span>
              </label>
              <input
                id="rounds"
                type="number"
                min="3"
                max="20"
                value={maxRounds}
                onChange={(e) => setMaxRounds(parseInt(e.target.value))}
                disabled={loading}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="mode">
                <span className="label-text">Modalità Dichiarazione:</span>
              </label>
              <select
                id="mode"
                value={declarationMode}
                onChange={(e) => setDeclarationMode(e.target.value)}
                disabled={loading}
                className="form-select"
              >
                <option value="assisted">Guidata (Consigliata)</option>
                <option value="free">Libera (Esperti)</option>
              </select>
            </div>

            <button 
              type="submit"
              className="btn-create"
              disabled={loading}
            >
              {loading ? '⏳ Creazione...' : '🎬 Crea Stanza'}
            </button>
          </form>

          {/* HINTS */}
          <div className="hints">
            <div className="hint">
              <span className="hint-icon">ℹ️</span>
              <div className="hint-text">
                <strong>Round:</strong> Numero di turni nella partita (3-20)
              </div>
            </div>
            <div className="hint">
              <span className="hint-icon">ℹ️</span>
              <div className="hint-text">
                <strong>Modalità:</strong> Guidata per principianti, Libera per esperti
              </div>
            </div>
          </div>
        </div>
      </main>

      <style jsx>{`
        .liar-host {
          min-height: 100vh;
          font-family: 'Press Start 2P', 'Courier New', monospace;
          color: #f1f5f9;
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

        /* HEADER */
        .host-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem 2rem;
          background: rgba(15, 23, 42, 0.9);
          backdrop-filter: blur(10px);
          border-bottom: 3px solid #8b5cf6;
          position: relative;
          z-index: 50;
        }

        .back-button {
          padding: 0.75rem 1.5rem;
          background: rgba(139, 92, 246, 0.2);
          border: 2px solid #8b5cf6;
          border-radius: 8px;
          color: #c4b5fd;
          text-decoration: none;
          font-family: 'Press Start 2P', monospace;
          font-weight: 600;
          font-size: 0.8rem;
          transition: all 0.3s ease;
          cursor: pointer;
          display: inline-block;
        }

        .back-button:hover {
          background: rgba(139, 92, 246, 0.3);
          transform: translateX(-4px);
        }

        .host-title {
          margin: 0;
          font-size: 1.5rem;
          font-family: 'Press Start 2P', monospace;
          font-weight: 900;
          color: #c4b5fd;
          letter-spacing: 1px;
        }

        .spacer {
          width: 100px;
        }

        /* MAIN */
        .host-main {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
          padding: 2rem;
        }

        .host-card {
          background: rgba(30, 41, 59, 0.95);
          border: 3px solid #8b5cf6;
          border-radius: 16px;
          padding: 2.5rem;
          max-width: 500px;
          width: 100%;
          box-shadow: 0 8px 32px rgba(139, 92, 246, 0.3);
          backdrop-filter: blur(10px);
        }

        .error-banner {
          background: linear-gradient(135deg, #dc2626, #b91c1c);
          color: #fff;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 2rem;
          font-family: monospace;
          font-size: 0.9rem;
          border-left: 4px solid #fca5a5;
        }

        /* FORM */
        .form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .label-text {
          font-family: 'Press Start 2P', monospace;
          color: #c4b5fd;
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        .form-input,
        .form-select {
          padding: 0.75rem 1rem;
          background: rgba(15, 23, 42, 0.6);
          border: 2px solid #8b5cf6;
          border-radius: 8px;
          color: #f1f5f9;
          font-family: 'Courier New', monospace;
          font-size: 1rem;
          transition: all 0.3s ease;
        }

        .form-input:focus,
        .form-select:focus {
          outline: none;
          border-color: #a78bfa;
          background: rgba(15, 23, 42, 0.8);
          box-shadow: 0 0 12px rgba(139, 92, 246, 0.4);
        }

        .form-input:disabled,
        .form-select:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* BUTTONS */
        .btn-create {
          padding: 1rem;
          background: linear-gradient(135deg, #10b981, #059669);
          border: 2px solid #34d399;
          border-radius: 8px;
          color: #fff;
          font-family: 'Press Start 2P', monospace;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.3s ease;
          text-transform: uppercase;
          letter-spacing: 1px;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .btn-create:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(16, 185, 129, 0.5);
          border-color: #6ee7b7;
        }

        .btn-create:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* HINTS */
        .hints {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 2px solid #334155;
        }

        .hint {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }

        .hint-icon {
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .hint-text {
          font-family: 'Courier New', monospace;
          font-size: 0.9rem;
          color: #cbd5e1;
          line-height: 1.4;
        }

        .hint-text strong {
          color: #c4b5fd;
          font-weight: 700;
        }

        /* RESPONSIVE */
        @media (max-width: 768px) {
          .host-header {
            flex-wrap: wrap;
            gap: 1rem;
            padding: 1rem;
          }

          .host-title {
            flex: 1 1 100%;
            text-align: center;
            font-size: 1.25rem;
          }

          .host-main {
            padding: 1rem;
          }

          .host-card {
            padding: 1.5rem;
          }
        }

        @media (max-width: 480px) {
          .host-header {
            padding: 0.75rem;
          }

          .host-title {
            font-size: 1rem;
          }

          .back-button {
            font-size: 0.7rem;
            padding: 0.5rem 1rem;
          }

          .host-card {
            padding: 1rem;
            border-width: 2px;
          }

          .form-group {
            gap: 0.5rem;
          }

          .label-text {
            font-size: 0.7rem;
          }

          .form-input,
          .form-select {
            font-size: 0.9rem;
            padding: 0.6rem 0.8rem;
          }
        }
      `}</style>
    </div>
  );
}
