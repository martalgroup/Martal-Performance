import React from 'react';

/**
 * Badge — small status / label pill. Tones map to brand + semantic colors.
 * `solid` fills; default is a soft tinted background.
 */
export function Badge({ children, tone = 'neutral', solid = false, size = 'md', style = {}, ...rest }) {
  const tones = {
    neutral: { soft: { bg: 'var(--mg-ink-100)', fg: 'var(--mg-ink-700)' }, solid: { bg: 'var(--mg-charcoal)', fg: '#fff' } },
    green:   { soft: { bg: 'var(--mg-green-50)', fg: 'var(--mg-green-700)' }, solid: { bg: 'var(--mg-green-500)', fg: '#fff' } },
    blue:    { soft: { bg: 'var(--mg-blue-50)', fg: 'var(--mg-blue-700)' }, solid: { bg: 'var(--mg-blue-500)', fg: '#fff' } },
    warning: { soft: { bg: '#fbf0d8', fg: '#8a5c00' }, solid: { bg: 'var(--mg-warning)', fg: '#fff' } },
    danger:  { soft: { bg: '#fbe4e1', fg: '#9c2a1f' }, solid: { bg: 'var(--mg-danger)', fg: '#fff' } },
  };
  const chosen = solid ? tones[tone].solid : tones[tone].soft;
  const sizes = {
    sm: { padding: '2px 8px', fontSize: '11px' },
    md: { padding: '4px 11px', fontSize: 'var(--fs-overline)' },
  };
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-semibold)',
        letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase',
        lineHeight: 1.4, borderRadius: 'var(--radius-pill)',
        background: chosen.bg, color: chosen.fg,
        ...sizes[size], ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
