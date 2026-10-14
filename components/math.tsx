'use client'

import katex from 'katex'
import { memo, useMemo } from 'react'

type MathProps = {
  tex: string
  display?: boolean
  className?: string
}

/** KaTeX is the slow part of a question screen — typeset each distinct formula only once per session
 *  (going Back/Next, re-renders and the review screen all reuse the finished HTML). */
const KATEX_CACHE = new Map<string, string>()
const KATEX_CACHE_MAX = 1500

function renderTex(tex: string, display: boolean): string {
  const key = (display ? 'D|' : 'I|') + tex
  const hit = KATEX_CACHE.get(key)
  if (hit !== undefined) return hit
  let html: string
  try {
    html = katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'html' })
  } catch {
    html = tex
  }
  if (KATEX_CACHE.size >= KATEX_CACHE_MAX) KATEX_CACHE.clear()
  KATEX_CACHE.set(key, html)
  return html
}

export const Math = memo(function Math({ tex, display = false, className }: MathProps) {
  const html = useMemo(() => renderTex(tex, display), [tex, display])

  return (
    <span
      className={className}
      // KaTeX output is trusted (generated from our own TeX strings)
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})

/**
 * Internal-only marker the admin panel appends to a question's prompt
 * (see lib/admin-schema.ts / the LaTeX-import prompt template) so the admin
 * knows which imported question still needs a figure/diagram uploaded.
 * Never meant for students to see — stripped out wherever a prompt is
 * rendered on the exam/review side (this file's MixedText), but left intact
 * in the admin panel's own JSON/answer-entry views.
 */
const FIGURE_MARKER_RE = /\s*\[\s*CHIZMA\s*BOR\s*\]/gi

export function stripFigureMarker(text: string): string {
  return text.replace(FIGURE_MARKER_RE, '').trim()
}

/**
 * Renders plain question text that mixes ordinary prose with math — a
 * variable name, a function call, a short inline expression — so it comes
 * out typeset like real Bluebook rather than as plain characters. Also
 * strips the admin-only "[CHIZMA BOR]" figure marker so students never see
 * it. Two ways math gets recognized in the text:
 *
 * 1. Explicit `$...$` spans (e.g. "the value of $\sin(R)$ is"). This is the
 *    preferred, reliable way — the admin JSON prompt template instructs the
 *    AI to wrap every inline variable/expression this way — since it can't
 *    be confused with ordinary prose and correctly keeps spaces inside one
 *    math span (e.g. "$x + y$").
 * 2. A legacy fallback for content imported before that convention existed:
 *    outside of `$...$` spans, any whitespace-separated token containing a
 *    backslash-letter LaTeX command (\frac, \left, \pi, \le, ...) is still
 *    rendered as math on its own — this is what fixed the original "raw
 *    \frac{p}{59} shown as text" bug.
 */
export const MixedText = memo(function MixedText({ text, className }: { text: string; className?: string }) {
  const clean = stripFigureMarker(text)
  const parts = clean.split(/(\$[^$\n]+\$)/g)

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.length > 1 && part.startsWith('$') && part.endsWith('$')) {
          return <Math key={i} tex={part.slice(1, -1)} />
        }
        // Plain prose stays ONE text node; only tokens that hold a LaTeX command become <Math>.
        // (It used to create two <span>s per word, which made long passages slow to re-render.)
        const tokens = part.split(/(\s+)/)
        const out: React.ReactNode[] = []
        let run = ''
        tokens.forEach((token, j) => {
          if (/\\[a-zA-Z]/.test(token)) {
            if (run) out.push(run)
            run = ''
            out.push(<Math key={`${i}-${j}`} tex={token} />)
          } else {
            run += token
          }
        })
        if (run) out.push(run)
        return <span key={i}>{out}</span>
      })}
    </span>
  )
})
