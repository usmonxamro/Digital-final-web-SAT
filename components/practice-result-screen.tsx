'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, X, Minus, ChevronDown } from 'lucide-react'
import { Math as MathTex, MixedText } from '@/components/math'
import { ChoiceContent } from '@/components/choice-content'
import type { Question } from '@/lib/test-data'
import { VideoAnalysisCta } from '@/components/score-report'
import { ReportQuestionButton } from '@/components/report-question'

export type PracticeReviewItem = {
  index: number
  question: Question
  answer?: string
  correct: boolean
  omitted: boolean
}

export function PracticeResultScreen({
  testTitle,
  elapsedLabel,
  review,
  videoHref,
}: {
  testTitle: string
  elapsedLabel: string
  review: PracticeReviewItem[]
  videoHref?: string
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const correct = review.filter((r) => r.correct).length
  const incorrect = review.filter((r) => !r.correct && !r.omitted).length
  const omitted = review.filter((r) => r.omitted).length

  return (
    <div className="min-h-dvh bg-[#f8fafc] px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0f172a] hover:underline"
        >
          <ArrowLeft className="size-4" />
          Dashboard&apos;ga qaytish
        </Link>

        <div className="rounded-md border border-[#cbd5e1] bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#64748b]">{testTitle}</p>
          <p className="mt-2 text-6xl font-black text-[#0f172a]">
            {correct} / {review.length}
          </p>
          <p className="mt-1 text-sm text-[#64748b]">to&apos;g&apos;ri javob &middot; sarflangan vaqt: {elapsedLabel}</p>
          <p className="mt-1 text-xs text-[#94a3b8]">
            Bu erkin mashq — shkala bo&apos;yicha ball berilmaydi, faqat to&apos;g&apos;ri/noto&apos;g&apos;ri ko&apos;rsatiladi.
          </p>

          <div className="mt-6 flex justify-center gap-6 text-sm">
            <span className="flex items-center gap-1.5 text-green-700">
              <Check className="size-4" /> {correct} to&apos;g&apos;ri
            </span>
            <span className="flex items-center gap-1.5 text-[#b91c1c]">
              <X className="size-4" /> {incorrect} xato
            </span>
            <span className="flex items-center gap-1.5 text-[#64748b]">
              <Minus className="size-4" /> {omitted} o&apos;tkazilgan
            </span>
          </div>
          {videoHref && <VideoAnalysisCta href={videoHref} />}
        </div>

        <div className="mt-8 overflow-hidden rounded-md border border-[#cbd5e1] bg-white shadow-sm">
          <div className="border-b border-[#e2e8f0] px-6 py-4">
            <h2 className="text-lg font-bold text-[#0f172a]">Savol-javob kaliti</h2>
            <p className="mt-1 text-xs text-[#64748b]">Savolni ochish uchun ustiga bosing.</p>
          </div>
          <div className="divide-y divide-[#e2e8f0]">
            {review.map((item, i) => {
              const open = openIndex === i
              return (
                <div key={i}>
                  <div className="relative">
                  <button
                    onClick={() => setOpenIndex(open ? null : i)}
                    className="flex w-full items-center gap-3 py-4 pl-4 pr-[3.5rem] text-left hover:bg-[#f8fafc] sm:pl-6 sm:pr-[4.5rem]"
                  >
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-sm text-sm font-bold ${
                        item.omitted
                          ? 'border border-slate-300 bg-slate-100 text-slate-500'
                          : item.correct
                            ? 'border border-green-300 bg-green-50 text-green-700'
                            : 'border border-red-300 bg-red-50 text-red-700'
                      }`}
                    >
                      {item.omitted ? <Minus className="size-4" /> : item.correct ? <Check className="size-4" /> : <X className="size-4" />}
                    </span>
                    <span className="flex-1 truncate text-sm font-medium text-[#0f172a]">
                      {item.index + 1}. <MixedText text={item.question.prompt} />
                    </span>
                    <ChevronDown className={`size-4 shrink-0 text-[#94a3b8] transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 sm:right-5">
                    <ReportQuestionButton testLabel={testTitle} qNumber={item.index + 1} question={item.question} />
                  </span>
                  </div>
                  {open && (
                    <div className="bg-[#f8fafc] px-6 py-4">
                      {item.question.type === 'gridin' ? (
                        <div className="flex flex-wrap gap-4 text-sm">
                          <span>
                            <span className="font-semibold text-[#475569]">Sizning javobingiz: </span>
                            {item.answer ?? "\u2014 (o'tkazib yuborilgan)"}
                          </span>
                          <span>
                            <span className="font-semibold text-[#475569]">To&apos;g&apos;ri javob: </span>
                            {item.question.correctValue}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {item.question.choices?.map((c) => {
                            const isCorrect = c.id === item.question.correct
                            const isChosen = c.id === item.answer
                            return (
                              <div
                                key={c.id}
                                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                                  isCorrect
                                    ? 'border-green-300 bg-green-50 text-green-800'
                                    : isChosen
                                      ? 'border-red-300 bg-red-50 text-red-800'
                                      : 'border-slate-200 text-slate-600'
                                }`}
                              >
                                <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-current text-[11px] font-bold">
                                  {c.id}
                                </span>
                                <ChoiceContent choice={c} scale={item.question.layout?.choiceImg?.[c.id]?.scale} />
                                {isCorrect && <span className="ml-auto text-xs font-semibold">To&apos;g&apos;ri javob</span>}
                                {isChosen && !isCorrect && <span className="ml-auto text-xs font-semibold">Sizning javobingiz</span>}
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {item.question.explanation && (
                        <p className="whitespace-pre-line mt-3 rounded-lg bg-white p-3 text-sm text-[#334155]">
                          <MixedText text={item.question.explanation} />
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
