import { NextResponse } from 'next/server';
import { createClient, getProfile } from '../../../../lib/supabase/server';
import { isSuperAdminRole } from '../../../../lib/roles';

const ROLES = ['user', 'admin', 'super_admin', 'hidden'];

/** PATCH { href, minRole } — super admins only; RLS enforces it a second time. */
export async function PATCH(request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isSuperAdminRole(profile.role)) return NextResponse.json({ error: 'super admins only' }, { status: 403 });
  const { href, minRole } = await request.json().catch(() => ({}));
  if (!href || !ROLES.includes(minRole)) return NextResponse.json({ error: 'href and a valid minRole are required' }, { status: 400 });
  if (href === '/console/admin/users' && minRole !== 'super_admin') {
    return NextResponse.json({ error: 'The Admin tab is always super admins only.' }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from('perf_tab_access')
    .update({ min_role: minRole, updated_at: new Date().toISOString(), updated_by: profile.id })
    .eq('href', href).select('href, min_role').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, ...data });
}
