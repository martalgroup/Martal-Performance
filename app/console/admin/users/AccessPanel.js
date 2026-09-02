'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const ROLES = [
  { v: 'user', l: 'User — builds their own deals' },
  { v: 'admin', l: 'Admin — sees every deal, approves contracts' },
  { v: 'super_admin', l: 'Super admin — full control' },
];

function fmt(ts) {
  if (!ts) return null;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AccessPanel({ invites, allowedDomains, mailer, isSuperAdmin, currentEmail }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [canViewAll, setCanViewAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [pending, setPending] = useState(null);
  const [copied, setCopied] = useState(false);

  const [domains, setDomains] = useState(allowedDomains.join(', '));
  const [domainBusy, setDomainBusy] = useState(false);
  const [domainMsg, setDomainMsg] = useState(null);

  async function invite(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const res = await fetch('/api/admin/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role, canViewAll }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg({ kind: 'err', text: data.error || 'Could not send the invite.' }); return; }
    if (data.emailSent) {
      setMsg({ kind: 'ok', text: `Invited ${data.email} — the email is on its way from ${data.from}.` });
      setPending(null);
    } else {
      // No provider wired up (or the send failed). Access IS granted; hand over
      // a ready-to-send invite rather than pretending an email went out.
      setMsg({
        kind: 'warn',
        text: `${data.email} now has access, but no invite email was sent${data.emailError && data.mailerReady ? ` (${data.emailError})` : ''}. Send it yourself below — it will come from your own Martal address.`,
      });
      setPending({ email: data.email, mailto: data.mailto, loginUrl: data.loginUrl });
    }
    setEmail(''); setRole('user'); setCanViewAll(false);
    router.refresh();
  }

  async function revoke(addr) {
    if (!confirm(`Revoke access for ${addr}?`)) return;
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/admin/invites?email=${encodeURIComponent(addr)}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg({ kind: 'err', text: data.error || 'Revoke failed.' }); return; }
    setMsg(data.note ? { kind: 'warn', text: data.note } : { kind: 'ok', text: `Revoked ${addr}.` });
    router.refresh();
  }

  async function saveDomains(e) {
    e.preventDefault();
    setDomainBusy(true); setDomainMsg(null);
    const res = await fetch('/api/admin/domains', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domains: domains.split(',').map((d) => d.trim()).filter(Boolean) }),
    });
    const data = await res.json().catch(() => ({}));
    setDomainBusy(false);
    if (!res.ok) { setDomainMsg({ kind: 'err', text: data.error || 'Could not save.' }); return; }
    setDomainMsg({ kind: 'ok', text: `Saved. Anyone with a Google account on ${data.domains.map((d) => '@' + d).join(' or ')} can sign in.` });
    router.refresh();
  }

  const active = invites.filter((i) => !i.revoked_at);
  const revoked = invites.filter((i) => i.revoked_at);

  const note = (m) => m && (
    <div style={{
      fontSize: 13, lineHeight: 1.5, marginTop: 10, padding: '9px 12px', borderRadius: 'var(--radius-md)',
      border: `1px solid ${m.kind === 'err' ? '#e6b3ac' : m.kind === 'warn' ? '#f0d9b5' : 'var(--green-200)'}`,
      background: m.kind === 'err' ? '#fdf0ee' : m.kind === 'warn' ? '#fdf3e7' : 'var(--green-50)',
    }}>{m.text}</div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
      {/* ── domains ─────────────────────────────────────────────── */}
      <div className="card">
        <div className="section-label">Allowed email domains</div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.55 }}>
          Anyone with a Google account on these domains can sign in without an invite, and gets the
          <b> User</b> role on first login. This is the broadest control in the app — one domain here
          admits everybody on it.
        </p>
        {isSuperAdmin ? (
          <form onSubmit={saveDomains} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <input
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              placeholder="martalgroup.com, landbase.com"
              style={{
                flex: '1 1 300px', padding: '9px 11px', fontSize: 13,
                border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
              }}
            />
            <button className="btn btn--primary" disabled={domainBusy}>
              {domainBusy ? 'Saving…' : 'Save domains'}
            </button>
          </form>
        ) : (
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {allowedDomains.map((d) => (
              <span key={d} className="badge badge--neutral">@{d}</span>
            ))}
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)', alignSelf: 'center' }}>
              (super admin only)
            </span>
          </div>
        )}
        {note(domainMsg)}
      </div>

      {/* ── invite ──────────────────────────────────────────────── */}
      <div className="card">
        <div className="section-label">Invite someone, or pre-assign a role</div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.55 }}>
          For people outside the domains above: they get an email with a sign-in link, and can
          also just open the app and sign in with Google on that address.
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.55 }}>
          You can also use this to <b>set someone up as an Admin before they have ever logged in</b>,
          including on a domain above. Enter their address and pick Admin or Super admin: the role is
          held against that email and applied the moment they first sign in, so they never land as a
          plain User. No email is sent to someone who can already sign in.
        </p>
        <form onSubmit={invite} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="person@company.com"
            style={{
              flex: '1 1 240px', padding: '9px 11px', fontSize: 13,
              border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
            }}
          />
          <select
            value={role} onChange={(e) => setRole(e.target.value)}
            style={{
              flex: '0 1 250px', padding: '9px 11px', fontSize: 13,
              border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
            }}
          >
            {ROLES.filter((r) => r.v !== 'super_admin' || isSuperAdmin)
              .map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, padding: '9px 0' }}>
            <input type="checkbox" checked={canViewAll} onChange={(e) => setCanViewAll(e.target.checked)} />
            Can view all deals
          </label>
          <button className="btn btn--primary" disabled={busy || !email}>
            {busy ? 'Sending…' : 'Send invite'}
          </button>
        </form>
        {note(msg)}

        {pending && (
          <div style={{
            marginTop: 11, padding: '12px 13px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)', background: 'var(--surface-muted)',
          }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 9 }}>
              Send {pending.email} their invite
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a className="btn btn--primary" href={pending.mailto}
                 style={{ textDecoration: 'none', padding: '8px 14px', fontSize: 12.5 }}>
                Compose in my mail app
              </a>
              <button className="btn btn--ghost" style={{ padding: '8px 14px', fontSize: 12.5 }}
                onClick={() => {
                  navigator.clipboard?.writeText(pending.loginUrl);
                  setCopied(true); setTimeout(() => setCopied(false), 1800);
                }}>
                {copied ? 'Link copied' : 'Copy sign-in link'}
              </button>
            </div>
          </div>
        )}

        {!mailer?.ready && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 11, lineHeight: 1.55 }}>
            <b>Automatic sending is off.</b> Invites are prepared for you to send from your own
            address. To have the app email them directly as <b>{mailer?.from || 'Martal Deal Room'}</b>,
            add a <code>RESEND_API_KEY</code> environment variable.
          </div>
        )}
      </div>

      {/* ── outstanding invites ─────────────────────────────────── */}
      {(active.length > 0 || revoked.length > 0) && (
        <div className="card">
          <div className="section-label">Invited people</div>
          <table className="list">
            <thead>
              <tr><th>Email</th><th>Role</th><th>Status</th><th>Invited</th><th /></tr>
            </thead>
            <tbody>
              {active.map((i) => (
                <tr key={i.email}>
                  <td>{i.email}</td>
                  <td><span className="badge badge--neutral">{i.role}</span></td>
                  <td style={{ fontSize: 12.5 }}>
                    {i.accepted_at
                      ? <span style={{ color: 'var(--green-700)' }}>Signed in {fmt(i.accepted_at)}</span>
                      : i.email_error
                        ? <span title={i.email_error} style={{ color: '#8a5a12' }}>Invited · email failed</span>
                        : <span style={{ color: 'var(--text-muted)' }}>Invited · awaiting sign-in</span>}
                  </td>
                  <td style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{fmt(i.created_at)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn--ghost" style={{ padding: '5px 11px', fontSize: 12 }}
                      disabled={busy} onClick={() => revoke(i.email)}>Revoke</button>
                  </td>
                </tr>
              ))}
              {revoked.map((i) => (
                <tr key={i.email} style={{ opacity: 0.55 }}>
                  <td style={{ textDecoration: 'line-through' }}>{i.email}</td>
                  <td><span className="badge badge--neutral">{i.role}</span></td>
                  <td style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Revoked {fmt(i.revoked_at)}</td>
                  <td style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{fmt(i.created_at)}</td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
