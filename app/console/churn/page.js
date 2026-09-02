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
  const [{ ds, w, finance: fin, dashboard: dash, series, inProgress, open, financeSource }, profile] = await Promise.all([churnView(searchParams), getProfile()]);
  const n = (x) => (x == null ? '—' : Number(x).toLocaleString('en-US'));
  const net = fin && fin.deals_closed != null && fin.contracts_lost != null ? fin.deals_closed - fin.contracts_lost : null;
  return (
    <div>
      <Hero eyebrow={`${w.label} · ${inProgress ? `month in progress, day ${open.dayOfMonth}` : 'month complete'} · calendar month`}
            title="Company Churn"
            lede={fin
              ? `${n(fin.contracts_lost)} contracts lost in ${w.label}${fin.partial ? ' so far' : ''}. ${n(fin.deals_closed)} deals closed, ${n(fin.active_clients)} active clients at month end.`
              : `No finance figures recorded for ${w.label} yet.`}
            meta={`Finance basis: the cashflow workbook's contracts-lost row · churn is measured 1st to last day of the month · net accounts ${net == null ? '—' : (net >= 0 ? '+' : '') + net}`} />
      <SourceNote ds={ds} isAdmin={isAdminRole(profile?.role)} />
      <MonthPicker base="/console/churn" current={w} />
      {!inProgress && open.finance && (
        <div className="card" style={{ marginBottom: 18, borderLeft: '3px solid var(--mg-blue-500)' }}>
          <div className="card-head">
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>In progress · {open.w.label} · day {open.dayOfMonth}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{n(open.finance.contracts_lost)} contracts lost so far{open.dashboard.pendingCount ? ` · ${open.dashboard.pendingCount} churn pending in the campaign dashboard` : ''}</div>
            </div>
            <a href="/console/churn?m=open" className="btn btn--ghost" style={{ fontSize: 12, padding: '6px 12px', lineHeight: 1, textDecoration: 'none' }}>Current month</a>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <Stat value={n(fin?.contracts_lost)} label="Contracts lost" note="finance · cashflow sheet" tone="red" />
        <Stat value={n(fin?.deals_closed)} label="Deals closed" note="finance · cashflow sheet" tone="green" />
        <Stat value={n(fin?.active_clients)} label="Active clients" note="finance · at month end" tone="blue" />
        <Stat value={net == null ? '—' : `${net >= 0 ? '+' : ''}${net}`} label="Net accounts" note="closed minus lost" tone={net != null && net < 0 ? 'red' : 'plain'} />
      </div>
      <div className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 18, margin: '0 0 12px', borderLeft: '3px solid var(--mg-blue-500)', paddingLeft: 10 }}>Churn by month</h2>
        <table className="list"><thead><tr><th>Month</th><th style={{ textAlign: 'right' }}>Contracts lost</th><th style={{ textAlign: 'right' }}>Deals closed</th><th style={{ textAlign: 'right' }}>Net</th><th style={{ textAlign: 'right' }}>Active clients</th><th style={{ textAlign: 'right', color: 'var(--text-muted)' }}>Dashboard end-dates</th></tr></thead>
          <tbody>{[...series].reverse().map((p) => { const f = p.finance; const nn = f && f.deals_closed != null && f.contracts_lost != null ? f.deals_closed - f.contracts_lost : null; return (
            <tr key={p.start}><td>{p.label}{f?.partial ? ' (partial)' : ''}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{n(f?.contracts_lost)}</td><td style={{ textAlign: 'right' }}>{n(f?.deals_closed)}</td><td style={{ textAlign: 'right', fontWeight: 700, color: nn != null && nn < 0 ? '#a13b2f' : 'var(--mg-green-700)' }}>{nn == null ? '—' : (nn >= 0 ? '+' : '') + nn}</td><td style={{ textAlign: 'right' }}>{n(f?.active_clients)}</td><td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{p.dashboard.churnedCount}</td></tr>); })}</tbody></table>
      </div>
      <div className="card">
        <h2 style={{ fontSize: 18, margin: '0 0 4px', borderLeft: '3px solid var(--border-default)', paddingLeft: 10, color: 'var(--text-muted)' }}>Accounts with an end date in {w.label} · campaign dashboard ({dash.churnedCount})</h2>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 10px', paddingLeft: 13 }}>Detail only. The campaign dashboard marks accounts ended on a different basis than finance, so this count will not always equal contracts lost.</p>
        <table className="list"><thead><tr><th>Account</th><th>Tier</th><th>Owner</th><th>Started</th><th>Ended</th><th style={{ textAlign: 'right' }}>MRR</th></tr></thead>
          <tbody>{dash.churned.map((a) => (<tr key={a.name + a.end}><td>{a.name}</td><td>{a.tier || '—'}</td><td>{a.owner || '—'}</td><td>{a.start || '—'}</td><td>{a.end}</td><td style={{ textAlign: 'right' }}>{usd(a.mrr)}</td></tr>))}
          {dash.churned.length === 0 && <tr><td colSpan={6} style={{ color: 'var(--text-muted)', padding: 16 }}>None in this month.</td></tr>}</tbody></table>
      </div>
    </div>
  );
}
