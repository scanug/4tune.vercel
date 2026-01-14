/**
 * LUCKY LIAR - React Components for Timeline & Game End
 * Componenti per timeline dichiarazioni, indicatori comportamentali, schermata fine partita
 */

'use client';

import React, { useState } from 'react';
import {
  getActiveClaim,
  formatTimelineForDisplay,
  INDICATOR_ICONS,
  INDICATOR_COLORS,
} from '@/lib/luckyLiarBehaviorMetrics';
import {
  getRankEmoji,
  getNetGainColor,
  formatCredits,
  getGameEndMessage,
} from '@/lib/luckyLiarGameEnd';

// ============================================
// DECLARATION TIMELINE COMPONENT
// ============================================

/**
 * Timeline delle dichiarazioni fatte nel round
 * Mostra: autore, valore, risultato sfida
 */
export function DeclarationTimeline({ timeline, activeClaim, onChallengeClick }) {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="declaration-timeline empty">
        <p className="text-gray-400 text-center py-8">Nessuna dichiarazione ancora</p>
      </div>
    );
  }

  const displayTimeline = formatTimelineForDisplay(timeline);

  return (
    <div className="declaration-timeline">
      <div className="timeline-header">
        <h3 className="text-sm font-semibold text-white">Dichiarazioni</h3>
        <span className="text-xs text-gray-400">{timeline.length} dichiazioni</span>
      </div>

      <div className="timeline-entries">
        {displayTimeline.map((claim, idx) => (
          <DeclarationEntry
            key={idx}
            claim={claim}
            isActive={activeClaim && activeClaim.index === claim.index}
            isChallenged={claim.isChallenged}
            challengeSuccess={claim.challengeSuccess}
            onChallengeClick={() => onChallengeClick?.(claim.index)}
          />
        ))}
      </div>

      <style jsx>{`
        .declaration-timeline {
          background: rgba(0, 0, 0, 0.4);
          border-radius: 12px;
          padding: 16px;
          margin: 16px 0;
          max-height: 300px;
          overflow-y: auto;
          border-left: 3px solid #8b5cf6;
        }

        .declaration-timeline.empty {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100px;
        }

        .timeline-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .timeline-entries {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        /* Scrollbar personalizzata */
        .declaration-timeline::-webkit-scrollbar {
          width: 6px;
        }

        .declaration-timeline::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 3px;
        }

        .declaration-timeline::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.5);
          border-radius: 3px;
        }

        .declaration-timeline::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.7);
        }
      `}</style>
    </div>
  );
}

/**
 * Singolo entry nella timeline
 */
function DeclarationEntry({
  claim,
  isActive,
  isChallenged,
  challengeSuccess,
  onChallengeClick,
}) {
  return (
    <div
      className={`declaration-entry ${isActive ? 'active' : ''} ${
        isChallenged ? (challengeSuccess ? 'challenged-won' : 'challenged-lost') : ''
      }`}
    >
      <div className="entry-header">
        <div className="player-info">
          <span className="player-name">{claim.playerName}</span>
          <span className="claim-value">
            {claim.quantity}x {claim.value}
          </span>
        </div>
        <span className="time-ago">{claim.timeAgo}</span>
      </div>

      {isChallenged && (
        <div className="challenge-badge">
          {challengeSuccess ? (
            <>
              <span className="badge-icon">✓</span>
              <span className="badge-text">Bluff scoperto!</span>
            </>
          ) : (
            <>
              <span className="badge-icon">✗</span>
              <span className="badge-text">Vera dichiarazione</span>
            </>
          )}
        </div>
      )}

      {isActive && (
        <div className="active-indicator">
          <span className="pulse"></span>
          <span className="label">Dichiarazione attiva</span>
        </div>
      )}

      <style jsx>{`
        .declaration-entry {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 8px;
          padding: 12px;
          transition: all 0.3s ease;
        }

        .declaration-entry.active {
          border-color: #8b5cf6;
          background: rgba(139, 92, 246, 0.15);
          box-shadow: 0 0 12px rgba(139, 92, 246, 0.3);
        }

        .declaration-entry.challenged-won {
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }

        .declaration-entry.challenged-lost {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.1);
        }

        .entry-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .player-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .player-name {
          font-weight: 600;
          font-size: 13px;
          color: #fff;
        }

        .claim-value {
          font-size: 12px;
          color: #a78bfa;
          font-weight: 500;
        }

        .time-ago {
          font-size: 11px;
          color: #999;
        }

        .challenge-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 6px;
          font-size: 12px;
          margin-top: 8px;
        }

        .declaration-entry.challenged-won .challenge-badge {
          background: rgba(239, 68, 68, 0.2);
          color: #fca5a5;
        }

        .declaration-entry.challenged-lost .challenge-badge {
          background: rgba(16, 185, 129, 0.2);
          color: #86efac;
        }

        .badge-icon {
          font-weight: bold;
          font-size: 14px;
        }

        .badge-text {
          font-weight: 500;
        }

        .active-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid rgba(139, 92, 246, 0.3);
          font-size: 11px;
          color: #a78bfa;
        }

        .pulse {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #8b5cf6;
          animation: pulse-animation 2s infinite;
        }

        @keyframes pulse-animation {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(0.8);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

// ============================================
// BEHAVIOR INDICATORS COMPONENT
// ============================================

/**
 * Mostra indicatori comportamentali di un giocatore
 */
export function BehaviorIndicators({ indicators, maxDisplay = 3 }) {
  if (!indicators || indicators.length === 0) {
    return null;
  }

  const displayIndicators = indicators.slice(0, maxDisplay);

  return (
    <div className="behavior-indicators">
      {displayIndicators.map((indicator, idx) => (
        <div
          key={idx}
          className="indicator"
          style={{ backgroundColor: indicator.color + '20', borderColor: indicator.color }}
          title={indicator.tooltip}
        >
          <span className="indicator-icon" style={{ color: indicator.color }}>
            {indicator.icon}
          </span>
        </div>
      ))}

      {indicators.length > maxDisplay && (
        <div className="indicator-more">+{indicators.length - maxDisplay}</div>
      )}

      <style jsx>{`
        .behavior-indicators {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          align-items: center;
        }

        .indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1.5px solid;
          cursor: help;
          transition: all 0.2s ease;
        }

        .indicator:hover {
          transform: scale(1.15);
          filter: brightness(1.2);
        }

        .indicator-icon {
          font-size: 16px;
        }

        .indicator-more {
          font-size: 12px;
          font-weight: 600;
          color: #999;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </div>
  );
}

// ============================================
// GAME END SCREEN
// ============================================

/**
 * Schermata finale della partita con recap
 */
export function GameEndScreen({ gameSummary, playerSummaries, isDraw = false, onPlayAgain, onLeave }) {
  const message = getGameEndMessage(
    gameSummary.winner,
    gameSummary.endReason,
    isDraw
  );

  return (
    <div className="game-end-screen">
      {/* Sfondo sfumato */}
      <div className="end-background"></div>

      {/* Contenuto */}
      <div className="end-content">
        {/* Header con messaggio */}
        <div className="end-header">
          <div className="end-emoji" style={{ fontSize: '64px', marginBottom: '16px' }}>
            {message.emoji}
          </div>
          <h1 className="end-title">{message.title}</h1>
          <p className="end-subtitle">{message.subtitle}</p>
        </div>

        {/* Ranking */}
        <div className="ranking-section">
          <h2 className="section-title">Classifica Finale</h2>
          <div className="ranking-list">
            {playerSummaries.map((player) => (
              <PlayerResultCard key={player.playerId} player={player} />
            ))}
          </div>
        </div>

        {/* Bottoni d'azione */}
        <div className="end-actions">
          <button className="btn btn-primary" onClick={onPlayAgain}>
            🎮 Gioca di nuovo
          </button>
          <button className="btn btn-secondary" onClick={onLeave}>
            Esci
          </button>
        </div>
      </div>

      <style jsx>{`
        .game-end-screen {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fade-in 0.3s ease;
        }

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .end-background {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);
          opacity: 0.95;
        }

        .end-content {
          position: relative;
          z-index: 10;
          background: rgba(0, 0, 0, 0.6);
          border: 2px solid rgba(139, 92, 246, 0.3);
          border-radius: 20px;
          padding: 40px;
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
          backdrop-filter: blur(10px);
          animation: slide-up 0.4s ease;
        }

        @keyframes slide-up {
          from {
            transform: translateY(50px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .end-header {
          text-align: center;
          margin-bottom: 32px;
          padding-bottom: 24px;
          border-bottom: 1px solid rgba(139, 92, 246, 0.2);
        }

        .end-title {
          font-size: 32px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 12px;
        }

        .end-subtitle {
          font-size: 16px;
          color: #c4b5fd;
        }

        .ranking-section {
          margin-bottom: 32px;
        }

        .section-title {
          font-size: 16px;
          font-weight: 600;
          color: #a78bfa;
          margin-bottom: 16px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .ranking-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .end-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        .btn {
          flex: 1;
          padding: 12px 24px;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-primary {
          background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
          color: white;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(139, 92, 246, 0.4);
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.1);
          color: #e9d5ff;
          border: 1px solid rgba(139, 92, 246, 0.3);
        }

        .btn-secondary:hover {
          background: rgba(139, 92, 246, 0.2);
          border-color: #8b5cf6;
        }

        /* Scrollbar */
        .end-content::-webkit-scrollbar {
          width: 6px;
        }

        .end-content::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
        }

        .end-content::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.5);
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
}

/**
 * Card risultato singolo giocatore nella classifica
 */
function PlayerResultCard({ player }) {
  const rankEmoji = getRankEmoji(player.rank);
  const netGainColor = getNetGainColor(player.netGain);
  const netGainFormatted = formatCredits(player.netGain);

  return (
    <div className="result-card" style={{ borderColor: netGainColor }}>
      <div className="result-rank-section">
        <div className="rank-emoji">{rankEmoji}</div>
        <div className="rank-number">#{player.rank}</div>
      </div>

      <div className="result-main">
        <div className="result-name-section">
          <h3 className="result-name">{player.name}</h3>
          {player.isWinner && <span className="winner-badge">👑 VINCITORE</span>}
        </div>

        <div className="result-credits">
          <span className="credit-label">Crediti finali</span>
          <span className="credit-value">{player.finalCredits}</span>
        </div>

        <div className="result-net-gain" style={{ color: netGainColor }}>
          <span className="net-label">Guadagno/Perdita</span>
          <span className="net-value">{netGainFormatted}</span>
        </div>
      </div>

      <div className="result-stats">
        {player.claimsCount > 0 && (
          <div className="stat-item">
            <span className="stat-icon">📢</span>
            <span className="stat-value">{player.claimsCount}</span>
          </div>
        )}

        {player.challengesCount > 0 && (
          <div className="stat-item">
            <span className="stat-icon">⚔️</span>
            <span className="stat-value">
              {player.challengesWon}/{player.challengesCount}
            </span>
          </div>
        )}

        {player.wildcardsUsed > 0 && (
          <div className="stat-item">
            <span className="stat-icon">⚡</span>
            <span className="stat-value">{player.wildcardsUsed}</span>
          </div>
        )}
      </div>

      <style jsx>{`
        .result-card {
          display: flex;
          gap: 16px;
          align-items: center;
          padding: 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 2px solid;
          border-radius: 12px;
          transition: all 0.2s ease;
        }

        .result-card:hover {
          background: rgba(255, 255, 255, 0.08);
          transform: translateX(4px);
        }

        .result-rank-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          min-width: 50px;
        }

        .rank-emoji {
          font-size: 28px;
        }

        .rank-number {
          font-size: 11px;
          color: #999;
          font-weight: 600;
        }

        .result-main {
          flex: 1;
        }

        .result-name-section {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .result-name {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
        }

        .winner-badge {
          font-size: 11px;
          background: rgba(251, 191, 36, 0.2);
          color: #fbbf24;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 600;
        }

        .result-credits {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          margin-bottom: 6px;
          gap: 8px;
        }

        .credit-label {
          color: #999;
        }

        .credit-value {
          font-weight: 600;
          color: #fff;
        }

        .result-net-gain {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          gap: 8px;
        }

        .net-label {
          color: #999;
        }

        .net-value {
          font-weight: 600;
        }

        .result-stats {
          display: flex;
          gap: 8px;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 6px;
          font-size: 11px;
          color: #c4b5fd;
        }

        .stat-icon {
          font-size: 12px;
        }

        .stat-value {
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

// ============================================
// EXPORTS
// ============================================

export default {
  DeclarationTimeline,
  BehaviorIndicators,
  GameEndScreen,
};
