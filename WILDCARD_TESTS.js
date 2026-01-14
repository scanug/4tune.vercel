/**
 * LUCKY LIAR - Wildcard System Tests
 * Test cases per validare il sistema wildcard
 */

import {
  assignWildcards,
  hasAvailableWildcard,
  getWildcardForPlayer,
  determineWildcardScenario,
  calculateWildcardEffect,
  applyWildcardMultiplier,
  validateWildcardActivationInChallenge,
  WILDCARD_MODES,
  WILDCARD_SCENARIOS,
  WILDCARD_MULTIPLIERS,
} from '@/lib/luckyLiarWildcard';

/**
 * TEST 1: Assegnazione Wildcard
 */
export function testWildcardAssignment() {
  console.log('TEST 1: Wildcard Assignment');

  const playerIds = ['user1', 'user2', 'user3', 'user4'];

  // SINGLE Mode
  const singleWc = assignWildcards(playerIds, WILDCARD_MODES.SINGLE);
  console.assert(singleWc.length === 1, '❌ Should assign 1 wildcard in SINGLE mode');
  console.assert(singleWc[0].state === 'unused', '❌ State should be unused');
  console.log('✅ SINGLE mode: 1 wildcard assigned');

  // DOUBLE Mode
  const doubleWc = assignWildcards(playerIds, WILDCARD_MODES.DOUBLE);
  console.assert(doubleWc.length === 2, '❌ Should assign 2 wildcards in DOUBLE mode');
  console.assert(doubleWc.every((w) => w.state === 'unused'), '❌ All should be unused');
  console.log('✅ DOUBLE mode: 2 wildcards assigned');

  // Wildcard has required fields
  const wc = singleWc[0];
  console.assert(wc.playerId, '❌ Missing playerId');
  console.assert(wc.state !== undefined, '❌ Missing state');
  console.log('✅ All fields present');
}

/**
 * TEST 2: Wildcard Availability
 */
export function testWildcardAvailability() {
  console.log('\nTEST 2: Wildcard Availability');

  const playerIds = ['user1', 'user2', 'user3'];
  const wildcards = assignWildcards(playerIds, WILDCARD_MODES.SINGLE);

  const wildcardOwner = wildcards[0].playerId;
  const otherPlayer = playerIds.find((id) => id !== wildcardOwner);

  // Check availability
  console.assert(
    hasAvailableWildcard(wildcardOwner, wildcards),
    '❌ Should have available wildcard'
  );
  console.assert(
    !hasAvailableWildcard(otherPlayer, wildcards),
    '❌ Should not have wildcard'
  );
  console.log('✅ Availability check works');

  // Check after exhaustion
  const exhaustedWildcards = wildcards.map((w) =>
    w.playerId === wildcardOwner ? { ...w, state: 'exhausted' } : w
  );
  console.assert(
    !hasAvailableWildcard(wildcardOwner, exhaustedWildcards),
    '❌ Should not have available wildcard when exhausted'
  );
  console.log('✅ Exhaustion detection works');
}

/**
 * TEST 3: Scenario Determination
 */
export function testScenarioDetermination() {
  console.log('\nTEST 3: Scenario Determination');

  const wildcardOwnerId = 'user1';
  const claimerId = 'user1';
  const challengerId = 'user2';

  // Claimer True
  let scenario = determineWildcardScenario(
    wildcardOwnerId,
    claimerId,
    challengerId,
    true
  );
  console.assert(
    scenario === WILDCARD_SCENARIOS.CLAIMER_TRUE,
    `❌ Should be CLAIMER_TRUE, got ${scenario}`
  );
  console.log('✅ CLAIMER_TRUE scenario');

  // Claimer False
  scenario = determineWildcardScenario(wildcardOwnerId, claimerId, challengerId, false);
  console.assert(
    scenario === WILDCARD_SCENARIOS.CLAIMER_FALSE,
    `❌ Should be CLAIMER_FALSE, got ${scenario}`
  );
  console.log('✅ CLAIMER_FALSE scenario');

  // Challenger True (different owner)
  scenario = determineWildcardScenario(
    challengerId,
    claimerId,
    challengerId,
    true
  );
  console.assert(
    scenario === WILDCARD_SCENARIOS.CHALLENGER_TRUE,
    `❌ Should be CHALLENGER_TRUE, got ${scenario}`
  );
  console.log('✅ CHALLENGER_TRUE scenario');

  // Challenger False
  scenario = determineWildcardScenario(
    challengerId,
    claimerId,
    challengerId,
    false
  );
  console.assert(
    scenario === WILDCARD_SCENARIOS.CHALLENGER_FALSE,
    `❌ Should be CHALLENGER_FALSE, got ${scenario}`
  );
  console.log('✅ CHALLENGER_FALSE scenario');
}

/**
 * TEST 4: Penalty Multipliers
 */
export function testPenaltyMultipliers() {
  console.log('\nTEST 4: Penalty Multipliers');

  const basePenalty = 100;

  // REDUCE scenario
  let effect = calculateWildcardEffect(WILDCARD_SCENARIOS.CLAIMER_TRUE, basePenalty);
  console.assert(effect.multiplier === 0.5, `❌ REDUCE should be 0.5, got ${effect.multiplier}`);
  console.assert(
    effect.effectAmount === 50,
    `❌ Effect amount should be 50, got ${effect.effectAmount}`
  );
  console.log('✅ REDUCE multiplier: 0.5x (saves 50)');

  // AMPLIFY scenario
  effect = calculateWildcardEffect(WILDCARD_SCENARIOS.CLAIMER_FALSE, basePenalty);
  console.assert(effect.multiplier === 1.5, `❌ AMPLIFY should be 1.5, got ${effect.multiplier}`);
  console.assert(
    effect.effectAmount === 50,
    `❌ Effect amount should be 50, got ${effect.effectAmount}`
  );
  console.log('✅ AMPLIFY multiplier: 1.5x (adds 50)');

  // Modified penalty
  let modified = applyWildcardMultiplier(basePenalty, WILDCARD_SCENARIOS.CLAIMER_TRUE);
  console.assert(modified === 50, `❌ Modified should be 50, got ${modified}`);
  console.log('✅ Modified penalty (REDUCE): 100 → 50');

  modified = applyWildcardMultiplier(basePenalty, WILDCARD_SCENARIOS.CLAIMER_FALSE);
  console.assert(modified === 150, `❌ Modified should be 150, got ${modified}`);
  console.log('✅ Modified penalty (AMPLIFY): 100 → 150');
}

/**
 * TEST 5: Challenge Validation
 */
export function testChallengeValidation() {
  console.log('\nTEST 5: Challenge Validation');

  const playerIds = ['user1', 'user2', 'user3'];
  const wildcards = assignWildcards(playerIds, WILDCARD_MODES.SINGLE);
  const wildcardOwner = wildcards[0].playerId;
  const otherPlayer = playerIds.find((id) => id !== wildcardOwner);

  // Valid activation
  let validation = validateWildcardActivationInChallenge(wildcardOwner, wildcards);
  console.assert(validation.valid, '❌ Should be valid for owner');
  console.log('✅ Valid activation for owner');

  // Invalid: no wildcard
  validation = validateWildcardActivationInChallenge(otherPlayer, wildcards);
  console.assert(!validation.valid, '❌ Should be invalid for non-owner');
  console.assert(
    validation.reason.includes('non hai una wildcard'),
    '❌ Wrong error message'
  );
  console.log('✅ Invalid: no wildcard');

  // Invalid: already used
  const exhaustedWildcards = wildcards.map((w) =>
    w.playerId === wildcardOwner ? { ...w, state: 'exhausted' } : w
  );
  validation = validateWildcardActivationInChallenge(wildcardOwner, exhaustedWildcards);
  console.assert(!validation.valid, '❌ Should be invalid when exhausted');
  console.assert(
    validation.reason.includes('già usato'),
    '❌ Wrong error message'
  );
  console.log('✅ Invalid: already used');
}

/**
 * TEST 6: Scenario Matrix (All 4 Combinations)
 */
export function testScenarioMatrix() {
  console.log('\nTEST 6: Scenario Matrix (4 Combinations)');

  const scenarios = [
    {
      name: 'CLAIMER_TRUE',
      owner: 'claimer',
      result: true,
      expectedMultiplier: WILDCARD_MULTIPLIERS.REDUCE,
    },
    {
      name: 'CLAIMER_FALSE',
      owner: 'claimer',
      result: false,
      expectedMultiplier: WILDCARD_MULTIPLIERS.AMPLIFY,
    },
    {
      name: 'CHALLENGER_TRUE',
      owner: 'challenger',
      result: true,
      expectedMultiplier: WILDCARD_MULTIPLIERS.AMPLIFY,
    },
    {
      name: 'CHALLENGER_FALSE',
      owner: 'challenger',
      result: false,
      expectedMultiplier: WILDCARD_MULTIPLIERS.REDUCE,
    },
  ];

  for (const scenario of scenarios) {
    const wildcardOwnerId = scenario.owner === 'claimer' ? 'user1' : 'user2';
    const claimerId = 'user1';
    const challengerId = 'user2';

    const scenarioKey = determineWildcardScenario(
      wildcardOwnerId,
      claimerId,
      challengerId,
      scenario.result
    );

    const effect = calculateWildcardEffect(scenarioKey, 100);
    console.assert(
      effect.multiplier === scenario.expectedMultiplier,
      `❌ ${scenario.name}: expected ${scenario.expectedMultiplier}, got ${effect.multiplier}`
    );
    console.log(`✅ ${scenario.name}: ${scenario.expectedMultiplier}x multiplier`);
  }
}

/**
 * TEST 7: Integration Test (Full Flow)
 */
export function testFullFlow() {
  console.log('\nTEST 7: Full Flow Integration');

  const playerIds = ['user1', 'user2', 'user3'];
  
  // 1. Assign wildcards
  const wildcards = assignWildcards(playerIds, WILDCARD_MODES.SINGLE);
  const wildcardOwner = wildcards[0].playerId;
  console.log(`✅ Step 1: Wildcard assigned to ${wildcardOwner}`);

  // 2. Challenge happens (simulate)
  const basePenalty = 100;
  console.log(`✅ Step 2: Base penalty = ${basePenalty}`);

  // 3. Wildcard activated
  const canActivate = hasAvailableWildcard(wildcardOwner, wildcards);
  console.assert(canActivate, '❌ Should be able to activate');
  console.log(`✅ Step 3: Wildcard activated`);

  // 4. Determine scenario (claimer true)
  const scenario = determineWildcardScenario(
    wildcardOwner,
    wildcardOwner,
    'user2',
    true
  );
  console.assert(
    scenario === WILDCARD_SCENARIOS.CLAIMER_TRUE,
    '❌ Scenario mismatch'
  );
  console.log(`✅ Step 4: Scenario = ${scenario}`);

  // 5. Apply wildcard effect
  const modifiedPenalty = applyWildcardMultiplier(basePenalty, scenario);
  console.assert(modifiedPenalty === 50, `❌ Should be 50, got ${modifiedPenalty}`);
  console.log(`✅ Step 5: Penalty reduced (100 → 50)`);

  console.log('✅ Full flow completed successfully');
}

/**
 * RUN ALL TESTS
 */
export function runAllWildcardTests() {
  console.log('\n' + '='.repeat(60));
  console.log('LUCKY LIAR - WILDCARD SYSTEM TESTS');
  console.log('='.repeat(60));

  try {
    testWildcardAssignment();
    testWildcardAvailability();
    testScenarioDetermination();
    testPenaltyMultipliers();
    testChallengeValidation();
    testScenarioMatrix();
    testFullFlow();

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    throw error;
  }
}

// Export for use in browser console or test runner
if (typeof window !== 'undefined') {
  window.runWildcardTests = runAllWildcardTests;
  console.log('🎴 Wildcard tests available: window.runWildcardTests()');
}
