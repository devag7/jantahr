// Unit tests for where Google Analytics may run and the stored consent answer. `npm test`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { asChoice, isMeasuredPage, vercelPageUrl } from './analytics.rules.ts';

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

test('vercelPageUrl: public pages only, without query string or fragment', () => {
  assert.equal(vercelPageUrl('https://hr.example.in/pricing?billing=monthly&employees=12#faq', PUBLIC, false), 'https://hr.example.in/pricing');
  assert.equal(vercelPageUrl('https://hr.example.in/', PUBLIC, false), 'https://hr.example.in/');
  assert.equal(vercelPageUrl('https://hr.example.in/login?next=%2Fhr%2Fpayroll', PUBLIC, false), 'https://hr.example.in/login');
});

test('vercelPageUrl: nothing from the app, token links or the installed app', () => {
  for (const u of ['https://hr.example.in/hr/employees/3f2c', 'https://hr.example.in/me/payslips', 'https://hr.example.in/auth/callback#access_token=x', 'https://hr.example.in/reset-password?code=abc']) {
    assert.equal(vercelPageUrl(u, PUBLIC, false), null, u);
  }
  assert.equal(vercelPageUrl('https://hr.example.in/pricing', PUBLIC, true), null);
  assert.equal(vercelPageUrl('not a url', PUBLIC, false), null);
});
