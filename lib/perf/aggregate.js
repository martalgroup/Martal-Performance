// Pure functions over the campaign dashboard's normalised rows. The upstream
// already classifies each lead (mql / sql / flip booleans) and parses dates, so
// nothing here re-derives status from strings; that is the mistake the memory
// file warns about and the reason to build strictly on that source.
//
// Vocabulary, matching the locked taxonomy:
//   flip  = booked meeting (a subset of sql)
//   sql   = flip + interest statuses
//   mql   = qualifying / objection handling
import { inWindow } from './periods.js';

const UNATTRIBUTED = 'Unattributed';
const canonRep = (r) => {
  const s = String(r || '').trim();
  if (!s) return UNATTRIBUTED;
  if (/^jay jones$/i.test(s)) return 'Javion Jones';   // the one residual alias upstream leaves
  return s;
};

/** Company totals for one window, plus data-quality counts for the same window. */
export function companyTotals(leads, w) {
  const t = { mql: 0, sql: 0, flip: 0, leads: 0, undated: 0, unattributed: 0, lowConfidence: 0 };
  for (const l of leads) {
    if (!l.dateISO) { t.undated++; continue; }
    if (!inWindow(l.dateISO, w)) continue;
    t.leads++;
    if (l.mql) t.mql++;
    if (l.sql) t.sql++;
    if (l.flip) t.flip++;
    if (!String(l.rep || '').trim()) t.unattributed++;
    if (!l.dateConfident) t.lowConfidence++;
  }
  t.mtgPerMql = t.mql ? t.flip / t.mql : 0;
  return t;
}

/** Per-rep rows for one window, ranked by flips then sql then mql. */
export function repTable(leads, w) {
  const by = new Map();
  for (const l of leads) {
    if (!inWindow(l.dateISO, w)) continue;
    const rep = canonRep(l.rep);
    const r = by.get(rep) || { rep, mql: 0, sql: 0, flip: 0, accounts: new Set() };
    if (l.mql) r.mql++; if (l.sql) r.sql++; if (l.flip) r.flip++;
    if (l.account) r.accounts.add(l.account);
    by.set(rep, r);
  }
  return [...by.values()]
    .map((r) => ({ ...r, accounts: r.accounts.size, ranked: r.rep !== UNATTRIBUTED }))
    .sort((a, b) => b.flip - a.flip || b.sql - a.sql || b.mql - a.mql || a.rep.localeCompare(b.rep))
    .map((r, i, arr) => ({ ...r, rank: r.ranked ? arr.slice(0, i).filter((x) => x.ranked).length + 1 : null }));
}

/** [mtg, sql, mql] per rep per period, the shape the old dashboard's REP_HISTORY used. */
export function repHistory(leads, periods) {
  const reps = new Set(leads.map((l) => canonRep(l.rep)));
  const out = {};
  for (const rep of reps) out[rep] = periods.map(() => [0, 0, 0]);
  for (const l of leads) {
    const i = periods.findIndex((p) => inWindow(l.dateISO, p));
    if (i === -1) continue;
    const row = out[canonRep(l.rep)][i];
    if (l.flip) row[0]++; if (l.sql) row[1]++; if (l.mql) row[2]++;
  }
  return out;
}

/** Company series across periods for the trend view. */
export const companySeries = (leads, periods) => periods.map((p) => ({ ...p, ...companyTotals(leads, p) }));

/**
 * Churn from the account records. Upstream supplies status, start/end/churn
 * dates and monthly revenue, so churn is read, not inferred.
 */
export function churn(accountsRaw, w) {
  // The source carries a few duplicate account rows (same name, same start);
  // count each account once.
  const seen = new Set();
  const accounts = accountsRaw.filter((a) => {
    const k = `${a.name}|${a.startISO}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
  // "MYT" is a pre-start stage (meet-your-team), not a live account, and
  // "MYT Lost" was lost before it ever started. Neither is a start, and neither
  // is churn; MYT Lost is reported on its own line so the revenue is visible.
  const isPre = (a) => a.status === 'MYT' || a.status === 'MYT Lost';
  const churnedIn = accounts.filter((a) => a.status !== 'MYT Lost' && inWindow(a.churnDateISO || a.endISO, w));
  const startedIn = accounts.filter((a) => !isPre(a) && inWindow(a.startISO, w));
  const mytLostIn = accounts.filter((a) => a.status === 'MYT Lost' && (inWindow(a.churnDateISO || a.endISO, w) || inWindow(a.startISO, w)));
  const active = accounts.filter((a) => a.status === 'Active');
  const pending = accounts.filter((a) => a.status === 'Churn Pending');
  const mrr = (xs) => xs.reduce((s, a) => s + (Number(a.monthlyRevenue) || 0), 0);
  const row = (a) => ({ name: a.name, tier: a.serviceTier, mrr: a.monthlyRevenue, start: a.startISO, end: a.churnDateISO || a.endISO, owner: a.dealOwner, soms: a.soms || [], status: a.status });
  return {
    window: w,
    churnedCount: churnedIn.length, churnedMrr: mrr(churnedIn),
    startedCount: startedIn.length, startedMrr: mrr(startedIn),
    mytLostCount: mytLostIn.length, mytLostMrr: mrr(mytLostIn),
    activeCount: active.length, activeMrr: mrr(active),
    pendingCount: pending.length, pendingMrr: mrr(pending),
    netMrr: mrr(startedIn) - mrr(churnedIn),
    churned: churnedIn.map(row).sort((x, y) => (y.mrr || 0) - (x.mrr || 0)),
    started: startedIn.map(row).sort((x, y) => (y.mrr || 0) - (x.mrr || 0)),
    mytLost: mytLostIn.map(row),
  };
}

/** Whole-dataset quality report, shown on Methodology so nothing is hidden. */
export function quality(leads, accounts) {
  const dates = leads.map((l) => l.dateISO).filter(Boolean).sort();
  const today = new Date().toISOString().slice(0, 10);
  return {
    leads: leads.length, accounts: accounts.length,
    undated: leads.filter((l) => !l.dateISO).length,
    unattributed: leads.filter((l) => !String(l.rep || '').trim()).length,
    lowConfidenceDates: leads.filter((l) => l.dateISO && !l.dateConfident).length,
    futureDated: leads.filter((l) => l.dateISO && l.dateISO > today).length,
    firstDate: dates[0] || null, lastDate: dates.filter((d) => d <= today).slice(-1)[0] || null,
    fromTracker: leads.filter((l) => l.fromTracker).length,
    accountStatus: Object.fromEntries([...new Set(accounts.map((a) => a.status))].map((s) => [s, accounts.filter((a) => a.status === s).length])),
  };
}
