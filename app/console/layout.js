import { redirect } from 'next/navigation';
import { getProfile, createClient } from '../../lib/supabase/server';
import ConsoleShell from './ConsoleShell';
import { navFor } from '../../lib/perf/access';
import { getTabs } from '../../lib/perf/guard';

// Same shell as the Deal Room and Academy, so the three read as one product
// when linked together. Access is decided by the shared Supabase policy in
// middleware + lib/access.js; this layout only renders the frame.
export default async function ConsoleLayout({ children }) {
  const profile = await getProfile();
  if (!profile) redirect('/login');

  // The portal decides who may open this dashboard at all. Asked here rather
  // than in middleware because middleware runs on every asset request and this
  // is a database round trip; the layout runs once per page and is the first
  // thing rendered, so nothing leaks before the answer comes back.
  //
  // has_app_access is security definer and returns true for a super admin
  // without any rows. Someone without a grant goes back to the portal, not to
  // this app's sign-in screen: they are signed in perfectly well, they simply
  // were not given this one, and a login form would be a lie.
  const supabase = await createClient();
  const { data: allowed, error: gateErr } = await supabase
    .rpc('has_app_access', { p_app_key: 'performance' });

  // Fail OPEN on a transport error, never on a definite no. A blip in Postgres
  // should not throw the whole company out of a dashboard mid-morning, and the
  // portal still controls who gets a link in the first place.
  if (gateErr) {
    console.error('access gate: has_app_access failed', profile.email, gateErr.message);
  } else if (allowed === false) {
    redirect('https://martal-portal.vercel.app/?denied=performance');
  }

  const items = navFor(await getTabs(), profile.role);
  return (
    <div className="app-canvas">
      <ConsoleShell items={items} name={profile.full_name || profile.email} avatarUrl={profile.avatarUrl || null}>
        {children}
      </ConsoleShell>
    </div>
  );
}
