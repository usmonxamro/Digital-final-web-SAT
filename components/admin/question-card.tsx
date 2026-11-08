'use client'

import { ChoiceContent } from '@/components/choice-content'
import { QuestionImage } from '@/components/question-image'
import { QuestionStimulus } from '@/components/question-stimulus'
import { RichText } from '@/components/rich-text'
import type { Question } from '@/lib/test-data'

/** A question drawn as the student saw it (math rendered, figure, options) with the key marked green — for admin lists. */
export function QuestionCard({ q, compact = false }: { q: Question & { kind?: 'reading' | 'math' }; compact?: boolean }) {
  const reading = q.kind === 'reading' || (!q.kind && !!q.passage)
  const textCls = `q-ink ${compact ? 'text-[14px]' : 'text-[15px]'} leading-[1.55] text-ink`
  return (
    <div className={reading ? 'grid gap-4 md:grid-cols-2' : ''}>
      {reading && (q.passage || q.image) && (
        <div className="min-w-0 md:border-r md:border-line md:pr-4">
          {q.passage && <div className="whitespace-pre-line font-serif text-[14.5px] leading-[1.6] text-ink">{q.passage}</div>}
          {q.image && <QuestionImage src={q.image} scale={q.layout?.img?.scale} plain />}
        </div>
      )}
      <div className="min-w-0">
        <div className="mb-2.5">
          <QuestionStimulus question={q} withFigure={!reading} textClassName={textCls} plain />
        </div>
        {q.type === 'gridin' ? (
          <div className="inline-flex items-center gap-2 rounded-lg border-[1.5px] border-[#16a34a] bg-[#16a34a]/10 px-3 py-1.5 text-[13px] font-bold text-green-deep">
            Javob: {q.correctValue ?? '—'}
          </div>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {(q.choices ?? []).map((c) => {
              const right = q.correct === c.id
              return (
                <div
                  key={c.id}
                  className={`flex min-h-[38px] items-center gap-2.5 rounded-lg px-2.5 py-1.5 ${
                    right ? 'border-2 border-[#16a34a] bg-[#16a34a]/10' : 'border border-line'
                  }`}
                >
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
                      right ? 'border-[#16a34a] bg-[#16a34a] text-white' : 'border-ink-faint text-ink'
                    }`}
                  >
                    {c.id}
                  </span>
                  <span className="q-ink min-w-0 text-[13.5px] text-ink">
                    <ChoiceContent choice={c} scale={q.layout?.choiceImg?.[c.id]?.scale} plain />
                  </span>
                </div>
              )
            })}
          </div>
        )}
        {q.explanation && !compact && (
          <details className="mt-2 text-[12px] text-ink-soft">
            <summary className="cursor-pointer font-bold text-ink">Yechim</summary>
            <div className="q-ink mt-1 text-[13px] leading-relaxed text-ink">
              <RichText text={q.explanation} />
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
