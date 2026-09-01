// The gate. Serves the dashboard only to a signed-in, allow-listed account.
//
// index.html has to stay at the repo root, and anything at a Vercel project
// root is served statically, which would hand it out unauthenticated. The build
// therefore emits an empty output directory (see vercel.json): Vercel serves no
// static files, every path falls through the rewrite, and this is the only door.
const { readFileSync } = require('fs');
const { join } = require('path');
const { clientFor, resolveAccess } = require('../lib/auth');
const { signInPage } = require('../lib/shell');

let cached = null;

module.exports = async (req, res) => {
  const supabase = clientFor(req, res);

  let user = null;
  try {
    ({ data: { user } } = await supabase.auth.getUser());
  } catch { /* treated as signed out */ }

  if (!user) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).send(signInPage());
    return;
  }

  // A session alone is not access: the same account could have been invited to
  // a different Martal app on this Supabase project. Re-check the allow list on
  // every request so a revoked invite takes effect immediately.
  let access;
  try {
    access = await resolveAccess(user.email);
  } catch {
    res.writeHead(302, { Location: '/api/denied?reason=error' });
    res.end();
    return;
  }
  if (!access.allowed) {
    res.writeHead(302, { Location: `/api/denied?e=${encodeURIComponent(user.email || '')}` });
    res.end();
    return;
  }

  if (!cached) cached = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).send(cached);
};
