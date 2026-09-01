import Hero from '../../../components/Hero';
import Stat from '../../../components/Stat';
import PeriodPicker from '../../../components/PeriodPicker';
import SourceNote from '../../../components/SourceNote';
import { churnView } from '../../../lib/perf/data';
import { getProfile } from '../../../lib/supabase/server';
import { isAdminRole } from '../../../lib/roles';
export const dynamic = 'force-dynamic';
const usd = (x) => `$${Number(x || 0).toLocaleString('en-US')}`;

export default async function ChurnPage({ searchParams }) {
  const [{ ds, w, churn, series }, profile] = await Promise.all([churnView(searchParams), getProfile()]);
  return (
    <div>
      <Hero eyebrow={w.label} title="Company Churn" lede={`${churn.churnedCount} accounts churned this period, ${usd(churn.churnedMrr)} in monthly revenue. ${churn.startedCount} started, ${usd(churn.startedMrr)}.`} meta={`Net monthly revenue ${churn.netMrr >= 0 ? '+' : ''}${usd(churn.netMrr)} · ${churn.activeCount} active accounts · ${churn.pendingCount} churn pending`} />
      <SourceNote ds={ds} isAdmin={isAdminRole(profile?.role)} />
      <PeriodPicker base="/console/churn" current={w} />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <Stat value={churn.churnedCount} label="Churned" note={usd(churn.churnedMrr) + ' MRR'} tone="red" />
        <Stat value={churn.startedCount} label="Started" note={usd(churn.startedMrr) + ' MRR'} tone="green" />
        <Stat value={churn.activeCount} label="Active" note={usd(churn.activeMrr) + ' MRR'} tone="blue" />
        <Stat value={churn.pendingCount} label="Churn pending" note={usd(churn.pendingMrr) + ' MRR at risk'} />
      </div>
      <div className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 18, margin: '0 0 12px', borderLeft: '3px solid #a13b2f', paddingLeft: 10 }}>Churned this period</h2>
        <table className="list"><thead><tr><th>Account</th><th>Tier</th><th>Owner</th><th>SOM</th><th>Started</th><th>Ended</th><th style={{ textAlign: 'right' }}>MRR</th></tr></thead>
          <tbody>{churn.churned.map((a) => (<tr key={a.name + a.end}><td style={{ fontWeight: 600 }}>{a.name}</td><td>{a.tier || '—'}</td><td>{a.owner || '—'}</td><td>{a.soms.join(', ') || '—'}</td><td>{a.start || '—'}</td><td>{a.end}</td><td style={{ textAlign: 'right' }}>{usd(a.mrr)}</td></tr>))}
          {churn.churned.length === 0 && <tr><td colSpan={7} style={{ color: 'var(--text-muted)', padding: 16 }}>No churn recorded in this window.</td></tr>}</tbody></table>
      </div>
      <div className="card">
        <h2 style={{ fontSize: 18, margin: '0 0 12px', borderLeft: '3px solid var(--mg-blue-500)', paddingLeft: 10 }}>Churn by period</h2>
        <table className="list"><thead><tr><th>Period</th><th style={{ textAlign: 'right' }}>Churned</th><th style={{ textAlign: 'right' }}>MRR lost</th><th style={{ textAlign: 'right' }}>Started</th><th style={{ textAlign: 'right' }}>MRR added</th><th style={{ textAlign: 'right' }}>Net</th></tr></thead>
          <tbody>{series.map((p) => (<tr key={p.start}><td>{p.label}</td><td style={{ textAlign: 'right' }}>{p.churnedCount}</td><td style={{ textAlign: 'right' }}>{usd(p.churnedMrr)}</td><td style={{ textAlign: 'right' }}>{p.startedCount}</td><td style={{ textAlign: 'right' }}>{usd(p.startedMrr)}</td><td style={{ textAlign: 'right', fontWeight: 700, color: p.netMrr < 0 ? '#a13b2f' : 'var(--mg-green-700)' }}>{p.netMrr >= 0 ? '+' : ''}{usd(p.netMrr)}</td></tr>))}</tbody></table>
      </div>
    </div>
  );
}
