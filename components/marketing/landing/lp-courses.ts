import type { CourseGroup } from '@/lib/course-groups'

/**
 * The «Telegram kurslari» cards of the landing page are built from the admin-managed course groups
 * (Admin → Kurs bannerlari). The original static November / December cards are used as the two
 * colour templates ('nov' = orange, 'dec' = blue); their texts are swapped for the group's own.
 */

export const COURSE_CARDS_MARK = '<!--LP-COURSE-CARDS-->'

/** Index of the `</div>` that closes the <div> starting at `from`. */
function closeDiv(html: string, from: number): number {
  const re = /<div\b|<\/div>/g
  re.lastIndex = from
  let depth = 0
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[0] === '</div>' ? -1 : 1
    if (depth === 0) return m.index + '</div>'.length
  }
  return -1
}

function cardAt(html: string, cls: string): string {
  const start = html.indexOf(`<div class="c-card ${cls}">`)
  if (start < 0) return ''
  const end = closeDiv(html, start)
  return end > 0 ? html.slice(start, end) : ''
}

/** Splits the static landing body: the grid's static cards are replaced by a marker, the cards become templates. */
export function splitCourseCards(body: string): { body: string; templates: { nov: string; dec: string } } {
  const nov = cardAt(body, 'c-nov')
  const dec = cardAt(body, 'c-dec')
  const gridStart = body.indexOf('<div class="c-grid"')
  if (!nov || !dec || gridStart < 0) return { body, templates: { nov, dec } }
  const gridEnd = closeDiv(body, gridStart)
  const openEnd = body.indexOf('>', gridStart) + 1
  const out = body.slice(0, openEnd) + COURSE_CARDS_MARK + body.slice(gridEnd - '</div>'.length)
  return { body: out, templates: { nov, dec } }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** One landing card for a group, from its colour template. Missing texts keep the template's own. */
export function courseCardHtml(g: CourseGroup, templates: { nov: string; dec: string }): string {
  let h = g.theme === 'nov' ? templates.nov : templates.dec
  if (!h) return ''
  if (g.tag) h = h.replace(/<span class="tag">[\s\S]*?<\/span>/, `<span class="tag">${esc(g.tag)}</span>`)
  h = h.replace(/<h2>[\s\S]*?<\/h2>/, `<h2>${esc(g.title)}</h2>`)
  if (g.desc) h = h.replace(/(<\/h2>\s*)<p>[\s\S]*?<\/p>/, `$1<p>${esc(g.desc)}</p>`)
  if (g.bullets?.length) {
    const li = h.match(/<li>(<span class="ochk">[\s\S]*?<\/span>)[\s\S]*?<\/li>/)
    if (li) {
      const items = g.bullets.map((b) => `<li>${li[1]}${esc(b)}</li>`).join('\n          ')
      h = h.replace(/<ul>[\s\S]*?<\/ul>/, `<ul>\n          ${items}\n        </ul>`)
    }
  }
  if (g.link) h = h.replace(/(<a href=")[^"]*(" [^>]*class="c-btn")/, `$1${esc(g.link)}$2`)
  if (g.month) h = h.replace(/>(NOVEMBER|DECEMBER)<\/text>/, `>${esc(g.month)}</text>`)
  return h
}
