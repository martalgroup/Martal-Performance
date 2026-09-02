// Tiny inline SVG trend, one value per period. Endpoint emphasised, faint
// baseline, no axes: it is a shape to read at a glance next to the number.
export default function Sparkline({ values = [], width = 96, height = 26, color = 'var(--mg-green-500)' }) {
  const v = values.map((x) => Number(x) || 0);
  if (v.length < 2) return <svg width={width} height={height} aria-hidden="true" />;
  const max = Math.max(...v, 1), min = 0;
  const px = (i) => (i / (v.length - 1)) * (width - 6) + 3;
  const py = (y) => height - 3 - ((y - min) / (max - min || 1)) * (height - 6);
  const d = v.map((y, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(y).toFixed(1)}`).join(' ');
  const area = `${d} L${px(v.length - 1).toFixed(1)},${height - 3} L3,${height - 3} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={{ display: 'block' }}>
      <path d={area} fill={color} opacity=".12" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={px(v.length - 1)} cy={py(v[v.length - 1])} r="2.6" fill={color} />
    </svg>
  );
}
