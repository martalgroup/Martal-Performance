// Sign-in hero copy. The Deal Room lets a super admin edit this in the DB; here
// it is static, because this app only shows numbers and the copy is the frame
// those numbers sit in, not a sales message to be tuned.
export const STAT_COLORS = { green: 'var(--mg-green-500)', blue: 'var(--mg-blue-300)', white: '#fff' };
export const DEFAULT_LOGIN_CONTENT = {
  eyebrow: 'Internal use only',
  headline: 'The numbers behind every rep, every period.',
  subcopy: 'Booked meetings, SQLs and MQLs by rep and by account, computed from the campaign sheets and refreshed on a schedule.',
  stats: [
    { value: 'Live', caption: 'Refreshed from the campaign dashboard', color: 'green' },
    { value: '16th → 15th', caption: 'Reporting periods', color: 'blue' },
    { value: '2023 →', caption: 'History back to the first campaign sheet', color: 'white' },
  ],
  footer: 'Martal Group · Performance Intelligence',
};

// The Deal Room fetches this from its messaging table; here it is static, but
// the login page shares the same call shape so it needed no edits.
export async function fetchLoginContent() { return DEFAULT_LOGIN_CONTENT; }
