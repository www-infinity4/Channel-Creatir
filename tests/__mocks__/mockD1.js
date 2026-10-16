// Simple in‑memory mock for Cloudflare D1 used in unit tests.
export default class MockD1 {
  constructor() {
    this.store = new Map();
    this.failNextPut = false; // toggle to simulate transient failure
  }

  // Helper to build composite key.
  _key(channel, week) {
    return `${channel}::${week}`;
  }

  prepare(sql) {
    const self = this;
    return {
      bind(...args) {
        const [channel, week, hash, schedule] = args;
        return {
          async run() {
            if (self.failNextPut) {
              self.failNextPut = false; // only fail once
              throw new Error('Transient D1 failure');
            }
            const key = self._key(channel, week);
            self.store.set(key, { hash, schedule });
            return { success: true };
          },
          async first() {
            const key = self._key(channel, week);
            const row = self.store.get(key);
            return row ? { schedule: row.schedule } : null;
          }
        };
      }
    };
  }
}
