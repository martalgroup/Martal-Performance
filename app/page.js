import { redirect } from 'next/navigation';
import { getProfile } from '../lib/supabase/server';
import { homeFor } from '../lib/perf/access';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const profile = await getProfile();
  redirect(profile ? homeFor(profile.role) : '/login');
}
