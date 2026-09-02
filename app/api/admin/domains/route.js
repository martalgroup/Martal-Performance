import { NextResponse } from 'next/server';
import { createClient, getProfile } from '../../../../lib/supabase/server';

// The domain allowlist is the widest access control in the app: adding a domain
// lets EVERY Google account on it sign in. Super-admin only, deliberately
// narrower than the rest of the admin surface.
export async function PUT(request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (profile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Only a super admin can change the allowed domains.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  if (!Array.isArray(body.domains)) {
    return NextResponse.json({ error: 'domains array required' }, { status: 400 });
  }

  const cleaned = [...new Set(
    body.domains
      .map((d) => String(d).toLowerCase().trim().replace(/^@+/, ''))
      .filter(Boolean),
  )];

  for (const d of cleaned) {
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) {
      return NextResponse.json({ error: `"${d}" doesn't look like a domain.` }, { status: 400 });
    }
    // Public mailbox providers would turn "allowed domain" into "anyone".
    if (['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'proton.me'].includes(d)) {
      return NextResponse.json({
        error: `${d} is a public email provider — allowing it would let anyone sign in. Invite those people individually instead.`,
      }, { status: 400 });
    }
  }

  // Never save an empty list: that locks every user, including you, out of the
  // app with no way back in through the UI.
  if (!cleaned.length) {
    return NextResponse.json({ error: 'At least one domain is required.' }, { status: 400 });
  }
  // Don't let an admin remove the domain they themselves signed in on.
  const ownDomain = String(profile.email || '').toLowerCase().split('@')[1];
  if (ownDomain && !cleaned.includes(ownDomain)) {
    return NextResponse.json({
      error: `Removing @${ownDomain} would lock you out. Add it back, or change it from an account on a different allowed domain.`,
    }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from('app_settings').update({
    allowed_domains: cleaned,
    updated_by: profile.id,
    updated_at: new Date().toISOString(),
  }).eq('only_row', true);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, domains: cleaned });
}
