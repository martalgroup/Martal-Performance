import { redirect } from 'next/navigation';
import { getProfile, createClient } from '../lib/supabase/server';
import { homeFor, loadTabs } from '../lib/perf/access';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const profile = await getProfile();
  if (!profile) redirect('/login');
  redirect(homeFor(await loadTabs(await createClient()), profile.role));
}
