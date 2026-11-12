/** Site colour palette + day/night mode, stored per device (localStorage) and applied on <html>.
 *  The inline script in app/layout.tsx applies both before first paint; these helpers change them live. */
export type Palette = 'classic' | 'green' | 'yellow'
export type Mode = 'light' | 'dark'

export const PALETTE_EVENT = 'sp-appearance-change'

export function currentPalette(): Palette {
  const v = typeof document !== 'undefined' ? document.documentElement.getAttribute('data-sp-palette') : null
  return v === 'green' || v === 'yellow' ? v : 'classic'
}
export function currentMode(): Mode {
  return typeof document !== 'undefined' && document.documentElement.getAttribute('data-sp-theme') === 'light' ? 'light' : 'dark'
}

export function setPalette(p: Palette) {
  const html = document.documentElement
  if (p === 'classic') html.removeAttribute('data-sp-palette')
  else html.setAttribute('data-sp-palette', p)
  try {
    if (p === 'classic') localStorage.removeItem('sp-palette')
    else localStorage.setItem('sp-palette', p)
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(PALETTE_EVENT))
}

export function setMode(m: Mode) {
  document.documentElement.setAttribute('data-sp-theme', m)
  try {
    localStorage.setItem('sp-theme', m)
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(PALETTE_EVENT))
}

/** Exam-interface accent (separate from the site palette): the default teal, or the orange used on /daraja. */
export type ExamAccent = 'teal' | 'orange'
export function currentExamAccent(): ExamAccent {
  return typeof document !== 'undefined' && document.documentElement.getAttribute('data-ex-accent') === 'orange' ? 'orange' : 'teal'
}
export function setExamAccent(a: ExamAccent) {
  const html = document.documentElement
  if (a === 'orange') html.setAttribute('data-ex-accent', 'orange')
  else html.removeAttribute('data-ex-accent')
  try {
    if (a === 'orange') localStorage.setItem('ex-accent', 'orange')
    else localStorage.removeItem('ex-accent')
  } catch {
    /* private mode */
  }
}
