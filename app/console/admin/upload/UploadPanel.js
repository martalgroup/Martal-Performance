'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// Pick a file, or paste the text. Both post to the same route.
//
// Paste is here because the fastest way to get the dataset out of the campaign
// dashboard is often the browser console, and making someone save that to a
// file first is a step that buys nothing. The file picker is the normal path.
export default function UploadPanel({ email, hasExisting }) {
  const router = useRouter();
  const fileRef = useRef(null);
  const [mode, setMode] = useState('file');
  const [text, setText] = useState('');
  const [chosen, setChosen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const sizeOf = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

  async function send() {
    setBusy(true); setResult(null);
    try {
      let res;
      if (mode === 'file') {
        const file = fileRef.current?.files?.[0];
        if (!file) { setResult({ bad: true, text: 'Choose a file first.' }); setBusy(false); return; }
        const body = new FormData();
        body.append('file', file);
        res = await fetch('/api/admin/upload', { method: 'POST', body });
      } else {
        if (!text.trim()) { setResult({ bad: true, text: 'Paste the data first.' }); setBusy(false); return; }
        res = await fetch('/api/admin/upload', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text, filename: 'pasted' }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setResult({ bad: true, text: data.error || 'Upload failed.' }); setBusy(false); return; }
      setResult({
        bad: false,
        text: `Loaded ${data.leads.toLocaleString()} leads and ${data.accounts.toLocaleString()} accounts. `
          + 'Every page is now reading this data.',
      });
      setText(''); setChosen(null);
      if (fileRef.current) fileRef.current.value = '';
      router.refresh();
    } catch (e) {
      setResult({ bad: true, text: `Upload failed: ${e.message}` });
    }
    setBusy(false);
  }

  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <div className="section-label">Load a new dataset</div>

      <div style={{ display: 'flex', gap: 18, marginBottom: 14, flexWrap: 'wrap' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, cursor: 'pointer' }}>
          <input type="radio" checked={mode === 'file'} onChange={() => setMode('file')} /> Upload a file
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, cursor: 'pointer' }}>
          <input type="radio" checked={mode === 'paste'} onChange={() => setMode('paste')} /> Paste the data
        </label>
      </div>

      {mode === 'file' ? (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.txt,application/json,text/plain"
            onChange={(e) => setChosen(e.target.files?.[0] || null)}
          />
          {chosen && (
            <p className="muted" style={{ marginTop: 8 }}>
              {chosen.name}, {sizeOf(chosen.size)}
            </p>
          )}
        </div>
      ) : (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          spellCheck={false}
          placeholder='{"leads":[…],"accounts":[…]}'
          style={{ width: '100%', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5 }}
        />
      )}

      <div className="btn-row" style={{ marginTop: 14, alignItems: 'center' }}>
        <button className="btn btn--primary" onClick={send} disabled={busy}>
          {busy ? 'Loading…' : 'Load data'}
        </button>
        <span className="muted" style={{ fontSize: 12.5 }}>
          Saved against {email}
        </span>
      </div>

      {result && (
        <div className={result.bad ? 'err' : 'ok'} style={{ marginTop: 14 }}>{result.text}</div>
      )}

      <details style={{ marginTop: 18 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13.5, fontWeight: 600 }}>
          What file do I need?
        </summary>
        <div className="muted" style={{ fontSize: 13, lineHeight: 1.65, marginTop: 10 }}>
          <p>Either of these works:</p>
          <ol style={{ paddingLeft: 18 }}>
            <li>
              <b>The export JSON.</b> An object with a <code>leads</code> array and an
              {' '}<code>accounts</code> array. This is the clean option.
            </li>
            <li>
              <b>The campaign dashboard&rsquo;s own page payload.</b> Open the dashboard signed
              in, and in the browser console run:
              <pre style={{ fontSize: 11.5, overflowX: 'auto', background: 'rgba(0,0,0,.05)', padding: 10, borderRadius: 8 }}>
{`copy(await (await fetch('/', {headers:{RSC:'1'}})).text())`}
              </pre>
              That puts the whole payload on your clipboard. Paste it above.
            </li>
          </ol>
          <p>
            Contact details are stripped before anything is saved: this dashboard counts
            leads by rep and account and never needs an email address.
            {hasExisting && ' The current data stays untouched if the file cannot be read.'}
          </p>
        </div>
      </details>
    </section>
  );
}
