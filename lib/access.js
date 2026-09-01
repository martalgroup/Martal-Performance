// Who may sign in to the Deal Room.
//
// Access is granted by EITHER route:
//   1. the email's domain is listed in app_settings.allowed_domains, or
//   2. there is an active (not revoked) invite row for that exact email.
//
// Both lookups run with the SERVICE-ROLE client, because the person signing in
// for the first time has no profiles row yet and so cannot satisfy the is_admin()
// RLS policies on these tables.

// Fallback if app_settings can't be read — never an empty list, which would
// lock every single user out of the app on a transient DB error.
export const DEFAULT_ALLOWED_DOMAINS = ['martalgroup.com', 'landbase.com'];

export function domainOf(email) {
  const at = String(email || '').toLowerCase().lastIndexOf('@');
  return at === -1 ? '' : String(email).toLowerCase().slice(at + 1);
}

export async function loadAllowedDomains(adminClient) {
  const { data, error } = await adminClient
    .from('app_settings')
    .select('allowed_domains')
    .maybeSingle();
  if (error || !data?.allowed_domains?.length) return DEFAULT_ALLOWED_DOMAINS;
  return data.allowed_domains.map((d) => String(d).toLowerCase().trim()).filter(Boolean);
}

/**
 * Resolves whether `email` may sign in, and with what role.
 *
 * Returns { allowed, via, role, canViewAll, invite }.
 *  - via 'domain' → access comes from the domain allowlist
 *  - via 'invite' → access comes from the invite row
 *
 * `role` is non-null whenever an ACTIVE invite row exists, for either route.
 * That is the point: for someone on an allowed domain an invite row is not an
 * access grant (they can already sign in) but a PRE-ASSIGNED ROLE, so a super
 * admin can set someone up as an admin before they have ever logged in. The
 * row used to be skipped entirely on a domain match, which meant every
 * @martalgroup.com user necessarily landed as 'user' and had to be promoted
 * afterwards.
 */
export async function resolveAccess(adminClient, email) {
  const lower = String(email || '').toLowerCase().trim();
  if (!lower || !lower.includes('@')) return { allowed: false, via: null };

  const domains = await loadAllowedDomains(adminClient);
  const domainAllowed = domains.includes(domainOf(lower));

  const { data: invite } = await adminClient
    .from('invites')
    .select('email, role, can_view_all, revoked_at, accepted_at, blocked_at')
    .eq('email', lower)
    .maybeSingle();
  const active = invite && !invite.revoked_at ? invite : null;

  // A blocked address is denied outright, before the domain allowlist is even
  // considered. Without this, removing an @martalgroup.com user would achieve
  // nothing: they would sign in with Google again and be re-provisioned.
  if (invite?.blocked_at) {
    return { allowed: false, via: null, blocked: true };
  }

  if (domainAllowed) {
    // A revoked row must not strip domain access — revoking an invite is about
    // the invite, and this person's access never depended on it. It does drop
    // the pre-assigned role, which is the intended way to cancel one.
    return {
      allowed: true,
      via: 'domain',
      role: active?.role || null,
      canViewAll: !!active?.can_view_all,
      invite: active,
    };
  }

  if (active) {
    return {
      allowed: true,
      via: 'invite',
      role: active.role || 'user',
      canViewAll: !!active.can_view_all,
      invite: active,
    };
  }

  return { allowed: false, via: null };
}
