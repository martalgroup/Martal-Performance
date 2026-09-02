import Hero from '../../components/Hero';
import Stat from '../../components/Stat';
import PeriodPicker from '../../components/PeriodPicker';
import SourceNote from '../../components/SourceNote';
import { companyView } from '../../lib/perf/data';
import { getProfile } from '../../lib/supabase/server';
import { isAdminRole } from '../../lib/roles';
export const dynamic = 'force-dynamic';

const pct = (a, b) => (b ? `${a >= b ? '+' : ''}${(((a - b) / b) * 100).toFixed(1)}%` : '—');
const n = (x) => Number(x || 0).toLocaleString('en-US');

export default async function CompanyPage({ searchParams }) {
  const [{ ds, w, now, prev, prevToDate, inProgress, daysIn, daysTotal, series }, profile] = await Promise.all([companyView(searchParams), getProfile()]);
  const rises = series.slice(1).filter((p, i) => p.flip > series[i].flip).length;
  const cmp = inProgress ? prevToDate : prev;               // like-for-like baseline
  const cmpLabel = inProgress ? `vs prior period to day ${daysIn}` : 'vs prior period';
  return (
    <div>
      <Hero eyebrow={`${w.label} · ${inProgress ? `day ${daysIn} of ${daysTotal}` : 'period complete'}`}
            title={`Booked meetings ${pct(now.flip, cmp.flip)} ${cmpLabel}`}
            lede={`${n(now.flip)} booked meetings, ${n(now.sql)} SQLs and ${n(now.mql)} MQLs ${inProgress ? 'so far' : ''} this period. Meetings per MQL ${(now.mtgPerMql * 100).toFixed(1)}%.`}
            meta={`${rises} of the last ${series.length - 1} periods rose on meetings · SQLs include booked meetings${inProgress ? ` · prior full period: ${n(prev.flip)} meetings` : ''}`} />
      <SourceNote ds={ds} isAdmin={isAdminRole(profile?.role)} />
      <PeriodPicker base="/console" current={w} />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <Stat value={n(now.flip)} label="Booked meetings" note={`${pct(now.flip, cmp.flip)} ${cmpLabel}`} tone="green" />
        <Stat value={n(now.sql)} label="SQLs" note={`${pct(now.sql, cmp.sql)} ${cmpLabel} · incl. meetings`} tone="blue" />
        <Stat value={n(now.mql)} label="MQLs" note={`${pct(now.mql, cmp.mql)} ${cmpLabel}`} />
        <Stat value={`${(now.mtgPerMql * 100).toFixed(1)}%`} label="Meetings per MQL" note="conversion, not volume" tone="green" />
      </div>
      <div className="card">
        <h2 style={{ fontSize: 18, margin: '0 0 12px', borderLeft: '3px solid var(--mg-green-500)', paddingLeft: 10 }}>Period history</h2>
        <table className="list">
          <thead><tr><th>Period</th><th style={{ textAlign: 'right' }}>MQLs</th><th style={{ textAlign: 'right' }}>SQLs</th><th style={{ textAlign: 'right' }}>Meetings</th><th style={{ textAlign: 'right' }}>Mtg / MQL</th><th style={{ textAlign: 'right' }}>Undated</th></tr></thead>
          <tbody>{series.map((p) => (
            <tr key={p.start}><td>{p.label}</td><td style={{ textAlign: 'right' }}>{n(p.mql)}</td><td style={{ textAlign: 'right' }}>{n(p.sql)}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{n(p.flip)}</td><td style={{ textAlign: 'right' }}>{(p.mtgPerMql * 100).toFixed(1)}%</td><td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{n(p.undated)}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
