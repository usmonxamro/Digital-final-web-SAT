'use client'

import { useEffect, useLayoutEffect, useState } from 'react'
import { useT } from '@/components/i18n-provider'
import { useUser } from '@/components/marketing/dashboard/user-context'

const KEY = 'sp-tour-done'
type Box = { x: number; y: number; w: number; h: number }

/**
 * First-visit tour for a freshly created account: points at the ☰ menu (phone) or the sidebar (desktop)
 * and says "mocks and groups are here". Shown once per browser, only for accounts under 3 days old.
 */
export function Tour({ onMenu, menuOpen }: { onMenu: (open: boolean) => void; menuOpen: boolean }) {
  const t = useT()
  const user = useUser()
  const [step, setStep] = useState<0 | 1 | 2>(0) // 0 = off
  const [box, setBox] = useState<Box | null>(null)
  const [phone, setPhone] = useState(false)

  useEffect(() => {
    let done = true
    try {
      done = localStorage.getItem(KEY) === '1'
    } catch {}
    const fresh = user.createdAt ? Date.now() - new Date(user.createdAt).getTime() < 3 * 86400_000 : false
    if (done || !fresh) return
    document.documentElement.dataset.spTour = '1'
    const id = setTimeout(() => {
      const btn = document.querySelector<HTMLElement>('.sd-menu-btn')
      const isPhone = !!btn && btn.offsetParent !== null
      setPhone(isPhone)
      setStep(isPhone ? 1 : 2)
    }, 900)
    return () => clearTimeout(id)
  }, [user.createdAt])

  useLayoutEffect(() => {
    if (!step) return
    const place = () => {
      const sel = step === 1 ? '.sd-menu-btn' : '.sd-nav'
      const el = document.querySelector<HTMLElement>(sel)
      if (!el) return setBox(null)
      const r = el.getBoundingClientRect()
      setBox({ x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 })
    }
    place()
    const id = setTimeout(place, 420) // after the sidebar slide-in
    window.addEventListener('resize', place)
    return () => {
      clearTimeout(id)
      window.removeEventListener('resize', place)
    }
  }, [step, menuOpen])

  function finish() {
    try {
      localStorage.setItem(KEY, '1')
    } catch {}
    setStep(0)
    delete document.documentElement.dataset.spTour
    window.dispatchEvent(new Event('sp-tour-end'))
    if (phone) onMenu(false)
  }
  function next() {
    if (step === 1) {
      onMenu(true)
      setStep(2)
    } else finish()
  }

  if (!step || !box) return null
  const vw = typeof window === 'undefined' ? 400 : window.innerWidth
  const tipW = Math.min(300, vw - 28)
  const left = step === 1 ? Math.max(14, Math.min(box.x, vw - tipW - 14)) : phone ? Math.min(box.x + box.w + 12, vw - tipW - 14) : box.x + box.w + 16
  const top = step === 1 ? box.y + box.h + 14 : phone ? Math.max(90, box.y + 60) : box.y + 8

  return (
    <div className="sd-tour" role="dialog" aria-label="Tour">
      <div className="sd-tour-hole" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} />
      {step === 1 && <button className="sd-tour-hit" aria-label={t('Menyuni ochish')} style={{ left: box.x, top: box.y, width: box.w, height: box.h }} onClick={next} />}
      <div className="sd-tour-tip" style={{ left, top }}>
        <b>{step === 1 ? t('Menyu shu yerda 👆') : t('Mocklar va guruhlar shu yerda')}</b>
        <p>
          {step === 1
            ? t("Chap tomondagi 3 ta chiziqni bosing — mocklar, kurs guruhlari, savollar banki va natijalaringiz shu menyuda.")
            : t("«Barcha o'tgan imtihonlar» va «Bepul mocklar» — mock testlar, «Mening kurslarim» — kurs guruhlari vazifalari. Savollar banki va natijalar ham shu yerda.")}
        </p>
        <div className="row">
          <button className="skip" onClick={finish}>
            {t("O'tkazib yuborish")}
          </button>
          <span className="steps">{phone ? `${step}/2` : ''}</span>
          <button className="sd-primary" onClick={next}>
            {step === 1 ? t('Menyuni ochish') : t('Tushunarli')}
          </button>
        </div>
      </div>
    </div>
  )
}
