// One place that turns "the latest snapshot" into the numbers a page needs.
// Falls back to the captured fixture when no snapshot exists yet, and says so,
// so the UI is reviewable before a live source is wired and nobody mistakes
// sample data for the real thing.
import { latestSnapshot } from './cache';
import { recentPeriods, preset, periodFor } from './periods';
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
  const periods = recentPeriods(6);
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
  const openPrev = periods[periods.length - 2];
  const openPrevCut = { start: openPrev.start, end: new Date((day(openPrev.start) + openDaysIn - 1) * 86400000).toISOString().slice(0, 10) };
  const open = { w: openW, daysIn: openDaysIn, daysTotal: openDaysTotal, now: companyTotals(ds.leads, openW), prevToDate: companyTotals(ds.leads, openPrevCut) };
  return { ds, w, inProgress, daysIn, daysTotal, open,
    now: companyTotals(ds.leads, w), prev: companyTotals(ds.leads, prev), prevToDate: companyTotals(ds.leads, prevCut),
    series: companySeries(ds.leads, periods), quality: quality(ds.leads, ds.accounts) };
}
export async function repsView(searchParams) {
  const ds = await loadDataset();
  const w = windowFrom(searchParams);
  const periods = recentPeriods(5);
  return { ds, w, periods, table: repTable(ds.leads, w), history: repHistory(ds.leads, periods) };
}
export async function churnView(searchParams) {
  const ds = await loadDataset();
  const w = windowFrom(searchParams);
  return { ds, w, churn: churn(ds.accounts, w), series: recentPeriods(6).map((p) => ({ ...p, ...churn(ds.accounts, p) })) };
}
