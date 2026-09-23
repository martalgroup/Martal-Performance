import { parseFlight, stripPII } from './source.js';

// Turning a file a human just saved into the same dataset /api/refresh pulls.
//
// This exists because the automatic pull has two failure modes that both leave
// the dashboard frozen with no way out: CAMPAIGN_EXPORT_URL was never set, and
// the RSC stopgap dies the moment CAMPAIGN_SESSION_COOKIE expires. Neither is
// something an admin can fix from inside the app. Uploading the file by hand
// is the way out, so it has to land on exactly the same code path: the same
// flight parser, the same PII strip, the same snapshot writer. A second,
// slightly different ingest route would drift and the numbers would quietly
// stop matching.
//
// Pure and synchronous on purpose, so check-ingest.mjs can throw real payload
// shapes at it without a database or a network.

/** Keys a lead row must have for the aggregates to mean anything. */
const LEAD_SIGNALS = ['rep', 'dateISO', 'mql', 'sql', 'flip', 'status', 'customer', 'account'];

function looksLikeLeads(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  const sample = rows.find((r) => r && typeof r === 'object');
  if (!sample) return false;
  return LEAD_SIGNALS.some((k) => k in sample);
}

/**
 * Works out what was uploaded and returns { leads, accounts }, PII already
 * stripped. Throws with something an admin can act on, never a parser stack
 * trace: the person doing this is unblocking a broken dashboard, and "line
 * 1 col 4831" tells them nothing about which file to save instead.
 *
 * Accepts, in order of how likely someone is to have it to hand:
 *   1. The export JSON:     { leads: [...], accounts: [...] }
 *   2. The same, wrapped:   { data: { leads, accounts } }  (some exports nest)
 *   3. A raw RSC payload    saved from the campaign dashboard with RSC: 1
 */
export function parseUpload(text) {
  const body = String(text ?? '').trim();
  if (!body) throw new Error('The file is empty.');

  // JSON first: it is the clean shape, and a flight payload never starts with
  // { or [, so there is no ambiguity to resolve.
  if (body[0] === '{' || body[0] === '[') {
    let json;
    try {
      json = JSON.parse(body);
    } catch {
      throw new Error('That looks like JSON but it will not parse. It may have been '
        + 'truncated on save. Re-save the file and try again.');
    }
    const root = json?.leads || json?.accounts ? json : json?.data;
    if (!root || typeof root !== 'object') {
      throw new Error('That JSON has no "leads" or "accounts" in it. Upload the campaign '
        + 'dashboard export, not a report or a spreadsheet conversion.');
    }
    const leads = root.leads;
    const accounts = root.accounts;
    if (!Array.isArray(leads)) throw new Error('That file has no "leads" array.');
    if (!Array.isArray(accounts)) throw new Error('That file has no "accounts" array.');
    return validate({ leads, accounts }, 'json');
  }

  // Not JSON, so the only other thing it can be is a saved flight payload.
  //
  // Decide that BEFORE handing it to parseFlight. That parser's failure message
  // blames an expired session or a changed page, which is right when someone
  // really did save the dashboard and it went stale, and actively misleading
  // when they uploaded a CSV: it sends them off to renew a cookie that was
  // never the problem. A file with no `"leads":[` anywhere in it was never a
  // payload, so say the simple thing instead.
  if (!body.includes('"leads":[')) {
    const looksCsv = /^[^\n]{0,200}(,|\t)[^\n]{0,200}\n/.test(body);
    const looksHtml = /^\s*<(!doctype|html|\?xml)/i.test(body);
    throw new Error(
      `${looksCsv ? 'That looks like a CSV or spreadsheet export. ' : ''}`
      + `${looksHtml ? 'That looks like a saved web page, probably a sign-in screen. ' : ''}`
      + 'It is not the campaign dataset: there is no "leads" array anywhere in it. '
      + 'Upload the export JSON, or the page payload saved with the RSC header.',
    );
  }

  // It does contain the dataset, so a failure here is a genuine payload
  // problem and parseFlight's own diagnosis is the useful one.
  let parsed;
  try {
    parsed = parseFlight(body);
  } catch (e) {
    throw new Error(`Could not read that file. ${e.message}. Expected either the campaign `
      + 'dashboard export JSON, or a page payload saved with the RSC header.');
  }
  return validate(parsed, 'flight');
}

/**
 * Refuses a file that parses but would wreck the dashboard.
 *
 * An empty or wrong-shaped upload is the dangerous case: writeSnapshot would
 * accept it happily, it becomes the newest snapshot, and every page then reads
 * zero. Better to refuse than to let someone blank the dashboard from a file
 * picker.
 */
export function validate({ leads, accounts }, shape) {
  if (!leads.length) {
    throw new Error('That file parsed but contains no leads, so loading it would blank '
      + 'the dashboard. Nothing has been changed.');
  }
  if (!accounts.length) {
    throw new Error('That file parsed but contains no accounts, so loading it would blank '
      + 'the dashboard. Nothing has been changed.');
  }
  if (!looksLikeLeads(leads)) {
    throw new Error('The "leads" array does not look like campaign leads: no rep, date or '
      + 'status on the first row. Check you exported the right dataset.');
  }
  // Strip here rather than at the call site so there is no path into a snapshot
  // that skips it. This app reports counts by rep and account; it never needs
  // an email address, and one that gets stored is one that can leak.
  const clean = stripPII({ leads, accounts });
  return { ...clean, shape, kind: 'manual' };
}

/**
 * A short line for the snapshot's notes column, so the history says where a
 * given set of numbers came from and who is answerable for it.
 */
export function uploadNote({ email, filename, shape }) {
  const what = shape === 'flight' ? 'saved page payload' : 'export JSON';
  return `manual upload by ${email || 'an admin'}`
    + `${filename ? ` from ${filename}` : ''} (${what})`;
}
