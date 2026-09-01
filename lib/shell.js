// The sign-in and denied screens, in the Deal Room / Academy visual language.
//
// The login CSS in lib/login.css is lifted verbatim from the Deal Room's
// globals.css rather than reimplemented, so the two screens cannot drift. Only
// the handful of design tokens it references are redeclared here, because this
// app does not carry the whole design system.
const { readFileSync } = require('fs');
const { join } = require('path');

let LOGIN_CSS = null;
const loginCss = () => (LOGIN_CSS ??= readFileSync(join(process.cwd(), 'lib/login.css'), 'utf8'));

const TOKENS = `
:root{
  --mg-charcoal:#181818; --mg-green-500:#80b122; --mg-green-700:#557519;
  --mg-blue-300:#8ecdee; --mg-blue-500:#2d9cdb;
  --mg-ink-100:#e9e9ea; --mg-ink-400:#8a8a8f; --mg-ink-500:#6d6d72;
  --text-strong:#181818; --text-muted:#5a6169;
  --border-subtle:#e9e9ea; --border-default:#dcdcdc;
  --radius-pill:999px;
}
*{box-sizing:border-box}
body{margin:0;font-family:'Montserrat',system-ui,-apple-system,sans-serif;color:var(--text-strong);background:#fbfbfa}
a{color:inherit}
`;

const GOOGLE_ICON = `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;

const MARK = (color = '#fff', size = 30) =>
  `<svg viewBox="0 0 100 100" width="${size}" height="${size}" fill="none" aria-hidden="true">
     <path d="M50 12 L88 88 H70 L50 44 L30 88 H12 Z" fill="${color}"/></svg>`;

function page({ title, body }) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>${TOKENS}${loginCss()}</style></head><body>${body}</body></html>`;
}

/** Split sign-in: dark branded hero left, Google button right. */
function signInPage() {
  return page({
    title: 'Sign in \u00b7 Martal Performance Intelligence',
    body: `<main class="login-split">
  <section class="login-hero">
    <div class="login-lockup">${MARK()}<span class="bar">|</span>
      <span class="name">Performance</span></div>
    <div>
      <p class="login-eyebrow">Internal use only</p>
      <h1 class="login-h1">The numbers behind every rep, every period.</h1>
      <p class="login-sub">Booked meetings, SQLs and MQLs by rep and by period, reconciled to the campaign sheets.</p>
      <div class="login-stats">
        <div class="login-stat"><div class="login-stat-v" style="color:#80b122">392</div>
          <div class="login-stat-c">Booked meetings, 7/16&ndash;8/15</div></div>
        <div class="login-stat"><div class="login-stat-v" style="color:#8ecdee">+68%</div>
          <div class="login-stat-c">Since March, five straight rises</div></div>
        <div class="login-stat"><div class="login-stat-v" style="color:#fff">36</div>
          <div class="login-stat-c">Ranked reps</div></div>
      </div>
    </div>
    <p class="login-foot">Martal Group &middot; Performance Intelligence</p>
  </section>

  <section class="login-pane">
    <div style="margin-bottom:34px" class="login-hide-lg">${MARK('var(--mg-charcoal)', 28)}</div>
    <div class="login-card">
      <div class="login-badge">${MARK('#fff', 20)}</div>
      <h2 class="login-h2">Performance Intelligence</h2>
      <p class="login-p">Sign in to see booked meetings, SQLs and MQLs by rep and by period.</p>
      <a class="login-google" href="/api/login">${GOOGLE_ICON}Continue with Google</a>
      <div class="login-rule">
        <span class="line"></span>
        <span class="txt">@martalgroup.com &middot; @landbase.com &middot; or invited</span>
        <span class="line"></span>
      </div>
      <p class="login-fine">Access is limited to Martal Group and Landbase team members, plus addresses that
        have been invited. This dashboard carries rep-level performance and churn data.</p>
    </div>
  </section>
</main>`,
  });
}

/** Shown when a valid Google account is not on the allow list. */
function deniedPage(email) {
  return page({
    title: 'No access \u00b7 Martal Performance Intelligence',
    body: `<main class="login-split">
  <section class="login-pane" style="grid-column:1/-1">
    <div class="login-card">
      <div class="login-badge">${MARK('#fff', 20)}</div>
      <h2 class="login-h2">You do not have access</h2>
      <p class="login-p">${email ? `<b>${email}</b> is not on the access list.` : 'That account is not on the access list.'}
        This dashboard is open to Martal Group and Landbase accounts, or to an address that has been invited.</p>
      <a class="login-google" href="/api/logout">Try a different account</a>
      <p class="login-fine">Ask Edd if you should have access.</p>
    </div>
  </section>
</main>`,
  });
}

module.exports = { signInPage, deniedPage, page };
