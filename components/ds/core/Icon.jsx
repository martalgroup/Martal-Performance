import React from 'react';

/**
 * Icon — thin wrapper over Lucide's stroke icon set (loaded from CDN as
 * masked SVGs so the glyph inherits `color`). Lucide is a documented
 * substitution: the brand guide specifies "crisp vector graphics" but
 * names no icon library.
 */
export function Icon({ name, size = 20, color = 'currentColor', strokeWidth, style = {}, ...rest }) {
  const url = `https://unpkg.com/lucide-static@0.544.0/icons/${name}.svg`;
  return (
    <span
      role="img"
      aria-label={name}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        flex: '0 0 auto',
        backgroundColor: color,
        WebkitMaskImage: `url(${url})`,
        maskImage: `url(${url})`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        ...style,
      }}
      {...rest}
    />
  );
}
