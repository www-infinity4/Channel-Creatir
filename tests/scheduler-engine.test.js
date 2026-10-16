// Scheduler engine unit tests – uses mock D1 implementation.
import { strict as assert } from 'assert';
import { buildWeek, weekKey } from '../scheduler/engine.js';
import MockD1 from './__mocks__/mockD1.js';

// Install mock D1 globally before importing engine (engine imports getReceipt/putReceipt at load time).
globalThis.env = { D1: new MockD1() };

// Helper to generate a tiny catalog.
function makeCatalog(num = 3) {
  const catalog = [];
  for (let i = 1; i <= num; i++) {
    catalog.push({
      id: `prog-${i}`,
      title: `Program ${i}`,
      runtimeMinutes: 60,
      sources: [{ status: 'playable', sourceId: `src-${i}`, provider: 'youtube' }]
    });
  }
  return catalog;
}

// ---- weekKey DST tests ----
const dstStart = new Date('2024-03-10T02:30:00Z'); // DST start in Chicago (clocks jump forward)
const dstEnd = new Date('2024-11-03T01:30:00Z'); // DST end (clocks fall back)
assert.equal(weekKey(dstStart), '2024-03-04'); // Monday of that week
assert.equal(weekKey(dstEnd), '2024-10-28');

// ---- idempotent build test ----
(async () => {
  const catalog = makeCatalog();
  const channel = 'test';
  const week = weekKey();

  // First build – should store receipt.
  const schedule1 = await buildWeek({ channel, week, catalog });
  assert.ok(schedule1);
  const receipt1 = await env.D1.prepare('SELECT schedule FROM receipts WHERE channel = ? AND week = ?').bind(channel, week).first();
  assert.ok(receipt1?.schedule);

  // Second build – should return same schedule without creating a new receipt entry.
  const schedule2 = await buildWeek({ channel, week, catalog });
  assert.deepEqual(schedule2, schedule1);
})();

// ---- retry/back‑off test ----
(async () => {
  const catalog = makeCatalog();
  const channel = 'retry';
  const week = weekKey();
  // Configure mock to fail first putReceipt call.
  env.D1.failNextPut = true;
  const schedule = await buildWeek({ channel, week, catalog });
  assert.ok(schedule);
  // After retry, receipt should exist.
  const receipt = await env.D1.prepare('SELECT schedule FROM receipts WHERE channel = ? AND week = ?').bind(channel, week).first();
  assert.ok(receipt?.schedule);
})();
