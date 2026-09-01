const { deniedPage } = require('../lib/shell');

module.exports = (req, res) => {
  const url = new URL(req.url, `https://${req.headers.host}`);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(403).send(deniedPage(url.searchParams.get('e') || ''));
};
