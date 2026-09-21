'use client';
import { useState } from 'react';

// Booked meetings and SQLs, period over period.
//
// One axis, deliberately: both series are counts of the same thing at the same
// order of magnitude, so a shared scale is the honest comparison and a second
// y-axis would invent a relationship that is not in the data.
//
// Colours are green-600 and blue-700 rather than the brand-500 pair. The 500s
// were checked against a white card surface and the green came back at 2.55:1
// contrast, under the 3:1 floor. These two pass every check, worst adjacent
// colour-blind separation 22.1 protan / 9.9 tritan.
const MEETINGS = '#66901b';
const SQLS = '#1c6d9c';
const GRID = '#e7e7e7';
const BAND = '#f3f5ee';
const INK = '#565656';
const MUTED = '#7a7a7a';

const W = 920, H = 250;
const PAD = { top: 14, right: 62, bottom: 34, left: 48 };
const PW = W - PAD.left - PAD.right;
const PH = H - PAD.top - PAD.bottom;

/** Round the axis up to a readable ceiling. Coarse steps waste half the plot:
 *  540 has to become 600, not 1000. */
function niceMax(v) {
  if (v <= 0) return 10;
  const mag = 10 ** Math.floor(Math.log10(v));
  return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((s) => s * mag).find((c) => c >= v) || 10 * mag;
}

export default function TrendChart({ points, currentStart }) {
  const [hover, setHover] = useState(null);
  if (!points || points.length < 2) return null;

  const max = niceMax(Math.max(...points.flatMap((p) => [p.flip, p.sql])));
  const step = PW / (points.length - 1);
  const x = (i) => PAD.left + i * step;
  const y = (v) => PAD.top + PH - (v / max) * PH;
  const path = (k) => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' ');
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const last = points.length - 1;
  const act = hover == null ? null : points[hover];
  const currentIdx = points.findIndex((p) => p.start === currentStart);

  // Keep the two endpoint labels legible when the series finish close together.
  const ends = [{ k: 'flip', c: MEETINGS }, { k: 'sql', c: SQLS }]
    .map((s) => ({ ...s, v: points[last][s.k], y: y(points[last][s.k]) }))
    .sort((a, b) => a.y - b.y);
  if (ends[1].y - ends[0].y < 14) { ends[0].y -= (14 - (ends[1].y - ends[0].y)) / 2; ends[1].y = ends[0].y + 14; }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 6 }}>
        {[['Booked meetings (SQL 2)', MEETINGS], ['SQLs (SQL 1)', SQLS]].map(([label, c]) => (
          <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: MUTED }}>
            <span style={{ width: 9, height: 9, borderRadius: 9, background: c, display: 'inline-block' }} />{label}
          </span>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" style={{ display: 'block' }}
           aria-label={`Booked meetings and SQLs by period, ${points[0].label} to ${points[last].label}. Figures in the period history table below.`}>
        {/* The period the tiles above are reporting, so chart and numbers agree.
            Behind the grid, and inset, so it never reads as a stray edge mark. */}
        {currentIdx >= 0 && (
          <rect x={Math.min(x(currentIdx) - step * 0.3, PAD.left + PW - step * 0.6)} y={PAD.top}
                width={step * 0.6} height={PH} fill={BAND} rx="4" />
        )}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={PAD.left + PW} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth="1" />
            <text x={PAD.left - 9} y={y(v) + 4} textAnchor="end" fontSize="11" fill={MUTED}
                  style={{ fontVariantNumeric: 'tabular-nums' }}>{v.toLocaleString('en-US')}</text>
          </g>
        ))}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + PH} stroke={MUTED} strokeWidth="1" />}

        {[{ k: 'sql', c: SQLS }, { k: 'flip', c: MEETINGS }].map(({ k, c }) => (
          <g key={k}>
            <path d={path(k)} fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => (
              <circle key={p.start} cx={x(i)} cy={y(p[k])} r={i === last || i === hover ? 5 : 4}
                      fill={c} stroke="#fff" strokeWidth="2" />
            ))}
          </g>
        ))}

        {/* Direct-label the endpoint only; a number on every point is noise. */}
        {ends.map((e) => (
          <text key={e.k} x={x(last) + 11} y={e.y + 4} fontSize="12.5" fontWeight="700" fill={INK}
                style={{ fontVariantNumeric: 'tabular-nums' }}>{e.v.toLocaleString('en-US')}</text>
        ))}

        {points.map((p, i) => (
          (i % 2 === 0 || i === last) && (
            <text key={p.start} x={x(i)} y={H - 12} textAnchor="middle" fontSize="11" fill={MUTED}>{p.short}</text>
          )
        ))}

        {/* Hit bands a whole step wide, so hovering never needs precision. */}
        {points.map((p, i) => (
          <rect key={p.start} x={x(i) - step / 2} y={PAD.top} width={step} height={PH} fill="transparent"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}
      </svg>

      {act && (
        <div style={{
          position: 'absolute', top: 22, left: `${(x(hover) / W) * 100}%`, transform: 'translateX(-50%)',
          background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 10,
          boxShadow: '0 8px 20px -10px rgba(24,24,24,.35)', padding: '8px 11px', pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: INK, marginBottom: 4 }}>{act.label}</div>
          {[['Booked meetings', act.flip, MEETINGS], ['SQLs', act.sql, SQLS]].map(([l, v, c]) => (
            <div key={l} style={{ fontSize: 12, color: MUTED, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 8, background: c, display: 'inline-block' }} />
              {l} <b style={{ color: INK, fontVariantNumeric: 'tabular-nums' }}>{v.toLocaleString('en-US')}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
