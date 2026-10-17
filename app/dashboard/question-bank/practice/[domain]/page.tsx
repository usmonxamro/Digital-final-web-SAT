'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react'
import { Math as MathTex, MixedText } from '@/components/math'
import { ChoiceImage } from '@/components/choice-content'
import { isCorrectAnswer } from '@/lib/test-data'
import { skillPracticePool, SKILL_DOMAINS, type SkillDomain } from '@/lib/skill-practice-data'

export default function SkillDrillPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain: rawDomain } = use(params)
  const domain = decodeURIComponent(rawDomain) as SkillDomain
  const questions = SKILL_DOMAINS.includes(domain) ? skillPracticePool[domain] : []

  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [gridValue, setGridValue] = useState('')
  const [phase, setPhase] = useState<'quiz' | 'summary'>('quiz')
  const [submitting, setSubmitting] = useState(false)

  if (questions.length === 0) {
    return (
      <div className="max-w-[560px]">
        <Link href="/dashboard/question-bank" className="inline-flex items-center gap-1.5 text-sp-text-muted text-[13px] font-semibold mb-6">
          <ArrowLeft size={14} /> Savol bankiga qaytish
        </Link>
        <div className="sp-glass rounded-2xl p-6">
          <h1 className="text-[18px] font-bold text-sp-text">&quot;{domain}&quot; uchun hali savol yo&apos;q</h1>
          <p className="mt-2 text-[14px] text-sp-text-muted">
            Bu ko&apos;nikma bo&apos;yicha savollar hali qo&apos;shilmagan. /admin panel orqali yoki
            lib/skill-practice-data.ts fayliga qo&apos;shib qo&apos;ying.
          </p>
        </div>
      </div>
    )
  }

  const question = questions[index]

  function selectMcq(choiceId: string) {
    setAnswers((a) => ({ ...a, [index]: choiceId }))
  }

  function submitGrid() {
    if (gridValue.trim()) setAnswers((a) => ({ ...a, [index]: gridValue.trim() }))
  }

  async function finish(finalAnswers: Record<number, string>) {
    setSubmitting(true)
    let correct = 0
    const review = questions.map((q, i) => {
      const answer = finalAnswers[i]
      const ok = isCorrectAnswer(q, answer)
      if (ok) correct++
      return { domain: q.domain ?? domain, correct: ok, omitted: !answer }
    })

    await fetch('/api/skill-drills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, correctCount: correct, totalCount: questions.length, review }),
    }).catch(() => {})

    setSubmitting(false)
    setPhase('summary')
  }

  function next() {
    if (question.type === 'gridin') submitGrid()
    const isLast = index === questions.length - 1
    if (isLast) {
      const finalAnswers = question.type === 'gridin' && gridValue.trim() ? { ...answers, [index]: gridValue.trim() } : answers
      finish(finalAnswers)
    } else {
      setIndex((i) => i + 1)
      setGridValue('')
    }
  }

  function restart() {
    setIndex(0)
    setAnswers({})
    setGridValue('')
    setPhase('quiz')
  }

  if (phase === 'summary') {
    const correctCount = questions.filter((q, i) => isCorrectAnswer(q, answers[i])).length
    const pct = Math.round((correctCount / questions.length) * 100)
    return (
      <div className="max-w-[560px]">
        <div className="sp-glass rounded-2xl p-7 text-center">
          <div className="text-[13px] font-bold text-sp-text-muted uppercase tracking-wide">{domain}</div>
          <div className="font-extrabold text-[44px] text-sp-orange mt-2">{pct}%</div>
          <p className="text-[14px] text-sp-text-muted mt-1">
            {correctCount} / {questions.length} savol to&apos;g&apos;ri
          </p>
          <div className="flex gap-3 mt-6 justify-center">
            <button
              onClick={restart}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-sp-border text-sp-text text-[13.5px] font-bold hover:border-sp-green"
            >
              <RotateCcw size={14} /> Qayta urinish
            </button>
            <Link
              href="/dashboard/question-bank"
              className="px-4 py-2.5 rounded-lg text-[#1A1200] text-[13.5px] font-bold bg-sp-orange shadow-[0_4px_15px_rgba(255,102,0,0.25)] hover:shadow-[0_0_25px_rgba(255,102,0,0.5)] transition-all duration-300"
            >
              Boshqa ko&apos;nikma
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[640px]">
      <Link href="/dashboard/question-bank" className="inline-flex items-center gap-1.5 text-sp-text-muted text-[13px] font-semibold mb-5">
        <ArrowLeft size={14} /> Savol bankiga qaytish
      </Link>

      <div className="flex items-center justify-between mb-3">
        <span className="inline-block text-[12.5px] font-extrabold text-[#1A1200] bg-sp-orange px-3 py-1 rounded-md">
          {domain} — {index + 1} / {questions.length}
        </span>
      </div>
      <div className="h-1.5 rounded bg-sp-border overflow-hidden mb-6">
        <div
          className="h-full rounded bg-sp-orange transition-all duration-500"
          style={{ width: `${((index + 1) / questions.length) * 100}%` }}
        />
      </div>

      <div className="sp-glass rounded-2xl p-6">
        {question.difficulty && (
          <span className="inline-block text-[10.5px] font-bold text-sp-text-muted bg-sp-input px-2 py-0.5 rounded-md mb-3">
            {question.difficulty.toUpperCase()}
          </span>
        )}

        {question.passage && (
          <p className="text-[13.5px] leading-relaxed text-sp-text-muted mb-4 pb-4 border-b border-sp-border">
            {question.passage}
          </p>
        )}

        {question.equations?.map((eq, i) => (
          <div key={i} className="my-2 text-sp-text">
            <MathTex tex={eq} display />
          </div>
        ))}
        <p className="whitespace-pre-line text-[15px] font-semibold text-sp-text mb-1"><MixedText text={question.prompt} /></p>

        {question.type === 'gridin' ? (
          <input
            value={gridValue}
            onChange={(e) => setGridValue(e.target.value)}
            placeholder="Javobingizni kiriting"
            className="w-full mt-4 px-3.5 py-3 rounded-[10px] border border-sp-border bg-sp-input text-sp-text text-[14.5px] focus:outline-none focus:border-sp-orange"
          />
        ) : (
          <div className="mt-4 space-y-2.5">
            {question.choices?.map((c) => {
              const selected = answers[index] === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => selectMcq(c.id)}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border text-left text-[13.5px] font-medium transition-all duration-200 ${
                    selected
                      ? 'border-sp-orange bg-sp-orange/[0.15] text-sp-text shadow-[0_0_15px_rgba(255,102,0,0.2)]'
                      : 'border-sp-border text-sp-text-muted hover:border-sp-orange/50 hover:bg-sp-orange/[0.05]'
                  }`}
                >
                  <span
                    className={`w-8 h-8 rounded-full border flex items-center justify-center text-[13px] font-bold shrink-0 ${
                      selected ? 'bg-sp-orange text-[#1A1200] border-sp-orange' : 'border-sp-border bg-sp-input text-sp-text'
                    }`}
                  >
                    {c.id}
                  </span>
                  <span className="flex min-w-0 flex-col items-start gap-1.5">
                    {c.image && <ChoiceImage src={c.image} />}
                    {c.tex ? <MathTex tex={c.tex} /> : c.text}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <button
        onClick={next}
        disabled={submitting}
        className="w-full mt-5 py-3 rounded-[11px] font-bold text-[14.5px] text-[#1A1200] flex items-center justify-center gap-2 disabled:opacity-60 bg-sp-orange shadow-[0_4px_15px_rgba(255,102,0,0.25)] hover:shadow-[0_0_25px_rgba(255,102,0,0.5)] hover:scale-[1.02] transition-all duration-300"
      >
        {index === questions.length - 1 ? "Yakunlash" : 'Keyingi savol'} <ArrowRight size={15} />
      </button>
    </div>
  )
}
