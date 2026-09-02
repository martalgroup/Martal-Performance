import { redirect } from 'next/navigation';
import { canSee, homeFor } from '../../../lib/perf/access';
import Hero from '../../../components/Hero';
import Stat from '../../../components/Stat';
import MonthPicker from '../../../components/MonthPicker';
import SourceNote from '../../../components/SourceNote';
import { churnView } from '../../../lib/perf/data';
import { getProfile } from '../../../lib/supabase/server';
import { isAdminRole } from '../../../lib/roles';
export const dynamic = 'force-dynamic';
const usd = (x) => `$${Number(x || 0).toLocaleString('en-US')}`;

export default async function ChurnPage({ searchParams }) {
  const [{ ds, w, finance: fin, financePrev: prev, ratioRank, lowest, dashboard: dash, series, inProgress }, profile] = await Promise.all([churnView(searchParams), getProfile()]);
  if (!canSee(profile?.role, '/console/churn')) redirect(homeFor(profile?.role));
  const monthYear = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  // The title is the ratio plus its standing against every month on record,
  // recomputed from the sheet's figures. It never says more than the data does:
  // the churn sheet begins Dec 2022, so "on record" means since then.
  let title = 'Company Churn';
  if (fin?.mkt_churn_ratio != null) {
    const r = `${(Number(fin.mkt_churn_ratio) * 100).toFixed(2)}% churn`;
    if (lowest?.kind === 'record') title = `${r} · lowest on record since ${monthYear(lowest.since)}`;
    else if (lowest?.kind === 'since') title = `${r} · lowest since ${monthYear(lowest.since)}`;
    else title = r;
  }
  const n = (x) => (x == null ? '—' : Number(x).toLocaleString('en-US'));
  const pctf = (x) => (x == null ? '—' : `${(Number(x) * 100).toFixed(2)}%`);
  const monthName = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
  // The sentence Edd reads: this month's lost vs last month's, and where the
  // ratio ranks in the year. All computed from the marketing sheet's figures.
  let sentence = null;
  if (fin?.mkt_lost != null) {
    const vs = prev?.mkt_lost != null ? ` vs ${monthName(prev.month)}'s ${n(prev.mkt_lost)}` : '';
    const rank = ratioRank ? (ratioRank.rank === 1 ? `the lowest churn ratio of ${w.start.slice(0, 4)}` : ratioRank.rank === ratioRank.of ? `the highest churn ratio of ${w.start.slice(0, 4)}` : `the ${ordinal(ratioRank.rank)}-lowest churn ratio of ${w.start.slice(0, 4)}`) : null;
    sentence = `${n(fin.mkt_lost)} accounts lost in ${w.label}${vs}${rank ? `, ${rank} at ${pctf(fin.mkt_churn_ratio)}` : ` (${pctf(fin.mkt_churn_ratio)})`}.`;
  }
  const net = fin && fin.deals_closed != null && fin.mkt_lost != null ? fin.deals_closed - fin.mkt_lost : null;
  const disagree = fin && fin.contracts_lost != null && fin.mkt_lost != null && fin.contracts_lost !== fin.mkt_lost;
  return (
    <div>
      <Hero eyebrow={`Company Churn · ${w.label} · ${inProgress ? 'month in progress' : 'month complete'} · calendar month`}
            title={title}
            lede={sentence || `No churn measurement recorded for ${w.label} yet.`}
            meta={`Churn ratio = accounts lost ÷ prior month's active accounts · ${n(fin?.mkt_active_eom)} active at month end · ${n(fin?.deals_closed)} deals closed${disagree ? ` · cashflow sheet records ${n(fin.contracts_lost)} lost` : ''}`} />
      <SourceNote ds={ds} isAdmin={isAdminRole(profile?.role)} />
      <MonthPicker base="/console/churn" current={w} />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <Stat value={n(fin?.mkt_lost)} label="Accounts lost" note={prev?.mkt_lost != null ? `${monthName(prev.month)}: ${n(prev.mkt_lost)}` : 'marketing churn sheet'} tone="red" />
        <Stat value={pctf(fin?.mkt_churn_ratio)} label="Churn ratio" note={prev?.mkt_churn_ratio != null ? `${monthName(prev.month)}: ${pctf(prev.mkt_churn_ratio)}` : 'lost ÷ prior-month active'} tone={fin && prev && fin.mkt_churn_ratio < prev.mkt_churn_ratio ? 'green' : 'plain'} />
        <Stat value={n(fin?.mkt_active_eom)} label="Active accounts EOM" note="marketing churn sheet" tone="blue" />
        <Stat value={n(fin?.deals_closed)} label="Deals closed" note={`finance · net accounts ${net == null ? '—' : (net >= 0 ? '+' : '') + net}`} tone="green" />
      </div>
      <div className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 18, margin: '0 0 12px', borderLeft: '3px solid var(--mg-blue-500)', paddingLeft: 10 }}>Churn by month</h2>
        <table className="list"><thead><tr><th>Month</th><th style={{ textAlign: 'right' }}>Lost</th><th style={{ textAlign: 'right' }}>Churn ratio</th><th style={{ textAlign: 'right' }}>Active EOM</th><th style={{ textAlign: 'right' }}>Deals closed</th><th style={{ textAlign: 'right' }}>Net</th><th style={{ textAlign: 'right', color: 'var(--text-muted)' }}>Cashflow lost</th></tr></thead>
          <tbody>{[...series].reverse().map((p) => { const f = p.finance; const nn = f && f.deals_closed != null && f.mkt_lost != null ? f.deals_closed - f.mkt_lost : null; return (
            <tr key={p.start}><td>{p.label}{f?.partial ? ' (partial)' : ''}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{n(f?.mkt_lost)}</td><td style={{ textAlign: 'right' }}>{pctf(f?.mkt_churn_ratio)}</td><td style={{ textAlign: 'right' }}>{n(f?.mkt_active_eom)}</td><td style={{ textAlign: 'right' }}>{n(f?.deals_closed)}</td><td style={{ textAlign: 'right', fontWeight: 700, color: nn != null && nn < 0 ? '#a13b2f' : 'var(--mg-green-700)' }}>{nn == null ? '—' : (nn >= 0 ? '+' : '') + nn}</td><td style={{ textAlign: 'right', color: f && f.contracts_lost != null && f.mkt_lost != null && f.contracts_lost !== f.mkt_lost ? '#a13b2f' : 'var(--text-muted)' }}>{n(f?.contracts_lost)}</td></tr>); })}</tbody></table>
      </div>
      <div className="card">
        <h2 style={{ fontSize: 18, margin: '0 0 4px', borderLeft: '3px solid var(--border-default)', paddingLeft: 10, color: 'var(--text-muted)' }}>Accounts with an end date in {w.label} · campaign dashboard ({dash.churnedCount})</h2>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 10px', paddingLeft: 13 }}>Detail only. The campaign dashboard marks accounts ended on a different basis than the churn measurement, so this count will not always equal accounts lost.</p>
        <table className="list"><thead><tr><th>Account</th><th>Tier</th><th>Owner</th><th>Started</th><th>Ended</th><th style={{ textAlign: 'right' }}>MRR</th></tr></thead>
          <tbody>{dash.churned.map((a) => (<tr key={a.name + a.end}><td>{a.name}</td><td>{a.tier || '—'}</td><td>{a.owner || '—'}</td><td>{a.start || '—'}</td><td>{a.end}</td><td style={{ textAlign: 'right' }}>{usd(a.mrr)}</td></tr>))}
          {dash.churned.length === 0 && <tr><td colSpan={6} style={{ color: 'var(--text-muted)', padding: 16 }}>None in this month.</td></tr>}</tbody></table>
      </div>
    </div>
  );
}
const ordinal = (k) => k + (['th', 'st', 'nd', 'rd'][(k % 100 > 10 && k % 100 < 14) ? 0 : (k % 10 < 4 ? k % 10 : 0)]);
