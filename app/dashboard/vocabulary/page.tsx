'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BookOpenCheck, Brain, CalendarClock, Languages, Layers, RotateCcw, Send, Sparkles } from 'lucide-react'
import { VocabQuiz, type QuizResult } from '@/components/vocab/vocab-quiz'
import {
  DEFAULT_COUNT,
  DEFAULT_SECONDS,
  buildQuiz,
  isDue,
  isWeeklyMistake,
  masteredCount,
  pickSessionWords,
  type QuizQuestion,
  type SessionMode,
  type VocabProgress,
  type VocabWord,
} from '@/lib/vocab'
import type { VocabSessionData } from '@/app/api/vocab/session/route'
import '@/components/vocab/vocab.css'

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || 'https://t.me/SAT_surxon'

type Phase = { name: 'hub' } | { name: 'quiz'; questions: QuizQuestion[]; label: string } | { name: 'result'; results: QuizResult[]; mistakes: QuizQuestion[]; saved: boolean | null }

export default function VocabularyPage() {
  const [data, setData] = useState<VocabSessionData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>({ name: 'hub' })
  const [count, setCount] = useState(DEFAULT_COUNT)
  const [search, setSearch] = useState('')
  const [showList, setShowList] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/vocab/session?subject=math', { cache: 'no-store' })
      const d = await res.json()
      if (!res.ok) setError(d.error ?? "Lug'atni yuklab bo'lmadi.")
      else setData(d)
    } catch {
      setError("Server bilan bog'lanib bo'lmadi.")
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const words: VocabWord[] = useMemo(() => data?.words ?? [], [data])
  const progress = useMemo(() => new Map<number, VocabProgress>((data?.progress ?? []).map((p) => [p.word_id, p])), [data])
  const cats = useMemo(() => {
    const m = new Map<string, number>()
    for (const w of words) m.set(w.cat, (m.get(w.cat) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [words])
  const now = new Date()
  const dueCount = (data?.progress ?? []).filter((p) => p.wrong_n > 0 && isDue(p, now)).length
  const weeklyCount = (data?.progress ?? []).filter((p) => isWeeklyMistake(p, now)).length
  const mastered = masteredCount(data?.progress ?? [])

  const start = (mode: SessionMode, label: string, cat?: string) => {
    const picked = pickSessionWords(words, progress, mode, count, { cat })
    const questions = buildQuiz(words, picked)
    if (!questions.length) {
      setError('Bu rejim uchun hozircha so‘z yo‘q.')
      return
    }
    setError(null)
    setPhase({ name: 'quiz', questions, label })
  }

  const save = useCallback(
    async (results: QuizResult[], keepalive = false) => {
      if (!results.length) return true
      try {
        const res = await fetch('/api/vocab/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ results }),
          keepalive,
        })
        return res.ok
      } catch {
        return false
      }
    },
    [],
  )

  const finish = useCallback(
    async (results: QuizResult[], mistakes: QuizQuestion[]) => {
      setPhase({ name: 'result', results, mistakes, saved: null })
      const ok = await save(results)
      setPhase((p) => (p.name === 'result' ? { ...p, saved: ok } : p))
      load() // yangilangan statistika
    },
    [save, load],
  )

  // Sahifa yopilsa ham, javob berilgan qismi saqlansin
  const exit = (partial: QuizResult[]) => {
    if (partial.length) save(partial, true).then(() => load())
    setPhase({ name: 'hub' })
  }

  if (phase.name === 'quiz') {
    return <VocabQuiz key={phase.label + phase.questions.length + phase.questions[0]?.wordId} questions={phase.questions} seconds={DEFAULT_SECONDS} onDone={finish} onExit={exit} />
  }

  if (phase.name === 'result') {
    const total = phase.results.length
    const right = phase.results.filter((r) => r.ok).length
    const pct = total ? Math.round((right / total) * 100) : 0
    return (
      <div className="vq-wrap vq-res">
        <div className="vq-card">
          <div className="vq-ring" style={{ ['--p' as string]: pct }}>
            <span>{pct}%</span>
          </div>
          <h2 style={{ margin: '0 0 6px' }}>
            {right} / {total} to‘g‘ri
          </h2>
          <p style={{ margin: 0, fontWeight: 700 }}>{pct >= 80 ? '🔥 Zo‘r natija!' : pct >= 50 ? '👍 Yomon emas, davom eting!' : '💪 Xatolarni takrorlasangiz, tez o‘sasiz.'}</p>
          {phase.saved === false && <div className="vq-warn" style={{ marginTop: 12 }}>Natijani saqlab bo‘lmadi (internetni tekshiring). Keyingi safar qayta urinib ko‘ring.</div>}
          {phase.mistakes.length > 0 && (
            <div className="vq-miss">
              <h3>Xato qilingan so‘zlar ({phase.mistakes.length})</h3>
              {phase.mistakes.map((m, n) => (
                <div className="vq-row" key={n}>
                  <b>{m.explain.split(' = ')[0]}</b>
                  <span>{m.explain.split(' = ').slice(1).join(' = ')}</span>
                </div>
              ))}
            </div>
          )}
          <div className="vq-actions">
            {phase.mistakes.length > 0 && (
              <button
                type="button"
                className="sd-primary"
                onClick={() => {
                  const ids = new Set(phase.mistakes.map((m) => m.wordId))
                  const picked = words.filter((w) => ids.has(w.id))
                  const questions = buildQuiz(words, picked)
                  if (questions.length) setPhase({ name: 'quiz', questions, label: 'retry' + Date.now() })
                }}
              >
                <RotateCcw /> Xatolarni qayta yechish
              </button>
            )}
            <button type="button" className="sd-soft" onClick={() => setPhase({ name: 'hub' })}>
              Lug‘atlar sahifasi
            </button>
          </div>
        </div>
      </div>
    )
  }

  const filtered = search.trim() ? words.filter((w) => (w.en + ' ' + w.uz).toLowerCase().includes(search.trim().toLowerCase())) : words

  return (
    <div className="vq-wrap">
      <div className="sd-page-header">
        <div>
          <div className="sd-eyebrow">SAT by Usmon / Lug‘atlar</div>
          <h1>Lug‘atlar</h1>
        </div>
        <span className="sd-pill">Math uchun</span>
      </div>

      <div className="vq-tabs">
        <button type="button" className="vq-tab vq-on">
          <Languages size={14} style={{ verticalAlign: -2 }} /> SAT Math
        </button>
        <button type="button" className="vq-tab" disabled title="Tez orada">
          SAT English · tez orada
        </button>
      </div>

      {error && <div className="vq-warn">{error}</div>}
      {!data && !error && <div className="vq-warn">Yuklanmoqda…</div>}

      {data && (
        <>
          <div className="vq-hub-grid">
            <div className="vq-stat">
              <b>{words.length}</b>
              <span>jami so‘z</span>
            </div>
            <div className="vq-stat">
              <b>{mastered}</b>
              <span>yaxshi bilasiz</span>
            </div>
            <div className="vq-stat">
              <b>{dueCount}</b>
              <span>takrorlash kerak</span>
            </div>
          </div>

          <div className="vq-count">
            Savollar soni:
            {[10, 15, 20, 30].map((n) => (
              <button key={n} type="button" className={count === n ? 'vq-on' : ''} onClick={() => setCount(n)}>
                {n}
              </button>
            ))}
          </div>

          <div className="vq-modes">
            <button type="button" className="vq-mode vq-main" onClick={() => start('mix', 'mix')}>
              <span className="vq-mode-ico">
                <Sparkles />
              </span>
              <span>
                <b>Aralash quiz</b>
                <small>Yangi so‘zlar + xato qilganlaringiz · har savolga 25 soniya</small>
              </span>
            </button>
            <button type="button" className="vq-mode" disabled={dueCount === 0} onClick={() => start('review', 'review')}>
              <span className="vq-mode-ico">
                <Brain />
              </span>
              <span>
                <b>Xatolarni takrorlash{dueCount ? ` (${dueCount})` : ''}</b>
                <small>Xato qilgan so‘zlaringiz intervalli takrorlash bilan qaytadi</small>
              </span>
            </button>
            <button type="button" className="vq-mode" disabled={weeklyCount === 0} onClick={() => start('weekly', 'weekly')}>
              <span className="vq-mode-ico">
                <CalendarClock />
              </span>
              <span>
                <b>Haftalik takrorlash{weeklyCount ? ` (${weeklyCount})` : ''}</b>
                <small>O‘tgan 7 kunda xato qilingan so‘zlar</small>
              </span>
            </button>
          </div>

          <div className="vq-kicker" style={{ marginBottom: 8 }}>
            <Layers size={13} style={{ verticalAlign: -2 }} /> Bo‘lim bo‘yicha
          </div>
          <div className="vq-chips">
            {cats.map(([c, n]) => (
              <button key={c} type="button" className="vq-chip" onClick={() => start('cat', 'cat-' + c, c)}>
                {c} · {n}
              </button>
            ))}
          </div>

          <div className="vq-warn">
            <Send size={14} style={{ verticalAlign: -2 }} /> Telegramda ham mashq qilishingiz mumkin: guruhda <b>/lugat</b> yozing yoki{' '}
            <a href={BOT_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--sd-accent)', fontWeight: 800 }}>
              botni oching
            </a>
            . Bot va sayt natijalari bitta joyda hisoblanadi (kurs kodi orqali ulangan bo‘lsa).
          </div>

          <button type="button" className="sd-soft" onClick={() => setShowList((v) => !v)} style={{ marginBottom: 10 }}>
            <BookOpenCheck /> {showList ? 'So‘zlar ro‘yxatini yopish' : 'Barcha so‘zlar ro‘yxati'}
          </button>
          {showList && (
            <div className="vq-list">
              <input placeholder="So‘z qidirish (inglizcha yoki o‘zbekcha)…" value={search} onChange={(e) => setSearch(e.target.value)} />
              {filtered.slice(0, 80).map((w) => (
                <div className="vq-row" key={w.id}>
                  <b>{w.en}</b>
                  <span>{w.uz}</span>
                </div>
              ))}
              {filtered.length > 80 && <div className="vq-row"><span>… yana {filtered.length - 80} ta. Qidiruv orqali toping.</span></div>}
              {!filtered.length && <div className="vq-row"><span>Hech narsa topilmadi.</span></div>}
            </div>
          )}
          <p style={{ fontSize: 12, opacity: 0.7, marginTop: 14 }}>
            Tarjimada xato topsangiz, <Link href="/dashboard/profile" style={{ color: 'var(--sd-accent)' }}>Yordam</Link> orqali yozing — ustoz tuzatadi.
          </p>
        </>
      )}
    </div>
  )
}
