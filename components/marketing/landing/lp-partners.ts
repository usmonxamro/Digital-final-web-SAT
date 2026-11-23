/**
 * Landing: "Bizning hamkorlarimiz" — a slow, endless marquee of partner sites (icon + name), placed right
 * above the "Platformamiz imkoniyatlari" section. Pure CSS (transform only, no JS, no layout work) so it
 * stays smooth on weak phones; pauses on hover/touch-hold and stops for "reduce motion".
 *
 * To add a partner: add one object to PARTNERS (icon = file in /public/partners or a full URL).
 */
type Partner = { name: string; url: string; icon: string; kind?: 'svg' | 'img'; cls?: string }

const GH =
  '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="#1f2328" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>'
const VC =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="1.5" y="1.5" width="21" height="21" rx="3" fill="#000"/><path fill="#fff" d="M12 7 18 17H6z"/></svg>'

const PARTNERS: Partner[] = [
  { name: 'GitHub', url: 'https://github.com', icon: GH, kind: 'svg', cls: 'pt-gh' },
  { name: 'Vercel', url: 'https://vercel.com', icon: VC, kind: 'svg', cls: 'pt-vc' },
  { name: 'LongoUz', url: 'https://longouz.vercel.app', icon: '/partners/longouz.png', cls: 'pt-owl' },
  {
    name: 'Saidxonov Academy',
    url: 'https://saidxonov.academy',
    icon: 'https://saidxonov.academy/_next/image?url=%2Flogo.jpg&w=96&q=75',
  },
]

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

// Fallback if an icon fails to load: first letter on an orange tile (inline, no extra request).
const FALLBACK =
  "this.onerror=null;this.replaceWith(Object.assign(document.createElement('b'),{className:'pt-ic pt-fb',textContent:this.alt.charAt(0)}))"

function item(p: Partner, hidden: boolean) {
  const ic =
    p.kind === 'svg'
      ? `<span class="pt-ic ${p.cls ?? ''}">${p.icon}</span>`
      : `<img class="pt-ic ${p.cls ?? ''}" src="${esc(p.icon)}" alt="${esc(p.name)}" width="38" height="38" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="${FALLBACK}">`
  return (
    `<a class="pt-item" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" title="${esc(p.name)}"${hidden ? ' tabindex="-1" aria-hidden="true"' : ''}>` +
    `${ic}<span class="pt-name">${esc(p.name)}</span></a>`
  )
}

// Each half repeats the list until it is wider than any screen (>= 12 items); the second half is an exact
// copy, so the -50% loop is seamless.
const reps = Math.max(1, Math.ceil(12 / PARTNERS.length))
const half = (hidden: boolean) =>
  Array.from({ length: reps }, (_, r) => PARTNERS.map((p) => item(p, hidden || r > 0)).join('')).join('')

export const LP_PARTNERS =
  `<section class="partners" id="partners" aria-label="Bizning hamkorlarimiz">` +
  `<p class="pt-title">Bizning hamkorlarimiz</p>` +
  `<div class="pt-marq"><div class="pt-track">` +
  `<div class="pt-set">${half(false)}</div><div class="pt-set" aria-hidden="true">${half(true)}</div>` +
  `</div></div></section>\n`

const ru = { 'Bizning hamkorlarimiz': 'Наши партнёры' }
const en = { 'Bizning hamkorlarimiz': 'Our partners' }
export const PARTNERS_I18N = { ru, en }
