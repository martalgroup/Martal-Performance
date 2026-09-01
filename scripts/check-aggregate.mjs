// Runs the aggregation over the captured fixture so a change that breaks the
// math fails the build rather than the dashboard.
import { readFileSync } from 'fs';
import { periodFor, recentPeriods, preset } from '../lib/perf/periods.js';
import { companyTotals, repTable, repHistory, churn, quality } from '../lib/perf/aggregate.js';

const fx = JSON.parse(readFileSync(new URL('../lib/perf/fixture.json', import.meta.url)));
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

console.log('aggregation over fixture (sampled 1-in-20 leads, all accounts)');
const w = { start: '2026-07-16', end: '2026-08-15' };
const ct = companyTotals(fx.leads, w);
t('window totals are consistent (flip ⊆ sql ⊆ leads)', ct.flip <= ct.sql && ct.sql <= ct.leads, JSON.stringify({ leads: ct.leads, mql: ct.mql, sql: ct.sql, flip: ct.flip }));
t('every dated in-window lead counted exactly once', ct.leads === fx.leads.filter((l) => l.dateISO && l.dateISO >= w.start && l.dateISO <= w.end).length);
const reps = repTable(fx.leads, w);
t('rep table sums to company totals', reps.reduce((s, r) => s + r.flip, 0) === ct.flip && reps.reduce((s, r) => s + r.mql, 0) === ct.mql);
t('Unattributed is present but unranked', reps.every((r) => (r.rep === 'Unattributed') === (r.rank === null)));
t('ranks are dense 1..n over ranked reps', reps.filter((r) => r.rank).map((r) => r.rank).join(',') === reps.filter((r) => r.rank).map((_, i) => i + 1).join(','));
const hist = repHistory(fx.leads, five);
const someRep = Object.keys(hist).find((k) => k !== 'Unattributed');
t('rep history is [mtg,sql,mql] × periods', hist[someRep].length === 5 && hist[someRep].every((x) => x.length === 3), someRep);

console.log('churn from account records');
const ch = churn(fx.allAccountsMinimal, w);
t('churned accounts have an end/churn date in window', ch.churned.every((a) => a.end >= w.start && a.end <= w.end), `${ch.churnedCount} churned, $${ch.churnedMrr.toLocaleString()} MRR`);
t('active count matches status filter', ch.activeCount === fx.allAccountsMinimal.filter((a) => a.status === 'Active').length, `${ch.activeCount} active, $${ch.activeMrr.toLocaleString()} MRR`);

console.log('quality report');
const q = quality(fx.leads, fx.allAccountsMinimal);
t('reports undated + unattributed + future-dated', 'undated' in q && 'unattributed' in q && 'futureDated' in q, JSON.stringify({ undated: q.undated, unattributed: q.unattributed, future: q.futureDated, span: `${q.firstDate}..${q.lastDate}` }));

if (failed) { console.error(`\n✗ aggregate: ${failed} check(s) failed`); process.exit(1); }
console.log('✓ aggregate: periods, totals, rep tables, churn and quality all check out');
