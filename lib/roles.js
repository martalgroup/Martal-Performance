// Seed role assignment for first login only — after that, role changes go
// through the profiles table (via /console/admin/users), not this list.
export const SEED_ROLES = {
  'edward@martalgroup.com': 'super_admin',
  'matt@martalgroup.com': 'admin',
};

export function seedRoleFor(email) {
  return SEED_ROLES[(email || '').toLowerCase()] || 'user';
}

export function isAdminRole(role) {
  return role === 'admin' || role === 'super_admin';
}

// Reserved for overriding another admin's decision — reopening an approved
// contract, exceeding the discount cap, editing the domain allowlist. An admin
// approving is a normal step; undoing someone else's approval is not.
export function isSuperAdminRole(role) {
  return role === 'super_admin';
}
