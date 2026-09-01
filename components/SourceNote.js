import RefreshButton from './RefreshButton';
const fmt = (iso) => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
export default function SourceNote({ ds, isAdmin }) {
  return (
    <div className="card-head" style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>
      <span>
        {ds.isSample
          ? <><b style={{ color: '#a13b2f' }}>Sample data.</b> No live pull yet; showing a 1-in-20 sample captured {fmt(ds.pulledAt)}.</>
          : <>Source: campaign dashboard ({ds.source.replace('_', ' ')}) · {ds.leadCount?.toLocaleString('en-US') || ds.leads.length.toLocaleString('en-US')} leads · pulled {fmt(ds.pulledAt)}</>}
      </span>
      {isAdmin && <RefreshButton />}
    </div>
  );
}
