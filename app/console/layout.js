import { redirect } from 'next/navigation';
import { getProfile } from '../../lib/supabase/server';
import ConsoleShell from './ConsoleShell';

// Same shell as the Deal Room and Academy, so the three read as one product
// when linked together. Access is decided by the shared Supabase policy in
// middleware + lib/access.js; this layout only renders the frame.
export default async function ConsoleLayout({ children }) {
  const profile = await getProfile();
  if (!profile) redirect('/login');
  const items = [
    { href: '/console', label: 'Company', icon: 'quotation' },
    { href: '/console/churn', label: 'Company Churn', icon: 'deals' },
    { href: '/console/reps', label: 'Sales Reps', icon: 'users' },
    { href: '/console/methodology', label: 'Methodology', icon: 'settings' },
  ];
  return (
    <div className="app-canvas">
      <ConsoleShell items={items} name={profile.full_name || profile.email} avatarUrl={profile.avatarUrl || null}>
        {children}
      </ConsoleShell>
    </div>
  );
}
