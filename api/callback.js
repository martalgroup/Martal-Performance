// OAuth return leg: swap the code for a session, then check the email against
// the same allow rules the Deal Room uses before letting anyone through.
const { clientFor, resolveAccess } = require('../lib/auth');

module.exports = async (req, res) => {
  const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const url = new URL(req.url, origin);
  const code = url.searchParams.get('code');
  if (!code) {
    res.writeHead(302, { Location: '/api/login' });
    res.end();
    return;
  }

  const supabase = clientFor(req, res);
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    res.status(400).send(`Sign-in failed: ${error.message}`);
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  const email = (user?.email || '').toLowerCase();

  let access;
  try {
    access = await resolveAccess(email);
  } catch (e) {
    // Fail closed. Letting someone in because a lookup broke is worse than a
    // spurious rejection.
    await supabase.auth.signOut();
    res.writeHead(302, { Location: '/api/denied?reason=error' });
    res.end();
    return;
  }

  if (!access.allowed) {
    await supabase.auth.signOut();
    res.writeHead(302, { Location: `/api/denied?e=${encodeURIComponent(email)}` });
    res.end();
    return;
  }

  res.writeHead(302, { Location: '/' });
  res.end();
};
