import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server-side Supabase client bound to the request's auth cookies.
// All DB access goes through this so Postgres RLS enforces roles/grants.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore; middleware refreshes.
          }
        },
      },
    }
  );
}

// Returns the signed-in user's profile row (id, email, full_name, role), or
// null if not signed in. Use for role gates in Server Components/routes.
export async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, can_view_platform')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile) return null;

  // The Google avatar lives on the auth user, not the profiles row, so there is
  // nothing to store or keep in sync — it comes back with the session. Google
  // has used both keys over time, hence the fallback.
  const meta = user.user_metadata || {};
  return { ...profile, avatarUrl: meta.avatar_url || meta.picture || null };
}
