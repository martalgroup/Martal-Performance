// Same auth backend, same policy, as the Deal Room and Martal Academy.
//
// All three apps point at one Supabase project, so "who may sign in" is decided
// in one place: the app_settings.allowed_domains list plus per-email invites.
// This file is the plain-Node equivalent of the Deal Room's lib/access.js; it
// deliberately mirrors that logic rather than inventing a second rule set.
const { createServerClient } = require('@supabase/ssr');
const { createClient } = require('@supabase/supabase-js');

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Never an empty list on a transient failure: that would lock everyone out.
const DEFAULT_ALLOWED_DOMAINS = ['martalgroup.com', 'landbase.com'];

function parseCookies(header) {
  const out = [];
  (header || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out.push({ name: part.slice(0, i).trim(), value: decodeURIComponent(part.slice(i + 1)) });
  });
  return out;
}

function serialize(name, value, options = {}) {
  const bits = [`${name}=${encodeURIComponent(value)}`];
  bits.push(`Path=${options.path || '/'}`);
  if (options.maxAge != null) bits.push(`Max-Age=${options.maxAge}`);
  if (options.expires) bits.push(`Expires=${new Date(options.expires).toUTCString()}`);
  bits.push('HttpOnly');
  bits.push('Secure');
  bits.push(`SameSite=${options.sameSite || 'Lax'}`);
  return bits.join('; ');
}

/** A Supabase client bound to this request's cookies. */
function clientFor(req, res) {
  const pending = [];
  const supabase = createServerClient(URL_, ANON, {
    cookies: {
      getAll: () => parseCookies(req.headers.cookie),
      setAll: (list) => {
        list.forEach(({ name, value, options }) => pending.push(serialize(name, value, options)));
        if (pending.length) res.setHeader('Set-Cookie', pending);
      },
    },
  });
  return supabase;
}

function domainOf(email) {
  const at = String(email || '').toLowerCase().lastIndexOf('@');
  return at === -1 ? '' : String(email).toLowerCase().slice(at + 1);
}

/**
 * Mirrors the Deal Room: access is granted by EITHER an allowed domain OR an
 * active invite for that exact address. Fails closed on error.
 */
async function resolveAccess(email) {
  const lower = String(email || '').toLowerCase().trim();
  if (!lower.includes('@')) return { allowed: false };

  // Without the service role we can still honour the domain list, because it is
  // hardcoded as a fallback. Invites need to be read past RLS.
  const admin = SERVICE ? createClient(URL_, SERVICE, { auth: { persistSession: false } }) : null;

  let domains = DEFAULT_ALLOWED_DOMAINS;
  if (admin) {
    const { data } = await admin.from('app_settings').select('allowed_domains').maybeSingle();
    if (data?.allowed_domains?.length) {
      domains = data.allowed_domains.map((d) => String(d).toLowerCase().trim()).filter(Boolean);
    }
  }
  if (domains.includes(domainOf(lower))) return { allowed: true, via: 'domain' };

  if (!admin) return { allowed: false, via: null, reason: 'no-service-key' };
  const { data: invite } = await admin
    .from('invites').select('email, revoked_at').eq('email', lower).maybeSingle();
  if (invite && !invite.revoked_at) return { allowed: true, via: 'invite' };

  return { allowed: false };
}

module.exports = { clientFor, resolveAccess, domainOf, DEFAULT_ALLOWED_DOMAINS };
