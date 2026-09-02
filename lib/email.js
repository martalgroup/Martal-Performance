// Outbound email for the Deal Room.
//
// WHY NOT Supabase's mailer: invites used to go out via
// supabase.auth.admin.inviteUserByEmail(), which sends through Supabase's own
// email service. Two problems with that. First, the recipient sees a Supabase
// sender — the From identity on the default service is not configurable at all;
// per Supabase's docs it is "only for development purposes" and "heavily
// restricted", and changing the sender requires configuring custom SMTP on the
// project (smtp_sender_name / smtp_admin_email). Second, it created a second
// auth identity for an email that then signs in through Google anyway.
//
// So the invite email is ours now. It renders as Martal Deal Room, and if no
// provider is configured we send NOTHING rather than fall back to a
// Supabase-branded message — the route hands the admin a ready-to-send invite
// instead.

// martalgroup.com, not martal.ca: martal.ca is not in use, and it is also the
// domain every Martal Google account already lives on, so it is the one that can
// actually be verified for sending.
const DEFAULT_FROM = 'Martal Deal Room <no-reply@martalgroup.com>';

/** Which provider, if any, is wired up. */
export function mailerStatus() {
  if (process.env.RESEND_API_KEY) {
    return { ready: true, provider: 'resend', from: process.env.MARTAL_INVITE_FROM || DEFAULT_FROM };
  }
  return {
    ready: false,
    provider: null,
    from: process.env.MARTAL_INVITE_FROM || DEFAULT_FROM,
    reason: 'No email provider configured. Set RESEND_API_KEY (and optionally '
      + 'MARTAL_INVITE_FROM) to send invites automatically from Martal Deal Room.',
  };
}

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The invite email. Deliberately plain HTML with inline styles and a table
 * shell — that is what survives Outlook, Gmail's CSS stripping, and dark mode.
 * Montserrat is named first but every rule falls back to system sans, because
 * webfonts do not load in most mail clients.
 */
export function inviteEmailHtml({ inviteUrl, invitedByName, invitedByEmail, roleLabel }) {
  const inviter = invitedByName || invitedByEmail || 'a Martal admin';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>You've been invited to the Martal Deal Room</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:28px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Montserrat,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;">

    <tr><td style="background:#181818;padding:26px 30px;">
      <div style="font-size:15px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:#ffffff;line-height:1;">Martal</div>
      <div style="font-size:8px;letter-spacing:.3em;text-transform:uppercase;color:#a3a3a3;margin-top:4px;">Group</div>
      <div style="font-size:19px;font-weight:700;color:#ffffff;margin-top:18px;">Martal Deal Room</div>
      <div style="font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#8ecdee;margin-top:6px;">You've been invited</div>
    </td></tr>

    <tr><td style="padding:26px 30px 8px;">
      <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#303030;">
        ${esc(inviter)} has given you access to the <b>Martal Deal Room</b> — where Martal
        Group builds deal quotes, contract drafts, and signature approvals.
      </p>
      ${roleLabel ? `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#303030;">
        Your access level: <b>${esc(roleLabel)}</b>.
      </p>` : ''}
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#303030;">
        Sign in with the Google account on this email address:
      </p>
    </td></tr>

    <tr><td style="padding:0 30px 24px;">
      <a href="${esc(inviteUrl)}"
         style="display:inline-block;background:#181818;color:#ffffff;text-decoration:none;
                font-size:14px;font-weight:600;padding:13px 26px;border-radius:999px;">
        Open the Deal Room
      </a>
      <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#7a7a7a;">
        Or paste this into your browser:<br>
        <span style="color:#1c6d9c;word-break:break-all;">${esc(inviteUrl)}</span>
      </p>
    </td></tr>

    <tr><td style="padding:0 30px 26px;">
      <div style="height:1px;background:#ececec;margin-bottom:14px;"></div>
      <p style="margin:0;font-size:11.5px;line-height:1.6;color:#8a8a8f;">
        If you weren't expecting this, you can ignore it — nothing happens until you sign in.
        Questions? Reply to ${esc(invitedByEmail || 'your Martal contact')}.
      </p>
    </td></tr>

    <tr><td style="background:#f6f6f6;padding:14px 30px;">
      <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#8a8a8f;">
        Martal Services &amp; Consulting Ltd. &middot; Oakville, ON
      </div>
    </td></tr>

  </table>
</td></tr></table>
</body></html>`;
}

/** Plain-text twin, used as the text/plain part and for the mailto: fallback. */
export function inviteEmailText({ inviteUrl, invitedByName, invitedByEmail, roleLabel }) {
  const inviter = invitedByName || invitedByEmail || 'a Martal admin';
  return [
    `${inviter} has given you access to the Martal Deal Room — where Martal Group builds`,
    'deal quotes, contract drafts, and signature approvals.',
    '',
    roleLabel ? `Your access level: ${roleLabel}.` : null,
    roleLabel ? '' : null,
    'Sign in with the Google account on this email address:',
    inviteUrl,
    '',
    "If you weren't expecting this, you can ignore it — nothing happens until you sign in.",
    '',
    'Martal Services & Consulting Ltd. · Oakville, ON',
  ].filter((l) => l !== null).join('\n');
}

export const INVITE_SUBJECT = "You've been invited to the Martal Deal Room";

/**
 * Sends the invite. Resend's REST API over plain fetch — no new dependency, and
 * nothing Supabase-branded ever reaches the recipient.
 *
 * Returns { sent, provider, error }. Never throws: the invite record is already
 * committed by the time this runs, so a mail failure must degrade to "tell them
 * yourself", not lose the access grant.
 */
export async function sendInviteEmail({ to, inviteUrl, invitedByName, invitedByEmail, roleLabel }) {
  const status = mailerStatus();
  if (!status.ready) return { sent: false, provider: null, error: status.reason };

  const payload = {
    from: status.from,
    to: [to],
    subject: INVITE_SUBJECT,
    html: inviteEmailHtml({ inviteUrl, invitedByName, invitedByEmail, roleLabel }),
    text: inviteEmailText({ inviteUrl, invitedByName, invitedByEmail, roleLabel }),
  };
  if (invitedByEmail) payload.reply_to = invitedByEmail;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { sent: false, provider: 'resend', error: `Resend ${res.status}: ${body.slice(0, 200)}` };
    }
    return { sent: true, provider: 'resend', error: null };
  } catch (e) {
    return { sent: false, provider: 'resend', error: e?.message || String(e) };
  }
}
