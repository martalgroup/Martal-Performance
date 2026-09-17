import RefreshButton from './RefreshButton';

const fmt = (iso) => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
const DAY = 86400000;
const utcDay = (d) => new Date(d).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / DAY);

// A snapshot can only speak for the days it actually covers, and for two weeks
// this app served a Sep 1 snapshot as the finished Aug 16 to Sep 15 period: 196
// booked meetings against the campaign dashboard's 317, rendered as a 49.5%
// collapse with nothing on screen to say the data stopped halfway through.
// The refresh cron had been failing silently since the seed was promoted.
//
// Age alone is a weak signal, so the load-bearing check is coverage: a period
// that has finished, reported from a snapshot pulled before it ended, is always
// wrong and always understates. Age is the secondary check for everything else.
function staleness(ds, w) {
  if (!ds?.pulledAt) return null;
  const pulled = utcDay(ds.pulledAt);
  const today = utcDay(Date.now());
  const ageDays = daysBetween(pulled, today);

  // The period is over and the snapshot never saw the end of it.
  if (w?.end && w.end < today && pulled < w.end) {
    return {
      tone: 'red',
      headline: `These numbers are incomplete. The snapshot stops ${daysBetween(pulled, w.end)} days before this period ended.`,
      detail: `Counts below only include leads logged up to ${pulled}, so every figure for this period understates. Read the real numbers off the campaign dashboard until a fresh snapshot lands.`,
    };
  }
  // Still running, but the snapshot is behind the days already elapsed.
  const short = w?.end ? daysBetween(pulled, w.end < today ? w.end : today) : ageDays;
  if (short >= 2 || ageDays >= 3) {
    return {
      tone: 'amber',
      headline: `Snapshot is ${ageDays} day${ageDays === 1 ? '' : 's'} old.`,
      detail: w?.end && short >= 2
        ? `The last ${short} days of this period are missing, so the figures below are behind the campaign dashboard.`
        : 'The daily refresh has not run, so the figures below are behind the campaign dashboard.',
    };
  }
  return null;
}

const TONES = {
  red: { fg: '#a13b2f', bg: '#fdf1ef', bd: '#f0cdc7' },
  amber: { fg: '#8a5a12', bg: '#fdf6e8', bd: '#f0e0bd' },
};

export default function SourceNote({ ds, isAdmin, w }) {
  const stale = staleness(ds, w);
  return (
    <>
      {stale && (
        <div role="status" style={{
          border: `1px solid ${TONES[stale.tone].bd}`, borderLeft: `3px solid ${TONES[stale.tone].fg}`,
          background: TONES[stale.tone].bg, borderRadius: 12, padding: '10px 14px', marginBottom: 12,
        }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: TONES[stale.tone].fg }}>{stale.headline}</div>
          <div style={{ fontSize: 12.5, color: TONES[stale.tone].fg, opacity: .85, marginTop: 3, lineHeight: 1.45 }}>
            {stale.detail}{' '}
            <a href="https://martal-campaign-dashboard.vercel.app/" target="_blank" rel="noreferrer"
               style={{ color: 'inherit', fontWeight: 600 }}>Open the campaign dashboard</a>
          </div>
        </div>
      )}
      <div className="card-head" style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>
        <span>
          {ds.isBundled
            ? <><b style={{ color: 'var(--mg-blue-700)' }}>Bundled snapshot.</b> Full dataset captured {fmt(ds.pulledAt)}, not yet promoted to the shared record.</>
            : <>Source: campaign dashboard ({String(ds.source).replace('_', ' ')}) · {(ds.leadCount || ds.leads.length).toLocaleString('en-US')} leads · pulled {fmt(ds.pulledAt)}</>}
        </span>
        {isAdmin && <RefreshButton />}
      </div>
    </>
  );
}
