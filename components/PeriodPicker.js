import Link from 'next/link';
import { recentPeriods } from '../lib/perf/periods';

// Period selection is a URL parameter, so a view can be linked and the server
// renders the right numbers without client state. Mirrors the campaign
// dashboard's presets so the two agree when compared.
export default function PeriodPicker({ base, current }) {
  const periods = recentPeriods(6).reverse();
  const presets = [['open', 'Open period'], ['last30', 'Last 30d'], ['last90', 'Last 90d'], ['last180', 'Last 180d'], ['thisMonth', 'This month']];
  const pill = (href, label, on) => (
    <Link key={href} href={href} className={on ? 'btn btn--primary' : 'btn btn--ghost'} style={{ fontSize: 12, padding: '6px 12px', lineHeight: 1, textDecoration: 'none' }}>{label}</Link>
  );
  return (
    <div className="btn-row" style={{ marginBottom: 16, alignItems: 'center' }}>
      {periods.map((p) => pill(`${base}?p=${p.start}`, p.label, current.start === p.start && current.end === p.end))}
      <span style={{ width: 1, height: 22, background: 'var(--border-default)', margin: '0 4px' }} />
      {presets.map(([k, l]) => pill(`${base}?p=${k}`, l, k === 'open' ? false : current.label === l))}
    </div>
  );
}
