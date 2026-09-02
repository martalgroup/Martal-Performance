import { redirect } from 'next/navigation';
import { createClient, getProfile } from '../supabase/server';
import { loadTabs, canSee, homeFor } from './access';

/** Loads the profile + tab config; redirects if this role may not see `href`. */
export async function requireTab(href) {
  const [profile, supabase] = await Promise.all([getProfile(), createClient()]);
  if (!profile) redirect('/login');
  const tabs = await loadTabs(supabase);
  if (!canSee(tabs, profile.role, href)) redirect(homeFor(tabs, profile.role));
  return { profile, tabs };
}
