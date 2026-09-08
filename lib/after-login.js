// Where to send someone once they have signed in.
//
// The portal links straight to a page inside each app (Service Pricing, the
// Performance console, the Academy home), so a signed-out click lands on
// /login and the intended page is lost: the callback used to send everyone to
// the app's default screen no matter which tile they came from. The middleware
// now records the intended path when it bounces them, and the callback spends
// it.
//
// It travels in an HttpOnly cookie rather than on the OAuth redirectTo, so the
// Google round trip stays byte-identical to the flow that is known to work.
// SameSite=Lax is deliberate: the return leg is a top-level GET navigation
// from Google, which Lax allows, and it keeps the cookie off cross-site
// subrequests.
export const AFTER_LOGIN_COOKIE = 'mg_after_login';

/**
 * Only a same-origin absolute path is ever accepted. Anything protocol- or
 * host-shaped ('//evil.example', 'https://evil.example') is refused, so this
 * cannot be turned into an open redirect by handing someone a crafted link.
 */
export function safeAfterLogin(value) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v || !v.startsWith('/') || v.startsWith('//') || v.includes('\\')) return null;
  if (v.startsWith('/login') || v.startsWith('/auth') || v.startsWith('/denied')) return null;
  // Only pages. The middleware also runs on /api routes and on React's own
  // ?_rsc= data requests, and landing someone on a JSON payload after they
  // sign in is not a destination.
  if (v.startsWith('/api') || v.includes('_rsc')) return null;
  return v;
}

/** Remembers `path` on a redirect response. */
export function rememberAfterLogin(response, path) {
  const dest = safeAfterLogin(path);
  if (!dest) return response;
  response.cookies.set(AFTER_LOGIN_COOKIE, dest, {
    path: '/',
    maxAge: 600,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}
