import React from 'react';

/**
 * Logo — official Martal Group marks. Never recolor or distort; this
 * component only picks between approved official files.
 *   variant "wordmark" → MARTAL GROUP lockup
 *   variant "symbol"   → the "A" apex mark
 * `theme` picks white (for dark backgrounds, preferred) or dark files.
 * Paths resolve from the design-system root via `assetBase`.
 */
export function Logo({ variant = 'wordmark', theme = 'white', height = 32, assetBase = '', style = {}, ...rest }) {
  const files = {
    wordmark: {
      white: 'assets/logos/martal-wordmark-white.png',
      dark: 'assets/logos/martal-wordmark-on-black.png',
    },
    symbol: {
      white: 'assets/logos/martal-symbol-white.png',
      dark: 'assets/logos/martal-symbol-black.png',
    },
  };
  const src = `${assetBase}${files[variant][theme]}`;
  return (
    <img
      src={src}
      alt="Martal Group"
      style={{ height, width: 'auto', display: 'block', ...style }}
      {...rest}
    />
  );
}
