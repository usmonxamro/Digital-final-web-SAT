'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Play, X } from 'lucide-react'
import { useT } from '@/components/i18n-provider'
import type { UnfinishedExam } from '@/app/api/exam/unfinished/route'

/** Dashboard notice (like Bluebook): "you have an unfinished test" — continue where you stopped. Saved for 7 days. */
export function UnfinishedExamBanner() {
  const t = useT()
  const [items, setItems] = useState<UnfinishedExam[]>([])

  useEffect(() => {
    fetch('/api/exam/unfinished')
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => {})
  }, [])

  function discard(it: UnfinishedExam) {
    if (!confirm(t('«{name}» bo‘yicha saqlangan javoblar o‘chiriladi. Bekor qilasizmi?', { name: it.testLabel }))) return
    setItems((l) => l.filter((x) => x.startId !== it.startId))
    fetch(`/api/exam/unfinished?startId=${encodeURIComponent(it.startId)}`, { method: 'DELETE' }).catch(() => {})
  }

  if (items.length === 0) return null
  return (
    <div className="mb-4 grid gap-2.5">
      {items.map((it) => (
        <div
          key={it.startId}
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#0e7c75]/30 bg-[rgba(240,253,244,0.8)] px-4 py-3"
        >
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-extrabold text-[#0b4f4a]">{t('Yakunlanmagan testingiz bor')}</div>
            <div className="truncate text-[12.5px] text-[#334155]">
              {it.testLabel}
              {it.moduleLabel ? ` · ${it.moduleLabel}` : ''}
              {it.total > 0 ? ` · ${t('{a}/{b} savolga javob berilgan', { a: it.answered, b: it.total })}` : ''}
              <span className="text-[#64748b]"> · {t('{n} kun saqlanadi', { n: it.daysLeft })}</span>
            </div>
          </div>
          <Link
            href={`/exam?test=${encodeURIComponent(it.testLabel)}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0e7c75] px-3.5 py-2 text-[13px] font-bold text-white hover:bg-[#0b4f4a]"
          >
            <Play size={14} /> {t('Davom ettirish')}
          </Link>
          <button
            type="button"
            onClick={() => discard(it)}
            aria-label={t('Bekor qilish')}
            title={t('Bekor qilish')}
            className="rounded-lg p-2 text-[#64748b] hover:bg-white"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
