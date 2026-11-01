/**
 * "SAT by Usmon" brand mark — a calm, flat rounded tile with a check-mark that rises into an arrow
 * (a correct answer → a growing score). Pure SVG, readable down to 16px. Colours come from the palette
 * tokens (--brand-1 / --brand-3 in app/palettes.css): orange in the classic theme, green and gold in the
 * other two. The static copies (app/icon.svg, apple-icon, favicon, logo-512.png) use the classic orange.
 */
export function BrandMark({ size = 40, className = '', glow = false }: { size?: number; className?: string; glow?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={`sbu-mark ${className}`}
      aria-hidden="true"
      style={{ flex: 'none', filter: glow ? 'drop-shadow(0 4px 12px var(--brand-glow, rgba(255,122,26,.35)))' : undefined }}
    >
      <defs>
        <linearGradient id="sbu-tile" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: 'var(--brand-1, #ff9a3c)' }} />
          <stop offset="1" style={{ stopColor: 'var(--brand-3, #ea4f00)' }} />
        </linearGradient>
      </defs>
      <rect className="sbu-tile" x="2" y="2" width="44" height="44" rx="12" fill="url(#sbu-tile)" />
      <g className="sbu-check" fill="none" stroke="#fff" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round">
        <path className="sbu-check-tick" pathLength={1} d="M13 25.5l7 7 15.5-15.5" />
        <path className="sbu-check-head" pathLength={1} d="M27.5 16.5h8v8" />
      </g>
    </svg>
  )
}
