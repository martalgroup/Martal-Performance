// Snapshots live in the shared Supabase project (perf_snapshots). Reads go
// through the signed-in user's client so RLS applies. Writes try the service
// role first and fall back to the user's client, which the
// perf_snapshots_admin_insert policy permits for admins: the service key is a
// convenience here, not a dependency.
import { cache } from 'react';
import { createClient } from '../supabase/server';
import { createAdminClient } from '../supabase/admin';

const META = 'id, pulled_at, source, lead_count, account_count, first_date, last_date, notes';

// Everything about the snapshot except the payload. Small, indexed on
// pulled_at, and cached per request so the layout and the page share one read.
export const latestSnapshotMeta = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from('perf_snapshots')
    .select(META)
    .order('pulled_at', { ascending: false }).limit(1).maybeSingle();
  return data || null;
});

// The payload is ~6 MB of JSON that changes once a day, and every render used
// to re-fetch it: four at a time, because the sidebar links prefetch their
// routes. Postgres needs ~115 ms just to decompress and serialise it, and the
// arithmetic on top of it takes about 4 ms, so nearly all of the wait was
// moving bytes that had not changed since the last click.
//
// One parsed copy per warm instance, keyed by snapshot id. A refresh writes a
// new row with a new id, so the next request misses the memo and picks it up;
// there is no staleness window to reason about and nothing to invalidate.
let MEMO = null;

export async function snapshotPayload(id) {
  if (MEMO?.id === id) return MEMO.payload;
  const supabase = await createClient();
  const { data, error } = await supabase.from('perf_snapshots').select('payload').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`snapshot ${id} is not readable`);
  MEMO = { id, payload: data.payload };
  return MEMO.payload;
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
