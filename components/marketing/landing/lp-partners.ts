/**
 * Landing: "Bizning hamkorlarimiz" — a slow, endless marquee of partner sites (icon + name), placed right
 * above the "Platformamiz imkoniyatlari" section. Pure CSS (transform only, no JS, no layout work) so it
 * stays smooth on weak phones; pauses on hover/touch-hold and stops for "reduce motion".
 *
 * To add a partner: add one object to PARTNERS (icon = file in /public/partners or a full URL).
 */
type Partner = { name: string; host: string; url: string; icon: string }

const PARTNERS: Partner[] = [
  {
    name: 'Saidxonov Academy',
    host: 'saidxonov.academy',
    url: 'https://saidxonov.academy',
    icon: 'https://saidxonov.academy/_next/image?url=%2Flogo.jpg&w=96&q=75',
  },
  { name: 'LongoUZ', host: 'longouz.vercel.app', url: 'https://longouz.vercel.app', icon: '/partners/longouz.png' },
]

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

// Fallback if an icon fails to load: first letter on an orange tile (inline, no extra request).
const FALLBACK =
  "this.onerror=null;this.replaceWith(Object.assign(document.createElement('b'),{className:'pt-ic pt-fb',textContent:this.alt.charAt(0)}))"

function item(p: Partner, hidden: boolean) {
  return (
    `<a class="pt-item" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer"${hidden ? ' tabindex="-1" aria-hidden="true"' : ''}>` +
    `<img class="pt-ic" src="${esc(p.icon)}" alt="${esc(p.name)}" width="44" height="44" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="${FALLBACK}">` +
    `<span class="pt-tx"><b>${esc(p.name)}</b><small>${esc(p.host)}</small></span></a>`
  )
}

// With few partners one pass is shorter than a wide screen, so each half repeats the list until it is
// wide enough (>= 8 tiles); the second half is an exact copy → the -50% loop is seamless.
const reps = Math.max(1, Math.ceil(8 / PARTNERS.length))
const half = (hidden: boolean) =>
  Array.from({ length: reps }, (_, r) => PARTNERS.map((p) => item(p, hidden || r > 0)).join('')).join('')

export const LP_PARTNERS =
  `<section class="partners" id="partners" aria-label="Bizning hamkorlarimiz">` +
  `<div class="container"><div class="pt-head"><span class="pill"><span class="dot"></span>Bizning hamkorlarimiz</span></div></div>` +
  `<div class="pt-marq"><div class="pt-track">` +
  `<div class="pt-set">${half(false)}</div><div class="pt-set" aria-hidden="true">${half(true)}</div>` +
  `</div></div></section>\n`

const ru = { 'Bizning hamkorlarimiz': 'Наши партнёры' }
const en = { 'Bizning hamkorlarimiz': 'Our partners' }
export const PARTNERS_I18N = { ru, en }
