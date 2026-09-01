// Serves the dashboard behind HTTP Basic Auth.
//
// GitHub Pages forced this repo public, which put rep-level performance, churn
// and client pricing on an open URL. Vercel has no such constraint, so the move
// is the moment to close it. index.html stays exactly as it is and is still the
// single source of truth pushed to GitHub; this only gates access to it.
const { readFileSync } = require('fs');
const { join } = require('path');

let cached = null;

module.exports = (req, res) => {
  const expected = process.env.APP_PASSWORD;

  // Fail closed. A missing password must not silently serve the dashboard.
  if (!expected) {
    res.status(500).send('APP_PASSWORD is not set on this deployment.');
    return;
  }

  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  let ok = false;
  if (scheme === 'Basic' && encoded) {
    const [, pass] = Buffer.from(encoded, 'base64').toString().split(':');
    // Length-independent compare is overkill for a shared team password, but
    // constant-time costs nothing here.
    ok = pass != null && pass.length === expected.length
      && require('crypto').timingSafeEqual(Buffer.from(pass), Buffer.from(expected));
  }

  if (!ok) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Martal Performance Intelligence"');
    res.status(401).send('Authentication required.');
    return;
  }

  if (!cached) cached = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Internal dashboard: never let a shared cache hold a copy.
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).send(cached);
};
