export const BASE_POINTS = 100;
export const MAX_SPEED_BONUS = 20;
// Il bonus è a scaglioni (quarti della finestra di risposta) per non
// trasformare la partita in una gara sui millisecondi.
const BONUS_STEPS = [20, 15, 10, 5];

export function speedBonus(receivedAt, answerOpenAt, answerMs) {
  if (!answerMs || answerMs <= 0) return 0;
  const elapsed = Math.min(Math.max(0, receivedAt - answerOpenAt), answerMs);
  const step = Math.min(BONUS_STEPS.length - 1, Math.floor((elapsed / answerMs) * BONUS_STEPS.length));
  return Math.min(MAX_SPEED_BONUS, BONUS_STEPS[step]);
}

export function computePoints({ correct, receivedAt, answerOpenAt, answerMs, speedBonusEnabled }) {
  if (!correct) return { points: 0, bonus: 0 };
  const bonus = speedBonusEnabled ? speedBonus(receivedAt, answerOpenAt, answerMs) : 0;
  return { points: BASE_POINTS + bonus, bonus };
}
