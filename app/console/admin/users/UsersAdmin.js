'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Switch } from '../../../../components/ds/forms/Switch.jsx';
import { Select } from '../../../../components/ds/forms/Select.jsx';
import { Badge } from '../../../../components/ds/core/Badge.jsx';
import AccessPanel from './AccessPanel';

// Compact, unambiguous, and stable regardless of who is looking: "2 Sep, 14:03"
// rather than a relative string that goes stale on a page left open. The full
// timestamp is on the title attribute for when the exact moment matters.
function when(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function Stamp({ iso, never }) {
  const label = when(iso);
  if (!label) {
    return <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{never}</span>;
  }
  return <span title={iso} style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{label}</span>;
}

export default function UsersAdmin({
  profiles, invites = [], allowedDomains = [], mailer = null, isSuperAdmin,
  currentUserId, currentEmail, lastSignIn = {}, lastActivity = {},
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');

  async function remove(user) {
    const warning = `Remove ${user.email}?\n\n`
      + 'They will be signed out and blocked from signing in again, even on an '
      + 'allowed domain. Any deals they created stay put.';
    if (!window.confirm(warning)) return;
    setBusy(true);
    setErr('');
    setNote('');
    const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error || 'Could not remove that user.'); return; }
    setNote(data.message || 'User removed.');
    router.refresh();
  }

  async function patch(userId, body) {
    setBusy(true);
    setErr('');
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error || 'Failed'); return; }
    router.refresh();
  }

  return (
    <div>
      <h1 style={{ fontSize: 20 }}>Users</h1>
      <p style={{ color: 'var(--text-muted)', marginTop: -6 }}>
        Accounts, roles and invites are shared with the Deal Room and the Academy: a change here applies
        everywhere. Which tabs each role can see in this app is set in the Tabs panel above.
      </p>
      <AccessPanel
        invites={invites}
        allowedDomains={allowedDomains}
        mailer={mailer}
        isSuperAdmin={isSuperAdmin}
        currentEmail={currentEmail}
      />

      <div className="section-label">Existing accounts</div>
      {err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}
      {note && (
        <div style={{
          marginBottom: 12, padding: '9px 12px', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--mg-green-200, #e2eecc)', background: 'var(--mg-green-50)',
          color: 'var(--mg-green-700)', fontSize: 13, lineHeight: 1.5,
        }}>{note}</div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <table className="list">
          <thead>
            <tr><th>Email</th><th>Name</th><th>Role</th><th>View all deals</th><th>Platform Pricing</th><th>Last sign-in</th><th>Last activity</th><th></th></tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id}>
                <td>{p.email}</td>
                <td>{p.full_name || '—'}</td>
                <td>
                  {isSuperAdmin ? (
                    <Select
                      value={p.role} disabled={busy} onChange={(e) => patch(p.id, { role: e.target.value })}
                      options={[{ value: 'user', label: 'user' }, { value: 'admin', label: 'admin' }, { value: 'super_admin', label: 'super_admin' }]}
                      containerStyle={{ maxWidth: 160 }}
                    />
                  ) : (
                    <>
                      <Badge tone="neutral" size="sm" style={{ marginRight: 8 }}>{p.role}</Badge>
                      {p.role === 'admin' && (
                        <button className="btn btn--ghost" disabled={busy} onClick={() => patch(p.id, { role: 'user' })}>Demote to user</button>
                      )}
                    </>
                  )}
                </td>
                <td>
                  {p.role === 'admin' || p.role === 'super_admin' ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>always (admin)</span>
                  ) : (
                    <Switch
                      checked={p.can_view_all}
                      disabled={busy}
                      onChange={(checked) => patch(p.id, { canViewAll: checked })}
                    />
                  )}
                </td>
                <td>
                  {p.role === 'admin' || p.role === 'super_admin' ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>always (admin)</span>
                  ) : (
                    <Switch
                      checked={p.can_view_platform}
                      disabled={busy}
                      onChange={(checked) => patch(p.id, { canViewPlatform: checked })}
                    />
                  )}
                </td>
                <td><Stamp iso={lastSignIn[p.id]} never="never" /></td>
                <td><Stamp iso={lastActivity[p.id]} never="no deals yet" /></td>
                <td style={{ textAlign: 'right' }}>
                  {p.id !== currentUserId && (
                    <button
                      className="btn btn--ghost"
                      style={{ fontSize: 12, padding: '5px 11px', lineHeight: 1 }}
                      disabled={busy}
                      onClick={() => remove(p)}
                    >Remove</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
