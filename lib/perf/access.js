// Which tabs each role may see. Stored in perf_tab_access and editable from the
// admin panel, so hiding a tab is a click, not a deploy. Roles come from the
// shared profiles.role (user / admin / super_admin). Super admins always see
// every tab: a tab can be hidden from the team but never locked away from the
// people who administer it.
import { isSuperAdminRole } from '../roles.js';

const RANK = { user: 1, admin: 2, super_admin: 3, hidden: 99 };
const ICON = { '/console/reps': 'users', '/console': 'quotation', '/console/churn': 'deals', '/console/methodology': 'settings', '/console/admin/users': 'users' };
// Used only if the table cannot be read; mirrors the seeded rows.
export const DEFAULT_TABS = [
  { href: '/console', label: 'Performance', min_role: 'admin', sort: 10 },
  { href: '/console/reps', label: 'Sales Reps', min_role: 'user', sort: 20 },
  { href: '/console/churn', label: 'Company Churn', min_role: 'admin', sort: 30 },
  { href: '/console/methodology', label: 'Methodology', min_role: 'super_admin', sort: 40 },
  { href: '/console/admin/users', label: 'Admin', min_role: 'super_admin', sort: 90 },
];

export async function loadTabs(supabase) {
  try {
    const { data } = await supabase.from('perf_tab_access').select('href, label, min_role, sort').order('sort');
    if (data?.length) return data;
  } catch { /* fall through to defaults */ }
  return DEFAULT_TABS;
}

const visible = (tab, role) => isSuperAdminRole(role) || (RANK[role] || 0) >= (RANK[tab.min_role] || 99);

// min_role 'hidden' is absolute in the NAV, super admin included: the whole
// point of hiding a tab is that nobody is looking at it by accident. canSee()
// deliberately still allows it, so a super admin can reach the page by URL.
export const navFor = (tabs, role) => tabs
  .filter((t) => t.min_role !== 'hidden' && visible(t, role))
  .map((t) => ({ href: t.href, label: t.label, icon: ICON[t.href] || 'quotation' }));
export const canSee = (tabs, role, href) => { const t = tabs.find((x) => x.href === href); return t ? visible(t, role) : isSuperAdminRole(role); };
/** First visible tab, in sort order; falls back to Sales Reps. */
export const homeFor = (tabs, role) => navFor(tabs, role)[0]?.href || '/console/reps';
