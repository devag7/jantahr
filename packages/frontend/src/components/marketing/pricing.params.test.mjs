// Unit tests for the pricing calculator's URL state. Run with `npm test`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULTS, parseEmployees, readParams, toQuery } from './pricing.params.ts';

const params = (q) => new URLSearchParams(q);

test('parseEmployees: whole numbers from 1 to 1,00,000 only', () => {
  assert.deepEqual(parseEmployees('50'), { value: 50, error: null });
  assert.deepEqual(parseEmployees(' 100000 '), { value: 100000, error: null });
  for (const bad of ['', '0', '100001', '12.5', '-3', '1e3', 'ten']) assert.equal(parseEmployees(bad).value, null, bad);
  assert.equal(parseEmployees('12.5').error, 'Use whole numbers only.');
  assert.equal(parseEmployees('0').error, 'Enter a number from 1 to 1,00,000.');
});

test('readParams and toQuery round-trip, with defaults for anything invalid', () => {
  assert.deepEqual(readParams(params('?billing=monthly&employees=12')), { cycle: 'MONTHLY', employees: 12 });
  assert.deepEqual(readParams(params('?billing=yearly&employees=abc')), { cycle: 'ANNUAL', employees: DEFAULTS.employees });
  assert.deepEqual(readParams(params('')), DEFAULTS);
  assert.equal(toQuery('ANNUAL', 50), '?billing=yearly&employees=50');
  assert.deepEqual(readParams(params(toQuery('MONTHLY', 7))), { cycle: 'MONTHLY', employees: 7 });
});
