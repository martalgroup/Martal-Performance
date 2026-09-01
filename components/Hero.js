// The hero. Same class, same gradient, same type as the Deal Room and Academy.
export default function Hero({ eyebrow, title, lede, meta, children }) {
  return (
    <div className="hero-dark" style={{ marginBottom: 18 }}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 style={{ fontSize: 'clamp(30px, 3.4vw, 42px)', lineHeight: 1.05, marginBottom: 8 }}>{title}</h1>
      {lede && <p style={{ color: 'var(--mg-green-500)', margin: '0 0 6px', fontSize: 15.5, fontWeight: 700, letterSpacing: '-.01em', maxWidth: '70ch' }}>{lede}</p>}
      {meta && <p style={{ color: 'var(--mg-blue-300)', margin: 0, fontSize: 12.5, letterSpacing: '.02em' }}>{meta}</p>}
      {children}
    </div>
  );
}
