/**
 * LUCKY LIAR - Wildcard Integration Example
 * Come integrare il sistema wildcard nella pagina di gioco React
 */

import { useEffect, useRef, useState } from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';
import {
  hasAvailableWildcard,
  validateWildcardActivationInChallenge,
  getWildcardActivationMessage,
  getWildcardDisplayData,
} from '@/lib/luckyLiarWildcard';
import { resolveChallenge, getResultHighlight } from '@/lib/luckyLiarChallenge';

/**
 * Hook per gestire il flusso della sfida con wildcard
 */
export function useChallengeWithWildcard(roomCode, currentPlayerId) {
  const [wildcards, setWildcards] = useState(null);
  const [wildcardActivated, setWildcardActivated] = useState(false);
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    // Ascolta i cambiamenti delle wildcard
    const wildcardRef = ref(db, `rooms_liar/${roomCode}/current/wildcards`);
    
    unsubscribeRef.current = onValue(wildcardRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const wildcardArray = Array.isArray(data) ? data : Object.values(data);
        setWildcards(wildcardArray);
      }
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [roomCode]);

  return { wildcards, wildcardActivated, setWildcardActivated };
}

/**
 * Componente: Pulsante Wildcard durante Challenge
 */
export function WildcardButton({ 
  roomCode, 
  currentPlayerId, 
  wildcards, 
  challenge,
  isLoading 
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [error, setError] = useState(null);

  // Controlla se il giocatore ha wildcard disponibile
  const hasWildcard = hasAvailableWildcard(currentPlayerId, wildcards || []);

  // Valida se può attivare
  const canActivate = hasWildcard && challenge && challenge.state === 'pending';

  const handleActivateWildcard = async () => {
    if (!canActivate) return;

    try {
      // Aggiorna Firebase con wildcard attivata
      const challengeRef = ref(
        db,
        `rooms_liar/${roomCode}/current/challenge/wildcardActivatedBy`
      );
      await update(challengeRef, { value: currentPlayerId });

      // La risoluzione della sfida leggerà questo valore
    } catch (err) {
      setError(err.message);
    }
  };

  if (!wildcards) return null;

  return (
    <div className="wildcard-button-container">
      <div
        className={`wildcard-button ${canActivate ? 'available' : 'disabled'}`}
        onClick={handleActivateWildcard}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        disabled={!canActivate || isLoading}
      >
        <span className="icon">🎴</span>
        <span className="text">
          {hasWildcard ? 'Attiva Wildcard' : 'Nessuna Wildcard'}
        </span>
      </div>

      {showTooltip && hasWildcard && (
        <div className="tooltip">
          <p className="title">Wildcard Disponibile!</p>
          <p className="description">
            Usa una sola volta per modificare il risultato della sfida.
          </p>
          <p className="warning">⚠️ Una volta usata, non puoi usarla più!</p>
        </div>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
}

/**
 * Componente: Wildcard Effect Display (nel risultato della sfida)
 */
export function WildcardEffectDisplay({ wildcardEffect, isLoading }) {
  if (!wildcardEffect || !wildcardEffect.wasUsed) {
    return null;
  }

  const displayData = getWildcardDisplayData(wildcardEffect);

  return (
    <div
      className="wildcard-effect-display"
      style={{ borderColor: displayData.color }}
    >
      <div className="header">
        <span className="icon">{displayData.icon}</span>
        <span className="title">{displayData.description}</span>
      </div>

      <div className="content">
        <div className="explanation">{displayData.explanation}</div>

        <div className="penalty-change">
          <div className="original">
            <span>Penalità originale:</span>
            <span className="amount">{displayData.originalPenalty}</span>
          </div>

          <div className="arrow">→</div>

          <div className="modified">
            <span>Penalità finale:</span>
            <span className="amount" style={{ color: displayData.color }}>
              {displayData.modifiedPenalty}
            </span>
          </div>
        </div>

        {displayData.wasSaved && (
          <div className="saved" style={{ color: '#16a34a' }}>
            💰 Crediti salvati: <strong>+{displayData.amountSaved}</strong>
          </div>
        )}

        {displayData.wasAmplified && (
          <div className="amplified" style={{ color: '#dc2626' }}>
            ⚡ Penalità aumentata: <strong>+{displayData.amountAdded}</strong>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Componente: Challenge Result con Wildcard Integration
 */
export function ChallengeResultDisplay({
  roomCode,
  challenge,
  playerHands,
  wildcards,
  isLoading,
}) {
  const [result, setResult] = useState(null);

  useEffect(() => {
    // Risolvi la sfida (questa funzione viene chiamata automaticamente su Firebase)
    if (challenge && challenge.result) {
      setResult(challenge.result);
    }
  }, [challenge]);

  if (!result) return null;

  const highlight = getResultHighlight(result);

  return (
    <div className="challenge-result-container">
      {/* Titolo Risultato */}
      <div
        className="result-header"
        style={{
          backgroundColor: highlight.bgColor,
          borderColor: highlight.color,
        }}
      >
        <span className="icon">{highlight.icon}</span>
        <span className="title">{highlight.title}</span>
      </div>

      {/* Dettagli Sfida */}
      <div className="result-details">
        <div className="card-count">
          Dichiarato: <strong>{result.claimedQuantity}</strong>
          <span className="value">{result.claim.value}</span>
        </div>
        <div className="actual-count">
          Reali: <strong>{result.actualCount}</strong>
        </div>
        <div className="difference">
          Differenza: <strong>{result.difference}</strong>
        </div>
      </div>

      {/* Penalità */}
      <div className="penalty-section">
        <h3>Penalità</h3>
        <div className="loser">
          {result.loserName} perde:
        </div>
        
        {result.wildcardEffect && result.wildcardEffect.wasUsed ? (
          <div className="penalty-with-wildcard">
            <span className="original">
              {result.penalty} crediti
            </span>
            <span className="arrow">→</span>
            <span className="modified" style={{ color: highlight.color }}>
              {result.modifiedPenalty} crediti
            </span>
          </div>
        ) : (
          <div className="penalty-no-wildcard">
            {result.penalty} crediti
          </div>
        )}
      </div>

      {/* Wildcard Effect */}
      <WildcardEffectDisplay 
        wildcardEffect={result.wildcardEffect}
        isLoading={isLoading}
      />

      {/* Spiegazione */}
      <div className="explanation">
        {result.explanation}
      </div>
    </div>
  );
}

/**
 * Logica Backend - Risoluzione Sfida con Wildcard
 * (Questo sarebbe in una Cloud Function o route API)
 */
export async function resolveChallengeWithWildcard(
  db,
  roomCode,
  challenge,
  playerHands,
  wildcards
) {
  try {
    // Leggi chi ha attivato la wildcard (se qualcuno)
    const challengeRef = ref(db, `rooms_liar/${roomCode}/current/challenge`);
    const snapshot = await get(challengeRef);
    const challengeData = snapshot.val();
    const wildcardActivator = challengeData?.wildcardActivatedBy;

    // Risolvi la sfida con wildcard support
    const result = resolveChallenge(
      challenge,
      playerHands,
      wildcards,
      wildcardActivator // undefined se nessuno ha attivato
    );

    // Salva il risultato con wildcard effect
    await update(ref(db, `rooms_liar/${roomCode}/current/challenge`), {
      state: 'resolved',
      result,
      wildcardEffect: result.wildcardEffect,
    });

    // Aggiorna wildcards (esaurisci se usata)
    if (result.updatedWildcards) {
      const wildcardArray = result.updatedWildcards;
      const wildcardUpdates = {};
      wildcardArray.forEach((wc, idx) => {
        wildcardUpdates[`current/wildcards/${idx}`] = wc;
      });
      await update(ref(db, `rooms_liar/${roomCode}`), wildcardUpdates);
    }

    // Applica penalità MODIFICATA (con wildcard)
    const scoreboardRef = ref(
      db,
      `rooms_liar/${roomCode}/scoreboard/${result.loserId}`
    );
    const scoreSnapshot = await get(scoreboardRef);
    const currentScore = scoreSnapshot.val()?.points || 0;

    await update(scoreboardRef, {
      points: Math.max(0, currentScore - result.modifiedPenalty),
    });

    return result;
  } catch (error) {
    console.error('Errore nella risoluzione della sfida:', error);
    throw error;
  }
}

/**
 * CSS Styling (da aggiungere al CSS globale)
 */
export const wildcardStyles = `
/* Wildcard Button */
.wildcard-button-container {
  position: relative;
  margin: 10px 0;
}

.wildcard-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: linear-gradient(135deg, #8b5cf6, #d946ef);
  color: white;
  border: 2px solid #7c3aed;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
}

.wildcard-button:hover:not(.disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(139, 92, 246, 0.3);
}

.wildcard-button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #999;
}

.wildcard-button .icon {
  font-size: 20px;
}

.wildcard-button .text {
  font-size: 14px;
}

.wildcard-button .tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 12px;
  white-space: nowrap;
  margin-bottom: 8px;
  z-index: 100;
}

.wildcard-button .tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.9);
}

/* Wildcard Effect Display */
.wildcard-effect-display {
  margin: 16px 0;
  padding: 16px;
  border-left: 4px solid;
  background: rgba(139, 92, 246, 0.05);
  border-radius: 6px;
}

.wildcard-effect-display .header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 600;
}

.wildcard-effect-display .icon {
  font-size: 24px;
}

.wildcard-effect-display .content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wildcard-effect-display .explanation {
  font-style: italic;
  color: #555;
}

.wildcard-effect-display .penalty-change {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background: white;
  border-radius: 4px;
}

.wildcard-effect-display .original,
.wildcard-effect-display .modified {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}

.wildcard-effect-display .amount {
  font-weight: 700;
  font-size: 18px;
}

.wildcard-effect-display .arrow {
  color: #999;
  font-size: 20px;
}

.wildcard-effect-display .saved,
.wildcard-effect-display .amplified {
  padding: 8px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 14px;
}
`;
