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
  const [{ ds, w, now, prev, prevToDate, inProgress, daysIn, daysTotal, series, open }, profile] = await Promise.all([companyView(searchParams), getProfile()]);
  const showOpenStrip = !inProgress && open.w.start !== w.start;
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
      {showOpenStrip && (
        <div className="card" style={{ marginBottom: 18, borderLeft: '3px solid var(--mg-blue-500)' }}>
          <div className="card-head">
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>In progress · {open.w.label} · day {open.daysIn} of {open.daysTotal}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>
                {n(open.now.flip)} booked meetings so far, {pct(open.now.flip, open.prevToDate.flip)} vs the prior period to day {open.daysIn}
                <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> · {n(open.now.sql)} SQLs · {n(open.now.mql)} MQLs</span>
              </div>
            </div>
            <a href="/console?p=open" className="btn btn--ghost" style={{ fontSize: 12, padding: '6px 12px', lineHeight: 1, textDecoration: 'none' }}>Open period</a>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <Stat value={n(now.flip)} label="Booked meetings (SQL 2)" note={`${pct(now.flip, cmp.flip)} ${cmpLabel}`} tone="green" />
        <Stat value={n(now.sql)} label="SQLs (SQL 1)" note={`${pct(now.sql, cmp.sql)} ${cmpLabel} · incl. meetings`} tone="blue" />
        <Stat value={n(now.mql)} label="MQLs" note={`${pct(now.mql, cmp.mql)} ${cmpLabel}`} />
        <Stat value={`${(now.mtgPerMql * 100).toFixed(1)}%`} label="Meetings per MQL" note="conversion, not volume" tone="green" />
      </div>
      <div className="card">
        <h2 style={{ fontSize: 18, margin: '0 0 12px', borderLeft: '3px solid var(--mg-green-500)', paddingLeft: 10 }}>Period history · since Dec 16 2025</h2>
        <table className="list">
          <thead><tr><th>Period</th><th style={{ textAlign: 'right' }}>MQLs</th><th style={{ textAlign: 'right' }}>SQLs (SQL 1)</th><th style={{ textAlign: 'right' }}>Booked meetings (SQL 2)</th><th style={{ textAlign: 'right' }}>Mtg / MQL</th><th style={{ textAlign: 'right' }}>Undated</th></tr></thead>
          <tbody>{[...series].reverse().map((p) => (
            <tr key={p.start}><td>{p.label}</td><td style={{ textAlign: 'right' }}>{n(p.mql)}</td><td style={{ textAlign: 'right' }}>{n(p.sql)}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{n(p.flip)}</td><td style={{ textAlign: 'right' }}>{(p.mtgPerMql * 100).toFixed(1)}%</td><td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{n(p.undated)}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
