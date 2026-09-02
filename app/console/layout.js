import { redirect } from 'next/navigation';
import { getProfile, createClient } from '../../lib/supabase/server';
import ConsoleShell from './ConsoleShell';
import { navFor, loadTabs } from '../../lib/perf/access';

// Same shell as the Deal Room and Academy, so the three read as one product
// when linked together. Access is decided by the shared Supabase policy in
// middleware + lib/access.js; this layout only renders the frame.
export default async function ConsoleLayout({ children }) {
  const profile = await getProfile();
  if (!profile) redirect('/login');
  const supabase = await createClient();
  const items = navFor(await loadTabs(supabase), profile.role);
  return (
    <div className="app-canvas">
      <ConsoleShell items={items} name={profile.full_name || profile.email} avatarUrl={profile.avatarUrl || null}>
        {children}
      </ConsoleShell>
    </div>
  );
}
