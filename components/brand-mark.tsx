/**
 * "SAT by Usmon" brand mark — a glossy rounded tile with a check-mark that turns into a rising arrow
 * (a correct answer → a growing score). Pure SVG, no fonts. Its colours come from the palette tokens
 * (--brand-1/2/3, --brand-ring, --brand-glow in app/palettes.css), so the logo is orange in the classic
 * theme, neon green in the green theme and gold in the yellow theme.
 */
export function BrandMark({ size = 40, className = '', glow = true }: { size?: number; className?: string; glow?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={`sbu-mark ${className}`}
      aria-hidden="true"
      style={{ flex: 'none', filter: glow ? 'drop-shadow(0 0 10px var(--brand-glow, rgba(255,122,26,.45)))' : undefined }}
    >
      <defs>
        <linearGradient id="sbu-tile" x1="6" y1="2" x2="42" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: 'var(--brand-1, #ffb357)' }} />
          <stop offset=".55" style={{ stopColor: 'var(--brand-2, #ff7a1a)' }} />
          <stop offset="1" style={{ stopColor: 'var(--brand-3, #d94b00)' }} />
        </linearGradient>
        <linearGradient id="sbu-shine" x1="24" y1="2" x2="24" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity=".42" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="sbu-spark" cx="36" cy="14" r="9" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect className="sbu-tile" x="2" y="2" width="44" height="44" rx="13" fill="url(#sbu-tile)" />
      <rect x="2" y="2" width="44" height="22" rx="13" fill="url(#sbu-shine)" />
      <circle cx="36" cy="14" r="9" fill="url(#sbu-spark)" />
      <rect x="2.75" y="2.75" width="42.5" height="42.5" rx="12.4" fill="none" strokeOpacity=".6" strokeWidth="1.5" style={{ stroke: 'var(--brand-ring, #ffe0bf)' }} />
      {/* soft shadow under the stroke gives the check some depth */}
      <g className="sbu-check-shadow" transform="translate(0 1.4)" opacity=".22" fill="none" stroke="#000" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.5 26.5l7 7 16-17" />
        <path d="M27.5 16.2h8.3v8.3" />
      </g>
      <g className="sbu-check" fill="none" stroke="#fff" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round">
        <path className="sbu-check-tick" pathLength={1} d="M12.5 26.5l7 7 16-17" />
        <path className="sbu-check-head" pathLength={1} d="M27.5 16.2h8.3v8.3" />
      </g>
    </svg>
  )
}
