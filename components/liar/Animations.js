'use client';

import React, { useState, useEffect } from 'react';
import {
  COLORS,
  ANIMATION_TIMING,
  SHADOWS,
  RADIUS,
  SPACING,
  TRANSITIONS,
} from '@/lib/uiDesignSystem';

/**
 * Toast notification per feedback immediato
 */
function FeedbackToast({ message, type, duration = 3000, onDismiss }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!isVisible) {
      onDismiss?.();
    }
  }, [isVisible, onDismiss]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsVisible(false);
    }, duration);

    return () => clearTimeout(timeout);
  }, [duration]);

  if (!isVisible) return null;

  const colors = {
    success: COLORS.success,
    error: COLORS.danger,
    warning: COLORS.warning,
    info: COLORS.info,
  };

  const bgColor = colors[type] || colors.info;

  return (
    <div className={`feedback-toast show ${type}`} style={{ borderColor: bgColor }}>
      <div className="toast-content">
        <span className="toast-message">{message}</span>
      </div>

      <style jsx>{`
        .feedback-toast {
          position: fixed;
          bottom: 24px;
          left: 24px;
          right: 24px;
          max-width: 400px;
          background: rgba(0, 0, 0, 0.9);
          border: 2px solid;
          border-radius: ${RADIUS.lg};
          padding: ${SPACING.md};
          box-shadow: ${SHADOWS.xl};
          z-index: 700;
          animation: toast-enter 0.3s ease-out;
        }

        .feedback-toast.show {
          animation: toast-enter 0.3s ease-out;
        }

        @keyframes toast-enter {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .toast-content {
          display: flex;
          align-items: center;
          gap: ${SPACING.sm};
        }

        .toast-message {
          color: #ffffff;
          font-weight: 500;
          font-size: 14px;
        }

        @media (max-width: 640px) {
          .feedback-toast {
            left: 12px;
            right: 12px;
            bottom: 12px;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Animazione e feedback per risultato bluff
 */
function BluffResultAnimation({ success, playerName, onComplete }) {
  useEffect(() => {
    const timeout = setTimeout(() => {
      onComplete?.();
    }, ANIMATION_TIMING.bluffSuccess);

    return () => clearTimeout(timeout);
  }, [onComplete]);

  const result = success
    ? {
        emoji: '🎭',
        title: 'Bluff Scoperto!',
        subtitle: `${playerName} stava bluffando`,
        color: COLORS.danger,
      }
    : {
        emoji: '✓',
        title: 'Vera Dichiarazione',
        subtitle: 'Hai sbagliato la sfida',
        color: COLORS.success,
      };

  return (
    <div className="bluff-result-overlay">
      <div className="bluff-result-card" style={{ borderColor: result.color }}>
        <div className="result-emoji" style={{ color: result.color }}>
          {result.emoji}
        </div>
        <h2 className="result-title" style={{ color: result.color }}>
          {result.title}
        </h2>
        <p className="result-subtitle">{result.subtitle}</p>
      </div>

      <style jsx>{`
        .bluff-result-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 600;
          animation: overlay-fade-in 0.2s ease-out;
        }

        @keyframes overlay-fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .bluff-result-card {
          background: rgba(0, 0, 0, 0.95);
          border: 3px solid;
          border-radius: ${RADIUS.xl};
          padding: ${SPACING.xl};
          text-align: center;
          box-shadow: ${SHADOWS.xl};
          animation: card-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
          max-width: 400px;
        }

        @keyframes card-pop {
          0% {
            transform: scale(0.8);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .result-emoji {
          font-size: 64px;
          margin-bottom: ${SPACING.md};
          display: block;
          animation: emoji-bounce 0.6s ease-out;
        }

        @keyframes emoji-bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-20px);
          }
        }

        .result-title {
          margin: 0 0 ${SPACING.sm} 0;
          font-size: 32px;
          font-weight: 700;
        }

        .result-subtitle {
          margin: 0;
          font-size: 16px;
          color: #d1d5db;
        }
      `}</style>
    </div>
  );
}

/**
 * Animazione della fase challenge
 */
function ChallengeAnimation({ claimerName, challengerName, onReady }) {
  useEffect(() => {
    const timeout = setTimeout(() => {
      onReady?.();
    }, ANIMATION_TIMING.challengeStart);

    return () => clearTimeout(timeout);
  }, [onReady]);

  return (
    <div className="challenge-animation">
      <div className="challenge-content">
        <div className="player player-left">
          <div className="player-emoji">🎤</div>
          <div className="player-label">{claimerName}</div>
        </div>

        <div className="vs-divider">
          <span className="vs-text">VS</span>
          <span className="vs-line"></span>
        </div>

        <div className="player player-right">
          <div className="player-emoji">⚔️</div>
          <div className="player-label">{challengerName}</div>
        </div>
      </div>

      <style jsx>{`
        .challenge-animation {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 500;
        }

        .challenge-content {
          display: flex;
          align-items: center;
          gap: ${SPACING.xxl};
          animation: challenge-appear 0.6s ease-out;
        }

        @keyframes challenge-appear {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .player {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: ${SPACING.md};
          animation: player-slide 0.6s ease-out;
        }

        .player.player-left {
          animation-name: player-slide-left;
        }

        .player.player-right {
          animation-name: player-slide-right;
        }

        @keyframes player-slide-left {
          from {
            transform: translateX(-100px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes player-slide-right {
          from {
            transform: translateX(100px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .player-emoji {
          font-size: 48px;
          animation: emoji-scale 0.6s ease-out;
        }

        @keyframes emoji-scale {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        .player-label {
          font-size: 16px;
          font-weight: 600;
          color: #ffffff;
          text-align: center;
        }

        .vs-divider {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: ${SPACING.sm};
        }

        .vs-text {
          font-size: 24px;
          font-weight: 700;
          color: ${COLORS.accent.primary};
          animation: vs-pulse 0.6s ease-out;
        }

        @keyframes vs-pulse {
          0% {
            opacity: 0;
            transform: scale(0.5);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        .vs-line {
          width: 2px;
          height: 80px;
          background: ${COLORS.accent.primary};
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}

/**
 * Animazione cambio crediti (floating text)
 */
function CreditChangePopup({ amount, x, y, onComplete }) {
  useEffect(() => {
    const timeout = setTimeout(() => {
      onComplete?.();
    }, ANIMATION_TIMING.creditChange);

    return () => clearTimeout(timeout);
  }, [onComplete]);

  const isPositive = amount > 0;
  const color = isPositive ? COLORS.success : COLORS.danger;
  const text = isPositive ? `+${amount}` : `${amount}`;

  return (
    <div
      className="credit-popup"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        color: color,
      }}
    >
      {text}

      <style jsx>{`
        .credit-popup {
          position: fixed;
          font-size: 28px;
          font-weight: 700;
          pointer-events: none;
          z-index: 400;
          animation: float-up-and-fade 0.8s ease-out forwards;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
        }

        @keyframes float-up-and-fade {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-60px) scale(0.8);
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Loading spinner per attese
 */
function LoadingIndicator({ text = 'In caricamento...', size = 'md' }) {
  const sizes = {
    sm: { spinner: '24px', text: '12px' },
    md: { spinner: '40px', text: '14px' },
    lg: { spinner: '60px', text: '16px' },
  };

  const sizeConfig = sizes[size] || sizes.md;

  return (
    <div className="loading-indicator">
      <div className="spinner"></div>
      {text && <p className="loading-text">{text}</p>}

      <style jsx>{`
        .loading-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: ${SPACING.md};
          padding: ${SPACING.lg};
        }

        .spinner {
          width: ${sizeConfig.spinner};
          height: ${sizeConfig.spinner};
          border: 3px solid rgba(139, 92, 246, 0.2);
          border-top-color: ${COLORS.accent.primary};
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .loading-text {
          margin: 0;
          font-size: ${sizeConfig.text};
          color: ${COLORS.text.secondary};
          text-align: center;
        }
      `}</style>
    </div>
  );
}

/**
 * Component che pulsa per attirare attenzione
 */
function PulseAnimation({ children, color }) {
  const pulseColor = color || COLORS.accent.primary;

  return (
    <div className="pulse-container" style={{ '--pulse-color': pulseColor }}>
      {children}

      <style jsx>{`
        .pulse-container {
          animation: pulse-effect 2s ease-in-out infinite;
        }

        @keyframes pulse-effect {
          0%, 100% {
            opacity: 1;
            box-shadow: 0 0 0 0 var(--pulse-color, #8b5cf6);
          }
          50% {
            opacity: 0.8;
            box-shadow: 0 0 0 10px rgba(139, 92, 246, 0);
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Custom hook per gestire feedback/toast
 */
function useFeedback() {
  const [feedbacks, setFeedbacks] = useState([]);

  const show = (message, type = 'info', duration = 3000) => {
    const id = Date.now();
    setFeedbacks((prev) => [...prev, { id, message, type, duration }]);

    return id;
  };

  const dismiss = (id) => {
    setFeedbacks((prev) => prev.filter((f) => f.id !== id));
  };

  const dismiss_all = () => {
    setFeedbacks([]);
  };

  return {
    feedbacks,
    show,
    dismiss,
    dismiss_all,
    showSuccess: (msg, duration) => show(msg, 'success', duration),
    showError: (msg, duration) => show(msg, 'error', duration),
    showWarning: (msg, duration) => show(msg, 'warning', duration),
    showInfo: (msg, duration) => show(msg, 'info', duration),
  };
}

/**
 * Container che renderizza tutti i toast
 */
function FeedbackToastContainer({ feedbacks, onDismiss }) {
  return (
    <>
      {feedbacks.map((feedback) => (
        <FeedbackToast
          key={feedback.id}
          message={feedback.message}
          type={feedback.type}
          duration={feedback.duration}
          onDismiss={() => onDismiss(feedback.id)}
        />
      ))}
    </>
  );
}

export {
  FeedbackToast,
  BluffResultAnimation,
  ChallengeAnimation,
  CreditChangePopup,
  LoadingIndicator,
  PulseAnimation,
  useFeedback,
  FeedbackToastContainer,
};
