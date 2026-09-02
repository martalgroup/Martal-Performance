import { NextResponse } from 'next/server';
import { createClient, getProfile } from '../../../../lib/supabase/server';
import { createAdminClient } from '../../../../lib/supabase/admin';
import { isSuperAdminRole } from '../../../../lib/roles';
import { domainOf, loadAllowedDomains } from '../../../../lib/access';
import { sendInviteEmail, mailerStatus, inviteEmailText, INVITE_SUBJECT } from '../../../../lib/email';

const ROLES = ['user', 'admin', 'super_admin'];

/** GET — invite list plus the current domain allowlist. */
export async function GET() {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isSuperAdminRole(profile.role)) return NextResponse.json({ error: 'super admins only' }, { status: 403 });

  const supabase = await createClient();
  const [{ data: invites }, { data: settings }] = await Promise.all([
    supabase.from('invites').select('*').order('created_at', { ascending: false }),
    supabase.from('app_settings').select('allowed_domains').maybeSingle(),
  ]);

  const status = mailerStatus();
  return NextResponse.json({
    invites: invites || [],
    allowedDomains: settings?.allowed_domains || [],
    mailer: { ready: status.ready, provider: status.provider, from: status.from, reason: status.reason || null },
  });
}

/** POST — invite one email and send them the sign-in link. */
export async function POST(request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isSuperAdminRole(profile.role)) return NextResponse.json({ error: 'super admins only' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').toLowerCase().trim();
  const role = ROLES.includes(body.role) ? body.role : 'user';
  const canViewAll = !!body.canViewAll;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  // Only a super_admin may mint another super_admin — an admin escalating
  // someone to their own level (or above) shouldn't be a self-service action.
  if (role === 'super_admin' && profile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Only a super admin can invite a super admin.' }, { status: 403 });
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  // Someone on an allowed domain can already sign in, so an invite adds nothing
  // — UNLESS the point is to pre-assign a role. In that case the row is a role
  // reservation, not an access grant: resolveAccess() reads it on first login
  // and the profile is created as an admin instead of a plain user. Without
  // this, an @martalgroup.com admin could only ever be promoted AFTER they had
  // logged in at least once.
  const domains = await loadAllowedDomains(admin);
  const onAllowedDomain = domains.includes(domainOf(email));
  if (onAllowedDomain && role === 'user') {
    return NextResponse.json({
      error: `@${domainOf(email)} is already an allowed domain — ${email} can sign in with Google right now, and would get the User role anyway. Pick Admin or Super admin to pre-assign a role before their first login.`,
    }, { status: 409 });
  }

  const { data: existingProfile } = await admin
    .from('profiles').select('id').eq('email', email).maybeSingle();
  if (existingProfile) {
    return NextResponse.json({ error: `${email} already has an account.` }, { status: 409 });
  }

  // Upsert so re-inviting a revoked address reactivates it instead of failing
  // on the primary key.
  const { error: upsertErr } = await supabase.from('invites').upsert({
    email,
    role,
    can_view_all: canViewAll,
    invited_by: profile.id,
    revoked_at: null,
    accepted_at: null,
    // Re-inviting a removed address is how you let them back in.
    blocked_at: null,
    blocked_by: null,
  }, { onConflict: 'email' });
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 400 });

  // Send the invite from Martal Deal Room via our own mailer (lib/email.js).
  // Supabase's inviteUserByEmail() is deliberately NOT used: its sender is
  // Supabase's own, unconfigurable on the default service, so the recipient
  // would see a Supabase email rather than one from Martal.
  //
  // The invite row is already committed at this point, so a mail failure
  // degrades to "access granted, send it yourself" rather than losing the grant.
  const origin = new URL(request.url).origin;
  const inviteUrl = `${origin}/login`;
  const roleLabel = { user: 'User', admin: 'Admin', super_admin: 'Super admin' }[role];

  // A domain user needs no sign-in link — sending "you've been invited" to
  // someone who could already log in is just confusing. The grant is the row.
  const mail = onAllowedDomain
    ? { sent: false, error: null, skipped: true }
    : await sendInviteEmail({
      to: email,
      inviteUrl,
      invitedByName: profile.full_name,
      invitedByEmail: profile.email,
      roleLabel,
    });

  await supabase.from('invites').update({
    email_sent_at: mail.sent ? new Date().toISOString() : null,
    email_error: mail.error,
  }).eq('email', email);

  // When there is no provider wired up we send nothing at all, and hand the
  // admin a prefilled message they can send from their own Martal address —
  // which is a genuinely Martal-branded invite, not a system one.
  const status = mailerStatus();
  return NextResponse.json({
    ok: true,
    email,
    emailSent: mail.sent,
    emailError: mail.error,
    mailerReady: status.ready,
    from: status.from,
    loginUrl: inviteUrl,
    mailto: `mailto:${encodeURIComponent(email)}`
      + `?subject=${encodeURIComponent(INVITE_SUBJECT)}`
      + `&body=${encodeURIComponent(inviteEmailText({
        inviteUrl, invitedByName: profile.full_name, invitedByEmail: profile.email, roleLabel,
      }))}`,
  });
}

/** DELETE — revoke an invite (soft, keeps the audit trail). */
export async function DELETE(request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isSuperAdminRole(profile.role)) return NextResponse.json({ error: 'super admins only' }, { status: 403 });

  const email = String(new URL(request.url).searchParams.get('email') || '').toLowerCase().trim();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.from('invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('email', email);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Revoking the invite closes the door for a NEW sign-in. If they already have
  // a profile, that account still exists — say so plainly instead of implying
  // the revoke did more than it did.
  const admin = createAdminClient();
  const { data: hasProfile } = await admin
    .from('profiles').select('id').eq('email', email).maybeSingle();

  return NextResponse.json({
    ok: true,
    stillHasAccount: !!hasProfile,
    note: hasProfile
      ? `${email} already signed in, so their account still exists. Remove it in Users to fully cut off access.`
      : null,
  });
}
