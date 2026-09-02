// Reporting periods run the 16th of one month to the 15th of the next, which
// is how Martal has always cut the numbers. "Current" is the open period to
// date. Presets (Last 30/90/180d, This month) mirror the campaign dashboard so
// the two agree when someone checks one against the other.
const iso = (d) => d.toISOString().slice(0, 10);
const utc = (y, m, d) => new Date(Date.UTC(y, m, d));

/** The 16th→15th period containing `date`. */
export function periodFor(date = new Date()) {
  const y = date.getUTCFullYear(), m = date.getUTCMonth(), d = date.getUTCDate();
  const start = d >= 16 ? utc(y, m, 16) : utc(y, m - 1, 16);
  const end = utc(start.getUTCFullYear(), start.getUTCMonth() + 1, 15);
  return { start: iso(start), end: iso(end), label: label(start, end) };
}

/** The N most recent periods, newest last, ending with the one containing `now`. */
export function recentPeriods(n, now = new Date()) {
  const out = [];
  let p = periodFor(now);
  for (let i = 0; i < n; i++) {
    out.unshift(p);
    const prevStart = new Date(p.start + 'T00:00:00Z');
    p = periodFor(utc(prevStart.getUTCFullYear(), prevStart.getUTCMonth(), 15));
  }
  return out;
}

export function preset(key, now = new Date()) {
  const end = iso(now);
  const back = (days) => iso(new Date(now.getTime() - days * 86400000));
  if (key === 'last30') return { start: back(30), end, label: 'Last 30 days' };
  if (key === 'last90') return { start: back(90), end, label: 'Last 90 days' };
  if (key === 'last180') return { start: back(180), end, label: 'Last 180 days' };
  if (key === 'thisMonth') return { start: iso(utc(now.getUTCFullYear(), now.getUTCMonth(), 1)), end, label: 'This month' };
  return periodFor(now);
}

function label(s, e) {
  const f = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${f(s)} – ${f(e)}`;
}

export const inWindow = (isoDate, w) => !!isoDate && isoDate >= w.start && isoDate <= w.end;

// ── Calendar months (churn) ─────────────────────────────────────────────────
// Churn is measured on calendar months, first day to last day. Only performance
// and ranking use the 16th→15th cycle above. Keep the two vocabularies apart.
export function monthFor(date = new Date()) {
  const y = date.getUTCFullYear(), m = date.getUTCMonth();
  const start = utc(y, m, 1), end = utc(y, m + 1, 0);
  return { start: iso(start), end: iso(end), label: start.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }), kind: 'month' };
}
export function lastCompleteMonth(now = new Date()) {
  return monthFor(utc(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
}
export function recentMonths(n, now = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(monthFor(utc(now.getUTCFullYear(), now.getUTCMonth() - i, 1)));
  return out;
}
