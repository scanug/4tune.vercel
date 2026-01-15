'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function LiarGamePage() {
  const router = useRouter();
  const params = useParams();
  const roomCode = params?.roomCode;

  const PHASE_TIME = 30; // seconds

  // State
  const [userId, setUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [gamePhase, setGamePhase] = useState('init'); // 'init', 'declare', 'challenge', 'resolve'
  const [selectedCard, setSelectedCard] = useState(null);
  const [error, setError] = useState(null);

  // Mock data for demo
  const currentPlayer = 'Player 1';
  const isMyTurn = true;

  // Auth check
  useEffect(() => {
    const timer = setTimeout(() => {
      setUserId('demo-user');
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Timer countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setPhaseTimeLeft(prev => {
        const newTime = Math.max(0, prev - 1);
        
        // Auto-advance when timer reaches 0
        if (newTime === 0) {
          setTimeout(() => {
            setGamePhase(current => {
              if (current === 'declare') return 'challenge';
              if (current === 'challenge') return 'resolve';
              if (current === 'resolve') return 'declare';
              return current;
            });
          }, 500);
        }
        
        return newTime;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Reset timer on phase change
  useEffect(() => {
    setPhaseTimeLeft(PHASE_TIME);
  }, [gamePhase]);

  if (isLoading) {
    return (
      <main style={styles.container}>
        <div style={styles.loadingScreen}>
          <h1 style={styles.pixelText}>⏳ LOADING...</h1>
        </div>
      </main>
    );
  }

  if (!roomCode) {
    return (
      <main style={styles.container}>
        <div style={styles.errorScreen}>
          <h1 style={styles.pixelText}>❌ NO ROOM</h1>
          <button onClick={() => router.push('/liar')} style={styles.button}>
            ← BACK
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.container}>
      {/* HEADER */}
      <header style={styles.header}>
        <h1 style={styles.title}>🎭 LUCKY LIAR</h1>
        <span style={styles.badge}>{roomCode}</span>
      </header>

      {/* ERROR BANNER */}
      {error && (
        <div style={styles.errorBanner}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={styles.closeBtn}>×</button>
        </div>
      )}

      {/* GAME AREA */}
      <section style={styles.gameArea}>
        {/* LEFT: Game Info */}
        <div style={styles.leftPanel}>
          <div style={styles.infoBox}>
            <h2 style={styles.sectionTitle}>📍 TURN: {currentPlayer}</h2>
            <span style={{...styles.badge, ...(isMyTurn ? styles.activeBadge : styles.waitingBadge)}}>
              {isMyTurn ? '⭐ YOUR TURN' : '⏳ WAITING'}
            </span>
          </div>

          <div style={styles.cardsDisplay}>
            <h3 style={styles.sectionTitle}>🎴 HAND</h3>
            <div style={styles.cardGrid}>
              {['♠A', '❤️5', '♦️10', '♣️K'].map((card, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedCard(selectedCard === card ? null : card)}
                  style={{
                    ...styles.card,
                    ...(selectedCard === card ? styles.cardSelected : {}),
                  }}
                >
                  {card}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Actions */}
        <aside style={styles.rightPanel}>
          <div style={styles.actionBox}>
            <h3 style={styles.sectionTitle}>⚡ ACTIONS</h3>

            <div style={styles.timerBox}>
              <div style={styles.timerText}>⏱️ 30s</div>
            </div>

            {gamePhase === 'declare' && isMyTurn && (
              <button
                onClick={() => {
                  if (!selectedCard) {
                    setError('🎴 Select a card first!');
                    return;
                  }
                  setGamePhase('challenge');
                  setSelectedCard(null);
                }}
                style={styles.buttonDeclare}
              >
                📢 DECLARE
              </button>
            )}

            {gamePhase === 'challenge' && !isMyTurn && (
              <>
                <button
                  onClick={() => setGamePhase('resolve')}
                  style={styles.buttonChallenge}
                >
                  ⚔️ CHALLENGE
                </button>
                <button 
                  onClick={() => {
                    // Skip to next player
                    setGamePhase('declare');
                  }} 
                  style={styles.buttonPass}
                >
                  ⏭️ PASS
                </button>
              </>
            )}

            {gamePhase === 'resolve' && (
              <div style={styles.resultBox}>
                <h2 style={{ color: '#00FF00', fontSize: '2rem' }}>✅ TRUTH!</h2>
                <p>Declaration was valid</p>
                <button
                  onClick={() => {
                    setGamePhase('declare');
                    setError(null);
                  }}
                  style={{ ...styles.button, marginTop: '0.5rem', fontSize: '0.9rem' }}
                >
                  NEXT ROUND
                </button>
              </div>
            )}
          </div>
        </aside>
      </section>

      <style>{`
        @keyframes blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0.5; }
        }
        @keyframes scale {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `}</style>
    </main>
  );
}

// ============ ARCADE 8-BIT STYLES ============
const styles = {
  container: {
    minHeight: '100vh',
    background: '#000033',
    color: '#FFFF00',
    fontFamily: '"Courier New", monospace',
    padding: '1rem',
    overflow: 'hidden',
  },
  
  header: {
    textAlign: 'center',
    borderBottom: '4px solid #FF00FF',
    paddingBottom: '1rem',
    marginBottom: '2rem',
    background: 'linear-gradient(90deg, #000033, #003366)',
    padding: '1.5rem',
  },
  
  title: {
    fontSize: '3rem',
    fontWeight: 'bold',
    margin: '0 0 1rem 0',
    textShadow: '4px 4px #00FFFF, 8px 8px #FF00FF',
    letterSpacing: '2px',
  },
  
  pixelText: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    textShadow: '3px 3px #FF00FF, 6px 6px #00FFFF',
    margin: 0,
  },
  
  badge: {
    display: 'inline-block',
    background: '#FF00FF',
    color: '#000033',
    padding: '0.5rem 1rem',
    border: '3px solid #00FFFF',
    fontWeight: 'bold',
    fontSize: '1.2rem',
  },
  
  activeBadge: {
    background: '#00FF00',
    color: '#000033',
    animation: 'blink 1s infinite',
  },
  
  waitingBadge: {
    background: '#FF6600',
    color: '#000033',
  },
  
  errorBanner: {
    background: '#FF0000',
    color: '#FFFF00',
    padding: '1rem',
    border: '4px solid #FFFF00',
    marginBottom: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontWeight: 'bold',
    fontSize: '1.1rem',
  },
  
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#FFFF00',
    fontSize: '2rem',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  
  gameArea: {
    display: 'grid',
    gridTemplateColumns: '1fr 300px',
    gap: '2rem',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  
  leftPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
  },
  
  rightPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  
  infoBox: {
    background: '#003366',
    border: '4px solid #00FFFF',
    padding: '1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  actionBox: {
    background: '#333300',
    border: '4px solid #FFFF00',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  
  sectionTitle: {
    fontSize: '1.3rem',
    margin: 0,
    fontWeight: 'bold',
    textShadow: '2px 2px #00FFFF',
  },
  
  cardsDisplay: {
    background: '#003366',
    border: '4px solid #00FFFF',
    padding: '1.5rem',
  },
  
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1rem',
  },
  
  card: {
    background: '#FF00FF',
    color: '#000033',
    border: '3px solid #FFFF00',
    padding: '1rem',
    fontSize: '1.5rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.1s',
    fontFamily: '"Courier New", monospace',
  },
  
  cardSelected: {
    background: '#00FF00',
    transform: 'scale(1.1)',
    animation: 'scale 0.3s',
  },
  
  timerBox: {
    background: '#FF0000',
    border: '3px solid #FFFF00',
    padding: '1rem',
    textAlign: 'center',
  },
  
  timerText: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#FFFF00',
    textShadow: '2px 2px #000033',
  },
  
  button: {
    background: '#FF00FF',
    color: '#000033',
    border: '4px solid #00FFFF',
    padding: '1rem 1.5rem',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.1s',
    fontFamily: '"Courier New", monospace',
    width: '100%',
    marginTop: '1rem',
  },
  
  buttonDeclare: {
    background: '#0099FF',
    color: '#000033',
    border: '4px solid #00FFFF',
    padding: '1rem',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    width: '100%',
    fontFamily: '"Courier New", monospace',
  },
  
  buttonChallenge: {
    background: '#FF6600',
    color: '#FFFF00',
    border: '4px solid #FFFF00',
    padding: '1rem',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    width: '100%',
    fontFamily: '"Courier New", monospace',
  },
  
  buttonPass: {
    background: '#666600',
    color: '#FFFF00',
    border: '4px solid #FFFF00',
    padding: '0.8rem',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    width: '100%',
    marginTop: '0.5rem',
    fontFamily: '"Courier New", monospace',
  },
  
  resultBox: {
    background: '#006600',
    border: '4px solid #00FF00',
    padding: '1rem',
    textAlign: 'center',
  },
  
  loadingScreen: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  errorScreen: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2rem',
  },
};
