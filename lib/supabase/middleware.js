import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// Refreshes the auth session on every request and gates the entire app behind
// login — only /login, /auth (the OAuth callback), and /denied are left open.
//
// This used to re-implement the domain rule with its own hardcoded
// ALLOWED_DOMAIN = 'martalgroup.com'. That was a second, independent copy of
// the access policy, and it is exactly why @landbase.com users were still being
// bounced to /denied after the callback started admitting them: the callback let
// them in, then this ran on the very next request and signed them straight out.
//
// The rule is now derived instead of duplicated. /auth/callback is the single
// gate: it checks app_settings.allowed_domains plus per-email invites, signs out
// anyone who fails, and creates a profiles row ONLY for those it admits. So the
// existence of a profiles row IS the proof of admission, and checking it here
// honours DB-configured domains and invites automatically — with nothing to keep
// in sync. Deleting someone's profile also locks them out on the next request.
export async function updateSession(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // Everything requires a session except the sign-in flow itself.
  const isPublic =
    path === '/login' || path.startsWith('/auth') || path === '/denied';
  if (isPublic) {
    return response;
  }

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // One indexed primary-key lookup, allowed by the profiles_select_own_or_admin
  // RLS policy (id = auth.uid()).
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  // Fail OPEN only on a transport/DB error, never on a definite "no row":
  // a blip in Postgres should not sign out the whole company mid-session, and
  // the callback plus RLS still stand behind this. A confirmed missing profile
  // does mean this session never passed the gate.
  if (error) {
    console.error('middleware: profile lookup failed', user.id, error.message);
    return response;
  }

  if (!profile) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = '/denied';
    return NextResponse.redirect(url);
  }

  return response;
}
