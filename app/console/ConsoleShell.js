'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MartalMark } from '../../components/ds/brand/MartalMark.jsx';
import SignOutButton from './SignOutButton';

// Left rail instead of a top bar: six items plus a brand lockup and a user chip
// no longer fit across the top. Collapses to icons, remembers the choice, and
// goes off-canvas on narrow screens.
//
// The collapse state is a per-viewer convenience, so localStorage is the right
// home for it — nothing server-side needs to know. Reads are wrapped because a
// private window or blocked site data makes the accessor itself throw.
const STORE_KEY = 'martal.performance.nav-collapsed';

const I = (props) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
       aria-hidden="true" focusable="false" {...props} />
);

const ICONS = {
  quotation: <I><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 13h6M9 17h4" /></I>,
  platform: <I><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></I>,
  deals: <I><rect x="2.5" y="7" width="19" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M2.5 12h19" /></I>,
  queue: <I><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 5-5" /></I>,
  users: <I><path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" /><circle cx="10" cy="7.5" r="3.5" /><path d="M17 11a3 3 0 1 0 0-6" /><path d="M20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35" /></I>,
  settings: <I><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .33 1.76l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.6 1.6 0 0 0 15 19.4a1.6 1.6 0 0 0-1 1.46V21a2 2 0 1 1-4 0v-.06A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.76.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 4.6 15a1.6 1.6 0 0 0-1.46-1H3a2 2 0 1 1 0-4h.06A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.33-1.76l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.6 1.6 0 0 0 9 4.6 1.6 1.6 0 0 0 10 3.14V3a2 2 0 1 1 4 0v.06A1.6 1.6 0 0 0 15 4.6a1.6 1.6 0 0 0 1.76-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.6 1.6 0 0 0 19.4 9v.06a1.6 1.6 0 0 0 1.46 1H21a2 2 0 1 1 0 4h-.06a1.6 1.6 0 0 0-1.54 1z" /></I>,
};

function Burger() {
  return <I width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" /></I>;
}

function initials(nameOrEmail) {
  const s = String(nameOrEmail || '').trim();
  if (!s) return '?';
  const local = s.includes('@') ? s.split('@')[0] : s;
  const parts = local.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  return local.slice(0, 2);
}

export default function ConsoleShell({ items, name, avatarUrl, children }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);      // mobile drawer
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORE_KEY) === '1');
    } catch { /* private window, blocked storage: keep the default */ }
    setReady(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      try { window.localStorage.setItem(STORE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }

  // Navigating on mobile should close the drawer, or the new page is hidden
  // behind it.
  useEffect(() => { setOpen(false); }, [pathname]);

  const brand = (
    <Link href="/console" className="sidenav-brand">
      <MartalMark style={{ height: 26, width: 26, color: '#fff', flex: '0 0 auto' }} />
      <span className="name">Performance</span>
    </Link>
  );

  return (
    <div className="shell" data-collapsed={ready && collapsed ? 'true' : 'false'} data-open={open ? 'true' : 'false'}>
      {/* mobile only */}
      <div className="shell-topbar">
        <button className="hamburger" onClick={() => setOpen(true)} aria-label="Open navigation">
          <Burger />
        </button>
        {brand}
      </div>

      <aside className="sidenav">
        <div className="sidenav-top">
          <button
            className="hamburger"
            onClick={() => (window.innerWidth < 900 ? setOpen(false) : toggleCollapsed())}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-expanded={!collapsed}
          >
            <Burger />
          </button>
          {brand}
        </div>

        <nav className="sidenav-items">
          {items.map((it) => {
            // Exact match, or a child route of it. Ordered longest-first by the
            // caller so /console/admin/users does not light up /console/admin.
            const active = pathname === it.href
              || (pathname.startsWith(`${it.href}/`) && !items.some(
                (o) => o !== it && o.href.length > it.href.length && pathname.startsWith(o.href),
              ));
            return (
              <Link
                key={it.href}
                href={it.href}
                className="sidenav-link"
                aria-current={active ? 'page' : undefined}
                title={it.label}
              >
                {ICONS[it.icon]}
                <span className="label">{it.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidenav-foot">
          <span className="sidenav-user" title={name}>
            {avatarUrl ? (
              // Plain <img>: Google serves avatars from lh3.googleusercontent.com,
              // which next/image would need whitelisted for a 26px decoration.
              <img className="appbar-avatar" src={avatarUrl} alt="" width={26} height={26}
                   referrerPolicy="no-referrer" style={{ height: 26, width: 26 }} />
            ) : (
              <span className="appbar-avatar appbar-avatar--fallback" aria-hidden="true"
                    style={{ height: 26, width: 26 }}>
                {initials(name)}
              </span>
            )}
            <span className="name">{name}</span>
          </span>
          <SignOutButton
            className="sidenav-signout"
            style={{
              justifyContent: 'center', padding: '7px 12px', fontSize: 12.5,
              lineHeight: 1, whiteSpace: 'nowrap', boxShadow: 'none', width: '100%',
            }}
          />
        </div>
      </aside>

      {open && <div className="shell-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

      <main className="shell-main">{children}</main>
    </div>
  );
}
