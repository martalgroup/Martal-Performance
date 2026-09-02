import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { createAdminClient } from '../../../lib/supabase/admin';
import { seedRoleFor } from '../../../lib/roles';
import { resolveAccess } from '../../../lib/access';
import { homeFor, loadTabs } from '../../../lib/perf/access';

// OAuth redirect target: exchange the code for a session, check the email is
// allowed in (by domain OR by invite), ensure a profiles row exists (creating
// one on first login), then send the user into the console.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      const email = (user?.email || '').toLowerCase();

      // Service-role: a first-time user isn't allowed to grant themselves a
      // role, and can't read app_settings/invites under RLS either, so both
      // the access check and provisioning run with elevated privileges.
      const admin = createAdminClient();

      let access;
      try {
        access = await resolveAccess(admin, email);
      } catch (e) {
        // Fail CLOSED on an access-check error. Letting someone in because a
        // lookup broke is the one outcome worse than a spurious /denied.
        console.error('auth callback: access check failed', email, e);
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/denied?reason=error`);
      }

      if (!access.allowed) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/denied`);
      }

      const { data: existing } = await admin
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (!existing) {
        // access.role is set whenever an active invite row exists — for an
        // invited user that IS their grant, and for someone on an allowed
        // domain it is a role pre-assigned before they ever logged in. Only
        // with no row at all do we fall back to the seed list (Edd and Matt)
        // and otherwise 'user'.
        await admin.from('profiles').insert({
          id: user.id,
          email,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
          role: access.role || seedRoleFor(email),
          can_view_all: access.canViewAll,
        });
      }

      // Record that the invite was actually taken up, so the admin list shows
      // who has turned up rather than just who was asked.
      if (access.invite && !access.invite.accepted_at) {
        await admin.from('invites')
          .update({ accepted_at: new Date().toISOString() })
          .eq('email', email);
      }

      // Land by role: admins on the company view, everyone else on Sales Reps.
      const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
      return NextResponse.redirect(`${origin}${homeFor(await loadTabs(admin), prof?.role)}`);
    }
  }
  return NextResponse.redirect(`${origin}/login`);
}
