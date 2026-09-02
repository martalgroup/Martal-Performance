// One place that turns "the latest snapshot" into the numbers a page needs.
// Falls back to the captured fixture when no snapshot exists yet, and says so,
// so the UI is reviewable before a live source is wired and nobody mistakes
// sample data for the real thing.
import { latestSnapshot } from './cache';
import { recentPeriods, preset, periodFor, monthFor, lastCompleteMonth, recentMonths, periodsSince, HISTORY_ANCHOR } from './periods';
import { financeMonths, financeFor, financePrev, ratioRankInYear, lowestSince } from './finance';
import { companyTotals, companySeries, repTable, repHistory, churn, quality } from './aggregate';

import { bundledSeed } from './seed';

export async function loadDataset() {
  const snap = await latestSnapshot();
  if (!snap) {
    // Full dataset, just not yet promoted into Supabase. Real numbers, flagged
    // so an admin knows to click Seed/Refresh and make it the shared record.
    const seed = bundledSeed();
    return { leads: seed.leads, accounts: seed.accounts, pulledAt: seed.pulledAt, source: 'bundled snapshot (not yet promoted)', isSample: false, isBundled: true, leadCount: seed.leads.length };
  }
  return { ...snap.payload, pulledAt: snap.pulled_at, source: snap.source, isSample: false, leadCount: snap.lead_count };
}

/** Resolve ?p= into a window: a preset key, or a period start date, or the open period. */
/** The most recent 16th→15th period that has fully elapsed. */
export function lastCompletePeriod(now = new Date()) {
  const open = periodFor(now);
  const prevMid = new Date(open.start + 'T00:00:00Z'); prevMid.setUTCDate(15);
  return periodFor(prevMid);
}

export function windowFrom(searchParams) {
  const p = searchParams?.p;
  // Default to the last COMPLETE period: that is the number people quote. The
  // open period is shown alongside as work in progress.
  if (!p) return lastCompletePeriod();
  if (p === 'open') return periodFor(new Date());
  if (['last30', 'last90', 'last180', 'thisMonth'].includes(p)) return preset(p);
  if (/^\d{4}-\d{2}-16$/.test(p)) return periodFor(new Date(p + 'T00:00:00Z'));
  return periodFor(new Date());
}

export async function companyView(searchParams) {
  const ds = await loadDataset();
  const w = windowFrom(searchParams);
  const periods = periodsSince(HISTORY_ANCHOR);
  const prevMid = new Date(w.start + 'T00:00:00Z'); prevMid.setUTCDate(15);
  const prev = periodFor(prevMid);
  const today = new Date().toISOString().slice(0, 10);
  const inProgress = w.end >= today;
  // An open period must be compared to the prior period cut at the same
  // elapsed day, or 17 days always looks like a collapse against 31.
  const day = (iso) => Math.round(new Date(iso + 'T00:00:00Z') / 86400000);
  const daysIn = inProgress ? day(today) - day(w.start) + 1 : day(w.end) - day(w.start) + 1;
  const daysTotal = day(w.end) - day(w.start) + 1;
  const prevCut = inProgress
    ? { start: prev.start, end: new Date((day(prev.start) + daysIn - 1) * 86400000).toISOString().slice(0, 10) }
    : prev;
  // Whatever window is selected, the open period is always available as a
  // secondary strip, compared to the prior period cut at the same day.
  const openW = periodFor(new Date());
  const openDaysIn = day(today) - day(openW.start) + 1;
  const openDaysTotal = day(openW.end) - day(openW.start) + 1;
  const openPrev = periods[periods.length - 2];  // periods is oldest→newest; the open one is last
  const openPrevCut = { start: openPrev.start, end: new Date((day(openPrev.start) + openDaysIn - 1) * 86400000).toISOString().slice(0, 10) };
  const open = { w: openW, daysIn: openDaysIn, daysTotal: openDaysTotal, now: companyTotals(ds.leads, openW), prevToDate: companyTotals(ds.leads, openPrevCut) };
  return { ds, w, inProgress, daysIn, daysTotal, open,
    now: companyTotals(ds.leads, w), prev: companyTotals(ds.leads, prev), prevToDate: companyTotals(ds.leads, prevCut),
    series: companySeries(ds.leads, periods), quality: quality(ds.leads, ds.accounts) };
}
export async function repsView(searchParams) {
  const ds = await loadDataset();
  const w = windowFrom(searchParams);
  const periods = periodsSince(HISTORY_ANCHOR);
  const prevMid = new Date(w.start + 'T00:00:00Z'); prevMid.setUTCDate(15);
  const prev = periodFor(prevMid);
  const today = new Date().toISOString().slice(0, 10);
  const inProgress = w.end >= today;
  // Like-for-like: an open period is compared to the prior period cut at the same day.
  const day = (iso) => Math.round(new Date(iso + 'T00:00:00Z') / 86400000);
  const daysIn = inProgress ? day(today) - day(w.start) + 1 : day(w.end) - day(w.start) + 1;
  const prevCut = inProgress ? { start: prev.start, end: new Date((day(prev.start) + daysIn - 1) * 86400000).toISOString().slice(0, 10) } : prev;
  const table = repTable(ds.leads, w);
  const prevTable = repTable(ds.leads, prevCut);
  const prevBy = Object.fromEntries(prevTable.map((r) => [r.rep, r]));
  const rows = table.map((r) => {
    const p = prevBy[r.rep];
    return { ...r, prevFlip: p?.flip ?? 0, prevSql: p?.sql ?? 0, prevMql: p?.mql ?? 0, prevRank: p?.rank ?? null,
      move: r.rank != null && p?.rank != null ? p.rank - r.rank : null };   // + = climbed
  });
  const totals = companyTotals(ds.leads, w);
  return { ds, w, prev, prevCut, inProgress, daysIn, periods, table: rows, totals, history: repHistory(ds.leads, periods) };
}
/** Churn windows are calendar months: ?m=YYYY-MM, ?m=open for the current month, default last complete month. */
export function monthWindowFrom(searchParams) {
  const m = searchParams?.m;
  if (!m) return lastCompleteMonth();
  if (m === 'open') return monthFor(new Date());
  if (/^\d{4}-\d{2}$/.test(m)) return monthFor(new Date(m + '-01T00:00:00Z'));
  return lastCompleteMonth();
}

export async function churnView(searchParams) {
  const [ds, fin] = await Promise.all([loadDataset(), financeMonths()]);
  const w = monthWindowFrom(searchParams);
  const today = new Date().toISOString().slice(0, 10);
  const inProgress = w.end >= today;
  const open = monthFor(new Date());
  const monthsBack = Math.max(6, fin.length);
  const months = recentMonths(monthsBack).filter((m) => m.start >= '2025-01-01');
  const withFinance = (m) => ({ ...m, finance: financeFor(fin, m.start), dashboard: churn(ds.accounts, m) });
  return {
    ds, w, inProgress,
    finance: financeFor(fin, w.start),
    financePrev: financePrev(fin, w.start),
    ratioRank: ratioRankInYear(fin, w.start),
    lowest: lowestSince(fin, w.start),
    dashboard: churn(ds.accounts, w),
    open: { w: open, finance: financeFor(fin, open.start), dashboard: churn(ds.accounts, open), dayOfMonth: new Date().getUTCDate() },
    series: months.map(withFinance),
    financeSource: fin[0]?.source || null,
  };
}
