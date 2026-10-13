'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Lock, MonitorPlay, Keyboard } from 'lucide-react'
import { ProtectedVideoPlayer } from '@/components/protected-video-player'
import { useUser } from '@/components/marketing/dashboard/user-context'
import { unmaskId } from '@/lib/youtube'

function AnalysisInner() {
  const params = useSearchParams()
  const test = params.get('test') ?? ''
  const user = useUser()
  const [state, setState] = useState<
    { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; id: string; title: string }
  >({ kind: 'loading' })

  useEffect(() => {
    if (!test) {
      setState({ kind: 'error', message: 'Mock tanlanmagan.' })
      return
    }
    let cancelled = false
    fetch(`/api/video?test=${encodeURIComponent(test)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (cancelled) return
        if (!r.ok || !d.m) setState({ kind: 'error', message: d.error ?? "Videoni yuklab bo'lmadi." })
        else setState({ kind: 'ready', id: unmaskId(d.m), title: d.title ?? test })
      })
      .catch(() => !cancelled && setState({ kind: 'error', message: "Server bilan bog'lanib bo'lmadi." }))
    return () => {
      cancelled = true
    }
  }, [test])

  return (
    <div className="mx-auto max-w-[980px]">
      <Link
        href="/dashboard/practice"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-sp-text-muted hover:text-sp-text"
      >
        <ArrowLeft size={14} /> Mocklarga qaytish
      </Link>

      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-sp-orange/15 text-sp-orange">
          <MonitorPlay size={20} />
        </span>
        <div className="min-w-0">
          <div className="text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-sp-text-muted">Video tahlil</div>
          <h1 className="truncate text-[22px] font-extrabold text-sp-text">{test || '—'}</h1>
        </div>
      </div>

      {state.kind === 'loading' && (
        <div className="flex aspect-video items-center justify-center rounded-2xl bg-black/80">
          <span className="size-10 animate-spin rounded-full border-[3px] border-white/70 border-t-transparent" />
        </div>
      )}
      {state.kind === 'error' && (
        <div className="sp-glass flex aspect-video flex-col items-center justify-center gap-3 rounded-2xl p-6 text-center">
          <Lock size={28} className="text-sp-text-muted" />
          <p className="max-w-sm text-[14px] font-semibold text-sp-text">{state.message}</p>
          <Link
            href="/dashboard/practice"
            className="rounded-lg bg-sp-orange px-4 py-2 text-[13px] font-bold text-[#1A1200]"
          >
            Mocklar ro&apos;yxati
          </Link>
        </div>
      )}
      {state.kind === 'ready' && (
        <ProtectedVideoPlayer
          videoId={state.id}
          title={state.title}
          watermark={`${user.firstName} ${user.lastName ?? ''} · ${user.id.slice(0, 8)}`}
        />
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-sp-text-muted">
        <span className="flex items-center gap-1.5">
          <Keyboard size={13} /> Probel — pauza · ← → — 5 soniya · F — to&apos;liq ekran · M — ovoz
        </span>
        <span>Video faqat shu saytda ko&apos;rish uchun — havolasi ulashilmaydi.</span>
      </div>
    </div>
  )
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={null}>
      <AnalysisInner />
    </Suspense>
  )
}
