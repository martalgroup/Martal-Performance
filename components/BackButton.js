import Link from 'next/link';

/**
 * Back navigation for the console's nested pages.
 *
 * An explicit `href` rather than router.back(): history-based "back" lands
 * wherever the user happened to come from, which after a save-and-refresh or a
 * deep link is often the wrong place (or off the app entirely). A fixed
 * destination is predictable, works on a cold page load, and lets the label say
 * where you are actually going.
 *
 * Rendered as a Link so it prefetches and supports cmd-click, styled with the
 * app's own .btn--ghost so it matches every other control.
 *
 * Three sizing details, each fixing a real measured defect:
 *  - The chevron is an inline SVG, not a "←" character. Montserrat has no arrow
 *    glyph, so the text version fell back to another font.
 *  - `line-height: 1` because .btn leaves it at `normal`, so height otherwise
 *    drifts with whatever the page inherits.
 *  - `white-space: nowrap` because as an inline-flex box the label wrapped
 *    under the chevron, making the button a full line-height taller than every
 *    other .btn beside it (48px vs 37px).
 */
export default function BackButton({ href, label = 'Back', style = {} }) {
  return (
    <Link
      href={href}
      className="btn btn--ghost"
      style={{ textDecoration: 'none', padding: '9px 15px', lineHeight: 1, whiteSpace: 'nowrap', ...style }}
    >
      <svg
        width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" focusable="false"
        fill="none" stroke="currentColor" strokeWidth="2.4"
        strokeLinecap="round" strokeLinejoin="round"
        style={{ display: 'block', flex: '0 0 auto' }}
      >
        <path d="M19 12H5" />
        <path d="M12 19l-7-7 7-7" />
      </svg>
      {label}
    </Link>
  );
}
