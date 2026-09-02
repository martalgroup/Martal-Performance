'use client';
import React from 'react';
import { Icon } from '../core/Icon.jsx';

/**
 * Select — styled native dropdown with a Lucide chevron. Options via
 * `options` array of {value,label} or plain strings.
 */
export function Select({ label, options = [], hint, glass = false, id, style = {}, containerStyle = {}, ...rest }) {
  const selectId = id || `mg-select-${Math.random().toString(36).slice(2, 8)}`;
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));

  const field = glass
    ? { background: 'var(--glass-dark)', color: 'var(--text-on-dark)', border: '1px solid var(--glass-border-dark)', backdropFilter: 'blur(var(--blur-md))', WebkitBackdropFilter: 'blur(var(--blur-md))' }
    : { background: 'var(--surface-card)', color: 'var(--text-strong)', border: '1px solid var(--border-default)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontFamily: 'var(--font-sans)', ...containerStyle }}>
      {label && <label htmlFor={selectId} style={{ fontSize: 'var(--fs-body-sm)', fontWeight: 'var(--fw-semibold)', color: glass ? 'var(--text-on-dark)' : 'var(--text-strong)' }}>{label}</label>}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <select
          id={selectId}
          style={{
            appearance: 'none', WebkitAppearance: 'none',
            fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-body)',
            padding: '11px 40px 11px 14px', borderRadius: 'var(--radius-md)',
            width: '100%', outline: 'none', cursor: 'pointer', ...field, ...style,
          }}
          {...rest}
        >
          {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Icon name="chevron-down" size={18} color={glass ? 'var(--text-on-dark-muted)' : 'var(--text-muted)'} style={{ position: 'absolute', right: 14, pointerEvents: 'none' }} />
      </div>
      {hint && <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>{hint}</span>}
    </div>
  );
}
