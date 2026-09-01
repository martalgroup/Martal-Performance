// One place that turns "the latest snapshot" into the numbers a page needs.
// Falls back to the captured fixture when no snapshot exists yet, and says so,
// so the UI is reviewable before a live source is wired and nobody mistakes
// sample data for the real thing.
import { readFileSync } from 'fs';
import path from 'path';
import { latestSnapshot } from './cache';
import { recentPeriods, preset, periodFor } from './periods';
import { companyTotals, companySeries, repTable, repHistory, churn, quality } from './aggregate';

let FIXTURE = null;
function fixture() {
  FIXTURE ??= JSON.parse(readFileSync(path.join(process.cwd(), 'lib/perf/fixture.json'), 'utf8'));
  return { leads: FIXTURE.leads, accounts: FIXTURE.allAccountsMinimal, pulledAt: FIXTURE.pulledAt, source: 'fixture (1-in-20 sample)', isSample: true };
}

export async function loadDataset() {
  const snap = await latestSnapshot();
  if (!snap) return fixture();
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
