import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '../../../lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Arrive from the portal already signed in.
//
// The portal cannot hand over its cookie: vercel.app is on the Public Suffix
// List, so browsers refuse to let one *.vercel.app site read another's. This is
// therefore not a shared session but a re-minted one. The portal vouches, this
// app mints its own, and nobody sees a second Google screen.
//
// What arrives in `k` is deliberately NOT a credential. It is a single-use
// thirty-second row id, worthless once redeemed, which is what makes it
// acceptable for it to pass through a URL and so through browser history, the
// next Referer and Vercel's logs.
//
// COOKIES. This builds the redirect FIRST and writes the session onto it. The
// app's usual createClient() writes through next/headers cookies(), and those
// writes do not travel onto a NextResponse.redirect constructed afterwards: the
// redirect is a different response object. That cost a full debug cycle here,
// with the ticket correctly redeemed and the session silently going nowhere, so
// the cookie jar is bound to the exact response being returned.
const APP_KEY = 'performance';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get('k');

  if (!token) return NextResponse.redirect(`${origin}/login`);

  const admin = createAdminClient();

  // Consumes the ticket and re-checks access in one statement. Answers with an
  // email or with nothing, and never says which of expired, already spent,
  // wrong app, made up or since-revoked applied.
  const { data: rows, error: redeemErr } = await admin
    .rpc('redeem_handoff', { p_token: token, p_app_key: APP_KEY });

  if (redeemErr) {
    console.error('handoff: redeem failed', redeemErr.message);
    return NextResponse.redirect(`${origin}/login?handoff=error`);
  }

  const email = rows?.[0]?.email;
  if (!email) return NextResponse.redirect(`${origin}/login?handoff=expired`);

  // generateLink gives a hashed token without sending mail; verifyOtp turns it
  // into a session. @supabase/ssr names and chunks the cookies, rather than us
  // guessing at "sb-<ref>-auth-token" and its base64 splitting.
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const hashed = link.data?.properties?.hashed_token;
  if (link.error || !hashed) {
    console.error('handoff: could not mint a session', email, link.error?.message);
    return NextResponse.redirect(`${origin}/login?handoff=error`);
  }

  const res = NextResponse.redirect(`${origin}/console`);
  res.headers.set('Referrer-Policy', 'no-referrer');

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
      },
    },
  );

  const verified = await supabase.auth.verifyOtp({ token_hash: hashed, type: 'magiclink' });
  if (verified.error) {
    console.error('handoff: verifyOtp failed', email, verified.error.message);
    return NextResponse.redirect(`${origin}/login?handoff=error`);
  }
  if (!verified.data?.session) {
    console.error('handoff: verifyOtp returned no session', email);
    return NextResponse.redirect(`${origin}/login?handoff=error`);
  }

  return res;
}
