import Link from 'next/link';
import { recentMonths } from '../lib/perf/periods';

// Churn is a calendar-month metric, so its picker is months, not the 16th→15th
// performance periods. Default is the last complete month; the current month
// is available but labelled as in progress.
export default function MonthPicker({ base, current }) {
  const months = recentMonths(7).reverse();
  const pill = (href, label, on) => (
    <Link key={href} href={href} className={on ? 'btn btn--primary' : 'btn btn--ghost'} style={{ fontSize: 12, padding: '6px 12px', lineHeight: 1, textDecoration: 'none' }}>{label}</Link>
  );
  return (
    <div className="btn-row" style={{ marginBottom: 16, alignItems: 'center' }}>
      {months.map((m, i) => pill(`${base}?m=${m.start.slice(0, 7)}`, i === 0 ? `${m.label} (current)` : m.label, current.start === m.start))}
    </div>
  );
}
