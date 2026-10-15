// Unit tests for the marketing helpers that hold rules: contact-form checks and screenshot srcset. `npm test`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MESSAGE_MAX, TOPICS, checkContact } from './contact-form.rules.ts';
import { SHOTS, srcSetOf } from './shots.ts';

const ok = { name: 'Asha Rao', email: 'asha@example.in', company: '', phone: '', topic: 'sales', message: 'We have 40 employees in Pune.' };

test('checkContact: a complete message passes; optional fields may be empty', () => {
  assert.deepEqual(checkContact(ok), {});
  assert.deepEqual(checkContact({ ...ok, company: 'Rao Textiles', phone: '+91 98765 43210' }), {});
});

test('checkContact: names the field and says how to fix it', () => {
  assert.deepEqual(Object.keys(checkContact({ name: '', email: '', company: '', phone: '', topic: '', message: '' })), ['name', 'email', 'topic', 'message']);
  assert.match(checkContact({ ...ok, email: 'asha@example' }).email, /name@company\.com/);
  assert.match(checkContact({ ...ok, phone: 'call me' }).phone, /digits/);
  assert.match(checkContact({ ...ok, message: 'hi' }).message, /at least 10/);
  assert.match(checkContact({ ...ok, message: 'x'.repeat(MESSAGE_MAX + 1) }).message, /4,000/);
  assert.ok(checkContact({ ...ok, topic: 'jobs' }).topic);
});

test('checkContact: topics match the API (packages/backend/src/modules/contact/contact.dto.ts)', () => {
  assert.deepEqual(TOPICS.map((t) => t.value), ['sales', 'billing', 'support', 'privacy', 'other']);
});

test('srcSetOf: every narrower copy, then the original at its own width', () => {
  assert.equal(srcSetOf(SHOTS.overview), '/marketing/overview-640.webp 640w, /marketing/overview-1080.webp 1080w, /marketing/overview-1600.webp 1600w, /marketing/overview.webp 2880w');
  assert.equal(srcSetOf(SHOTS.mobile), '/marketing/mobile-390.webp 390w, /marketing/mobile.webp 780w');
});
