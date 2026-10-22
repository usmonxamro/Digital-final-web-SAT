'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, ChevronRight, Loader2, RotateCcw, XCircle } from 'lucide-react'
import { Ring } from '@/components/marketing/dashboard/ring'
import { QuestionStimulus } from '@/components/question-stimulus'
import { ChoiceContent } from '@/components/choice-content'
import { RichText } from '@/components/rich-text'
import { useI18n } from '@/components/i18n-provider'
import { topicName } from '@/lib/bank-meta'
import type { Choice, Question } from '@/lib/test-data'

type BankQ = {
  id: string
  type: 'mcq' | 'gridin'
  difficulty: 'Easy' | 'Medium' | 'Hard'
  topic_code: string
  topic: string
  prompt: string
  equations: string[] | null
  image: string | null
  choices: Choice[] | null
}
type Check = { correct: boolean; correctAnswer: string | null; explanation: string | null }

const asQuestion = (q: BankQ): Question => ({
  id: q.id,
  type: q.type,
  prompt: q.prompt,
  equations: q.equations ?? undefined,
  image: q.image ?? undefined,
})

/** A practice set from the book bank: answer, press «Tekshirish», see the right answer and the solution at once. */
export function BankSession({
  params,
  onExit,
  title,
  crumb,
}: {
  params: { section: string; topic?: string; difficulty?: string; n: number }
  onExit: () => void
  /** Topic name (or «Aralash mashq») and the section it belongs to — shown in the session header. */
  title?: string
  crumb?: string
}) {
  const { t, lang } = useI18n()
  const [qs, setQs] = useState<BankQ[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [pick, setPick] = useState('')
  const [checks, setChecks] = useState<Record<string, Check>>({})
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [run, setRun] = useState(0)
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let off = false
    setQs(null)
    setIdx(0)
    setPick('')
    setChecks({})
    setPicked({})
    const sp = new URLSearchParams({ section: params.section, n: String(params.n) })
    if (params.topic) sp.set('topic', params.topic)
    if (params.difficulty) sp.set('difficulty', params.difficulty)
    fetch(`/api/bank/session?${sp}`)
      .then((r) => r.json())
      .then((d) => !off && setQs(d.questions ?? []))
      .catch(() => !off && setQs([]))
    return () => {
      off = true
    }
  }, [params.section, params.topic, params.difficulty, params.n, run])

  if (!qs) {
    return (
      <div className="sd-qb-loading">
        <Loader2 className="animate-spin" /> {t('Savollar tayyorlanmoqda…')}
      </div>
    )
  }
  if (qs.length === 0) {
    return (
      <div className="sd-panel sd-empty">
        {t("Bu tanlov bo'yicha hozircha savol yo'q.")}
        <div style={{ marginTop: 14 }}>
          <button className="sd-soft" onClick={onExit}>
            {t('Orqaga')}
          </button>
        </div>
      </div>
    )
  }

  const done = idx >= qs.length
  const head = (
    <div className="sd-qbs-head">
      <button className="sd-qbs-exit" onClick={onExit} aria-label={t('Chiqish')}>
        <ArrowLeft />
      </button>
      <div className="sd-qbs-title">
        {crumb && <small>{crumb}</small>}
        <b>{title ?? t('Mashq')}</b>
      </div>
      {!done && <span className="sd-qbs-count">{idx + 1} / {qs.length}</span>}
    </div>
  )
  const dots = (
    <div className="sd-qbs-dots" aria-hidden={!done}>
      {qs.map((x, i) => {
        const c = checks[x.id]
        const cls = c ? (c.correct ? 'sd-ok' : 'sd-bad') : i === idx ? 'sd-cur' : ''
        return done ? (
          <button
            key={x.id}
            className={cls}
            onClick={() => {
              setIdx(i)
              setPick(picked[x.id] ?? '')
            }}
            title={`${t('Savol')} ${i + 1}`}
          >
            {i + 1}
          </button>
        ) : (
          <i key={x.id} className={cls} />
        )
      })}
    </div>
  )

  if (done) {
    const right = qs.filter((q) => checks[q.id]?.correct).length
    const pct = Math.round((right / qs.length) * 100)
    return (
      <div>
        {head}
        <div className="sd-qb-summary sd-qbs-summary">
          <Ring value={pct} size={110} stroke={10} color={pct >= 75 ? 'var(--sp-green)' : pct >= 50 ? 'var(--sp-yellow)' : '#ef4444'} />
          <div className="sd-qbs-summary-text">
            <div className="sd-qb-score">
              <strong>
                {right}/{qs.length}
              </strong>
              <span>{t('{p}% to‘g‘ri', { p: pct })}</span>
            </div>
            <p className="sd-note" style={{ margin: '0 0 12px' }}>
              {t("Raqamni bosing — savolni yechimi bilan qayta ko'rasiz.")}
            </p>
            {dots}
            <div className="sd-qb-actions">
              <button className="sd-primary" onClick={() => setRun((r) => r + 1)}>
                <RotateCcw size={16} /> {t('Yana mashq qilish')}
              </button>
              <button className="sd-soft" onClick={onExit}>
                {t('Mavzularga qaytish')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const q = qs[idx]
  const chk = checks[q.id]
  const chosen = chk ? (picked[q.id] ?? '') : pick

  async function check() {
    if (!chosen || busy || chk) return
    setBusy(true)
    setError(null)
    try {
      const r = await fetch('/api/bank/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: q.id, answer: chosen }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Xatolik')
      setChecks((c) => ({ ...c, [q.id]: d }))
      setPicked((p) => ({ ...p, [q.id]: chosen }))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Xatolik'))
    } finally {
      setBusy(false)
    }
  }

  function next() {
    setIdx((i) => i + 1)
    setPick('')
    setError(null)
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div ref={topRef} className="sd-qbs">
      {head}
      <div className="sd-qbs-sub">
        {dots}
        <span className={`sd-qb-diff sd-${q.difficulty.toLowerCase()}`}>{q.difficulty}</span>
      </div>

      <div className="sd-qb-card">
        <div className="sd-qb-topic">{topicName(q.topic_code, q.topic, lang)}</div>
        <div className="sd-qb-stem">
          <QuestionStimulus question={asQuestion(q)} withFigure textClassName="text-[16px] leading-[1.65] text-[#111]" plain />
        </div>

        {q.type === 'gridin' ? (
          <div className="sd-qb-grid">
            <label>{t('Javobingiz')}</label>
            <input
              value={chosen}
              disabled={!!chk}
              onChange={(e) => setPick(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && check()}
              inputMode="text"
              autoComplete="off"
              placeholder="12, 3/4, -0.5"
            />
            {chk && (
              <small>
                {t("To'g'ri javob")}: <b>{chk.correctAnswer}</b>
              </small>
            )}
          </div>
        ) : (
          <div className="sd-qb-opts">
            {(q.choices ?? []).map((c) => {
              const state = chk ? (c.id === chk.correctAnswer ? 'sd-right' : c.id === chosen ? 'sd-wrong' : '') : c.id === chosen ? 'sd-sel' : ''
              return (
                <button key={c.id} disabled={!!chk} className={`sd-qb-opt ${state}`} onClick={() => setPick(c.id)}>
                  <span className="sd-qb-letter">{c.id}</span>
                  <span className="sd-qb-opt-text">
                    <ChoiceContent choice={c} plain />
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {chk && (
          <div className={`sd-qb-feedback ${chk.correct ? 'sd-ok' : 'sd-bad'}`}>
            <div className="sd-qb-fb-head">
              {chk.correct ? <CheckCircle2 /> : <XCircle />}
              <b>{chk.correct ? t("To'g'ri!") : t("Noto'g'ri")}</b>
              {!chk.correct && chk.correctAnswer && (
                <span>
                  {t("To'g'ri javob")}: <b>{chk.correctAnswer}</b>
                </span>
              )}
            </div>
            {chk.explanation ? (
              <div className="sd-qb-expl">
                <RichText text={chk.explanation} />
              </div>
            ) : (
              <small>{t("Bu savol uchun yechim hali qo'shilmagan.")}</small>
            )}
          </div>
        )}
        {error && <div className="sd-code-error">{error}</div>}
      </div>

      <div className="sd-qb-actions sd-qbs-actions">
        {!chk ? (
          <button className="sd-primary" onClick={check} disabled={!chosen || busy}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : t('Tekshirish')}
          </button>
        ) : (
          <button className="sd-primary" onClick={next}>
            {idx + 1 >= qs.length ? t('Natijani ko‘rish') : t('Keyingi savol')} <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
