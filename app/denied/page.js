import { createAdminClient } from '../../lib/supabase/admin';
import { DEFAULT_ALLOWED_DOMAINS } from '../../lib/access';
import { Logo } from '../../components/ds/brand/Logo.jsx';
import { GlassCard } from '../../components/ds/surfaces/GlassCard.jsx';
import DeniedActions from './DeniedActions';

export const dynamic = 'force-dynamic';

// The copy here is generated from the live allowlist, not hardcoded. It used to
// read "restricted to @martalgroup.com accounts", which was wrong the moment
// @landbase.com was allowed — and it was the message a legitimately-invited
// person saw, telling them they could never get in.
export default async function Denied({ searchParams }) {
  let domains = DEFAULT_ALLOWED_DOMAINS;
  try {
    const { data } = await createAdminClient()
      .from('app_settings').select('allowed_domains').maybeSingle();
    if (data?.allowed_domains?.length) domains = data.allowed_domains;
  } catch {
    // fall back to the static list — never render an empty sentence
  }

  const isError = searchParams?.reason === 'error';
  const list = domains.map((d) => `@${d}`);
  const domainSentence = list.length === 1
    ? list[0]
    : `${list.slice(0, -1).join(', ')} or ${list[list.length - 1]}`;

  return (
    <div className="center">
      <GlassCard tone="light" blur="lg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div className="logo" style={{ width: 52, height: 52, padding: 12 }}>
          <Logo variant="symbol" theme="white" height={28} assetBase="/" />
        </div>

        {isError ? (
          <>
            <h1 style={{ margin: 0 }}>Couldn&apos;t verify your access</h1>
            <p style={{ color: 'var(--text-muted)', maxWidth: 430, lineHeight: 1.6 }}>
              Something went wrong checking whether you&apos;re allowed in, so we didn&apos;t let the
              sign-in through. This is on our side, not yours — try again in a moment.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ margin: 0 }}>Access not enabled</h1>
            <p style={{ color: 'var(--text-muted)', maxWidth: 430, lineHeight: 1.6 }}>
              Performance Intelligence is open to {domainSentence} Google accounts, plus anyone who has been
              invited individually.
            </p>
            <p style={{ color: 'var(--text-muted)', maxWidth: 430, lineHeight: 1.6, fontSize: 13 }}>
              If you were invited, make sure you picked the <b>same Google account</b> the invite was
              sent to — signing in with a personal account instead is the usual cause. Otherwise ask
              Edd to add you.
            </p>
          </>
        )}

        <DeniedActions />
      </GlassCard>
    </div>
  );
}
