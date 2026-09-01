import { NextResponse } from 'next/server';
import { getProfile } from '../../../lib/supabase/server';
import { isAdminRole } from '../../../lib/roles';
import { pull } from '../../../lib/perf/source';
import { writeSnapshot } from '../../../lib/perf/cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Vercel cron calls this with the CRON_SECRET; an admin can also hit it from
// the "Refresh now" button. Anyone else gets nothing.
async function authorised(request) {
  const auth = request.headers.get('authorization') || '';
  if (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) return 'cron';
  const profile = await getProfile();
  if (profile && isAdminRole(profile.role)) return 'admin';
  return null;
}

async function run(request) {
  const who = await authorised(request);
  if (!who) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const data = await pull();
    const saved = await writeSnapshot({ ...data, notes: `refreshed by ${who}` });
    return NextResponse.json({ ok: true, ...saved, source: data.kind, leads: data.leads.length, accounts: data.accounts.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 502 });
  }
}
export const GET = run;
export const POST = run;
