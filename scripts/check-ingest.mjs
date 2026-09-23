// Guards the manual upload. The rule that matters most is the last group: a
// file that parses but is empty must be REFUSED, not stored.
//
// writeSnapshot will happily accept zero leads, and that row then becomes the
// newest snapshot, so every page reads zero and the dashboard looks like the
// business stopped. Blanking the numbers from a file picker is the worst
// outcome this feature can produce, and it is the easiest one to reach: save
// the wrong tab, upload it, done.

import { readFileSync } from 'fs';
import { parseUpload, uploadNote } from '../lib/perf/ingest.js';

let failed = 0;
const ok = (name, cond) => {
  console.log(`  ${cond ? '✓' : '✗'} ${name}`);
  if (!cond) failed++;
};
const t = (name, got, want) => {
  const pass = got === want;
  console.log(`  ${pass ? '✓' : '✗'} ${name}`);
  if (!pass) { failed++; console.log(`      got:  ${got}\n      want: ${want}`); }
};
const throws = (name, fn, re) => {
  try { fn(); failed++; console.log(`  ✗ ${name} (did not throw)`); }
  catch (e) {
    const pass = !re || re.test(e.message);
    console.log(`  ${pass ? '✓' : '✗'} ${name}`);
    if (!pass) { failed++; console.log(`      message: ${e.message}`); }
  }
};

const LEAD = { customer: 'Acme', account: 'Acme', rep: 'Noam', dateISO: '2026-09-01',
  mql: 1, sql: 0, flip: 0, status: 'Interested', email: 'buyer@acme.com', phone: '+1 555 0100' };
const ACCOUNT = { name: 'Acme', status: 'active', serviceTier: 'tier_1', monthlyRevenue: 8000 };
const EXPORT = JSON.stringify({ leads: [LEAD], accounts: [ACCOUNT] });

console.log('the export JSON shape');
const a = parseUpload(EXPORT);
t('reads the leads', a.leads.length, 1);
t('reads the accounts', a.accounts.length, 1);
t('is recorded as a manual snapshot', a.kind, 'manual');
t('and knows it was json', a.shape, 'json');
ok('keeps the fields the aggregates need', a.leads[0].rep === 'Noam' && a.leads[0].dateISO === '2026-09-01');

console.log('contact details never reach a snapshot');
// This app reports counts by rep and account. An email it stores is an email
// it can leak, and an upload is exactly where one would sneak in.
ok('the email is gone', !('email' in a.leads[0]));
ok('the phone is gone', !('phone' in a.leads[0]));
ok('no lead field holds an @ address',
  !JSON.stringify(a.leads).includes('buyer@acme.com'));

console.log('a nested export is still understood');
const nested = parseUpload(JSON.stringify({ data: { leads: [LEAD], accounts: [ACCOUNT] } }));
t('finds the leads inside data', nested.leads.length, 1);

console.log('a saved page payload');
const flight = `2:["$","div",null,{"children":"x"}]
3:{"leads":${JSON.stringify([LEAD])},"accounts":${JSON.stringify([ACCOUNT])}}`;
const f = parseUpload(flight);
t('reads the leads out of the payload', f.leads.length, 1);
t('and the accounts', f.accounts.length, 1);
t('and knows it was a payload', f.shape, 'flight');
ok('PII is stripped from that route too', !('email' in f.leads[0]));

console.log('an empty upload is refused, not stored');
throws('no leads is refused', () => parseUpload(JSON.stringify({ leads: [], accounts: [ACCOUNT] })), /blank the dashboard/);
throws('no accounts is refused', () => parseUpload(JSON.stringify({ leads: [LEAD], accounts: [] })), /blank the dashboard/);
throws('and it says nothing changed', () => parseUpload(JSON.stringify({ leads: [], accounts: [ACCOUNT] })), /Nothing has been changed/);

console.log('the wrong file is refused with something actionable');
throws('an empty file', () => parseUpload('   '), /empty/);
throws('truncated json', () => parseUpload('{"leads":[{"rep":"Noa'), /truncated|will not parse/);
throws('json with neither array', () => parseUpload('{"rows":[1,2,3]}'), /no "leads" or "accounts"/);
throws('leads present but not an array', () => parseUpload('{"leads":{},"accounts":[]}'), /no "leads" array/);
// A CSV is the most likely wrong file, and telling that person their session
// expired sends them to renew a cookie that was never the problem.
throws('a CSV is named as a CSV', () => parseUpload('rep,date,status\nNoam,2026-09-01,Interested'), /looks like a CSV/);
ok('and is not blamed on an expired session', (() => {
  try { parseUpload('rep,date,status\nNoam,2026-09-01,Interested'); return false; }
  catch (e) { return !/session expired/.test(e.message); }
})());
throws('an HTML page is named as a page', () => parseUpload('<!doctype html><html><body>nope</body></html>'), /saved web page/);
ok('HTML is not blamed on an expired session either', (() => {
  try { parseUpload('<!doctype html><html><body>nope</body></html>'); return false; }
  catch (e) { return !/session expired/.test(e.message); }
})());
// A real payload that HAS the dataset but is damaged should still get the
// parser's own diagnosis, because there the session really may have expired.
throws('a damaged real payload keeps the useful diagnosis',
  () => parseUpload('0:{"leads":[{"rep":"Noam"'), /Could not read that file/);
throws('rows that are not leads',
  () => parseUpload(JSON.stringify({ leads: [{ foo: 1 }], accounts: [ACCOUNT] })), /does not look like campaign leads/);
// A parser stack trace helps nobody who is trying to unblock a dashboard.
throws('no error leaks a stack trace', () => parseUpload('{"leads":[{"rep":"Noa'), /^(?!.*at Object).*$/s);

console.log('the snapshot says where the numbers came from');
const note = uploadNote({ email: 'edward@martalgroup.com', filename: 'campaign.json', shape: 'json' });
ok('names the person', /edward@martalgroup\.com/.test(note));
ok('names the file', /campaign\.json/.test(note));
ok('says it was manual', /manual upload/.test(note));
ok('survives a missing filename', /manual upload/.test(uploadNote({ email: 'x@y.com', shape: 'flight' })));

console.log('the upload lands on the same path as an automatic refresh');
const ingest = readFileSync(new URL('../lib/perf/ingest.js', import.meta.url), 'utf8');
// A second ingest route that parsed or stripped differently would drift, and
// the manual numbers would quietly stop matching the pulled ones.
ok('it reuses the shared flight parser', /import \{ parseFlight, stripPII \} from '\.\/source\.js'/.test(ingest));
ok('and strips PII inside validate, so no path can skip it', /const clean = stripPII\(/.test(ingest));

const route = readFileSync(new URL('../app/api/admin/upload/route.js', import.meta.url), 'utf8');
ok('the route writes through writeSnapshot', /writeSnapshot\(/.test(route));
ok('it is admin gated', /isAdminRole\(profile\.role\)/.test(route));
ok('it records the source as manual', /kind: 'manual'|kind === 'manual'|\.kind/.test(route));
ok('it does not re-implement parsing', !/parseFlight\(/.test(route));

if (failed) {
  console.error(`\n✗ manual upload: ${failed} check(s) failed`);
  process.exit(1);
}
console.log('\n✓ manual upload: same parser as the pull, PII stripped, an empty file cannot blank the dashboard');
