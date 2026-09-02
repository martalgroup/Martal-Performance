// Runs the aggregation over the captured fixture so a change that breaks the
// math fails the build rather than the dashboard.
import { readFileSync } from 'fs';
import { periodFor, recentPeriods, preset, monthFor, lastCompleteMonth, recentMonths, periodsSince } from '../lib/perf/periods.js';
import { companyTotals, repTable, repHistory, churn, quality, NON_RANKED } from '../lib/perf/aggregate.js';

import { gunzipSync } from 'zlib';
const seed = JSON.parse(gunzipSync(readFileSync(new URL('../lib/perf/seed.json.gz', import.meta.url))).toString());
const fx = { leads: seed.leads, allAccountsMinimal: seed.accounts };
let failed = 0;
const t = (label, ok, extra = '') => { if (!ok) failed++; console.log(`  ${ok ? '✓' : '✗'} ${label}${extra ? '  ' + extra : ''}`); };

console.log('periods');
const p = periodFor(new Date('2026-09-01T12:00:00Z'));
t('Sep 1 sits in Aug 16 → Sep 15', p.start === '2026-08-16' && p.end === '2026-09-15', `${p.start}..${p.end}`);
const p2 = periodFor(new Date('2026-09-16T12:00:00Z'));
t('Sep 16 opens Sep 16 → Oct 15', p2.start === '2026-09-16' && p2.end === '2026-10-15');
const five = recentPeriods(5, new Date('2026-08-20T00:00:00Z'));
t('five periods back from Aug 20 start Apr 16 (Aug 16→Sep 15 is the open one)', five[0].start === '2026-04-16', five.map((x) => x.start).join(','));
t('preset last30 has 30-day span', (new Date(preset('last30').end) - new Date(preset('last30').start)) / 86400000 === 30);

const ps = periodsSince('2025-12-16', new Date('2026-09-01T00:00:00Z'));
t('periods since Dec 16 2025 through the open one = 9', ps.length === 9, ps.map((x) => x.start).join(','));
t('first is Dec 16 2025 → Jan 15 2026', ps[0].start === '2025-12-16' && ps[0].end === '2026-01-15');
t('last is the open Aug 16 → Sep 15', ps[8].start === '2026-08-16');

console.log('calendar months (churn)');
const m = monthFor(new Date('2026-09-01T12:00:00Z'));
t('Sep 1 is in Sep 1 → Sep 30', m.start === '2026-09-01' && m.end === '2026-09-30', `${m.start}..${m.end}`);
const lm = lastCompleteMonth(new Date('2026-09-01T12:00:00Z'));
t('last complete month on Sep 1 is Aug 1 → Aug 31', lm.start === '2026-08-01' && lm.end === '2026-08-31', `${lm.start}..${lm.end}`);
const feb = monthFor(new Date('2026-02-10T00:00:00Z'));
t('Feb 2026 ends on the 28th', feb.end === '2026-02-28');
const rm = recentMonths(3, new Date('2026-09-01T00:00:00Z'));
t('recent 3 months = Jul, Aug, Sep', rm.map((x) => x.start).join(',') === '2026-07-01,2026-08-01,2026-09-01');
t('month labels read as Mon YYYY', lm.label === 'Aug 2026', lm.label);

console.log('non-ranked SOMs');
{
  const w9 = { start: '2026-07-16', end: '2026-08-15' };
  const tbl = repTable(fx.leads, w9);
  const ang = tbl.find((r) => r.rep === 'Angela Hamilton'), pai = tbl.find((r) => r.rep === 'Paige Givinsky');
  t('Angela present but unranked', !!ang && ang.ranked === false && ang.rank === null, JSON.stringify(ang && { flip: ang.flip, rank: ang.rank }));
  t('Paige present but unranked', !!pai && pai.ranked === false && pai.rank === null, JSON.stringify(pai && { flip: pai.flip, rank: pai.rank }));
  t('no stray "Angela Hamlton" row', !tbl.some((r) => r.rep === 'Angela Hamlton'));
  const tot = companyTotals(fx.leads, w9); const sumRows = tbl.reduce((a, r) => a + r.flip, 0);
  t('company booked meetings still include them', tot.flip === sumRows, `${tot.flip} company vs ${sumRows} summed rows`);
  const ranked = tbl.filter((r) => r.ranked);
  t('ranks are 1..N over ranked reps only', ranked.every((r, i) => r.rank === i + 1), ranked.slice(0, 3).map((r) => r.rank + ':' + r.rep).join(', '));
}

console.log('aggregation over the bundled full snapshot');
const w = { start: '2026-07-16', end: '2026-08-15' };
const ct = companyTotals(fx.leads, w);
t('window totals are consistent (flip ⊆ sql ⊆ leads)', ct.flip <= ct.sql && ct.sql <= ct.leads, JSON.stringify({ leads: ct.leads, mql: ct.mql, sql: ct.sql, flip: ct.flip }));
t('every dated in-window lead counted exactly once', ct.leads === fx.leads.filter((l) => l.dateISO && l.dateISO >= w.start && l.dateISO <= w.end).length);
const reps = repTable(fx.leads, w);
t('rep table sums to company totals', reps.reduce((s, r) => s + r.flip, 0) === ct.flip && reps.reduce((s, r) => s + r.mql, 0) === ct.mql);
t('unranked rows are exactly Unattributed + the non-ranked SOMs', reps.every((r) => (r.rep === 'Unattributed' || NON_RANKED.has(r.rep)) === (r.rank === null)));
t('ranks are dense 1..n over ranked reps', reps.filter((r) => r.rank).map((r) => r.rank).join(',') === reps.filter((r) => r.rank).map((_, i) => i + 1).join(','));
const hist = repHistory(fx.leads, five);
const someRep = Object.keys(hist).find((k) => k !== 'Unattributed');
t('rep history is [mtg,sql,mql] × periods', hist[someRep].length === 5 && hist[someRep].every((x) => x.length === 3), someRep);

console.log('churn from account records');
const ch = churn(fx.allAccountsMinimal, { start: '2026-08-01', end: '2026-08-31' });
t('churned accounts have an end/churn date inside Aug 2026', ch.churned.every((a) => a.end >= '2026-08-01' && a.end <= '2026-08-31'), `${ch.churnedCount} churned, $${ch.churnedMrr.toLocaleString()} MRR`);
t('active count matches status filter', ch.activeCount === fx.allAccountsMinimal.filter((a) => a.status === 'Active').length, `${ch.activeCount} active, $${ch.activeMrr.toLocaleString()} MRR`);
t('started excludes MYT and MYT Lost', ch.started.every((a) => a.status !== 'MYT' && a.status !== 'MYT Lost'), `${ch.startedCount} started, $${ch.startedMrr.toLocaleString()} MRR`);
t('Questco (MYT Lost, $73,200) is not counted as started', !ch.started.some((a) => a.name === 'Questco'));
t('MYT Lost reported on its own line', ch.mytLost.some((a) => a.name === 'Questco'), `${ch.mytLostCount} lost before start, $${ch.mytLostMrr.toLocaleString()} MRR`);
t('churned excludes MYT Lost', ch.churned.every((a) => a.status !== 'MYT Lost'));

console.log('quality report');
const q = quality(fx.leads, fx.allAccountsMinimal);
t('reports undated + unattributed + future-dated', 'undated' in q && 'unattributed' in q && 'futureDated' in q, JSON.stringify({ undated: q.undated, unattributed: q.unattributed, future: q.futureDated, span: `${q.firstDate}..${q.lastDate}` }));

if (failed) { console.error(`\n✗ aggregate: ${failed} check(s) failed`); process.exit(1); }
console.log('✓ aggregate: periods, totals, rep tables, churn and quality all check out');
