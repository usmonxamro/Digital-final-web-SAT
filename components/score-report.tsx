'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, X, Minus, ChevronDown, Award, ArrowLeft, Home, Play } from 'lucide-react'
import { RichText } from '@/components/rich-text'
import { QuestionImage } from '@/components/question-image'
import { Math, MixedText } from '@/components/math'
import { Button } from '@/components/ui/button'
import { Certificate } from '@/components/certificate'
import type { SectionResult } from '@/lib/scoring'
import type { Question } from '@/lib/test-data'

export type ReviewItem = {
  moduleLabel: string
  sectionKind: 'reading' | 'math'
  index: number
  question: Question
  answer?: string
  correct: boolean
  omitted: boolean
}

type ScoreReportProps = {
  studentName: string
  testTitle: string
  composite: number
  rw: SectionResult
  math: SectionResult
  elapsedLabel: string
  review: ReviewItem[]
  /** Full SAT is out of 1600; a single-subject scored test is out of 800. */
  outOf?: number
  /** When set, only this section's card is shown (single-subject test) instead of both. */
  singleSection?: 'reading' | 'math'
  /** Hide the official-style certificate for non-full tests, to avoid misrepresenting a partial test as a full SAT score. */
  showCertificateButton?: boolean
  /** Link to this mock's video analysis, when one exists. */
  videoHref?: string
}

function StatusBadge({ item }: { item: ReviewItem }) {
  if (item.omitted) {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 text-slate-500">
        <Minus className="size-4" />
      </span>
    )
  }
  return item.correct ? (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-green-300 bg-green-50 text-green-700">
      <Check className="size-4" />
    </span>
  ) : (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-red-300 bg-red-50 text-red-700">
      <X className="size-4" />
    </span>
  )
}

function answerLabel(question: Question, answer?: string) {
  if (!answer) return 'Omitted'
  if (question.type === 'gridin') return answer
  const choice = question.choices?.find((c) => c.id === answer)
  return choice ? `${answer}` : answer
}

function correctLabel(question: Question) {
  if (question.type === 'gridin') return question.correctValue ?? ''
  return question.correct ?? ''
}

function QuestionDetail({ item }: { item: ReviewItem }) {
  const q = item.question
  return (
    <div className="border-t border-[#e2e8f0] bg-[#f8fafc] p-4 sm:p-5">
      {q.passage && (
        <p className="mb-3 whitespace-pre-line rounded-lg border border-[#e2e8f0] bg-white p-3 text-sm leading-relaxed text-[#334155]">
          {q.passage}
        </p>
      )}
      {q.equations?.map((eq) => (
        <div key={eq} className="my-1.5 [&_.katex-display]:!my-1">
          <Math tex={eq} display />
        </div>
      ))}
      {q.image && <QuestionImage src={q.image} scale={q.layout?.img?.scale} />}
      <div className="text-[15px] font-medium text-[#0f172a]">
        <RichText text={q.prompt} />
      </div>

      {q.choices && q.choices.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          {q.choices.map((c) => {
            const isCorrect = c.id === q.correct
            const isChosen = c.id === item.answer
            return (
              <div
                key={c.id}
                className={`flex items-center gap-2 rounded-sm border px-3 py-1.5 text-sm ${
                  isCorrect
                    ? 'border-green-300 bg-green-50 text-green-800'
                    : isChosen
                      ? 'border-red-300 bg-red-50 text-red-800'
                      : 'border-[#e2e8f0] bg-white text-[#475569]'
                }`}
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-current text-[11px] font-bold">
                  {c.id}
                </span>
                <span>{c.tex ? <Math tex={c.tex} /> : <MixedText text={c.text ?? ''} />}</span>
                {isCorrect && <span className="ml-auto text-xs font-semibold">To&apos;g&apos;ri javob</span>}
                {isChosen && !isCorrect && <span className="ml-auto text-xs font-semibold">Sizning javobingiz</span>}
              </div>
            )
          })}
        </div>
      )}

      {q.type === 'gridin' && (
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <span>
            <span className="font-semibold text-[#475569]">Sizning javobingiz: </span>
            {item.answer ?? '\u2014 (o\u2018tkazib yuborilgan)'}
          </span>
          <span>
            <span className="font-semibold text-[#475569]">To&apos;g&apos;ri javob: </span>
            {q.correctValue}
          </span>
        </div>
      )}

      {q.explanation && (
        <p className="whitespace-pre-line mt-3 rounded-lg bg-white p-3 text-sm text-[#334155]"><MixedText text={q.explanation} /></p>
      )}
    </div>
  )
}

export function ScoreReport({
  studentName,
  testTitle,
  composite,
  rw,
  math,
  elapsedLabel,
  review,
  outOf = 1600,
  singleSection,
  showCertificateButton = true,
  videoHref,
}: ScoreReportProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [showCertificate, setShowCertificate] = useState(false)

  return (
    <div className="min-h-dvh bg-[#f8fafc] px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/dashboard"
          className="mb-5 inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#2563eb,#0ea5e9)] px-5 py-3 text-[15px] font-extrabold text-white shadow-[0_8px_22px_rgba(37,99,235,.35)] transition-transform hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(37,99,235,.45)]"
        >
          <ArrowLeft className="size-5" />
          Dashboard&apos;ga qaytish
        </Link>
        <div className="rounded-md border border-[#cbd5e1] bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#64748b]">Total Score</p>
          <p className="mt-2 text-6xl font-black text-[#0f172a]">{composite}</p>
          <p className="mt-1 text-sm text-[#64748b]">out of {outOf} &middot; completed in {elapsedLabel}</p>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SectionCard title="Reading and Writing" result={rw} skipped={singleSection === 'math'} />
            <SectionCard title="Math" result={math} skipped={singleSection === 'reading'} />
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {showCertificateButton && (
              <button
                type="button"
                onClick={() => setShowCertificate(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#16a34a,#10b981)] px-6 py-3 text-[15px] font-extrabold text-white shadow-[0_8px_22px_rgba(22,163,74,.35)] transition-transform hover:-translate-y-0.5"
              >
                <Award className="size-5" />
                Sertifikat (PDF)
              </button>
            )}
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#2563eb,#6366f1)] px-6 py-3 text-[15px] font-extrabold text-white shadow-[0_8px_22px_rgba(79,70,229,.35)] transition-transform hover:-translate-y-0.5"
            >
              <Home className="size-5" />
              Dashboard&apos;ga qaytish
            </Link>
          </div>
          {videoHref && <VideoAnalysisCta href={videoHref} />}
        </div>

        <div className="mt-8 overflow-hidden rounded-md border border-[#e2e8f0] bg-white shadow-sm">
          <div className="border-b border-[#e2e8f0] px-6 py-4">
            <h2 className="text-lg font-bold text-[#0f172a]">Question Review</h2>
            <p className="mt-1 text-xs text-[#64748b]">
              Yashil = to&apos;g&apos;ri, qizil = noto&apos;g&apos;ri, kulrang = o&apos;tkazib yuborilgan.
              Savolni ochish uchun ustiga bosing.
            </p>
          </div>

          <div className="grid grid-cols-[3rem_1fr_auto_auto_auto] items-center gap-2 border-b border-[#e2e8f0] bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#64748b] sm:px-6">
            <span>#</span>
            <span>Section</span>
            <span className="hidden sm:block">Your Answer</span>
            <span className="hidden sm:block">Correct</span>
            <span></span>
          </div>

          <div className="divide-y divide-[#e2e8f0]">
            {review.map((item, i) => {
              const isOpen = openIndex === i
              const prev = review[i - 1]
              const isNewModule = !prev || prev.moduleLabel !== item.moduleLabel
              const isMathStart = isNewModule && item.sectionKind === 'math' && prev?.sectionKind === 'reading'

              return (
                <div key={i}>
                  {isMathStart && (
                    <div className="border-y-2 border-[#0f172a] bg-[#eef1f5] px-4 py-2 text-center text-xs font-bold uppercase tracking-wide text-[#0f172a] sm:px-6">
                      Math bo&apos;limi boshlandi
                    </div>
                  )}
                  {isNewModule && (
                    <div className="bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#334155] sm:px-6">
                      {item.moduleLabel}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="grid w-full grid-cols-[3rem_1fr_auto_auto_auto] items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-slate-50 sm:px-6"
                  >
                    <span className="flex items-center gap-2">
                      <StatusBadge item={item} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[#0f172a]">
                        Q{item.index + 1}
                      </span>
                      <span className="block truncate text-xs text-[#64748b]">{item.moduleLabel}</span>
                    </span>
                    <span className="hidden text-sm font-medium text-[#334155] sm:block">
                      {answerLabel(item.question, item.answer)}
                    </span>
                    <span className="hidden text-sm font-medium text-[#0f172a] sm:block">
                      {correctLabel(item.question)}
                    </span>
                    <ChevronDown
                      className={`size-4 text-[#94a3b8] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {isOpen && <QuestionDetail item={item} />}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {showCertificate && (
        <Certificate
          studentName={studentName}
          testTitle={testTitle}
          composite={composite}
          rw={rw}
          math={math}
          review={review}
          onClose={() => setShowCertificate(false)}
        />
      )}
    </div>
  )
}

function SectionCard({ title, result, skipped }: { title: string; result: SectionResult; skipped?: boolean }) {
  return (
    <div className={`rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-4 text-left ${skipped ? 'opacity-70' : ''}`}>
      <p className="text-sm font-semibold text-[#0f172a]">{title}</p>
      <p className="mt-1 text-3xl font-bold text-[#0f172a]">{result.scaled}</p>
      <p className="text-xs text-[#64748b]">out of 800</p>
      {skipped ? (
        <p className="mt-3 text-xs text-[#475569]">Bu bo&apos;lim topshirilmadi — minimal 200 ball beriladi.</p>
      ) : (
        <div className="mt-3 flex gap-3 text-xs text-[#475569]">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-green-500" /> {result.correct} correct
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-red-500" /> {result.incorrect} incorrect
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-slate-400" /> {result.omitted} omitted
          </span>
        </div>
      )}
    </div>
  )
}

/** "Watch the video analysis" call-to-action under a finished test's score. */
export function VideoAnalysisCta({ href }: { href: string }) {
  return (
    <a
      href={href}
      className="mt-6 flex items-center gap-4 rounded-xl border border-[#fed7aa] bg-[linear-gradient(120deg,#fff7ed,#ffedd5)] p-4 text-left transition-shadow hover:shadow-md"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#FF6600] text-white shadow-[0_6px_20px_rgba(255,102,0,0.35)]">
        <Play className="ml-0.5 size-5 fill-current" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-extrabold text-[#7c2d12]">Video tahlilni ko&apos;ring</span>
        <span className="block text-[12.5px] text-[#9a3412]">Har bir savol ustoz tomonidan tushuntirilgan</span>
      </span>
    </a>
  )
}
