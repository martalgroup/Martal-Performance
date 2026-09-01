'use client';
import { createClient } from '../../lib/supabase/client';

export default function SignOutButton({ style, className = '' }) {
  async function out() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }
  return (
    <button
      className={`btn btn--ghost ${className}`.trim()}
      style={style}
      onClick={out}
      title="Sign out"
      aria-label="Sign out"
    >
      {/* The icon stays when the label is hidden by a collapsed rail —
          otherwise the button collapses to an empty pill. */}
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
           aria-hidden="true" focusable="false" style={{ flex: '0 0 auto' }}>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
      <span className="label">Sign out</span>
    </button>
  );
}
