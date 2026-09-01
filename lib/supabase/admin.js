import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Service-role client — bypasses RLS. Server-only: never import from a
// Client Component. Used for (1) first-login profile provisioning, where a
// brand-new user needs a role assigned that they aren't allowed to grant
// themselves, and (2) the Dropbox Sign webhook, which has no user session.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
