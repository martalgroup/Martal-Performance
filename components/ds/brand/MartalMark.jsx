import React from 'react';

/**
 * MartalMark — the chevron "A" symbol, matched exactly to the one in the
 * Academy app's nav (components/AcademyMark.tsx there). Same shared header
 * across every internal app: this icon + a "|" divider + the product name
 * in green is the whole brand lockup, no wordmark.
 */
export function MartalMark({ style }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" style={{ height: 24, width: 24, ...style }} aria-hidden="true">
      <path
        d="M16 86 L50 15 L84 86"
        stroke="currentColor"
        strokeWidth="17"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
