'use client';
import { useState } from 'react';
import { createClient } from '../../lib/supabase/client';
import { MartalMark } from '../../components/ds/brand/MartalMark.jsx';
import { DEFAULT_LOGIN_CONTENT, STAT_COLORS } from '../../lib/login-content';

// Split sign-in, matching the Academy's (martal-academy.vercel.app): dark
// branded hero on the left, sign-in on the right.
//
// The hero copy is deliberately the POSITIONING rather than a welcome message.
// Every AE sees this screen before every quote, so it is the cheapest place to
// keep repeating the one rule that matters commercially: the deliverable is a
// Sales Qualified Lead. Meetings are how an SQL converts, not the product. If
// that line is in their head when they open the pricing page, the quote and the
// call both come out right.
function Stat({ value, caption, color }) {
  return (
    <div className="login-stat">
      <div className="login-stat-v" style={{ color }}>{value}</div>
      <div className="login-stat-c">{caption}</div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function Lockup({ dark = false }) {
  return (
    <div className="login-lockup">
      <MartalMark style={{ height: 30, width: 30, color: dark ? 'var(--mg-charcoal)' : '#fff' }} />
      <span className="bar" style={dark ? { color: 'rgba(24,24,24,.2)' } : undefined}>|</span>
      <span className="name">Performance</span>
    </div>
  );
}

export default function LoginForm({ content = DEFAULT_LOGIN_CONTENT }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function signIn() {
    setBusy(true); setErr('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // No `hd` domain lock: it restricts Google's own account picker to a
        // single workspace, which would block @landbase.com sign-ins before
        // our callback could evaluate them. /auth/callback is the real gate —
        // it checks app_settings.allowed_domains plus per-email invites and
        // signs out anyone who doesn't qualify.
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) { setErr(error.message); setBusy(false); }
  }

  return (
    <main className="login-split">
      <section className="login-hero">
        <Lockup />

        <div>
          <p className="login-eyebrow">{content.eyebrow}</p>
          <h1 className="login-h1">{content.headline}</h1>
          <p className="login-sub">{content.subcopy}</p>

          <div className="login-stats">
            {content.stats.map((s, i) => (
              <Stat key={i} value={s.value} caption={s.caption}
                    color={STAT_COLORS[s.color] || STAT_COLORS.white} />
            ))}
          </div>
        </div>

        <p className="login-foot">{content.footer}</p>
      </section>

      <section className="login-pane">
        {/* Shown only where the hero is hidden, so the brand never disappears. */}
        <div style={{ marginBottom: 34 }} className="login-hide-lg">
          <Lockup dark />
        </div>

        <div className="login-card">
          <div className="login-badge">
            <MartalMark style={{ height: 20, width: 20, color: '#fff' }} />
          </div>

          <h2 className="login-h2">Welcome to Performance Intelligence</h2>
          <p className="login-p">
            Sign in to see how every rep and account is performing, period by period.
          </p>

          <button className="login-google" onClick={signIn} disabled={busy}>
            <GoogleIcon />
            {busy ? 'Redirecting…' : 'Continue with Google'}
          </button>

          {err && <div className="err" style={{ marginTop: 16 }}>{err}</div>}

          <div className="login-rule">
            <span className="line" />
            <span className="txt">@martalgroup.com &middot; @landbase.com &middot; or invited</span>
            <span className="line" />
          </div>

          <p className="login-fine">
            Access is limited to Martal Group and Landbase team members, plus addresses that
            have been invited. Figures here are computed from the campaign sheets.
          </p>
        </div>
      </section>
    </main>
  );
}
