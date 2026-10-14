'use client'

import { memo, useMemo } from 'react'
import { MixedText } from '@/components/math'
import { parseRichText } from '@/lib/question-layout'

/**
 * Text with inline `$math$` (via MixedText) where consecutive "a | b | c"
 * lines are drawn as a normal fully-bordered grid table (first row = header).
 * Renders block elements, so wrap it in a <div>, not a <p>.
 */
export const RichText = memo(function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = useMemo(() => parseRichText(text), [text])
  return (
    <>
      {blocks.map((b, i) =>
        b.kind === 'text' ? (
          <div key={i} className={`whitespace-pre-wrap ${className ?? ''}`}>
            <MixedText text={b.text} />
          </div>
        ) : (
          <div key={i} className="my-3 overflow-x-auto">
            <table className="border-collapse border border-[#111] text-[15px] text-[#111]">
              <tbody>
                {b.rows.map((row, r) => (
                  <tr key={r} className={r === 0 ? 'bg-[#f1f1f1] font-bold' : ''}>
                    {row.map((cell, c) => (
                      <td key={c} className="min-w-[88px] border border-[#111] px-4 py-1.5 text-center align-middle">
                        <MixedText text={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      )}
    </>
  )
})
