// Finance's monthly counts (active clients, deals closed, contracts lost) from
// the cashflow workbook, loaded into perf_finance_months. This is the basis for
// the Churn headline: "contracts lost" is the number Edd quotes.
import { createClient } from '../supabase/server';

export async function financeMonths() {
  const supabase = await createClient();
  const { data } = await supabase.from('perf_finance_months')
    .select('month, active_clients, deals_closed, contracts_lost, partial, source, updated_at')
    .order('month', { ascending: true });
  return data || [];
}
export const financeFor = (rows, monthStartISO) => rows.find((r) => r.month === monthStartISO) || null;
