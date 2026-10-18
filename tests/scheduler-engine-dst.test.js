// Scheduler engine DST unit tests – validates weekKey across DST transitions.
import { strict as assert } from 'assert';
import { weekKey } from '../scheduler/engine.js';
import MockD1 from './__mocks__/mockD1.js';

// Install mock D1 globally (engine uses getReceipt/putReceipt which fallback to in‑memory when D1 is absent).
globalThis.env = { D1: new MockD1() };

// Helper to format ISO date (YYYY‑MM‑DD) for readability.
const iso = d => d.toISOString().slice(0, 10);

// DST start in 2024 for America/Chicago: clocks jump forward on 2024‑03‑10 at 02:00 local time.
const dstStart = new Date('2024-03-10T02:30:00Z'); // UTC time just after the jump.
// DST end in 2024: clocks fall back on 2024‑11‑03 at 02:00 local time.
const dstEnd = new Date('2024-11-03T01:30:00Z'); // UTC time just before the fallback.

// The weekKey should return the Monday of the week containing the given date, respecting the America/Chicago timezone.
assert.equal(weekKey(dstStart), '2024-03-04', `weekKey for DST start (${iso(dstStart)}) should be Monday 2024-03-04`);
assert.equal(weekKey(dstEnd),   '2024-10-28', `weekKey for DST end (${iso(dstEnd)}) should be Monday 2024-10-28`);

// Additional sanity check: a normal date.
const normal = new Date('2024-05-15T12:00:00Z'); // Mid‑May, DST in effect.
assert.equal(weekKey(normal), '2024-05-13', `weekKey for a regular date (${iso(normal)}) should be Monday 2024-05-13`);

console.log('All DST weekKey tests passed.');
