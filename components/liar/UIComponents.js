'use client';

import React, { useState, useEffect } from 'react';
import {
  COLORS,
  SPACING,
  RADIUS,
  SHADOWS,
  TRANSITIONS,
  TYPOGRAPHY,
  ANIMATION_TIMING,
} from '@/lib/uiDesignSystem';

/**
 * Mostra la mano privata del giocatore
 * 5 carte sempre visibili
 */
function PlayerHand({ cards, selectedIndex, onCardSelect, isMyTurn }) {
  return (
    <div className="player-hand">
      <div className="hand-header">
        <h3 className="hand-title">La mia mano</h3>
        <span className="card-count">{cards.length}/5</span>
      </div>

      <div className="hand-cards">
        {cards.map((card, index) => (
          <PlayerCard
            key={index}
            card={card}
            index={index}
            isSelected={selectedIndex === index}
            isClickable={isMyTurn}
            onClick={() => isMyTurn && onCardSelect?.(index)}
          />
        ))}
      </div>

      <style jsx>{`
        .player-hand {
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: ${RADIUS.lg};
          padding: ${SPACING.md};
          margin: ${SPACING.md} 0;
        }

        .hand-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: ${SPACING.md};
          padding-bottom: ${SPACING.sm};
          border-bottom: 1px solid rgba(139, 92, 246, 0.2);
        }

        .hand-title {
          font-size: ${TYPOGRAPHY.h3.fontSize};
          font-weight: ${TYPOGRAPHY.h3.fontWeight};
          color: ${COLORS.text.primary};
          margin: 0;
        }

        .card-count {
          font-size: ${TYPOGRAPHY.bodySm.fontSize};
          color: ${COLORS.text.tertiary};
          background: rgba(139, 92, 246, 0.2);
          padding: 2px 8px;
          border-radius: ${RADIUS.full};
        }

        .hand-cards {
          display: flex;
          gap: ${SPACING.sm};
          overflow-x: auto;
          padding: ${SPACING.sm};
          border-radius: ${RADIUS.md};
          background: rgba(0, 0, 0, 0.2);
        }

        .hand-cards::-webkit-scrollbar {
          height: 4px;
        }

        .hand-cards::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
        }

        .hand-cards::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.5);
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}

/**
 * Singola carta nella mano
 */
function PlayerCard({ card, index, isSelected, isClickable, onClick }) {
  const suits = { '♠': '♠', '♥': '♥', '♦': '♦', '♣': '♣' };
  const suit = suits[card.suit] || card.suit;
  const suitColor = ['♥', '♦'].includes(suit) ? '#ef4444' : '#ffffff';

  return (
    <div
      className={`player-card ${isSelected ? 'selected' : ''} ${isClickable ? 'clickable' : ''}`}
      onClick={onClick}
      title={`${card.value}${suit}`}
    >
      <div className="card-value" style={{ color: suitColor }}>
        {card.value}
      </div>
      <div className="card-suit" style={{ color: suitColor }}>
        {suit}
      </div>

      <style jsx>{`
        .player-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 60px;
          height: 80px;
          background: linear-gradient(135deg, ${COLORS.card.bg} 0%, #0f1419 100%);
          border: 2px solid ${COLORS.card.border};
          border-radius: ${RADIUS.md};
          padding: ${SPACING.xs};
          cursor: ${isClickable ? 'pointer' : 'default'};
          transition: ${TRANSITIONS.fast};
          flex-shrink: 0;
        }

        .player-card.clickable:hover {
          border-color: ${COLORS.accent.primary};
          box-shadow: ${SHADOWS.glow};
          transform: translateY(-4px);
        }

        .player-card.selected {
          border-color: ${COLORS.accent.primary};
          background: linear-gradient(135deg, ${COLORS.accent.primary}20 0%, ${COLORS.accent.primary}10 100%);
          box-shadow: ${SHADOWS.glowStrong};
          transform: translateY(-6px);
        }

        .card-value {
          font-size: 18px;
          font-weight: 700;
          line-height: 1;
          margin-bottom: 2px;
        }

        .card-suit {
          font-size: 16px;
          line-height: 1;
        }
      `}</style>
    </div>
  );
}

/**
 * Mostra stato wildcard (discreto, non invadente)
 */
function WildcardStatus({ hasWildcard, state, onClick }) {
  if (!hasWildcard) return null;

  const icons = {
    unused: '⚡',
    activated: '✨',
    exhausted: '💫',
  };

  const colors = {
    unused: COLORS.accent.primary,
    activated: COLORS.success,
    exhausted: COLORS.text.tertiary,
  };

  const labels = {
    unused: 'Wildcard disponibile',
    activated: 'Wildcard attivata',
    exhausted: 'Wildcard usata',
  };

  return (
    <div
      className="wildcard-status"
      style={{
        borderColor: colors[state],
        backgroundColor: `${colors[state]}15`,
      }}
      onClick={onClick}
      title={labels[state]}
    >
      <span className="wildcard-icon" style={{ color: colors[state] }}>
        {icons[state]}
      </span>
      <span className="wildcard-label">{labels[state]}</span>

      <style jsx>{`
        .wildcard-status {
          display: inline-flex;
          align-items: center;
          gap: ${SPACING.xs};
          padding: ${SPACING.xs} ${SPACING.sm};
          border: 1px solid;
          border-radius: ${RADIUS.full};
          font-size: ${TYPOGRAPHY.bodyXs.fontSize};
          cursor: ${onClick ? 'pointer' : 'default'};
          transition: ${TRANSITIONS.fast};
        }

        .wildcard-status:hover {
          transform: scale(1.05);
        }

        .wildcard-icon {
          font-size: 14px;
          display: flex;
          align-items: center;
        }

        .wildcard-label {
          font-weight: 500;
          color: ${COLORS.text.secondary};
        }
      `}</style>
    </div>
  );
}

/**
 * Mostra crediti in modo chiaro e leggibile
 */
function CreditDisplay({ credits, changes = null, isHighlighted = false }) {
  const [displayCredits, setDisplayCredits] = useState(credits);

  useEffect(() => {
    if (changes !== null) {
      const timeout = setTimeout(() => {
        setDisplayCredits(credits);
      }, ANIMATION_TIMING.creditChange);

      return () => clearTimeout(timeout);
    }
  }, [credits, changes]);

  const changeColor = changes !== null
    ? changes > 0 ? COLORS.success : COLORS.danger
    : 'transparent';

  const changeText = changes !== null
    ? changes > 0 ? `+${changes}` : `${changes}`
    : '';

  return (
    <div className={`credit-display ${isHighlighted ? 'highlighted' : ''}`}>
      <div className="credit-main">
        <span className="credit-icon">💰</span>
        <span className="credit-value">{displayCredits}</span>
      </div>

      {changes !== null && (
        <div className="credit-change" style={{ color: changeColor }}>
          {changeText}
        </div>
      )}

      <style jsx>{`
        .credit-display {
          display: flex;
          align-items: center;
          gap: ${SPACING.sm};
          padding: ${SPACING.sm} ${SPACING.md};
          background: rgba(0, 0, 0, 0.4);
          border: 2px solid rgba(139, 92, 246, 0.3);
          border-radius: ${RADIUS.lg};
          transition: ${TRANSITIONS.normal};
        }

        .credit-display.highlighted {
          border-color: ${COLORS.accent.primary};
          background: rgba(139, 92, 246, 0.1);
          box-shadow: ${SHADOWS.glow};
        }

        .credit-main {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
          color: ${COLORS.text.primary};
        }

        .credit-icon {
          font-size: 18px;
        }

        .credit-value {
          font-size: ${TYPOGRAPHY.h3.fontSize};
          font-weight: 700;
          min-width: 50px;
          text-align: right;
        }

        .credit-change {
          position: absolute;
          right: -30px;
          font-size: ${TYPOGRAPHY.h2.fontSize};
          font-weight: 700;
          animation: float-up 0.6s ease-out forwards;
        }

        @keyframes float-up {
          0% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-30px);
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Card di un giocatore nella vista di gioco
 */
function GamePlayerCard({
  playerId,
  playerName,
  credits,
  hasWildcard,
  wildcardState,
  indicators = [],
  isMyTurn = false,
  isActive = false,
  isEliminated = false,
  onCardClick,
}) {
  return (
    <div
      className={`game-player-card ${isMyTurn ? 'my-turn' : ''} ${isActive ? 'active' : ''} ${isEliminated ? 'eliminated' : ''}`}
      onClick={onCardClick}
    >
      <div className="card-header">
        <h4 className="player-name">{playerName}</h4>
        {isMyTurn && <span className="turn-badge">🎤 Turno</span>}
        {isEliminated && <span className="eliminated-badge">❌ Eliminato</span>}
      </div>

      <div className="card-credits">
        <span className="credit-label">Crediti:</span>
        <span className={`credit-amount ${credits < 50 ? 'low' : ''}`}>
          {credits}
        </span>
      </div>

      {hasWildcard && (
        <div className="card-wildcard">
          <WildcardStatus
            hasWildcard={hasWildcard}
            state={wildcardState}
          />
        </div>
      )}

      {indicators.length > 0 && (
        <div className="card-indicators">
          {indicators.slice(0, 2).map((ind, idx) => (
            <span
              key={idx}
              className="indicator"
              style={{ color: ind.color }}
              title={ind.tooltip}
            >
              {ind.icon}
            </span>
          ))}
          {indicators.length > 2 && (
            <span className="indicator-more">+{indicators.length - 2}</span>
          )}
        </div>
      )}

      <style jsx>{`
        .game-player-card {
          display: flex;
          flex-direction: column;
          gap: ${SPACING.sm};
          padding: ${SPACING.md};
          background: ${COLORS.bg.secondary};
          border: 2px solid ${COLORS.card.border};
          border-radius: ${RADIUS.lg};
          cursor: pointer;
          transition: ${TRANSITIONS.normal};
        }

        .game-player-card:hover {
          border-color: ${COLORS.accent.primary};
          box-shadow: ${SHADOWS.glow};
        }

        .game-player-card.my-turn {
          border-color: ${COLORS.player.self};
          background: rgba(139, 92, 246, 0.1);
          box-shadow: ${SHADOWS.glowStrong};
        }

        .game-player-card.active {
          border-color: ${COLORS.player.active};
          background: rgba(251, 191, 36, 0.05);
        }

        .game-player-card.eliminated {
          opacity: 0.6;
          border-color: ${COLORS.player.eliminated};
          background: rgba(75, 85, 99, 0.1);
          cursor: default;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: ${SPACING.sm};
          padding-bottom: ${SPACING.xs};
          border-bottom: 1px solid rgba(139, 92, 246, 0.2);
        }

        .player-name {
          margin: 0;
          font-size: ${TYPOGRAPHY.label.fontSize};
          font-weight: 600;
          color: ${COLORS.text.primary};
          flex: 1;
        }

        .turn-badge,
        .eliminated-badge {
          font-size: ${TYPOGRAPHY.bodyXs.fontSize};
          padding: 2px 6px;
          border-radius: ${RADIUS.full};
          font-weight: 500;
          white-space: nowrap;
        }

        .turn-badge {
          background: rgba(251, 191, 36, 0.2);
          color: ${COLORS.warning};
        }

        .eliminated-badge {
          background: rgba(239, 68, 68, 0.2);
          color: ${COLORS.danger};
        }

        .card-credits {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: ${TYPOGRAPHY.bodySm.fontSize};
        }

        .credit-label {
          color: ${COLORS.text.tertiary};
        }

        .credit-amount {
          font-weight: 700;
          color: ${COLORS.text.primary};
          font-size: ${TYPOGRAPHY.body.fontSize};
        }

        .credit-amount.low {
          color: ${COLORS.danger};
          animation: pulse-low 1.5s infinite;
        }

        @keyframes pulse-low {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        .card-wildcard {
          padding-top: ${SPACING.xs};
        }

        .card-indicators {
          display: flex;
          gap: ${SPACING.xs};
          align-items: center;
        }

        .indicator {
          font-size: 16px;
          display: flex;
          align-items: center;
        }

        .indicator-more {
          font-size: ${TYPOGRAPHY.bodyXs.fontSize};
          color: ${COLORS.text.tertiary};
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

export {
  PlayerHand,
  WildcardStatus,
  CreditDisplay,
  GamePlayerCard,
};
