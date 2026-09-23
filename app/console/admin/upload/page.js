import { requireTab } from '../../../../lib/perf/guard';
import { latestSnapshotMeta } from '../../../../lib/perf/cache';
import { sourceKind } from '../../../../lib/perf/source';
import UploadPanel from './UploadPanel';

export const dynamic = 'force-dynamic';

// Load the numbers by hand when the automatic pull cannot.
//
// The pull has two failure modes an admin cannot fix from inside the app:
// CAMPAIGN_EXPORT_URL was never set, and the RSC stopgap dies whenever
// CAMPAIGN_SESSION_COOKIE expires. Both leave the dashboard frozen on whatever
// it last managed to fetch, with a Refresh button that only ever errors. This
// page is the way out, and it is also the honest place to say which of those
// two is currently true.
export default async function UploadPage() {
  const { profile } = await requireTab('/console/admin/upload');
  const [meta] = await Promise.all([latestSnapshotMeta()]);
  const kind = sourceKind();

  const age = meta?.pulled_at
    ? Math.round((Date.now() - new Date(meta.pulled_at).getTime()) / 36e5)
    : null;

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1>Upload data</h1>
        <p className="muted">
          Load the campaign dashboard&rsquo;s dataset by hand. It lands exactly where an
          automatic refresh would, so the numbers are read the same way afterwards.
        </p>
      </header>

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="section-label">Where the numbers stand</div>
        {meta ? (
          <div>
            <div className="kv-row"><span className="kv-label">Last loaded</span><span className="kv-value">
              {new Date(meta.pulled_at).toLocaleString()}
              {age != null && <span className="muted"> ({age < 48 ? `${age}h ago` : `${Math.round(age / 24)}d ago`})</span>}
            </span></div>
            <div className="kv-row"><span className="kv-label">How</span><span className="kv-value">
              {meta.source === 'manual' ? 'Uploaded by hand'
                : meta.source === 'export_route' ? 'Automatic, export route'
                : 'Automatic, saved session'}
            </span></div>
            <div className="kv-row"><span className="kv-label">Covers</span><span className="kv-value">{meta.first_date || '?'} to {meta.last_date || '?'}</span></div>
            <div className="kv-row"><span className="kv-label">Size</span><span className="kv-value">
              {meta.lead_count?.toLocaleString()} leads, {meta.account_count?.toLocaleString()} accounts
            </span></div>
            {meta.notes && <div className="kv-row"><span className="kv-label">Note</span><span className="kv-value muted">{meta.notes}</span></div>}
          </div>
        ) : (
          <p className="muted">Nothing has ever been loaded, so the dashboard has no numbers yet.</p>
        )}
      </section>

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="section-label">Automatic refresh</div>
        {kind === 'export_route' ? (
          <p className="muted">
            Configured against the campaign dashboard&rsquo;s export route. Refresh should
            work on its own, and this page is a fallback.
          </p>
        ) : kind === 'rsc_stopgap' ? (
          <p className="muted">
            Running on the stopgap: it signs in with a saved session cookie, which expires
            every few weeks and cannot be renewed from in here. When Refresh starts failing,
            upload the file below rather than waiting for the cookie to be replaced.
          </p>
        ) : (
          <p className="err" style={{ margin: 0 }}>
            No automatic source is configured, so <b>Refresh will always fail</b>. Until
            either <code>CAMPAIGN_EXPORT_URL</code> or <code>CAMPAIGN_SESSION_COOKIE</code>
            {' '}is set on this project, uploading here is the only way to update the numbers.
          </p>
        )}
      </section>

      <UploadPanel email={profile.email} hasExisting={!!meta} />
    </div>
  );
}
