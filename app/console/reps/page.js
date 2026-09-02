import { redirect } from 'next/navigation';
import Hero from '../../../components/Hero';
import PeriodPicker from '../../../components/PeriodPicker';
import SourceNote from '../../../components/SourceNote';
import Sparkline from '../../../components/Sparkline';
import { repsView } from '../../../lib/perf/data';
import { requireTab } from '../../../lib/perf/guard';
import { isAdminRole } from '../../../lib/roles';
import { canSee, homeFor } from '../../../lib/perf/access';
export const dynamic = 'force-dynamic';

const n = (x) => Number(x || 0).toLocaleString('en-US');
const delta = (a, b) => (b ? `${a >= b ? '+' : ''}${(((a - b) / b) * 100).toFixed(0)}%` : a ? 'new' : '—');
const initials = (name) => name.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
const MEDAL = ['#c9a227', '#9aa4ad', '#b87333'];   // gold, silver, bronze

function Move({ move, rank, prevRank }) {
  if (rank == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  if (prevRank == null) return <span className="badge badge--sent" style={{ fontSize: 9.5 }}>new</span>;
  if (!move) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>=</span>;
  const up = move > 0;
  return <span style={{ color: up ? 'var(--mg-green-700)' : '#a13b2f', fontWeight: 700, fontSize: 12.5, whiteSpace: 'nowrap' }}>{up ? '▲' : '▼'} {Math.abs(move)}</span>;
}

function Podium({ rows, cmpLabel }) {
  const top = rows.filter((r) => r.ranked).slice(0, 3);
  if (!top.length) return null;
  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', marginBottom: 18 }}>
      {top.map((r, i) => (
        <div key={r.rep} className="card" style={{ position: 'relative', overflow: 'hidden', padding: '22px 22px 18px' }}>
          <div style={{ position: 'absolute', inset: '0 0 auto 0', height: 4, background: i === 0 ? 'linear-gradient(90deg, var(--mg-green-500), var(--mg-blue-500))' : MEDAL[i] }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 15, color: '#fff',
              background: i === 0 ? 'var(--mg-charcoal)' : MEDAL[i] }}>{initials(r.rep)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>#{r.rank}{i === 0 ? ' · top rep' : ''}</div>
              <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.rep}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 16 }}>
            <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, letterSpacing: '-.03em', color: 'var(--mg-charcoal)', fontVariantNumeric: 'tabular-nums' }}>{n(r.flip)}</span>
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>booked meetings</span>
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 12.5, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            <span style={{ color: r.flip >= r.prevFlip ? 'var(--mg-green-700)' : '#a13b2f', fontWeight: 700 }}>{delta(r.flip, r.prevFlip)} {cmpLabel}</span>
            <span>{n(r.sql)} SQLs</span><span>{n(r.mql)} MQLs</span><span>{n(r.accounts)} accounts</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function RepsPage({ searchParams }) {
  const [{ ds, w, prev, inProgress, daysIn, periods, table, totals, history }, { profile }] = await Promise.all([repsView(searchParams), requireTab('/console/reps')]);
  const ranked = table.filter((r) => r.ranked);
  const top = ranked[0];
  const climbers = ranked.filter((r) => r.move > 0).length;
  const cmpLabel = inProgress ? `vs prior period to day ${daysIn}` : 'vs prior period';
  const lastIdx = periods.findIndex((p) => p.start === w.start);
  return (
    <div>
      <Hero eyebrow={`Sales Reps · ${w.label} · ${inProgress ? `day ${daysIn} of ${Math.round((new Date(w.end) - new Date(w.start)) / 86400000) + 1}` : 'period complete'}`}
            title={top ? `${top.rep} leads with ${n(top.flip)} booked meetings` : 'Sales Reps'}
            lede={`${ranked.length} ranked reps · ${n(totals.flip)} booked meetings, ${n(totals.sql)} SQLs, ${n(totals.mql)} MQLs across the team${climbers ? ` · ${climbers} rep${climbers === 1 ? '' : 's'} climbed the board` : ''}.`}
            meta={`Ranked by booked meetings (SQL 2), then SQLs (SQL 1), then MQLs · movement is ${cmpLabel} · Unattributed rows count for the company, never for a rep`} />
      <SourceNote ds={ds} isAdmin={isAdminRole(profile?.role)} />
      <PeriodPicker base="/console/reps" current={w} />
      <Podium rows={table} cmpLabel={cmpLabel} />
      <div className="card" style={{ padding: '8px 10px 10px' }}>
        <h2 style={{ fontSize: 18, margin: '10px 10px 12px', borderLeft: '3px solid var(--mg-green-500)', paddingLeft: 10 }}>Leaderboard</h2>
        <table className="list">
          <thead><tr>
            <th style={{ width: 44 }}>#</th><th>Rep</th><th style={{ width: 70 }}>Move</th>
            <th style={{ textAlign: 'right' }}>Booked meetings (SQL 2)</th><th style={{ textAlign: 'right' }}>{cmpLabel.replace('vs prior period', 'vs prior')}</th>
            <th style={{ textAlign: 'right' }}>SQLs (SQL 1)</th><th style={{ textAlign: 'right' }}>MQLs</th><th style={{ textAlign: 'right' }}>Accounts</th>
            <th style={{ textAlign: 'right', paddingRight: 14 }}>Since Dec 16 2025</th>
          </tr></thead>
          <tbody>
            {table.map((r) => {
              const hist = (history[r.rep] || []).map((x) => x[0]);
              return (
                <tr key={r.rep} style={r.ranked ? undefined : { color: 'var(--text-muted)' }}>
                  <td style={{ fontWeight: 800, color: r.rank && r.rank <= 3 ? MEDAL[r.rank - 1] : 'inherit' }}>{r.rank ?? '—'}</td>
                  <td style={{ fontWeight: r.ranked ? 700 : 400, whiteSpace: 'nowrap' }}>{r.rep}</td>
                  <td><Move move={r.move} rank={r.rank} prevRank={r.prevRank} /></td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{n(r.flip)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: r.flip >= r.prevFlip ? 'var(--mg-green-700)' : '#a13b2f' }}>{delta(r.flip, r.prevFlip)}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{n(r.sql)}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{n(r.mql)}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{n(r.accounts)}</td>
                  <td style={{ textAlign: 'right', paddingRight: 10 }}><div style={{ display: 'inline-block' }}><Sparkline values={hist.slice(0, lastIdx + 1)} color={r.ranked ? 'var(--mg-green-500)' : 'var(--mg-ink-400)'} /></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
