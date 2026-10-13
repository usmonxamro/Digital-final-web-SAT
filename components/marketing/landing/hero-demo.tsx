'use client'

import { useEffect, useState } from 'react'
import { Check, Award, Sparkles, Calculator } from 'lucide-react'

const SCENES = ['desmos', 'correct', 'score', 'certificate'] as const
type Scene = (typeof SCENES)[number]

const SCENE_DURATION = 2800

export function HeroDemo() {
  const [index, setIndex] = useState(0)
  const scene: Scene = SCENES[index]

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % SCENES.length), SCENE_DURATION)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="relative rounded-2xl overflow-hidden sp-glass shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-sp-border">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#E7A2A2]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#EFCB8B]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#9AD1AE]" />
        </div>
        <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-sp-text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          DEMO
        </div>
      </div>

      <div className="relative h-[300px] sm:h-[320px] overflow-hidden">
        {scene === 'desmos' && <DesmosScene key="desmos" />}
        {scene === 'correct' && <CorrectScene key="correct" />}
        {scene === 'score' && <ScoreScene key="score" />}
        {scene === 'certificate' && <CertificateScene key="certificate" />}
      </div>

      <div className="flex items-center justify-center gap-1.5 pb-4">
        {SCENES.map((s, i) => (
          <span
            key={s}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i === index ? 'w-5 bg-sp-green' : 'w-1.5 bg-sp-border'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

function DesmosScene() {
  return (
    <div className="absolute inset-0 p-5 flex flex-col animate-in fade-in duration-500">
      <div className="flex items-center gap-1.5 text-[12px] font-bold text-sp-text-muted mb-3">
        <Calculator size={13} className="text-sp-green" /> Desmos
      </div>
      <div
        className="flex-1 rounded-lg border border-sp-border relative overflow-hidden"
        style={{
          backgroundImage:
            'linear-gradient(var(--sp-border) 1px, transparent 1px), linear-gradient(90deg, var(--sp-border) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      >
        <div className="absolute top-3 left-3 right-3 space-y-2">
          <div className="text-[13px] font-mono font-semibold text-sp-text bg-sp-input rounded-md px-2.5 py-1.5 w-fit">
            x&#8321; = random(5)
          </div>
          <div className="text-[13px] font-mono font-semibold text-sp-green bg-sp-green/10 rounded-md px-2.5 py-1.5 w-fit animate-in fade-in slide-in-from-left-2 duration-500 delay-700 fill-mode-both">
            a = 3, b = 7 &#10003;
          </div>
        </div>
        <svg className="absolute bottom-2 right-2 w-24 h-16 opacity-70" viewBox="0 0 100 60">
          <path
            d="M2 55 Q 30 5, 55 30 T 98 5"
            fill="none"
            stroke="var(--sp-green)"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="animate-in fade-in duration-700 delay-500 fill-mode-both"
          />
        </svg>
      </div>
    </div>
  )
}

function CorrectScene() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 animate-in fade-in zoom-in-95 duration-500">
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-sp-green/15 flex items-center justify-center animate-in zoom-in duration-500">
          <div className="w-14 h-14 rounded-full bg-sp-green flex items-center justify-center">
            <Check size={28} className="text-white" strokeWidth={3} />
          </div>
        </div>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full bg-sp-yellow animate-in fade-in zoom-in duration-700 fill-mode-both"
            style={{
              top: `${[-10, -4, 90, 96][i]}%`,
              left: `${[10, 96, -4, 100][i]}%`,
              animationDelay: `${150 + i * 100}ms`,
            }}
          />
        ))}
      </div>
      <p className="text-[16px] font-extrabold text-sp-text animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300 fill-mode-both">
        To&apos;g&apos;ri javob!
      </p>
    </div>
  )
}

function ScoreScene() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 animate-in fade-in duration-500">
      <span className="text-[12px] font-bold text-sp-text-muted tracking-wide uppercase">SAT Math</span>
      <div className="flex items-center gap-2">
        <span className="text-[44px] font-extrabold text-sp-text animate-in zoom-in-95 duration-700 fill-mode-both">
          800
        </span>
        <span className="text-[20px] font-bold text-sp-text-muted">/800</span>
      </div>
      <div className="flex items-center gap-1.5 text-sp-yellow animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300 fill-mode-both">
        <Sparkles size={15} />
        <span className="text-[13px] font-bold">Maksimal ball!</span>
        <Sparkles size={15} />
      </div>
    </div>
  )
}

function CertificateScene() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 animate-in fade-in duration-500">
      <div className="w-[220px] rounded-xl border-2 border-dashed border-sp-yellow/50 bg-sp-yellow/5 p-5 flex flex-col items-center gap-2 animate-in zoom-in-95 slide-in-from-bottom-3 duration-500">
        <div className="w-11 h-11 rounded-full bg-[linear-gradient(135deg,var(--sp-yellow),var(--sp-yellow-glow))] flex items-center justify-center">
          <Award size={22} className="text-[#1A1200]" />
        </div>
        <p className="text-[13px] font-extrabold text-sp-text">Sertifikat tayyor</p>
        <p className="text-[11px] text-sp-text-muted text-center leading-snug">
          Mock test yakunlandi — natijangiz saqlandi
        </p>
      </div>
    </div>
  )
}
