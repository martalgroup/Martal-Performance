import { redirect } from 'next/navigation';
import { createClient, getProfile } from '../../../../lib/supabase/server';
import { requireTab } from '../../../../lib/perf/guard';
import TabsPanel from './TabsPanel';
import { createAdminClient } from '../../../../lib/supabase/admin';
import { isSuperAdminRole } from '../../../../lib/roles';
import UsersAdmin from './UsersAdmin';
import { mailerStatus } from '../../../../lib/email';

export const dynamic = 'force-dynamic';

/**
 * Last sign-in comes from Supabase auth, which already records it — there is no
 * point storing a copy in profiles and keeping it in sync. It needs the service
 * role, and listUsers() pages (50 at a time), so walk until a short page.
 */
async function loadLastSignIn(admin) {
  const byId = {};
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users || [];
    if (error) break;
    users.forEach((u) => { byId[u.id] = u.last_sign_in_at || null; });
    if (users.length < 200) break;
  }
  return byId;
}

/**
 * "Created activity" = the most recent row this person actually made. Derived
 * from the existing created_by/created_at columns on the three tables that
 * record work, so it needs no new schema and no write on every request.
 */
async function loadLastActivity(admin) {
  const tables = ['clients', 'quotes', 'contracts'];
  const results = await Promise.all(
    tables.map((t) => admin.from(t).select('created_by, created_at')),
  );
  const byId = {};
  results.forEach(({ data }) => {
    (data || []).forEach((row) => {
      if (!row.created_by) return;
      const cur = byId[row.created_by];
      if (!cur || row.created_at > cur) byId[row.created_by] = row.created_at;
    });
  });
  return byId;
}

export default async function AdminUsersPage() {
  await requireTab('/console/admin/users');
  const profile = await getProfile();
  // Super admins only: this page grants roles, and an admin promoting someone
  // to their own level (or pre-assigning it before first login) shouldn't be a
  // self-service action. Matches /console/admin/settings.
  if (!isSuperAdminRole(profile.role)) redirect('/console/deals');

  const supabase = await createClient();
  const admin = createAdminClient();
  const [
    { data: profiles }, { data: invites }, { data: settings }, lastSignIn, lastActivity,
  ] = await Promise.all([
    supabase.from('profiles').select('*').order('email'),
    supabase.from('invites').select('*').order('created_at', { ascending: false }),
    supabase.from('app_settings').select('allowed_domains').maybeSingle(),
    loadLastSignIn(admin),
    Promise.resolve({}),
  ]);

  const { data: tabs } = await supabase.from('perf_tab_access').select('href, label, min_role, sort').order('sort');
  return (<>
    <TabsPanel tabs={tabs || []} />
    <UsersAdmin
      profiles={profiles || []}
      invites={invites || []}
      allowedDomains={settings?.allowed_domains || []}
      mailer={mailerStatus()}
      isSuperAdmin={profile.role === 'super_admin'}
      currentUserId={profile.id}
      currentEmail={profile.email}
      lastSignIn={lastSignIn}
      lastActivity={lastActivity}
    />
  </>);
}
