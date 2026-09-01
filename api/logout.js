const { clientFor } = require('../lib/auth');

module.exports = async (req, res) => {
  const supabase = clientFor(req, res);
  await supabase.auth.signOut();
  res.writeHead(302, { Location: '/api/login' });
  res.end();
};
