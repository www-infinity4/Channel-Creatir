import { getReceipt, putReceipt } from '../src/d1Helper.js';

export function weekKey(input = new Date()) {
  // America/Chicago week starts on Monday 00:00 local time, respecting DST.
  const tz = 'America/Chicago';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  }).formatToParts(input);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const utcDate = Date.UTC(+map.year, +map.month - 1, +map.day);
  const d = new Date(utcDate);
  // Convert to Monday (ISO week start). In JS, Sunday=0, Monday=1.
  const day = (d.getUTCDay() + 6) % 7; // Monday=0
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function hash(s) {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function scoreProgram(p, ctx = {}) {
  const wanted = new Set((ctx.tags || []).map(x => String(x).toLowerCase()));
  const tags = (p.tags || []).map(x => String(x).toLowerCase());
  let score = Number(p.attributes?.baseValue || 0);
  for (const t of tags) if (wanted.has(t)) score += 20;
  for (const s of (ctx.signals || [])) if (tags.includes(String(s.tag || '').toLowerCase())) score += Math.min(25, Number(s.weight || 1) * 5);
  if ((ctx.recentIds || []).includes(p.id)) score -= 1000;
  return score;
}

export async function buildWeek({ channel, week, catalog, profile = {}, signals = [], recentIds = [] }) {
  const wk = week || weekKey();
  // Idempotency: check for existing receipt.
  const existing = await getReceipt(channel, wk);
  if (existing) {
    // Stored schedule JSON string.
    return JSON.parse(existing);
  }

  const start = new Date(`${wk}T00:00:00.000Z`);
  const slotMinutes = Math.max(5, Number(profile.slotMinutes || 120));
  const slots = Math.ceil(7 * 24 * 60 / slotMinutes);
  const eligible = catalog.filter(p => p.sources?.some(s => s.status === 'playable'));
  const ranked = eligible.map(p => ({ p, score: scoreProgram(p, { tags: profile.tags, signals, recentIds }) }))
    .sort((a, b) => b.score - a.score || hash(channel + '|' + wk + '|' + a.p.id) - hash(channel + '|' + wk + '|' + b.p.id));

  const out = [];
  const used = new Set();
  for (let i = 0; i < slots; i++) {
    let row = ranked.find(x => !used.has(x.p.id)) || ranked[i % Math.max(1, ranked.length)];
    if (!row) break;
    used.add(row.p.id);
    const source = row.p.sources.find(s => s.status === 'playable');
    const scheduledStart = new Date(start.getTime() + i * slotMinutes * 60000).toISOString();
    out.push({
      slot: i,
      catalogId: row.p.id,
      title: row.p.title,
      scheduledStart,
      runtimeMinutes: row.p.runtimeMinutes,
      source,
      selectionScore: row.score,
      selectionReasons: ['channel-fit', 'eligible-source', ...(row.score > 0 ? ['weighted-discovery'] : [])]
    });
  }

  const schedule = {
    schema: 'infinity-week-schedule-v1',
    channel,
    week: wk,
    generatedAt: new Date().toISOString(),
    slotMinutes,
    programs: out
  };

  // Persist receipt with retries.
  const scheduleJson = JSON.stringify(schedule);
  const scheduleHash = hash(scheduleJson).toString();
  await putReceipt(channel, wk, scheduleHash, scheduleJson);
  return schedule;
}
