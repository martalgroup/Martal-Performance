import { requireTab } from '../../../lib/perf/guard';
import { loadMarketingDataset } from '../../../lib/perf/dataroom';
import MarketingDashboard from './MarketingDashboard';

export const dynamic = 'force-dynamic';

// Same dashboard the marketing artifact laid out, same data (the Data Room's
// dataroom.perf_deals / perf_meetings / perf_spend), with the defects the
// 2026-09-22 audit found fixed rather than reproduced. See /console/methodology
// for what each figure divides by and where the originals went wrong.
export default async function MarketingPage() {
  await requireTab('/console/marketing');
  const dataset = await loadMarketingDataset();
  if (!dataset) {
    return (
      <div className="stack">
        <header className="page-head">
          <h1>Marketing</h1>
          <p className="muted">
            No dataset loaded yet in the Data Room. Load one at{' '}
            <a href="https://martal-data-room.vercel.app/admin">martal-data-room.vercel.app/admin</a>,
            or run its seed script, then reload this page.
          </p>
        </header>
      </div>
    );
  }
  return <MarketingDashboard dataset={dataset} />;
}
