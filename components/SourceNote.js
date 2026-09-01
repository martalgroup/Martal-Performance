import RefreshButton from './RefreshButton';
const fmt = (iso) => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
export default function SourceNote({ ds, isAdmin }) {
  return (
    <div className="card-head" style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>
      <span>
        {ds.isBundled
          ? <><b style={{ color: 'var(--mg-blue-700)' }}>Bundled snapshot.</b> Full dataset captured {fmt(ds.pulledAt)}, not yet promoted to the shared record.</>
          : <>Source: campaign dashboard ({String(ds.source).replace('_', ' ')}) · {(ds.leadCount || ds.leads.length).toLocaleString('en-US')} leads · pulled {fmt(ds.pulledAt)}</>}
      </span>
      {isAdmin && <RefreshButton />}
    </div>
  );
}
