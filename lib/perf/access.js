// Page visibility by role. Roles come from the shared profiles.role, the same
// values the Deal Room uses (user / admin / super_admin). A user is a rep or
// manager who should see rep performance and nothing else; admins see the
// company view and churn; only super admins see how the numbers are made.
import { isAdminRole, isSuperAdminRole } from '../roles.js';

export const PAGES = [
  { href: '/console/reps', label: 'Sales Reps', icon: 'users', allow: () => true },
  { href: '/console', label: 'Company', icon: 'quotation', allow: isAdminRole },
  { href: '/console/churn', label: 'Company Churn', icon: 'deals', allow: isAdminRole },
  { href: '/console/methodology', label: 'Methodology', icon: 'settings', allow: isSuperAdminRole },
];
export const navFor = (role) => PAGES.filter((p) => p.allow(role)).map(({ href, label, icon }) => ({ href, label, icon }));
export const canSee = (role, href) => !!PAGES.find((p) => p.href === href)?.allow(role);
/** Where a signed-in person lands: admins on the company view, everyone else on reps. */
export const homeFor = (role) => (isAdminRole(role) ? '/console' : '/console/reps');
