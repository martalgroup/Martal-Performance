// Creates the profiles row for someone who has just passed the access gate.
//
// This used to be one unchecked service-role insert. When it failed — a stale
// or wrong SUPABASE_SERVICE_ROLE_KEY being the obvious way — the callback
// carried on regardless and redirected into the console, where the middleware
// found no profile and signed the person straight back out to /denied "Access
// not enabled". So the app told a legitimate user they weren't allowed in,
// while the allowlist said they were, and logged nothing either way. That is
// exactly how Daniel Saks's @landbase.com sign-in failed on an ALLOWED domain
// while every other @landbase.com account worked: everyone else already had a
// profiles row, so nothing ever exercised this path.
//
// Two changes. The insert is checked, and there is a second route to it:
// profiles carries a profiles_insert_self policy (id = auth.uid() AND role =
// 'user'), so the user's own client can create the row when the service role
// cannot. The database caps that at 'user', so self-provisioning can never
// mint an admin — which is why this fallback needs no new policy and grants
// nothing that wasn't already granted.
//
// Returns { ok, role, via, warning } or { ok: false, error }.
export async function ensureProfile({ admin, supabase, user, email, access, seedRole }) {
  const wantedRole = access.role || seedRole;
  const row = {
    id: user.id,
    email,
    full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
    role: wantedRole,
    can_view_all: !!access.canViewAll,
  };

  // Look for an existing row with BOTH clients. profiles_select_own_or_admin
  // lets anyone read their own row, so a broken service key must not be able
  // to make an existing user look brand new and trip the unique email index.
  const seen = async (client) => {
    const { data, error } = await client
      .from('profiles').select('id, role').eq('id', user.id).maybeSingle();
    return error ? null : data;
  };
  const already = (await seen(admin)) || (await seen(supabase));
  if (already) return { ok: true, role: already.role, via: 'existing' };

  const asService = await admin.from('profiles').insert(row).select('role').maybeSingle();
  if (!asService.error && asService.data) {
    return { ok: true, role: asService.data.role, via: 'service_role' };
  }
  console.error('provisioning: service-role insert failed for', email,
    asService.error?.code || '', asService.error?.message || '(no row returned)');

  // Same row, minus anything the policy won't allow the user to grant
  // themselves. Being let in as a 'user' who needs promoting beats being
  // locked out and told you don't have access.
  const asSelf = await supabase
    .from('profiles').insert({ ...row, role: 'user', can_view_all: false })
    .select('role').maybeSingle();
  if (!asSelf.error && asSelf.data) {
    const downgraded = wantedRole !== 'user' || row.can_view_all;
    return {
      ok: true,
      role: asSelf.data.role,
      via: 'self',
      warning: downgraded
        ? `provisioned ${email} as 'user' via the self-insert policy; the intended `
          + `role '${wantedRole}' needs a working service-role key to apply`
        : null,
    };
  }
  console.error('provisioning: self-insert failed too for', email,
    asSelf.error?.code || '', asSelf.error?.message || '(no row returned)');

  return {
    ok: false,
    error: asSelf.error?.message || asService.error?.message || 'profile could not be created',
  };
}
