'use client';
import React from 'react';

/**
 * Switch — toggle control. Green when on (brand secondary).
 */
export function Switch({ checked, onChange, label, disabled = false, id, style = {} }) {
  const switchId = id || `mg-switch-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <label htmlFor={switchId} style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, fontFamily: 'var(--font-sans)', ...style }}>
      <span
        onClick={() => { if (!disabled) onChange?.(!checked); }}
        style={{
          position: 'relative', width: 44, height: 26, flex: '0 0 auto',
          borderRadius: 'var(--radius-pill)',
          background: checked ? 'var(--mg-green-500)' : 'var(--mg-ink-200)',
          transition: 'background var(--dur-base) var(--ease-standard)',
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: checked ? 21 : 3, width: 20, height: 20,
          borderRadius: '50%', background: '#fff', boxShadow: 'var(--shadow-sm)',
          transition: 'left var(--dur-base) var(--ease-out)',
        }} />
        <input id={switchId} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
      </span>
      {label && <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-strong)' }}>{label}</span>}
    </label>
  );
}
