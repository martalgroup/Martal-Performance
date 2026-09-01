// Kicks off Google sign-in. Supabase does the OAuth dance and returns to
// /api/callback, which is where the session cookies get set.
const { clientFor } = require('../lib/auth');

module.exports = async (req, res) => {
  const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const supabase = clientFor(req, res);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/api/callback`,
      // Always show the picker: several people here have more than one Google
      // account and silently reusing the wrong one is a confusing failure.
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error || !data?.url) {
    res.status(500).send(`Could not start sign-in: ${error?.message || 'no URL returned'}`);
    return;
  }
  res.writeHead(302, { Location: data.url });
  res.end();
};
