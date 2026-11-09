'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Flame, X } from 'lucide-react'
import type { QuizQuestion } from '@/lib/vocab'
import './vocab.css'

export type QuizResult = { id: number; ok: boolean }

const LETTERS = ['A', 'B', 'C', 'D']
const CONFETTI_COLORS = ['#ff6600', '#ffc400', '#22c55e', '#3b82f6', '#a855f7', '#ef4444']

function Confetti() {
  // 24 ta bo'lakcha: har biri tasodifiy yo'nalishda uchib, so'nadi (faqat CSS animatsiya — yengil)
  const bits = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 24 + Math.random() * 0.5
        const d = 90 + Math.random() * 110
        return {
          x: Math.cos(a) * d,
          y: Math.sin(a) * d - 40,
          r: Math.round(Math.random() * 720 - 360),
          c: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          delay: Math.random() * 0.08,
        }
      }),
    [],
  )
  return (
    <div className="vq-confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <i key={i} style={{ background: b.c, animationDelay: `${b.delay}s`, ['--x' as string]: `${b.x}px`, ['--y' as string]: `${b.y}px`, ['--r' as string]: `${b.r}deg` }} />
      ))}
    </div>
  )
}

/**
 * Quiz: har savolga `seconds` soniya, vaqt tugasa avtomatik keyingisiga o'tadi.
 * To'g'ri javobda konfetti. Natijalar `onDone` orqali BIR MARTA qaytariladi (saqlashni sahifa qiladi).
 */
export function VocabQuiz({
  questions,
  seconds = 25,
  onDone,
  onExit,
}: {
  questions: QuizQuestion[]
  seconds?: number
  onDone: (results: QuizResult[], mistakes: QuizQuestion[]) => void
  onExit: (partial: QuizResult[]) => void
}) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null) // tanlangan variant; -1 = vaqt tugadi
  const [streak, setStreak] = useState(0)
  const results = useRef<QuizResult[]>([])
  const mistakes = useRef<QuizQuestion[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const q = questions[i]
  const answered = picked !== null

  const clear = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => clear, [])

  const next = useCallback(() => {
    clear()
    if (i + 1 >= questions.length) onDone(results.current, mistakes.current)
    else {
      setI(i + 1)
      setPicked(null)
    }
  }, [i, questions.length, onDone])

  const answer = useCallback(
    (idx: number) => {
      if (picked !== null || !q) return
      clear()
      const ok = idx === q.answer
      results.current.push({ id: q.wordId, ok })
      if (!ok) mistakes.current.push(q)
      setStreak((s) => (ok ? s + 1 : 0))
      setPicked(idx)
    },
    [picked, q],
  )

  // Vaqt tugasa: xato hisoblanadi, to'g'ri javob ko'rsatilib, keyingisiga o'tadi
  useEffect(() => {
    if (!q || answered) return
    timer.current = setTimeout(() => answer(-1), seconds * 1000)
    return clear
  }, [i, answered, q, seconds, answer])

  // Javobdan keyin avtomatik keyingisiga (to'g'ri: tez, xato: javobni o'qishga vaqt)
  useEffect(() => {
    if (!answered || !q) return
    timer.current = setTimeout(next, picked === q.answer ? 1400 : 3000)
    return clear
  }, [answered, picked, q, next])

  // Klaviatura: 1-4 / A-D, Enter / bo'sh joy = keyingisi
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      const idx = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : 'abcd'.indexOf(k)
      if (k.length === 1 && idx >= 0 && idx < (q?.options.length ?? 0)) answer(idx)
      else if ((k === 'enter' || k === ' ') && answered) {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [q, answered, answer, next])

  if (!q) return null
  const kicker = q.kind === 'en2uz' ? 'Inglizcha → O‘zbekcha' : q.kind === 'uz2en' ? 'O‘zbekcha → Inglizcha' : 'Gapni to‘ldiring'

  return (
    <div className="vq-wrap">
      <div className="vq-top">
        <button type="button" className="vq-x" aria-label="Chiqish" onClick={() => onExit(results.current)}>
          <X size={20} />
        </button>
        <span>
          {i + 1} / {questions.length}
        </span>
        <div className={`vq-bar ${answered ? 'vq-paused' : ''}`}>
          <i key={`${i}-${answered ? 'p' : 'r'}`} style={{ animationDuration: `${seconds}s`, animationPlayState: answered ? 'paused' : 'running' }} />
        </div>
        <span className="vq-streak" title="Ketma-ket to‘g‘ri javoblar">
          <Flame size={16} /> {streak}
        </span>
      </div>

      <div className="vq-card" key={i}>
        {answered && picked === q.answer && <Confetti />}
        <div className="vq-kicker">{kicker}</div>
        <div className="vq-prompt">{q.prompt}</div>
        {q.sentence && (
          <div className="vq-sentence">
            {q.sentence.split('_____').map((part, n, arr) => (
              <span key={n}>
                {part}
                {n < arr.length - 1 && <mark>{answered ? q.options[q.answer] : '_____'}</mark>}
              </span>
            ))}
          </div>
        )}
        <div className="vq-opts">
          {q.options.map((o, n) => {
            const cls = !answered ? '' : n === q.answer ? 'vq-ok' : n === picked ? 'vq-bad' : ''
            return (
              <button key={n} type="button" className={`vq-opt ${cls}`} disabled={answered} onClick={() => answer(n)}>
                <i>{LETTERS[n]}</i>
                <span>{o}</span>
              </button>
            )
          })}
        </div>
        {answered && (
          <>
            <div className="vq-explain">
              {picked === q.answer ? '✅ To‘g‘ri! ' : picked === -1 ? '⏱ Vaqt tugadi. ' : '❌ Xato. '}
              {q.explain}
            </div>
            <button type="button" className="sd-primary vq-next" onClick={next}>
              Keyingisi →
            </button>
          </>
        )}
      </div>
    </div>
  )
}
