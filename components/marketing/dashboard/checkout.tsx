'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, CalendarDays, CheckCircle2, CreditCard, Crown, Loader2, Lock, MessageSquareText, ShieldCheck, X } from 'lucide-react'
import { useT } from '@/components/i18n-provider'
import { useUser } from '@/components/marketing/dashboard/user-context'
import { BrandMark } from '@/components/brand-mark'
import { PRO_PLANS, cardBrand, formatSom, type ProPlan } from '@/lib/pro-plans'
import './checkout.css'

/**
 * Full-screen PRO checkout (phone) / centred panel (desktop) in the neon-green brand.
 * Card data goes from the browser straight to Payme (Subscribe API) — never to our server.
 * Without NEXT_PUBLIC_PAYME_MERCHANT_ID the form still validates and then explains that card
 * payments open soon, pointing to the help contacts.
 */
const MERCHANT = process.env.NEXT_PUBLIC_PAYME_MERCHANT_ID ?? ''
const PAYME_URL = process.env.NEXT_PUBLIC_PAYME_TEST === '1' ? 'https://checkout.test.paycom.uz/api' : 'https://checkout.paycom.uz/api'

async function paymeClient(method: string, params: Record<string, unknown>) {
  const res = await fetch(PAYME_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Auth': MERCHANT, 'Cache-Control': 'no-cache' },
    body: JSON.stringify({ id: Date.now(), method, params }),
  })
  const data = await res.json().catch(() => null)
  if (!data || data.error) {
    const msg = data?.error?.message
    throw new Error(typeof msg === 'string' ? msg : (msg?.uz ?? msg?.ru ?? 'Payme bilan bog‘lanib bo‘lmadi.'))
  }
  return data.result
}

type Step = 'card' | 'sms' | 'done' | 'soon'

const BRAND_LABEL: Record<string, string> = { uzcard: 'UzCard', humo: 'HUMO', visa: 'VISA', mastercard: 'Mastercard' }

export function Checkout({ onClose, onHelp }: { onClose: () => void; onHelp: () => void }) {
  const t = useT()
  const user = useUser()
  const [plan, setPlan] = useState<ProPlan>(PRO_PLANS[0])
  const [number, setNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [step, setStep] = useState<Step>('card')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [until, setUntil] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const digits = number.replace(/\D/g, '')
  const brand = cardBrand(digits)
  const holder = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim().toUpperCase() || t("TO'LIQ ISM")

  // Lock page scroll + Esc to close.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose, busy])

  const shownNumber = useMemo(() => {
    const groups: string[] = []
    for (let i = 0; i < 4; i++) {
      const part = digits.slice(i * 4, i * 4 + 4)
      groups.push(part.padEnd(4, '•'))
    }
    return groups
  }, [digits])

  function onNumber(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 16)
    setNumber(d.replace(/(\d{4})(?=\d)/g, '$1 '))
    setError(null)
  }
  function onExpiry(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 4)
    setExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d)
    setError(null)
  }

  function validate(): string | null {
    if (digits.length !== 16) return t('Karta raqamini to‘liq kiriting (16 ta raqam).')
    if (brand === 'visa' || brand === 'mastercard') return t('Hozircha faqat UzCard va HUMO kartalari qabul qilinadi.')
    if (brand !== 'uzcard' && brand !== 'humo') return t('Karta raqami noto‘g‘ri ko‘rinadi.')
    const [mm, yy] = expiry.split('/')
    const m = Number(mm)
    const y = Number(yy)
    if (!mm || !yy || yy.length !== 2 || m < 1 || m > 12) return t('Amal qilish muddatini OO/YY ko‘rinishida kiriting.')
    const now = new Date()
    const curY = now.getFullYear() % 100
    if (y < curY || (y === curY && m < now.getMonth() + 1)) return t('Karta muddati tugagan.')
    return null
  }

  async function submitCard(e: React.FormEvent) {
    e.preventDefault()
    const v = validate()
    if (v) return setError(v)
    if (!MERCHANT) return setStep('soon')
    setBusy(true)
    setError(null)
    try {
      const [mm, yy] = expiry.split('/')
      const created = await paymeClient('cards.create', { card: { number: digits, expire: `${mm}${yy}` }, save: false })
      const tk = created?.card?.token
      if (!tk) throw new Error(t('Kartani tekshirib bo‘lmadi.'))
      const sent = await paymeClient('cards.get_verify_code', { token: tk })
      setToken(tk)
      setPhone(sent?.phone ?? '')
      setCode('')
      setStep('sms')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Xatolik yuz berdi.'))
    } finally {
      setBusy(false)
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault()
    if (code.replace(/\D/g, '').length < 4) return setError(t('SMS kodni kiriting.'))
    setBusy(true)
    setError(null)
    try {
      await paymeClient('cards.verify', { token, code: code.replace(/\D/g, '') })
      const res = await fetch('/api/payments/payme/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, planId: plan.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? t("To'lov amalga oshmadi."))
      setUntil(data.premiumUntil ?? null)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Xatolik yuz berdi.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="co-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="co-panel" role="dialog" aria-modal="true" aria-label={t('PRO tarifini sotib olish')} ref={panelRef} tabIndex={-1}>
        {/* ---------- hero ---------- */}
        <header className="co-hero">
          <div className="co-hero-brand">
            <BrandMark size={58} />
            <div className="co-word">
              SAT <span>by</span> <b>Usmon</b>
            </div>
          </div>
          <div className="co-hero-txt">
            <span className="co-badge">
              <Crown size={15} /> PRO
            </span>
            <p className="co-slogan">{t('Maqsadingiz sari — har kuni bir qadam!')}</p>
            <p className="co-price">
              {formatSom(plan.price)} {t("so'm")}
              <small>/ {t(plan.label)}</small>
            </p>
          </div>
          <button className="co-close" onClick={onClose} disabled={busy} aria-label={t('Yopish')}>
            <X size={22} />
          </button>
        </header>

        <div className="co-tabs">
          <div className="co-tab">
            <CreditCard size={20} />
            {t("To'lov ma'lumotlari")}
          </div>
          <div className="co-secure">
            <Lock size={14} />
            {t('Xavfsiz va himoyalangan')}
          </div>
        </div>

        {step === 'card' && (
          <form className="co-body" onSubmit={submitCard} noValidate>
            <div className="co-plans" role="radiogroup" aria-label={t('Muddat')}>
              {PRO_PLANS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={plan.id === p.id}
                  className={`co-plan ${plan.id === p.id ? 'on' : ''}`}
                  onClick={() => setPlan(p)}
                >
                  <span className="co-plan-dot" />
                  <span className="co-plan-l">{t(p.label)}</span>
                  <span className="co-plan-p">
                    {formatSom(p.price)} {t("so'm")}
                  </span>
                  {p.note && <em>{p.note}</em>}
                </button>
              ))}
            </div>

            <div className="co-account">
              <span className="co-avatar">{(user.firstName ?? '?').slice(0, 1).toUpperCase()}</span>
              <span className="co-account-txt">
                <b>{`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()}</b>
                {user.email && <small>{user.email}</small>}
              </span>
              <ShieldCheck size={18} className="co-account-ok" />
            </div>

            {/* live card preview */}
            <div className={`co-card ${brand ?? ''}`} aria-hidden="true">
              <div className="co-card-top">
                <span className="co-chip">
                  <i />
                </span>
                <span className="co-card-brand">{brand ? BRAND_LABEL[brand] : 'UzCard · HUMO'}</span>
              </div>
              <div className="co-card-num">
                {shownNumber.map((g, i) => (
                  <span key={i}>{g}</span>
                ))}
              </div>
              <div className="co-card-bottom">
                <div>
                  <small>{t('KARTA EGASI')}</small>
                  <b>{holder}</b>
                </div>
                <div className="r">
                  <small>{t('AMAL QILADI')}</small>
                  <b>{expiry.length ? expiry.padEnd(5, '•') : 'OO/YY'}</b>
                </div>
              </div>
            </div>

            <label className="co-label" htmlFor="co-num">
              <CreditCard size={17} /> {t('Karta raqami')}
            </label>
            <div className="co-field">
              <CreditCard size={19} />
              <input
                id="co-num"
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="0000 0000 0000 0000"
                value={number}
                onChange={(e) => onNumber(e.target.value)}
                aria-invalid={!!error}
              />
            </div>

            <label className="co-label" htmlFor="co-exp">
              <CalendarDays size={17} /> {t('Amal qilish muddati')}
            </label>
            <div className="co-field co-field-half">
              <CalendarDays size={19} />
              <input
                id="co-exp"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="OO/YY"
                value={expiry}
                onChange={(e) => onExpiry(e.target.value)}
              />
            </div>

            <p className="co-hint">{t('UzCard va HUMO kartalarida CVV yo‘q — to‘lov SMS kod bilan tasdiqlanadi.')}</p>
            {error && <p className="co-error">{error}</p>}

            <button className="co-submit" type="submit" disabled={busy}>
              {busy ? <Loader2 size={22} className="co-spin" /> : <CreditCard size={22} />}
              {t('Tarifni tasdiqlash')}
              {!busy && <ArrowRight size={22} />}
            </button>
            <p className="co-foot">
              <Lock size={12} /> {t("Karta ma'lumotlari to'g'ridan-to'g'ri Payme'ga yuboriladi va saytimizda saqlanmaydi.")}
            </p>
          </form>
        )}

        {step === 'sms' && (
          <form className="co-body" onSubmit={submitCode} noValidate>
            <div className="co-state">
              <div className="co-state-ico">
                <MessageSquareText size={30} />
              </div>
              <h3>{t('SMS kodni kiriting')}</h3>
              <p>{phone ? t('Kod {p} raqamiga yuborildi.', { p: phone }) : t('Kod kartangizga ulangan raqamga yuborildi.')}</p>
            </div>
            <div className="co-field co-code">
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="••••••"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  setError(null)
                }}
                autoFocus
              />
            </div>
            {error && <p className="co-error">{error}</p>}
            <button className="co-submit" type="submit" disabled={busy}>
              {busy ? <Loader2 size={22} className="co-spin" /> : <ShieldCheck size={22} />}
              {t("{s} so'm to'lash", { s: formatSom(plan.price) })}
            </button>
            <button type="button" className="co-link" onClick={() => setStep('card')} disabled={busy}>
              {t('Kartani o‘zgartirish')}
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="co-body">
            <div className="co-state">
              <div className="co-state-ico ok">
                <CheckCircle2 size={34} />
              </div>
              <h3>{t('Tabriklaymiz, PRO faollashdi!')} 🎉</h3>
              <p>
                {until
                  ? t('PRO {d} gacha amal qiladi.', { d: new Date(until).toLocaleDateString('ru-RU') })
                  : t('PRO imkoniyatlari ochildi.')}
              </p>
            </div>
            <button className="co-submit" onClick={() => window.location.reload()}>
              {t("Davom etish")} <ArrowRight size={22} />
            </button>
          </div>
        )}

        {step === 'soon' && (
          <div className="co-body">
            <div className="co-state">
              <div className="co-state-ico">
                <Crown size={30} />
              </div>
              <h3>{t("Karta orqali to'lov tez orada ishga tushadi")}</h3>
              <p>{t("Hozircha PRO ni admin orqali faollashtirish mumkin — yozing, darhol yordam beramiz.")}</p>
            </div>
            <button className="co-submit" onClick={onHelp}>
              {t('Admin bilan bog‘lanish')} <ArrowRight size={22} />
            </button>
            <button type="button" className="co-link" onClick={() => setStep('card')}>
              {t('Orqaga')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
