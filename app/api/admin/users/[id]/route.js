import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient, getProfile } from '../../../../../lib/supabase/server';
import { createAdminClient } from '../../../../../lib/supabase/admin';
import { isSuperAdminRole } from '../../../../../lib/roles';

// Admin-only: change a user's role and/or their "view all clients/
// contracts" flag. Only a super_admin can create or demote another
// admin/super_admin, so a plain admin can't escalate a peer (or
// themselves) past 'user' <-> 'admin' without a super_admin's involvement —
// concretely: a plain admin may only set role='user', never 'admin' or
// 'super_admin'. can_view_all has no such restriction — any admin can
// grant it (it's visibility, not privilege escalation).
export async function PATCH(request, { params }) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isSuperAdminRole(profile.role)) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }

  const body = await request.json();
  const patch = {};

  if ('role' in body) {
    if (!['user', 'admin', 'super_admin'].includes(body.role)) {
      return NextResponse.json({ error: 'invalid role' }, { status: 400 });
    }
    if (body.role !== 'user' && profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'only a super_admin can grant admin/super_admin' }, { status: 403 });
    }
    patch.role = body.role;
  }
  if ('canViewAll' in body) {
    patch.can_view_all = Boolean(body.canViewAll);
  }
  if ('canViewPlatform' in body) {
    patch.can_view_platform = Boolean(body.canViewPlatform);
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', params.id)
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 });

  revalidatePath('/console/admin/users');

  return NextResponse.json({ ok: true });
}

/**
 * DELETE — remove a user.
 *
 * Three things have to happen for a removal to actually stick, and doing only
 * the obvious one is the trap:
 *   1. delete the auth user, which kills the current session and the login;
 *   2. block the email, or anyone on an allowed domain simply signs in with
 *      Google again and is re-provisioned as a fresh 'user';
 *   3. delete the profile row ONLY if nothing references it. Deals, quotes and
 *      contracts all carry created_by -> profiles(id) NOT NULL, so deleting a
 *      profile that owns work would either fail on the foreign key or, worse,
 *      cascade away the deal history. In that case the row is kept purely for
 *      attribution; the person still cannot sign in.
 */
export async function DELETE(request, { params }) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isSuperAdminRole(profile.role)) {
    return NextResponse.json({ error: 'super admins only' }, { status: 403 });
  }
  if (params.id === profile.id) {
    return NextResponse.json({ error: 'You cannot remove your own account.' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from('profiles').select('id, email, role').eq('id', params.id).maybeSingle();
  if (!target) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Count what they own, so we know whether the profile row can go.
  const owned = await Promise.all(
    ['clients', 'quotes', 'contracts'].map((t) =>
      admin.from(t).select('id', { count: 'exact', head: true }).eq('created_by', params.id)),
  );
  const ownedCount = owned.reduce((n, r) => n + (r.count || 0), 0);

  // 1. Kill the login.
  const { error: authErr } = await admin.auth.admin.deleteUser(params.id);
  // A missing auth user is fine: they may never have signed in, or been
  // removed already. Anything else is a real failure worth reporting.
  if (authErr && !/not found/i.test(authErr.message || '')) {
    return NextResponse.json({ error: authErr.message }, { status: 400 });
  }

  // 2. Block the email so an allowed domain cannot let them back in.
  await admin.from('invites').upsert({
    email: target.email,
    role: 'user',
    blocked_at: new Date().toISOString(),
    blocked_by: profile.id,
    revoked_at: new Date().toISOString(),
  }, { onConflict: 'email' });

  // 3. Remove the profile only when it owns nothing.
  let profileDeleted = false;
  if (ownedCount === 0) {
    const { error: delErr } = await admin.from('profiles').delete().eq('id', params.id);
    profileDeleted = !delErr;
  }

  revalidatePath('/console/admin/users');
  return NextResponse.json({
    ok: true,
    email: target.email,
    profileDeleted,
    ownedCount,
    message: profileDeleted
      ? `${target.email} removed.`
      : `${target.email} can no longer sign in. Their account is kept because it is `
        + `attached to ${ownedCount} deal${ownedCount === 1 ? '' : 's'} or document${ownedCount === 1 ? '' : 's'}.`,
  });
}
