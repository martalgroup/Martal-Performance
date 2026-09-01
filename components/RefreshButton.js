'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export default function RefreshButton() {
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const router = useRouter();
  async function go() {
    setBusy(true); setMsg('');
    const r = await fetch('/api/refresh', { method: 'POST' }); const d = await r.json().catch(() => ({}));
    setBusy(false); setMsg(d.ok ? `Pulled ${d.leads.toLocaleString('en-US')} leads` : (d.error || 'Refresh failed'));
    if (d.ok) router.refresh();
  }
  return <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
    {msg && <span>{msg}</span>}
    <button className="btn btn--ghost" style={{ fontSize: 12, padding: '5px 12px', lineHeight: 1 }} disabled={busy} onClick={go}>{busy ? 'Refreshing…' : 'Refresh now'}</button>
  </span>;
}
