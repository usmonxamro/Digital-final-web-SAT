'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Hourglass, Play, X } from 'lucide-react'
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
    <div className="sd-unf">
      {items.map((it) => (
        <div key={it.startId} className="sd-unf-card">
          <span className="sd-unf-ico">
            <Hourglass />
          </span>
          <div className="sd-unf-text">
            <strong>{t('Yakunlanmagan testingiz bor')}</strong>
            <span className="sd-unf-name" title={it.testLabel}>
              {it.testLabel}
            </span>
            <span className="sd-unf-meta">
              {it.moduleLabel && <span>{it.moduleLabel}</span>}
              {it.total > 0 && <span>{t('{a}/{b} savolga javob berilgan', { a: it.answered, b: it.total })}</span>}
              <span>{t('{n} kun saqlanadi', { n: it.daysLeft })}</span>
            </span>
            {it.total > 0 && (
              <span className="sd-unf-bar">
                <i style={{ width: `${Math.min(100, (it.answered / it.total) * 100)}%` }} />
              </span>
            )}
          </div>
          <Link href={`/exam?test=${encodeURIComponent(it.testLabel)}`} className="sd-unf-go">
            <Play /> {t('Davom ettirish')}
          </Link>
          <button type="button" onClick={() => discard(it)} aria-label={t('Bekor qilish')} title={t('Bekor qilish')} className="sd-unf-x">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
