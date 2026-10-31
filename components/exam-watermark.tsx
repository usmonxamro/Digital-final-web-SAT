/**
 * Faint diagonal "satbyusmon.com" watermark — over the exam's question area and on every page of the
 * downloadable test PDF, so screenshots and shared PDFs keep pointing to the site.
 *
 * Real DOM text (not a background picture): it uses the site's own CMU Serif file on every device, prints into
 * the PDF as crisp vector text and is drawn by html2canvas on phones too. It never blocks clicks or selection.
 * The font file is a 6 KB subset that only contains the letters of the domain (public/fonts, SIL OFL).
 */

export const WATERMARK_TEXT = 'satbyusmon.com'
export const WATERMARK_OPACITY = 0.07
export const WATERMARK_FONT = "'SATWatermark', 'CMU Serif', 'Latin Modern Roman', Georgia, serif"
export const WATERMARK_FONT_CSS =
  "@font-face{font-family:'SATWatermark';font-style:normal;font-weight:700;font-display:block;src:url(/fonts/cmu-serif-wm.woff2) format('woff2');}"

const ROWS = 14
const COLS = 6

export function ExamWatermark({
  opacity = WATERMARK_OPACITY,
  fontSize = 26,
  /** Gap between tiles, in px. */
  gapX = 150,
  gapY = 120,
  style,
}: {
  opacity?: number
  fontSize?: number
  gapX?: number
  gapY?: number
  style?: React.CSSProperties
}) {
  return (
    <div
      aria-hidden="true"
      data-watermark
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        zIndex: 10,
        ...style,
      }}
    >
      <style>{WATERMARK_FONT_CSS}</style>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: COLS * (fontSize * 8 + gapX),
          transform: 'translate(-50%, -50%) rotate(-28deg)',
          display: 'flex',
          flexDirection: 'column',
          gap: gapY,
        }}
      >
        {Array.from({ length: ROWS }, (_, r) => (
          <div
            key={r}
            style={{
              display: 'flex',
              gap: gapX,
              whiteSpace: 'nowrap',
              // every other row shifted by half a tile: a brick pattern, no straight columns to crop along
              marginLeft: r % 2 ? (fontSize * 8 + gapX) / 2 : 0,
            }}
          >
            {Array.from({ length: COLS }, (_, c) => (
              <span
                key={c}
                style={{
                  fontFamily: WATERMARK_FONT,
                  fontWeight: 700,
                  fontSize,
                  lineHeight: 1,
                  letterSpacing: '0.02em',
                  color: `rgba(15, 26, 74, ${opacity})`,
                }}
              >
                {WATERMARK_TEXT}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
