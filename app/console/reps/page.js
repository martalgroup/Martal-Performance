import Hero from '../../../components/Hero';
import PeriodPicker from '../../../components/PeriodPicker';
import SourceNote from '../../../components/SourceNote';
import { repsView } from '../../../lib/perf/data';
import { getProfile } from '../../../lib/supabase/server';
import { isAdminRole } from '../../../lib/roles';
export const dynamic = 'force-dynamic';
const n = (x) => Number(x || 0).toLocaleString('en-US');

export default async function RepsPage({ searchParams }) {
  const [{ ds, w, periods, table, history }, profile] = await Promise.all([repsView(searchParams), getProfile()]);
  const ranked = table.filter((r) => r.ranked);
  return (
    <div>
      <Hero eyebrow={w.label} title="Sales Reps" lede={`${ranked.length} ranked reps this period. Ranked by booked meetings, then SQLs, then MQLs.`} meta="Unattributed rows are counted in company totals but never ranked" />
      <SourceNote ds={ds} isAdmin={isAdminRole(profile?.role)} />
      <PeriodPicker base="/console/reps" current={w} />
      <div className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 18, margin: '0 0 12px', borderLeft: '3px solid var(--mg-green-500)', paddingLeft: 10 }}>This period</h2>
        <table className="list"><thead><tr><th>#</th><th>Rep</th><th style={{ textAlign: 'right' }}>Accounts</th><th style={{ textAlign: 'right' }}>MQLs</th><th style={{ textAlign: 'right' }}>SQLs (SQL 1)</th><th style={{ textAlign: 'right' }}>Booked meetings (SQL 2)</th></tr></thead>
          <tbody>{table.map((r) => (
            <tr key={r.rep} style={r.ranked ? undefined : { color: 'var(--text-muted)' }}><td>{r.rank ?? '—'}</td><td style={{ fontWeight: r.ranked ? 600 : 400 }}>{r.rep}</td><td style={{ textAlign: 'right' }}>{n(r.accounts)}</td><td style={{ textAlign: 'right' }}>{n(r.mql)}</td><td style={{ textAlign: 'right' }}>{n(r.sql)}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{n(r.flip)}</td></tr>
          ))}</tbody></table>
      </div>
      <div className="card">
        <h2 style={{ fontSize: 18, margin: '0 0 12px', borderLeft: '3px solid var(--mg-blue-500)', paddingLeft: 10 }}>Booked meetings (SQL 2) by rep · every period since Dec 16 2025</h2>
        <table className="list"><thead><tr><th>Rep</th>{periods.map((p) => <th key={p.start} style={{ textAlign: 'right' }}>{p.label}</th>)}</tr></thead>
          <tbody>{Object.entries(history).filter(([rep]) => rep !== 'Unattributed').sort((a, b) => b[1].at(-1)[0] - a[1].at(-1)[0]).map(([rep, rows]) => (
            <tr key={rep}><td style={{ fontWeight: 600 }}>{rep}</td>{rows.map((r, i) => <td key={i} style={{ textAlign: 'right' }}>{n(r[0])}</td>)}</tr>
          ))}</tbody></table>
      </div>
    </div>
  );
}
