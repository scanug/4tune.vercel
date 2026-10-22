import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAnswer, isAnswerCorrect } from '../src/barra/normalize.js';

test('maiuscole, spazi multipli e punteggiatura', () => {
  assert.equal(normalizeAnswer('  Ciao,   MONDO!!  '), 'ciao mondo');
  assert.equal(normalizeAnswer('ciao... mondo?'), 'ciao mondo');
  assert.equal(normalizeAnswer('"ciao" — mondo'), 'ciao mondo');
});

test('apostrofi tipografici equivalenti', () => {
  const a = normalizeAnswer("dell'anima");
  assert.equal(normalizeAnswer('dell’anima'), a);
  assert.equal(normalizeAnswer('dell‘anima'), a);
  assert.equal(normalizeAnswer('dellʼanima'), a);
  assert.equal(normalizeAnswer('dell anima'), a);
});

test('equivalenze Unicode (NFC/NFD/NFKC)', () => {
  const composed = 'città';      // à precomposta
  const decomposed = 'città';   // a + accento combinante
  assert.equal(normalizeAnswer(composed), normalizeAnswer(decomposed));
  assert.equal(normalizeAnswer('ｃｉａｏ'), 'ciao'); // caratteri a larghezza piena
  assert.equal(normalizeAnswer('ci​ao'), 'ciao');              // zero-width space
});

test('accento finale: grave/acuto e apostrofo da tastiera', () => {
  assert.equal(normalizeAnswer('perché'), normalizeAnswer('perchè'));
  assert.equal(normalizeAnswer("perche'"), normalizeAnswer('perché'));
  assert.equal(normalizeAnswer("e' tardi"), normalizeAnswer('è tardi'));
  assert.equal(normalizeAnswer("un po'"), normalizeAnswer('un pò'));
});

test('gli accenti non vengono rimossi indiscriminatamente', () => {
  assert.notEqual(normalizeAnswer('è'), normalizeAnswer('e'));
  assert.notEqual(normalizeAnswer('perché'), normalizeAnswer('perche'));
  assert.notEqual(normalizeAnswer('papà'), normalizeAnswer('papa'));
});

test('nessuna similarità permissiva: parole diverse restano diverse', () => {
  assert.equal(isAnswerCorrect('cuore', 'cuori'), false);
  assert.equal(isAnswerCorrect('sere nere', 'sera nera'), false);
  assert.equal(isAnswerCorrect('sere', 'sere nere'), false);
  assert.equal(isAnswerCorrect('sere nere nere', 'sere nere'), false);
});

test('risposta corretta e varianti accettate', () => {
  const answer = "Non me ne frega niente";
  const variants = ['nun me ne frega niente', 'non me ne frega nulla'];
  assert.equal(isAnswerCorrect('non me ne frega niente!', answer, variants), true);
  assert.equal(isAnswerCorrect('Nun me ne frega niente', answer, variants), true);
  assert.equal(isAnswerCorrect('NON ME NE FREGA NULLA', answer, variants), true);
  assert.equal(isAnswerCorrect('non me ne importa niente', answer, variants), false);
});

test('risposte vuote o non stringa non sono mai corrette', () => {
  assert.equal(isAnswerCorrect('', ''), false);
  assert.equal(isAnswerCorrect('   ', 'x'), false);
  assert.equal(isAnswerCorrect('!!!', '???'), false);
  assert.equal(isAnswerCorrect(null, 'x'), false);
});
