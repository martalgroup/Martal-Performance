// Snapshots live in the shared Supabase project (perf_snapshots). Reads use the
// signed-in user's client so RLS applies; writes use the service role because
// only the server refreshes.
import { createClient } from '../supabase/server';
import { createAdminClient } from '../supabase/admin';

export async function latestSnapshot() {
  const supabase = await createClient();
  const { data } = await supabase.from('perf_snapshots')
    .select('id, pulled_at, source, lead_count, account_count, first_date, last_date, payload, notes')
    .order('pulled_at', { ascending: false }).limit(1).maybeSingle();
  return data || null;
}

export async function writeSnapshot({ kind, leads, accounts, notes = null }) {
  const dates = leads.map((l) => l.dateISO).filter(Boolean).sort();
  const admin = createAdminClient();
  const { data, error } = await admin.from('perf_snapshots').insert({
    source: kind, lead_count: leads.length, account_count: accounts.length,
    first_date: dates[0] || null, last_date: dates[dates.length - 1] || null,
    payload: { leads, accounts }, notes,
  }).select('id, pulled_at').single();
  if (error) throw error;
  return data;
}
