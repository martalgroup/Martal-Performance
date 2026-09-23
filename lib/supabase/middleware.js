import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { rememberAfterLogin } from '../after-login';

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

  const path = request.nextUrl.pathname;

  // Everything requires a session except the sign-in flow itself, and the
  // refresh endpoint, which authenticates itself.
  //
  // /api/refresh is what the 06:00 cron calls. Vercel sends it a CRON_SECRET
  // bearer token and no cookies, so the session gate below bounced it to
  // /login and the handler never ran: in three weeks the cron never once
  // wrote a snapshot, and the data only looked current because someone kept
  // clicking "Refresh now". The handler does its own check (CRON_SECRET, or
  // an admin profile) and returns 401 to anyone else, so gating it here was
  // both redundant and the thing that broke it.
  const isPublic =
    path === '/login' || path.startsWith('/auth') || path === '/denied' ||
    path === '/api/refresh';
  // Return BEFORE touching the session, not after.
  //
  // getUser() used to run above this check, on every request including
  // /auth/handoff. That route exists to CREATE a session, and refreshing a
  // non-existent one first makes @supabase/ssr write cookie DELETIONS onto the
  // middleware's response. Next then merges those with the handler's response,
  // and the deletions cancel the session the handler had just minted: the
  // ticket redeemed, the route returned 307 with no error, and the browser
  // still arrived signed out. Nothing in the logs said why.
  //
  // Skipping the refresh on public paths is also simply correct: none of them
  // need a session, and it saves a network round trip on every one.
  if (isPublic) {
    return response;
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Keep hold of where they were going. The portal links straight to a page
    // inside this app, so without this every sign-in lands on the default
    // screen instead of the one the link promised.
    const intended = `${path}${request.nextUrl.search}`;
    url.search = '';
    return rememberAfterLogin(NextResponse.redirect(url), intended);
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
