// Where the numbers come from: the campaign dashboard's normalised dataset.
//
// Two adapters, chosen by env:
//   export_route  CAMPAIGN_EXPORT_URL + CAMPAIGN_EXPORT_SECRET
//                 A small JSON route added to the campaign dashboard. Clean,
//                 stable, ~20 lines on their side. Preferred.
//   rsc_stopgap   CAMPAIGN_BASE_URL + CAMPAIGN_SESSION_COOKIE
//                 Fetch the dashboard's own server payload (React flight, the
//                 same 13 MB the browser receives) with a Martal Google session
//                 and parse the leads/accounts arrays out of it. Works today
//                 with no change on their side, but breaks if their framing or
//                 session expires. Use only until the export route exists.
//
// Both return the same shape and both strip contact PII before anything is
// cached: this app reports counts by rep and account, it never needs an email.

const LEAD_KEEP = ['customer', 'account', 'rep', 'dateISO', 'dateConfident', 'dateRaw', 'dateNote',
  'mql', 'sql', 'flip', 'status', 'leadSource', 'objection', 'industry', 'companySize', 'fromTracker', 'eventType'];
const ACCOUNT_KEEP = ['name', 'status', 'startISO', 'endISO', 'churnDateISO', 'serviceTier', 'industryCleaned',
  'monthlyRevenue', 'dealOwner', 'soms', 'reps', 'dealCreateISO', 'dealCloseWonISO', 'switchedToLandbase', 'leadStats'];

const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o?.[k] ?? null]));
export const stripPII = ({ leads, accounts }) => ({
  leads: (leads || []).map((l) => pick(l, LEAD_KEEP)),
  accounts: (accounts || []).map((a) => pick(a, ACCOUNT_KEEP)),
});

/** Extract the JSON array that follows `"key":[` in a flight payload. */
function grabArray(text, startIdx) {
  let depth = 0, inStr = false, esc = false;
  for (let j = startIdx; j < text.length; j++) {
    const c = text[j];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) return JSON.parse(text.slice(startIdx, j + 1)); }
  }
  throw new Error('unterminated array in flight payload');
}

export function parseFlight(text) {
  const li = text.indexOf('"leads":[');
  if (li < 0) throw new Error('flight payload has no "leads" array (session expired or page changed)');
  const leads = grabArray(text, li + '"leads":'.length);
  // Accounts are not labelled consistently; locate by a field only they carry.
  const st = text.indexOf('"serviceTier"');
  if (st < 0) throw new Error('flight payload has no account records');
  const accounts = grabArray(text, text.lastIndexOf('[', st));
  return { leads, accounts };
}

async function fromExportRoute() {
  const res = await fetch(process.env.CAMPAIGN_EXPORT_URL, {
    headers: { authorization: `Bearer ${process.env.CAMPAIGN_EXPORT_SECRET}` }, cache: 'no-store',
  });
  if (!res.ok) throw new Error(`export route ${res.status}`);
  return res.json();
}

async function fromRscStopgap() {
  const res = await fetch(`${process.env.CAMPAIGN_BASE_URL}/`, {
    headers: { RSC: '1', cookie: process.env.CAMPAIGN_SESSION_COOKIE }, cache: 'no-store', redirect: 'manual',
  });
  if (res.status !== 200) throw new Error(`campaign dashboard returned ${res.status}; session probably expired`);
  return parseFlight(await res.text());
}

export function sourceKind() {
  if (process.env.CAMPAIGN_EXPORT_URL) return 'export_route';
  if (process.env.CAMPAIGN_SESSION_COOKIE) return 'rsc_stopgap';
  return null;
}

/** Pull the dataset from whichever source is configured. */
export async function pull() {
  const kind = sourceKind();
  if (!kind) throw new Error('No data source configured (CAMPAIGN_EXPORT_URL or CAMPAIGN_SESSION_COOKIE).');
  const raw = kind === 'export_route' ? await fromExportRoute() : await fromRscStopgap();
  return { kind, ...stripPII(raw) };
}
