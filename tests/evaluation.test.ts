import test from 'node:test';
import assert from 'node:assert/strict';
import { CRITERIA, parseEvaluation, restoreOrder } from '../app/lib/evaluation.ts';
const sample = () => ({ criteria: CRITERIA.map(criterionName => ({ criterionName, scoreA: 4, scoreB: 8, justification: 'Output A vs Output B' })), summary: 'Output B wins', weaknessesA: 'fix A', weaknessesB: 'fix B' });
test('swapped feedback belongs to the actual optimized answer', () => {
  const result = restoreOrder(sample(), true);
  assert.equal(result.weaknessesB, 'fix A'); assert.equal(result.weaknessesA, 'fix B');
  assert.equal(result.criteria[0].scoreA, 8); assert.equal(result.criteria[0].scoreB, 4);
  assert.equal(result.summary, 'Output A wins');
});
test('ties are accepted', () => { const data = sample(); data.criteria[0].scoreA = 8; assert.equal(parseEvaluation(JSON.stringify(data)).criteria[0].scoreA, 8); });
test('invalid scores and duplicate criteria are rejected', () => {
  const data = sample(); data.criteria[0].scoreA = 11; assert.throws(() => parseEvaluation(JSON.stringify(data)));
  const duplicate = sample(); duplicate.criteria[0] = duplicate.criteria[1]; assert.throws(() => parseEvaluation(JSON.stringify(duplicate)));
});
