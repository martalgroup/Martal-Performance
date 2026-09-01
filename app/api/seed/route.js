import { NextResponse } from 'next/server';
import { getProfile } from '../../../lib/supabase/server';
import { isAdminRole } from '../../../lib/roles';
import { bundledSeed } from '../../../lib/perf/seed';
import { writeSnapshot } from '../../../lib/perf/cache';
export const dynamic = 'force-dynamic';

// Promote the bundled snapshot into perf_snapshots. Admin only; idempotent in
// effect because the newest row always wins on read.
export async function POST() {
  const profile = await getProfile();
  if (!profile || !isAdminRole(profile.role)) return NextResponse.json({ error: 'admins only' }, { status: 403 });
  try {
    const seed = bundledSeed();
    const saved = await writeSnapshot({ kind: 'manual', leads: seed.leads, accounts: seed.accounts, pulledAt: seed.pulledAt,
      notes: `bundled snapshot promoted by ${profile.email}` });
    return NextResponse.json({ ok: true, ...saved, leads: seed.leads.length, accounts: seed.accounts.length });
  } catch (e) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }
}
