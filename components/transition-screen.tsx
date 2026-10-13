'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Coffee } from 'lucide-react'
import { Button } from '@/components/ui/button'

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

type ModuleStartProps = {
  variant: 'start'
  title: string
  subtitle: string
  onContinue: () => void
}

type BreakProps = {
  variant: 'break'
  breakSeconds: number
  title?: string
  subtitle?: string
  onContinue: () => void
}

type AutoNextProps = {
  variant: 'autoNext'
  onProceed: () => void
  seconds?: number
}

export function TransitionScreen(props: ModuleStartProps | BreakProps | AutoNextProps) {
  if (props.variant === 'break') {
    return (
      <BreakScreen
        breakSeconds={props.breakSeconds}
        title={props.title}
        subtitle={props.subtitle}
        onContinue={props.onContinue}
      />
    )
  }
  if (props.variant === 'autoNext') {
    return <AutoNextScreen onProceed={props.onProceed} seconds={props.seconds ?? 3} />
  }
  return <ModuleStartScreen title={props.title} subtitle={props.subtitle} onContinue={props.onContinue} />
}

function ModuleStartScreen({
  title,
  subtitle,
  onContinue,
}: {
  title: string
  subtitle: string
  onContinue: () => void
}) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center bg-white px-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-full border-2 border-[#0e7c75] bg-white text-[#0e7c75]">
        <CheckCircle2 className="size-9" />
      </span>
      <h1 className="mt-6 text-2xl font-bold text-[#0b4f4a]">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-[#475569]">{subtitle}</p>
      <Button
        onClick={onContinue}
        className="mt-8 rounded-md bg-[#0e7c75] px-8 py-2.5 text-base font-semibold text-white shadow-sm hover:bg-[#0a625c]"
      >
        Begin Section
      </Button>
    </div>
  )
}

/**
 * Shown right after a module finishes, between it and the next module of
 * the SAME section (e.g. Math Module 1 -> Module 2). Matches the real
 * Digital SAT Bluebook screen exactly: no choice, no visible countdown
 * number, just a brief pause before it auto-advances. Real Bluebook never
 * offers a break here — the only break is the long one between whole
 * sections (handled separately by the 'break' variant below).
 */
function AutoNextScreen({ onProceed, seconds }: { onProceed: () => void; seconds: number }) {
  useEffect(() => {
    const t = setTimeout(onProceed, seconds * 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex h-dvh flex-col items-center justify-center bg-white px-6 text-center">
      <h1 className="text-2xl font-bold text-[#0b4f4a]">This Module Is Over</h1>
      <p className="mt-4 text-[15px] text-[#334155]">All your work has been saved.</p>
      <p className="mt-2 text-[15px] text-[#334155]">You&apos;ll move on automatically in just a moment.</p>
      <p className="mt-2 text-[15px] text-[#334155]">Do not refresh this page or quit the app.</p>
      <div className="mt-8 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-2 rounded-full bg-[#94a3b8] animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}

function BreakScreen({
  breakSeconds,
  title,
  subtitle,
  onContinue,
}: {
  breakSeconds: number
  title?: string
  subtitle?: string
  onContinue: () => void
}) {
  const [seconds, setSeconds] = useState(breakSeconds)

  useEffect(() => {
    if (seconds <= 0) {
      onContinue()
      return
    }
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds])

  return (
    <div className="flex h-dvh flex-col items-center justify-center bg-white px-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-full border-2 border-[#0e7c75] bg-white text-[#0e7c75]">
        <Coffee className="size-9" />
      </span>
      <h1 className="mt-6 text-2xl font-bold text-[#0b4f4a]">{title ?? 'All Your Work Is Saved'}</h1>
      <p className="mt-2 max-w-md text-sm text-[#475569]">
        {subtitle ??
          "You've completed this section. Take a short break before continuing. Your break will end automatically when the timer reaches zero, or you can resume early."}
      </p>
      <div className="mt-6 text-4xl font-bold tabular-nums text-[#0b4f4a]">{formatTime(seconds)}</div>
      <Button
        onClick={onContinue}
        className="mt-8 rounded-md bg-[#0e7c75] px-8 py-2.5 text-base font-semibold text-white shadow-sm hover:bg-[#0a625c]"
      >
        Resume Now
      </Button>
    </div>
  )
}
