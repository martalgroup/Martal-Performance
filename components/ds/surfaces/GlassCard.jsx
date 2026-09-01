import React from 'react';

/**
 * GlassCard — the signature Martal surface: frosted translucent panel with
 * backdrop blur, a lit top sheen, and a soft floating shadow. Sits over
 * imagery or liquid gradient backdrops.
 */
export function GlassCard({
  children,
  tone = 'light',
  blur = 'lg',
  sheen = true,
  padding = 'var(--space-6)',
  radius = 'var(--radius-lg)',
  style = {},
  ...rest
}) {
  const blurPx = { sm: 'var(--blur-sm)', md: 'var(--blur-md)', lg: 'var(--blur-lg)', xl: 'var(--blur-xl)' }[blur];

  const tones = {
    light: {
      background: 'var(--glass-light-strong)',
      border: '1px solid var(--glass-border-soft)',
      boxShadow: 'var(--glass-shadow)',
      color: 'var(--text-body)',
    },
    dark: {
      background: 'var(--glass-dark-strong)',
      border: '1px solid var(--glass-border-dark)',
      boxShadow: 'var(--glass-shadow-dark)',
      color: 'var(--text-on-dark)',
    },
    green: {
      background: 'var(--glass-tint-green)',
      border: '1px solid rgba(128,177,34,.4)',
      boxShadow: 'var(--glass-shadow-dark)',
      color: 'var(--text-on-dark)',
    },
    blue: {
      background: 'var(--glass-tint-blue)',
      border: '1px solid rgba(45,156,219,.4)',
      boxShadow: 'var(--glass-shadow-dark)',
      color: 'var(--text-on-dark)',
    },
  };

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: radius,
        padding,
        backdropFilter: `blur(${blurPx}) saturate(1.4)`,
        WebkitBackdropFilter: `blur(${blurPx}) saturate(1.4)`,
        fontFamily: 'var(--font-sans)',
        ...tones[tone],
        ...style,
      }}
      {...rest}
    >
      {sheen && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, borderRadius: radius,
            background: 'var(--glass-sheen-soft)', pointerEvents: 'none',
          }}
        />
      )}
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  );
}
