'use client'

import { useEffect, useState } from 'react'
import { SectionAccessPicker, type Access, type Section } from '@/components/admin/section-access'
import { AlertTriangle, CalendarClock, ExternalLink, EyeOff, Globe, Loader2, X } from 'lucide-react'

/**
 * "Check it now" + "Publish" for one mock.
 *  - floating: slides up from the bottom of the screen right after a mock is saved.
 *  - inline:   inside the "Testni tahrirlash" list.
 * Reads the current draft/published state itself, so it can be dropped anywhere.
 */
export function PublishActions({
  testLabel,
  variant = 'inline',
  onChange,
}: {
  testLabel: string
  variant?: 'floating' | 'inline'
  onChange?: (published: boolean) => void
}) {
  const [published, setPublished] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState(false)
  const [publishAt, setPublishAt] = useState<string | null>(null)
  const [when, setWhen] = useState('')
  const [placement, setPlacement] = useState<{ section: Section; access: Access } | null>(null)
  const [placing, setPlacing] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/test-config?testLabel=${encodeURIComponent(testLabel)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setPublished(d.config?.published ?? true)
          setPublishAt(d.config?.publishAt ?? null)
          setPlacement({ section: d.config?.section === 'free' ? 'free' : 'exams', access: d.config?.access === 'paid' ? 'paid' : 'free' })
        }
      })
      .catch(() => {
        if (!cancelled) setPublished(true)
      })
    const t = setTimeout(() => setShown(true), 60)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [testLabel])

  async function place(v: { section: Section; access: Access }) {
    const before = placement
    setPlacement(v)
    setPlacing(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/test-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testLabel, ...v }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPlacement(before)
        setError(data.error ?? 'Saqlab bo‘lmadi.')
      } else {
        onChange?.(published ?? true)
      }
    } catch {
      setPlacement(before)
      setError("Server bilan bog'lanib bo'lmadi.")
    } finally {
      setPlacing(false)
    }
  }

  async function toggle(schedule?: string | null) {
    if (published === null) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          schedule === undefined
            ? { testLabel, published: !published }
            : schedule
              ? { testLabel, publishAt: schedule }
              : { testLabel, published: false },
        ),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Xatolik yuz berdi.')
        return
      }
      const nowPublished = schedule === undefined ? !published : false
      setPublished(nowPublished)
      setPublishAt(data.publishAt ?? null)
      setWhen('')
      onChange?.(nowPublished)
    } catch {
      setError("Server bilan bog'lanib bo'lmadi.")
    } finally {
      setBusy(false)
    }
  }

  const previewHref = `/exam?test=${encodeURIComponent(testLabel)}&preview=1`

  const body = (
    <>
      <span
        className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold tracking-wide ${
          published === null
            ? 'bg-line text-ink-faint'
            : published
              ? 'bg-green text-white'
              : 'bg-amber-400 text-amber-950'
        }`}
      >
        {published === null ? '…' : published ? 'PUBLISHED' : publishAt ? 'SCHEDULED' : 'DRAFT'}
      </span>
      {variant === 'floating' && (
        <span className="hidden max-w-[180px] truncate text-[12.5px] font-bold text-white sm:inline">{testLabel}</span>
      )}
      <a
        href={previewHref}
        target="_blank"
        rel="noopener"
        className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-bold transition-colors ${
          variant === 'floating'
            ? 'border border-white/40 text-white hover:bg-white/10'
            : 'border border-green text-green-deep hover:bg-green-mist'
        }`}
      >
        <ExternalLink size={14} /> Check it now
      </a>
      <button
        type="button"
        onClick={() => toggle()}
        disabled={busy || published === null}
        className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-extrabold transition-colors disabled:opacity-50 ${
          published
            ? variant === 'floating'
              ? 'bg-white/15 text-white hover:bg-white/25'
              : 'border border-line text-ink-soft hover:border-red-300'
            : 'bg-green text-white hover:brightness-110'
        }`}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : published ? <EyeOff size={14} /> : <Globe size={14} />}
        {published ? 'Unpublish' : 'Publish'}
      </button>
    </>
  )

  if (variant === 'inline') {
    return (
      <div className="mb-3">
        <div className="flex flex-wrap items-center gap-2">{body}</div>
        {placement && (
          <div className="mt-3">
            <SectionAccessPicker section={placement.section} access={placement.access} onChange={place} busy={placing} />
          </div>
        )}
        {published === false && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-[12px]">
            <CalendarClock size={14} className="text-green-deep" />
            {publishAt ? (
              <>
                <span className="font-bold text-ink">
                  Rejalashtirilgan:{' '}
                  {new Date(publishAt).toLocaleString('uz-UZ', {
                    timeZone: 'Asia/Tashkent',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  <span className="font-medium text-ink-faint">(Toshkent)</span>
                </span>
                <button
                  type="button"
                  onClick={() => toggle(null)}
                  disabled={busy}
                  className="ml-auto flex items-center gap-1 rounded px-1.5 py-1 font-semibold text-red-600 hover:bg-red-50"
                >
                  <X size={13} /> Bekor qilish
                </button>
              </>
            ) : (
              <>
                <span className="font-semibold text-ink-soft">Avto-publish:</span>
                <input
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  className="rounded-md border border-line px-2 py-1 text-[12px] focus:border-green focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!when || busy}
                  // The picker is read as Tashkent time (UTC+5, no DST).
                  onClick={() => toggle(new Date(`${when}:00+05:00`).toISOString())}
                  className="rounded-md bg-ink px-3 py-1.5 font-bold text-white disabled:opacity-40"
                >
                  Rejalashtirish
                </button>
                <span className="text-[11px] text-ink-faint">Toshkent vaqti bilan</span>
              </>
            )}
          </div>
        )}
        {error && (
          <div className="mt-1.5 flex items-start gap-1.5 text-[11.5px] font-semibold text-red-600">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={`fixed bottom-4 left-1/2 z-40 w-[calc(100%-24px)] max-w-fit -translate-x-1/2 transition-all duration-500 ease-out ${
        shown ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'
      }`}
    >
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-ink px-3 py-2.5 shadow-2xl">{body}</div>
      {error && (
        <div className="mt-1.5 rounded-lg bg-white px-3 py-1.5 text-center text-[11.5px] font-semibold text-red-600 shadow">
          {error}
        </div>
      )}
    </div>
  )
}
