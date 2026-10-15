// Unit tests for the shared number and date formats. Run with `npm test`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDate, formatDateTime, formatINR, formatINRCompact, formatPayMonth, formatTime, monthLabel } from './format.ts';

test('formatDate: 07 Oct 2026, three-letter months including Sep', () => {
  assert.equal(formatDate('2026-10-07T00:00:00.000Z'), '07 Oct 2026');
  assert.equal(formatDate('2022-09-10'), '10 Sep 2022');
  assert.equal(formatDate('2026-10-07T00:00:00.000Z', false), '07 Oct');
  assert.equal(formatDate(null), '-');
  assert.equal(formatDate('not a date'), '-');
});

test('formatTime and formatDateTime: 12-hour India time with am/pm', () => {
  assert.equal(formatTime('2026-10-07T03:30:00Z'), '9:00 am');
  assert.equal(formatTime('2026-10-07T09:00:00Z'), '2:30 pm');
  assert.equal(formatTime('2026-10-06T18:30:00Z'), '12:00 am');
  assert.equal(formatTime('2026-10-07T06:30:00Z'), '12:00 pm');
  assert.equal(formatDateTime('2026-10-06T20:00:00Z'), '07 Oct, 1:30 am');
});

test('formatPayMonth: Oct 2026; monthLabel keeps the full name for prose', () => {
  assert.equal(formatPayMonth(10, 2026), 'Oct 2026');
  assert.equal(formatPayMonth(9, 2026), 'Sep 2026');
  assert.equal(monthLabel(9, 2026), 'September 2026');
});

test('formatINR: Indian digit grouping', () => {
  assert.equal(formatINR(120194), '₹1,20,194');
  assert.equal(formatINR(20062880), '₹2,00,62,880');
  assert.equal(formatINR(1234.5, true), '₹1,234.50');
  assert.equal(formatINRCompact(1250000), '₹12.5L');
});
