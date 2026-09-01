// Same tile the Platform Pricing page uses, so the two apps read as one.
const TONES = {
  green: { fg: 'var(--mg-green-700)', bg: 'var(--mg-green-50)', bd: '#e2eecc' },
  blue: { fg: 'var(--mg-blue-700)', bg: '#eaf6fd', bd: '#cfe9f7' },
  plain: { fg: 'var(--mg-charcoal)', bg: 'var(--surface-muted)', bd: 'var(--border-subtle)' },
  red: { fg: '#a13b2f', bg: '#fdf1ef', bd: '#f0cdc7' },
};
export default function Stat({ value, label, note, tone = 'plain' }) {
  const c = TONES[tone] || TONES.plain;
  return (
    <div style={{ border: `1px solid ${c.bd}`, borderRadius: 12, padding: '12px 14px', background: c.bg, flex: '1 1 140px', minWidth: 0 }}>
      <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.05, color: c.fg, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 6 }}>{label}</div>
      {note && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.4 }}>{note}</div>}
    </div>
  );
}
