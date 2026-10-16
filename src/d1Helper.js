// D1 receipt helper – works with real Cloudflare D1 binding or falls back to in‑memory store for tests.
// Receipt schema: (channel TEXT, week TEXT) -> {hash: TEXT, schedule: TEXT}

const inMemoryStore = new Map();

function makeKey(channel, week) {
  return `${channel}::${week}`;
}

export async function getReceipt(channel, week) {
  if (globalThis.env && globalThis.env.D1) {
    try {
      const stmt = globalThis.env.D1.prepare('SELECT schedule FROM receipts WHERE channel = ? AND week = ?');
      const row = await stmt.bind(channel, week).first();
      return row?.schedule || null;
    } catch (e) {
      // On any DB error, treat as missing receipt.
      return null;
    }
  }
  // In‑memory fallback (used by unit tests).
  return inMemoryStore.get(makeKey(channel, week))?.schedule || null;
}

export async function putReceipt(channel, week, hash, scheduleJson) {
  const maxAttempts = 3;
  const baseDelay = 100; // ms
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (globalThis.env && globalThis.env.D1) {
        const stmt = globalThis.env.D1.prepare('INSERT OR REPLACE INTO receipts (channel, week, hash, schedule) VALUES (?, ?, ?, ?)');
        await stmt.bind(channel, week, hash, scheduleJson).run();
      } else {
        // In‑memory fallback.
        inMemoryStore.set(makeKey(channel, week), { hash, schedule: scheduleJson });
      }
      // Success – exit.
      return;
    } catch (e) {
      if (attempt === maxAttempts) throw e;
      // Exponential back‑off before retry.
      await new Promise(res => setTimeout(res, baseDelay * Math.pow(2, attempt - 1)));
    }
  }
}
