// Normalizzazione deterministica delle risposte di "Completa la barra".
// Regole volutamente prevedibili: niente similarità fuzzy, niente rimozione
// indiscriminata degli accenti. Le equivalenze non coperte qui vanno inserite
// dall'admin come varianti accettate.

const APOSTROPHES = /[‘’‚‛ʼʹ´`′＇]/g;
const INVISIBLE = /[​-‍⁠﻿­]/g;

// Vocale accentata finale: grave e acuto sono trattati come equivalenti
// (perché/perchè), ma solo in fine parola, dove in italiano l'accento è grafico.
const FINAL_ACCENT = {
  a: 'à', 'à': 'à', 'á': 'à',
  e: 'è', 'è': 'è', 'é': 'è',
  i: 'ì', 'ì': 'ì', 'í': 'ì',
  o: 'ò', 'ò': 'ò', 'ó': 'ò',
  u: 'ù', 'ù': 'ù', 'ú': 'ù',
};

export function normalizeAnswer(input) {
  if (typeof input !== 'string') return '';
  let s = input.normalize('NFKC').replace(INVISIBLE, '');
  s = s.toLocaleLowerCase('it-IT');
  s = s.replace(APOSTROPHES, "'");

  // "perche'" / "piu'" / "e'" -> vocale accentata finale (uso comune da tastiera)
  s = s.replace(/([aeiou])'(?=$|[\s\p{P}\p{S}])/gu, (_, v) => FINAL_ACCENT[v]);
  // Uniforma l'accento finale grave/acuto
  s = s.replace(/([àáèéìíòóùú])(?=$|[\s\p{P}\p{S}])/gu, (_, v) => FINAL_ACCENT[v]);

  // Apostrofi interni (dell'anima) e ogni altra punteggiatura/simbolo diventano separatori
  s = s.replace(/[\p{P}\p{S}]/gu, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s.normalize('NFC');
}

export function acceptedForms(answer, variants = []) {
  const forms = new Set();
  for (const v of [answer, ...(variants || [])]) {
    const n = normalizeAnswer(v);
    if (n) forms.add(n);
  }
  return forms;
}

export function isAnswerCorrect(raw, answer, variants = []) {
  const n = normalizeAnswer(raw);
  if (!n) return false;
  return acceptedForms(answer, variants).has(n);
}
