// Reads the marketing/sales performance dataset from the Data Room
// (martal-data-room.vercel.app), which lives in the SAME Postgres database as
// this app, one schema over: dataroom.perf_deals / perf_meetings / perf_spend.
// This is the one shared source of truth — the Data Room's own Performance
// tab, this page, and anyone quoting these numbers all read the same rows.
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function dataroomClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { db: { schema: 'dataroom' }, auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// PostgREST caps any single response at 1000 rows with no error, so a plain
// select silently truncates a 2000+ row table. Page past it. (The Data Room's
// own /performance page hit exactly this and under-counted by two thirds
// before it was fixed — see its git history.)
async function fetchAll(sb, table, uploadId) {
  const PAGE = 1000;
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select('*').eq('upload_id', uploadId).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < PAGE) return out;
  }
}

/** The newest upload that is not superseded AND actually carries rows — an
 *  upload row is written even when its payload fails to land, so "most
 *  recent by date" alone can point at an empty one. */
export async function loadMarketingDataset() {
  const sb = dataroomClient();
  const { data: candidates, error } = await sb
    .from('uploads')
    .select('id, as_of_date, filename, perf_deals(count)')
    .is('superseded_by', null)
    .order('as_of_date', { ascending: false })
    .limit(10);
  if (error) throw new Error(`uploads: ${error.message}`);
  const good = (candidates || []).filter((u) => (u.perf_deals?.[0]?.count ?? 0) > 0);
  const upload = good[0];
  if (!upload) return null;

  const [deals, meetings, spend] = await Promise.all([
    fetchAll(sb, 'perf_deals', upload.id),
    fetchAll(sb, 'perf_meetings', upload.id),
    fetchAll(sb, 'perf_spend', upload.id),
  ]);
  return { upload: { id: upload.id, as_of_date: upload.as_of_date, filename: upload.filename }, deals, meetings, spend };
}
