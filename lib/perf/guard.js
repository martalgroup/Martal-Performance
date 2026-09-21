import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient, getProfile } from '../supabase/server';
import { loadTabs, canSee, homeFor } from './access';

/** Tab config for this request. Cached so the console layout and the page it
 *  renders share one read instead of querying perf_tab_access twice. */
export const getTabs = cache(async () => loadTabs(await createClient()));

/** Loads the profile + tab config; redirects if this role may not see `href`. */
export async function requireTab(href) {
  const [profile, tabs] = await Promise.all([getProfile(), getTabs()]);
  if (!profile) redirect('/login');
  if (!canSee(tabs, profile.role, href)) redirect(homeFor(tabs, profile.role));
  return { profile, tabs };
}
