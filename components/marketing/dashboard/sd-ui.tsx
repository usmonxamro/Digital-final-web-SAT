'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { HelpModal } from '@/components/marketing/dashboard/help-modal'
import { PlansModal } from '@/components/marketing/dashboard/plans-modal'
import { X, Lock, LifeBuoy, Bell, KeyRound, CheckCircle2 } from 'lucide-react'

/** Telegram channel / bot / contact for "Yordam" and "Kursga qo'shilish" (set NEXT_PUBLIC_HELP_URL). */
export const HELP_URL = process.env.NEXT_PUBLIC_HELP_URL ?? ''

type ModalKind = 'help' | 'locked' | 'paid' | 'notifications' | 'code' | 'plans'
type Ctx = { toast: (m: string) => void; openModal: (k: ModalKind) => void }

const SdContext = createContext<Ctx>({ toast: () => {}, openModal: () => {} })
export const useSd = () => useContext(SdContext)

const MODALS: Record<ModalKind, { icon: React.ReactNode; title: string; text: string; button: string }> = {
  locked: {
    icon: <Lock />,
    title: 'Bu guruhga kirish cheklangan',
    text: "Bu guruhning vazifalari faqat kurs o'quvchilari uchun. Telegram botdan kod olgan bo'lsangiz, uni kiriting — guruh darhol ochiladi.",
    button: 'Kodni kiritish',
  },
  code: { icon: <KeyRound />, title: '', text: '', button: '' },
  paid: {
    icon: <Lock />,
    title: 'Bu mock pullik',
    text: "Pullik mocklar Pro foydalanuvchilar va kurs o'quvchilari uchun ochiq. Pro rejaga o'tish yoki kursga qo'shilish uchun biz bilan bog'laning.",
    button: "Pro'ga o'tish / kursga qo'shilish",
  },
  help: {
    icon: <LifeBuoy />,
    title: 'Yordam markazi',
    text: HELP_URL
      ? "Darslar, testlar yoki hisobingiz bo'yicha savollaringiz bo'lsa, Telegram orqali yozing — tez orada javob beramiz."
      : "Savollaringiz bo'lsa, SAT Akademiyasi Telegram kanali yoki guruhi orqali o'qituvchiga murojaat qiling.",
    button: HELP_URL ? 'Telegramda yozish' : 'Tushunarli',
  },
  plans: { icon: <Lock />, title: 'Tariflar', text: '', button: '' },
  notifications: {
    icon: <Bell />,
    title: 'Bildirishnomalar',
    text: "Hozircha yangi bildirishnomalar yo'q. Test natijalari va yangi vazifalar haqidagi xabarlar shu yerda chiqadi.",
    button: 'Yopish',
  },
}

export function SdUiProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalKind | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toast = useCallback((m: string) => {
    setMsg(m)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setMsg(null), 2400)
  }, [])

  useEffect(() => {
    if (!modal) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setModal(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modal])

  const [code, setCode] = useState('')
  const [codeBusy, setCodeBusy] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [joined, setJoined] = useState<string | null>(null)

  async function redeem() {
    if (!code.trim() || codeBusy) return
    setCodeBusy(true)
    setCodeError(null)
    try {
      const res = await fetch('/api/course/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setCodeError(data.error ?? 'Kodni tekshirib bo‘lmadi.')
      else setJoined(data.group ?? 'Kurs')
    } catch {
      setCodeError("Server bilan bog'lanib bo'lmadi.")
    } finally {
      setCodeBusy(false)
    }
  }

  const m = modal ? MODALS[modal] : null
  function act() {
    if (modal === 'locked') {
      setCode('')
      setCodeError(null)
      setJoined(null)
      setModal('code')
      return
    }
    if (modal === 'paid') {
      setModal('help')
    } else {
      setModal(null)
    }
  }

  return (
    <SdContext.Provider value={{ toast, openModal: setModal }}>
      {children}
      {m && (
        <div className="sd-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className={`sd-modal ${modal === 'help' ? 'sd-modal-wide' : ''} ${modal === 'plans' ? 'sd-modal-plans' : ''}`} role="dialog" aria-modal="true" aria-label={m.title}>
            <button className="sd-modal-close" onClick={() => setModal(null)} aria-label="Yopish">
              <X size={15} />
            </button>
            {modal === 'help' ? (
              <HelpModal onClose={() => setModal(null)} />
            ) : modal === 'plans' ? (
              <PlansModal onHelp={() => setModal('help')} />
            ) : modal === 'code' ? (
              joined ? (
                <>
                  <div className="sd-modal-icon sd-pop">
                    <CheckCircle2 />
                  </div>
                  <h2>Guruhga qo&apos;shildingiz! 🎉</h2>
                  <p>
                    <b>{joined}</b> guruhining vazifalari endi siz uchun ochiq.
                  </p>
                  <button className="sd-primary" onClick={() => (window.location.href = '/dashboard/course-tasks')}>
                    Kurslarimga o&apos;tish
                  </button>
                </>
              ) : (
                <>
                  <div className="sd-modal-icon">
                    <KeyRound />
                  </div>
                  <h2>Guruh kodini kiriting</h2>
                  <p>O&apos;qituvchi Telegram guruhga yuborgan kodni kiriting (masalan: NOYABR-ABC123). Kod faqat bir marta kiritiladi.</p>
                  <input
                    className="sd-code-input"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && redeem()}
                    placeholder="NOYABR-XXXXXX"
                    autoFocus
                    spellCheck={false}
                    autoComplete="off"
                  />
                  {codeError && <div className="sd-code-error">{codeError}</div>}
                  <button className="sd-primary" onClick={redeem} disabled={codeBusy || !code.trim()}>
                    {codeBusy ? 'Tekshirilmoqda…' : 'Tasdiqlash'}
                  </button>
                </>
              )
            ) : (
              <>
                <div className="sd-modal-icon">{m.icon}</div>
                <h2>{m.title}</h2>
                <p>{m.text}</p>
                <button className="sd-primary" onClick={act}>
                  {m.button}
                </button>
                {(modal === 'locked' || modal === 'paid') && (
                  <button className="sd-link" onClick={() => setModal(null)}>
                    Hozircha yopish
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
      <div className={`sd-toast${msg ? ' sd-show' : ''}`} role="status">
        {msg}
      </div>
    </SdContext.Provider>
  )
}
