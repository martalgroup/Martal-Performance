'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Select } from '../../../../components/ds/forms/Select.jsx';

const OPTIONS = [
  { value: 'user', label: 'Everyone' },
  { value: 'admin', label: 'Admins and super admins' },
  { value: 'super_admin', label: 'Super admins only' },
  { value: 'hidden', label: 'Hidden' },
];

// Who sees which tab. Super admins always see every tab regardless, so nothing
// here can lock the people who run the app out of it.
export default function TabsPanel({ tabs }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  async function set(href, minRole) {
    setBusy(href); setErr('');
    const r = await fetch('/api/admin/tabs', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ href, minRole }) });
    const d = await r.json().catch(() => ({}));
    setBusy('');
    if (!r.ok) { setErr(d.error || 'Could not save'); return; }
    router.refresh();
  }
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="section-label" style={{ marginBottom: 0 }}>Tabs</div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4, marginBottom: 12 }}>
        Who can see each tab in this app. Changes apply on the next page load, no deploy needed. Super admins always see everything.
      </p>
      {err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}
      <table className="list">
        <thead><tr><th>Tab</th><th>Visible to</th></tr></thead>
        <tbody>
          {tabs.map((t) => (
            <tr key={t.href}>
              <td style={{ fontWeight: 600 }}>{t.label}<span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8, fontSize: 12 }}>{t.href}</span></td>
              <td>
                {t.href === '/console/admin/users'
                  ? <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>Super admins only (fixed)</span>
                  : <Select value={t.min_role} disabled={busy === t.href} onChange={(e) => set(t.href, e.target.value)} options={OPTIONS} containerStyle={{ maxWidth: 260 }} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
