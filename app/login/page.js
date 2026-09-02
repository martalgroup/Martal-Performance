import { redirect } from 'next/navigation';
import { createClient, getProfile } from '../../lib/supabase/server';
import { fetchLoginContent } from '../../lib/login-content';
import { homeFor, loadTabs } from '../../lib/perf/access';
import LoginForm from './LoginForm';

// Server component so the hero copy is read per request. The messaging is
// edited by a super admin in /console/admin/messaging and must change without a
// deploy, so this page cannot be static.
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  // Already signed in? There is nothing to log into. Without this, /login
  // renders for an authenticated user, which is where the nav-bar-above-the-
  // sign-in-screen state came from.
  const profile = await getProfile();
  if (profile) redirect(homeFor(await loadTabs(supabase), profile.role));

  const supabase = await createClient();
  const content = await fetchLoginContent(supabase);
  return <LoginForm content={content} />;
}
