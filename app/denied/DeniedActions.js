'use client';
import { createClient } from '../../lib/supabase/client';

// Split out of the page so /denied itself can be a server component and read the
// live allowlist. Signing out matters here: the wrong Google account is the most
// common reason for landing on this page, and without clearing the session
// Google silently re-uses it on the next attempt and you loop straight back.
export default function DeniedActions() {
  async function out() {
    try {
      await createClient().auth.signOut();
    } finally {
      window.location.href = '/login';
    }
  }
  return (
    <button className="gbtn" onClick={out}>Sign in with a different account</button>
  );
}
