/**
 * LUCKY LIAR - UI Design System
 * Colori, spacing, timing, animazioni, breakpoints
 * Garantisce coerenza visiva in tutta l'app
 */

// ============================================
// COLORI
// ============================================

export const COLORS = {
  // Background
  bg: {
    primary: '#0f172a',      // Blu navy scuro
    secondary: '#1e293b',    // Blu navy più chiaro
    tertiary: '#334155',     // Grigio-blu
    overlay: 'rgba(0, 0, 0, 0.6)',
  },

  // Accent
  accent: {
    primary: '#8b5cf6',      // Viola (wildcard, active)
    secondary: '#6d28d9',    // Viola scuro
    light: '#a78bfa',        // Viola chiaro
  },

  // Estados
  success: '#10b981',        // Verde (bluff scoperto, sfida vinta)
  warning: '#fbbf24',        // Giallo (avvertimento, attenzione)
  danger: '#ef4444',         // Rosso (errore, bluff fallito)
  info: '#3b82f6',           // Blu (informazione)

  // Giocatore
  player: {
    self: '#8b5cf6',         // Viola (io)
    active: '#fbbf24',       // Giallo (turno)
    other: '#6b7280',        // Grigio (altri)
    eliminated: '#4b5563',   // Grigio scuro (eliminato)
  },

  // Carte
  card: {
    bg: '#1e293b',
    border: '#334155',
    highlight: '#8b5cf6',
  },

  // Crediti
  credit: {
    positive: '#10b981',
    negative: '#ef4444',
    neutral: '#9ca3af',
  },

  // Text
  text: {
    primary: '#ffffff',
    secondary: '#d1d5db',
    tertiary: '#9ca3af',
    muted: '#6b7280',
  },
};

// ============================================
// SPACING (8px grid)
// ============================================

export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
};

// ============================================
// TYPOGRAPHY
// ============================================

export const TYPOGRAPHY = {
  // Heading
  h1: {
    fontSize: '32px',
    fontWeight: '700',
    lineHeight: '1.2',
  },
  h2: {
    fontSize: '24px',
    fontWeight: '700',
    lineHeight: '1.3',
  },
  h3: {
    fontSize: '20px',
    fontWeight: '600',
    lineHeight: '1.4',
  },

  // Body
  body: {
    fontSize: '14px',
    fontWeight: '400',
    lineHeight: '1.5',
  },
  bodySm: {
    fontSize: '12px',
    fontWeight: '400',
    lineHeight: '1.4',
  },
  bodyXs: {
    fontSize: '11px',
    fontWeight: '400',
    lineHeight: '1.3',
  },

  // Label
  label: {
    fontSize: '13px',
    fontWeight: '500',
    lineHeight: '1.4',
  },

  // Button
  button: {
    fontSize: '14px',
    fontWeight: '600',
    lineHeight: '1.5',
  },
};

// ============================================
// BORDER RADIUS
// ============================================

export const RADIUS = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
};

// ============================================
// SHADOWS
// ============================================

export const SHADOWS = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.2)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.3)',
  glow: '0 0 12px rgba(139, 92, 246, 0.4)',
  glowStrong: '0 0 24px rgba(139, 92, 246, 0.6)',
};

// ============================================
// TRANSITIONS
// ============================================

export const TRANSITIONS = {
  fast: '150ms ease-in-out',
  normal: '300ms ease-in-out',
  slow: '500ms ease-in-out',
  verySlow: '800ms ease-in-out',
};

// ============================================
// Z-INDEX
// ============================================

export const Z_INDEX = {
  hidden: '-1',
  base: '0',
  dropdown: '100',
  sticky: '200',
  fixed: '300',
  modal: '400',
  popover: '500',
  tooltip: '600',
  notification: '700',
  topmost: '1000',
};

// ============================================
// BREAKPOINTS (Mobile-first)
// ============================================

export const BREAKPOINTS = {
  xs: '320px',    // Mobile
  sm: '640px',    // Mobile landscape
  md: '768px',    // Tablet
  lg: '1024px',   // Desktop
  xl: '1280px',   // Large desktop
  xxl: '1536px',  // Extra large
};

// ============================================
// ANIMATION TIMING
// ============================================

export const ANIMATION_TIMING = {
  // Entrance
  cardEnter: 500,           // Carta entra (ms)
  playerEnter: 300,         // Giocatore entra
  
  // Declaration
  declarationShowActive: 200, // Evidenzia dichiarazione attiva
  
  // Challenge
  challengeStart: 300,      // Inizio animazione sfida
  challengeReveal: 1500,    // Reveal risultato
  
  // Result
  bluffSuccess: 800,        // Bluff scoperto
  bluffFail: 600,           // Bluff fallito
  creditChange: 400,        // Cambio crediti
  
  // Exit
  playerExit: 400,          // Giocatore eliminato
  gameEndShow: 600,         // Schermata finale
};

// ============================================
// FEEDBACK MESSAGES (Ux Psychology)
// ============================================

export const FEEDBACK_MESSAGES = {
  // Bluff Success
  bluffSuccess: {
    title: '🎭 Bluff Scoperto!',
    subtitle: 'La dichiarazione era falsa',
    delay: 300,
  },
  
  // Bluff Fail
  bluffFail: {
    title: '✓ Vera Dichiarazione',
    subtitle: 'Hai sbagliato la sfida',
    delay: 300,
  },
  
  // Challenge Won
  challengeWon: {
    title: '⚔️ Sfida Vinta!',
    subtitle: 'Hai guadagnato crediti',
    delay: 500,
  },
  
  // Challenge Lost
  challengeLost: {
    title: '❌ Sfida Persa',
    subtitle: 'Hai perso crediti',
    delay: 500,
  },
  
  // Wildcard Used
  wildcardUsed: {
    title: '⚡ Wildcard Attivata!',
    subtitle: 'L\'effetto è stato applicato',
    delay: 400,
  },
  
  // Turn Active
  turnActive: {
    title: '🎤 È il tuo turno',
    subtitle: 'Fai una dichiarazione',
    delay: 100,
  },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Genera string CSS per media query
 * @param {string} breakpoint - xs, sm, md, lg, xl, xxl
 * @returns {string} Media query string
 */
export function media(breakpoint) {
  return `@media (min-width: ${BREAKPOINTS[breakpoint]})`;
}

/**
 * Converti colore hex in rgba
 * @param {string} hex - #rrggbb
 * @param {number} alpha - 0-1
 * @returns {string} rgba color
 */
export function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Get color basato su stato
 * @param {string} state - success, danger, warning, info
 * @returns {string} Colore hex
 */
export function getStateColor(state) {
  const colors = {
    success: COLORS.success,
    danger: COLORS.danger,
    warning: COLORS.warning,
    info: COLORS.info,
  };
  return colors[state] || COLORS.info;
}

/**
 * Get animation timing basato su tipo
 * @param {string} type - cardEnter, challengeStart, bluffSuccess, etc
 * @returns {number} Tempo in ms
 */
export function getAnimationTiming(type) {
  return ANIMATION_TIMING[type] || 300;
}

// ============================================
// CSS UTILITY CLASSES
// ============================================

export const CSS_UTILS = `
  /* Flexbox utilities */
  .flex-center {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .flex-between {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .flex-start {
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }

  /* Grid utilities */
  .grid-auto {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 8px;
  }

  /* Text utilities */
  .text-truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .text-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Visibility */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  /* Scrollbar */
  .scrollbar-custom::-webkit-scrollbar {
    width: 6px;
  }

  .scrollbar-custom::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }

  .scrollbar-custom::-webkit-scrollbar-thumb {
    background: rgba(139, 92, 246, 0.5);
    border-radius: 3px;
  }

  .scrollbar-custom::-webkit-scrollbar-thumb:hover {
    background: rgba(139, 92, 246, 0.7);
  }
`;

// ============================================
// COMPONENT PRESET STYLES
// ============================================

export const COMPONENT_STYLES = {
  // Card
  card: {
    bg: COLORS.bg.secondary,
    border: `1px solid ${COLORS.accent.light}`,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    shadow: SHADOWS.md,
  },

  // Button Primary
  buttonPrimary: {
    bg: COLORS.accent.primary,
    color: COLORS.text.primary,
    padding: `${SPACING.sm} ${SPACING.lg}`,
    borderRadius: RADIUS.md,
    fontSize: TYPOGRAPHY.button.fontSize,
    fontWeight: TYPOGRAPHY.button.fontWeight,
    cursor: 'pointer',
    transition: TRANSITIONS.fast,
  },

  // Button Secondary
  buttonSecondary: {
    bg: 'transparent',
    color: COLORS.accent.primary,
    border: `1px solid ${COLORS.accent.primary}`,
    padding: `${SPACING.sm} ${SPACING.lg}`,
    borderRadius: RADIUS.md,
    fontSize: TYPOGRAPHY.button.fontSize,
    fontWeight: TYPOGRAPHY.button.fontWeight,
    cursor: 'pointer',
    transition: TRANSITIONS.fast,
  },

  // Input
  input: {
    bg: COLORS.bg.secondary,
    color: COLORS.text.primary,
    border: `1px solid ${COLORS.card.border}`,
    borderRadius: RADIUS.md,
    padding: `${SPACING.sm} ${SPACING.md}`,
    fontSize: TYPOGRAPHY.body.fontSize,
    transition: TRANSITIONS.fast,
  },

  // Badge
  badge: {
    display: 'inline-block',
    padding: `2px 8px`,
    borderRadius: RADIUS.full,
    fontSize: TYPOGRAPHY.bodyXs.fontSize,
    fontWeight: TYPOGRAPHY.label.fontWeight,
  },
};

// ============================================
// PSYCHOLOGY PRINCIPLES
// ============================================

export const UX_PSYCHOLOGY = {
  // Feedback immediato (< 100ms invisibile, 200-500ms ideale)
  FEEDBACK_DELAY_IMMEDIATE: 0,
  FEEDBACK_DELAY_FAST: 200,
  FEEDBACK_DELAY_NORMAL: 400,
  FEEDBACK_DELAY_SLOW: 800,

  // Decisioni psicologiche
  CHOICE_TIMEOUT_NORMAL: 10000,  // 10 secondi per dichiarazione
  CHOICE_TIMEOUT_CHALLENGE: 5000, // 5 secondi per sfida

  // Colori per emozioni
  COLOR_FOR_SUCCESS: COLORS.success,   // Verde = positivo
  COLOR_FOR_ERROR: COLORS.danger,      // Rosso = negativo
  COLOR_FOR_ACTION: COLORS.accent.primary, // Viola = attivo/importante

  // Spacing per leggibilità
  CARD_SPACING: SPACING.md,            // Spazio tra elementi
  SECTION_SPACING: SPACING.lg,         // Spazio tra sezioni

  // Contrast per chiarezza
  MIN_CONTRAST_RATIO: 4.5,             // WCAG AA standard
};

export default {
  COLORS,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  TRANSITIONS,
  Z_INDEX,
  BREAKPOINTS,
  ANIMATION_TIMING,
  FEEDBACK_MESSAGES,
  UX_PSYCHOLOGY,
  media,
  hexToRgba,
  getStateColor,
  getAnimationTiming,
  CSS_UTILS,
  COMPONENT_STYLES,
};
