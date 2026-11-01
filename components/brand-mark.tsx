/**
 * "SAT by Usmon" brand mark — a neon-green rounded tile with a check-mark that turns into a
 * rising arrow (a correct answer → a growing score). Pure SVG, no fonts, crisp at any size,
 * works on dark and light backgrounds. Used by every header (landing, dashboard, login, checkout).
 */
export function BrandMark({ size = 40, className = '', glow = true }: { size?: number; className?: string; glow?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
      style={glow ? { filter: 'drop-shadow(0 0 10px rgba(46,226,122,.45))', flex: 'none' } : { flex: 'none' }}
    >
      <defs>
        <linearGradient id="sbu-tile" x1="6" y1="2" x2="42" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4cf08f" />
          <stop offset=".55" stopColor="#1fc566" />
          <stop offset="1" stopColor="#0b8a48" />
        </linearGradient>
        <linearGradient id="sbu-shine" x1="24" y1="2" x2="24" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity=".38" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#sbu-tile)" />
      <rect x="2" y="2" width="44" height="22" rx="13" fill="url(#sbu-shine)" />
      <rect x="2.75" y="2.75" width="42.5" height="42.5" rx="12.4" fill="none" stroke="#bdfdd6" strokeOpacity=".55" strokeWidth="1.5" />
      <path d="M12.5 26.5l7 7 16-17" fill="none" stroke="#fff" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M27.5 16.2h8.3v8.3" fill="none" stroke="#fff" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Mark + "SAT by Usmon" wordmark. `tone` decides the text colour on fixed backgrounds. */
export function BrandWordmark({
  size = 40,
  tone = 'auto',
  tagline,
  className = '',
}: {
  size?: number
  /** 'auto' follows the surrounding text colour; 'light' = white text (always-dark panels). */
  tone?: 'auto' | 'light'
  tagline?: string
  className?: string
}) {
  return (
    <span className={`sbu-word ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.26) }}>
      <BrandMark size={size} />
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05, minWidth: 0 }}>
        <span
          style={{
            fontWeight: 800,
            fontSize: Math.round(size * 0.5),
            letterSpacing: '-.02em',
            whiteSpace: 'nowrap',
            color: tone === 'light' ? '#fff' : 'inherit',
          }}
        >
          SAT <span style={{ fontWeight: 600, opacity: 0.75 }}>by</span>{' '}
          <span className="sbu-accent" style={{ color: tone === 'light' ? '#4cf08f' : 'var(--sbu-accent, #16a34a)' }}>
            Usmon
          </span>
        </span>
        {tagline && (
          <span style={{ fontSize: Math.max(9, Math.round(size * 0.23)), fontWeight: 700, letterSpacing: '.12em', opacity: 0.6, marginTop: 4, whiteSpace: 'nowrap' }}>
            {tagline}
          </span>
        )}
      </span>
    </span>
  )
}
