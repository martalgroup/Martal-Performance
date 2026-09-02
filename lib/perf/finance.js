// Finance's monthly counts (active clients, deals closed, contracts lost) from
// the cashflow workbook, loaded into perf_finance_months. This is the basis for
// the Churn headline: "contracts lost" is the number Edd quotes.
import { createClient } from '../supabase/server';

export async function financeMonths() {
  const supabase = await createClient();
  const { data } = await supabase.from('perf_finance_months')
    .select('month, active_clients, deals_closed, contracts_lost, partial, source, updated_at, mkt_active_eom, mkt_lost, mkt_churn_ratio, new_deals, closed_deals_mkt, closing_ratio, mkt_source')
    .order('month', { ascending: true });
  return data || [];
}
export const financeFor = (rows, monthStartISO) => rows.find((r) => r.month === monthStartISO) || null;

/** Prior month's row, for month-over-month sentences. */
export function financePrev(rows, monthStartISO) {
  const i = rows.findIndex((r) => r.month === monthStartISO);
  return i > 0 ? rows[i - 1] : null;
}
/** Rank of this month's churn ratio within its calendar year, 1 = lowest. */
export function ratioRankInYear(rows, monthStartISO) {
  const year = monthStartISO.slice(0, 4);
  const ys = rows.filter((r) => r.month.startsWith(year) && r.mkt_churn_ratio != null).sort((a, b) => a.mkt_churn_ratio - b.mkt_churn_ratio);
  const i = ys.findIndex((r) => r.month === monthStartISO);
  return i === -1 ? null : { rank: i + 1, of: ys.length };
}

/**
 * How this month's churn ratio compares to everything before it.
 *   { kind: 'record', since }  no earlier month is at or below it (since = first month on record)
 *   { kind: 'since',  since }  the most recent earlier month at or below it
 *   null                       no ratio for this month
 */
export function lowestSince(rows, monthStartISO) {
  const cur = rows.find((r) => r.month === monthStartISO);
  if (!cur || cur.mkt_churn_ratio == null) return null;
  const before = rows.filter((r) => r.month < monthStartISO && r.mkt_churn_ratio != null);
  if (!before.length) return null;
  const last = [...before].reverse().find((r) => Number(r.mkt_churn_ratio) <= Number(cur.mkt_churn_ratio));
  if (last) return { kind: 'since', since: last.month };
  // A record low is "since the measurement began", which is the first month
  // with any churn data (July 2021), not the first month that had a ratio.
  const firstData = rows.find((r) => r.month < monthStartISO && (r.mkt_lost != null || r.mkt_active_eom != null));
  return { kind: 'record', since: (firstData || before[0]).month };
}
