// Unit tests for where Google Analytics may run and the stored consent answer. `npm test`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { asChoice, isMeasuredPage } from './analytics.rules.ts';

const PUBLIC = ['/', '/pricing', '/legal/privacy'];

test('isMeasuredPage: public pages, sign-in and sign-up only', () => {
  for (const p of ['/', '/pricing', '/pricing/', '/legal/privacy', '/login', '/signup']) assert.equal(isMeasuredPage(p, PUBLIC), true, p);
});

test('isMeasuredPage: never the app, token links or job boards', () => {
  for (const p of ['/dashboard', '/employees/3f2c', '/me/payslips', '/auth/callback', '/reset-password', '/forgot-password', '/careers/acme', '/pricingx']) {
    assert.equal(isMeasuredPage(p, PUBLIC), false, p);
  }
});

test('asChoice: only the two stored answers count', () => {
  assert.equal(asChoice('granted'), 'granted');
  assert.equal(asChoice('denied'), 'denied');
  for (const v of [null, '', 'yes', 'true', undefined]) assert.equal(asChoice(v), null);
});
