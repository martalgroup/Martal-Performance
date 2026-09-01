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
export function windowFrom(searchParams) {
  const p = searchParams?.p;
  if (!p) return periodFor(new Date());
  if (['last30', 'last90', 'last180', 'thisMonth'].includes(p)) return preset(p);
  if (/^\d{4}-\d{2}-16$/.test(p)) return periodFor(new Date(p + 'T00:00:00Z'));
  return periodFor(new Date());
}

export async function companyView(searchParams) {
  const ds = await loadDataset();
  const w = windowFrom(searchParams);
  const periods = recentPeriods(6);
  const prev = periods[periods.length - 2];
  return { ds, w, now: companyTotals(ds.leads, w), prev: companyTotals(ds.leads, prev), series: companySeries(ds.leads, periods), quality: quality(ds.leads, ds.accounts) };
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
