'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Play, TrendingDown } from 'lucide-react'

type SkillStat = { domain: string; correct: number; total: number; accuracy: number }

export default function QuestionBankPage() {
  const [skills, setSkills] = useState<SkillStat[] | null>(null)

  useEffect(() => {
    fetch('/api/skills')
      .then((r) => r.json())
      .then((d) => setSkills(d.skills ?? []))
      .catch(() => setSkills([]))
  }, [])

  const weakest = skills?.filter((s) => s.total > 0).slice(0, 1)[0]

  return (
    <div className="max-w-[680px]">
      <h1 className="text-[24px] font-extrabold text-sp-text">Savol banki</h1>
      <p className="mt-1.5 text-sp-text-muted text-[14px]">
        Har bir ko&apos;nikmadagi aniqligingiz — eng zaif joydan mashq qiling.
      </p>

      {weakest && (
        <Link
          href={`/dashboard/question-bank/practice/${encodeURIComponent(weakest.domain)}`}
          className="mt-6 flex items-center justify-between sp-glass sp-hover-glow-orange rounded-2xl p-5 border-sp-orange/30"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sp-orange/10 flex items-center justify-center text-sp-orange shrink-0">
              <TrendingDown size={18} />
            </div>
            <div>
              <div className="text-[12px] font-bold text-sp-text-muted uppercase tracking-wide">Tavsiya</div>
              <div className="text-[15px] font-bold text-sp-text">{weakest.domain} — {weakest.accuracy}% aniqlik</div>
            </div>
          </div>
          <span className="text-[13px] font-bold text-sp-orange">Mashq qilish →</span>
        </Link>
      )}

      <div className="mt-7 space-y-2.5">
        {skills === null && <p className="text-[13.5px] text-sp-text-muted">Yuklanmoqda...</p>}
        {skills?.map((s) => (
          <div key={s.domain} className="sp-glass sp-hover-glow-orange rounded-xl p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13.5px] font-bold text-sp-text truncate">{s.domain}</span>
                <span className="text-[12.5px] font-semibold text-sp-text-muted shrink-0 ml-2">
                  {s.total > 0 ? `${s.accuracy}% · ${s.correct}/${s.total}` : "hali sinalmagan"}
                </span>
              </div>
              <div className="h-1.5 rounded bg-sp-border overflow-hidden">
                <div
                  className="h-full rounded bg-sp-orange transition-all duration-500"
                  style={{ width: `${s.total > 0 ? s.accuracy : 0}%` }}
                />
              </div>
            </div>
            <Link
              href={`/dashboard/question-bank/practice/${encodeURIComponent(s.domain)}`}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[#1A1200] shrink-0 bg-sp-orange shadow-[0_4px_15px_rgba(255,102,0,0.25)] hover:shadow-[0_0_20px_rgba(255,102,0,0.5)] transition-all duration-300"
            >
              <Play size={14} />
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
