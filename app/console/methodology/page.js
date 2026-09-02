import Hero from '../../../components/Hero';
import SourceNote from '../../../components/SourceNote';
import { loadDataset } from '../../../lib/perf/data';
import { quality } from '../../../lib/perf/aggregate';
import { getProfile } from '../../../lib/supabase/server';
import { isAdminRole } from '../../../lib/roles';
export const dynamic = 'force-dynamic';
const n = (x) => Number(x || 0).toLocaleString('en-US');

export default async function MethodologyPage() {
  const [ds, profile] = await Promise.all([loadDataset(), getProfile()]);
  const q = quality(ds.leads, ds.accounts);
  const Row = ({ k, v }) => <tr><td style={{ fontWeight: 600 }}>{k}</td><td>{v}</td></tr>;
  return (
    <div>
      <Hero eyebrow="How the numbers are made" title="Methodology" lede="Every figure comes from the campaign dashboard's normalised dataset. Nothing here re-derives a lead's status from text." meta="Periods run the 16th to the 15th · SQLs include booked meetings · MQLs are qualifying and objection handling" />
      <SourceNote ds={ds} isAdmin={isAdminRole(profile?.role)} />
      <div className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 18, margin: '0 0 12px', borderLeft: '3px solid var(--mg-green-500)', paddingLeft: 10 }}>Definitions</h2>
        <table className="list"><tbody>
          <Row k="Booked meeting" v="A lead whose status is a flip variant (Flipped, Flipped after obj, Meeting Booked, and so on). The deliverable that converts." />
          <Row k="SQL" v="Any booked meeting plus interest statuses (Interested in call, Interest in pricing). Meetings are a subset of SQLs." />
          <Row k="MQL" v="Qualifying and objection-handling statuses only. Dead dispositions (Not interested, No answer, DNC) are never counted." />
          <Row k="Unattributed" v="Leads logged with no rep. Counted in company totals, shown on the rep table, never ranked." />
          <Row k="Churn" v="Read from the account record's status and churn or end date, with its monthly revenue. Not inferred from lead activity. Measured on calendar months, 1st to last day." />
          <Row k="Started" v="Accounts whose start date falls in the month, excluding MYT (pre-start) and MYT Lost. Duplicate account rows in the source are counted once." />
          <Row k="Lost before start" v="MYT Lost accounts: lost during onboarding, never live. Reported separately; neither a start nor a churn." />
          <Row k="Two calendars" v="Performance and rep ranking run the 16th to the 15th. Churn runs the 1st to the last day of the month. They are not interchangeable." />
          <Row k="Campaign dashboard columns" v="MQLs → MQLs · SQL 1 → SQLs · SQL 2 → Booked meetings. Set both dashboards to the same dates and the three figures match to the unit." />
        </tbody></table>
      </div>
      <div className="card">
        <h2 style={{ fontSize: 18, margin: '0 0 12px', borderLeft: '3px solid var(--mg-blue-500)', paddingLeft: 10 }}>Data quality, this snapshot</h2>
        <table className="list"><tbody>
          <Row k="Leads / accounts" v={`${n(q.leads)} / ${n(q.accounts)}`} />
          <Row k="Date span" v={`${q.firstDate} → ${q.lastDate}`} />
          <Row k="Undated leads" v={`${n(q.undated)} (excluded from every period)`} />
          <Row k="Unattributed leads" v={n(q.unattributed)} />
          <Row k="Low-confidence dates" v={n(q.lowConfidenceDates)} />
          <Row k="Future-dated leads" v={`${n(q.futureDated)} (a typo upstream; excluded until the date passes)`} />
          <Row k="Account status" v={Object.entries(q.accountStatus).map(([k, v]) => `${k} ${n(v)}`).join(' · ')} />
        </tbody></table>
      </div>
    </div>
  );
}
