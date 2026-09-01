// Snapshots live in the shared Supabase project (perf_snapshots). Reads go
// through the signed-in user's client so RLS applies. Writes try the service
// role first and fall back to the user's client, which the
// perf_snapshots_admin_insert policy permits for admins: the service key is a
// convenience here, not a dependency.
import { createClient } from '../supabase/server';
import { createAdminClient } from '../supabase/admin';

export async function latestSnapshot() {
  const supabase = await createClient();
  const { data } = await supabase.from('perf_snapshots')
    .select('id, pulled_at, source, lead_count, account_count, first_date, last_date, payload, notes')
    .order('pulled_at', { ascending: false }).limit(1).maybeSingle();
  return data || null;
}

export async function writeSnapshot({ kind, leads, accounts, pulledAt = null, notes = null }) {
  const today = new Date().toISOString().slice(0, 10);
  const dates = leads.map((l) => l.dateISO).filter((d) => d && d <= today).sort();
  const row = {
    source: kind, lead_count: leads.length, account_count: accounts.length,
    first_date: dates[0] || null, last_date: dates[dates.length - 1] || null,
    payload: { leads, accounts }, notes,
    ...(pulledAt ? { pulled_at: pulledAt } : {}),
  };
  const attempt = async (client) => client.from('perf_snapshots').insert(row).select('id, pulled_at').single();
  let res = null;
  try { res = await attempt(createAdminClient()); } catch (e) { res = { error: e }; }
  if (res?.error) res = await attempt(await createClient());
  if (res.error) throw res.error;
  return res.data;
}
