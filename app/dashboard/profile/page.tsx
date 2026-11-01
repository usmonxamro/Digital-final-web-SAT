'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Crown, Globe, LogOut, MoonStar, Palette as PaletteIcon, ShieldCheck, Sparkles, Sun } from 'lucide-react'
import { useUser } from '@/components/marketing/dashboard/user-context'
import { useSd } from '@/components/marketing/dashboard/sd-ui'
import { useI18n, useT } from '@/components/i18n-provider'
import { BrandMark } from '@/components/brand-mark'
import { LANGS } from '@/lib/i18n'
import { PRO_PLANS, formatSom } from '@/lib/pro-plans'
import { PALETTE_EVENT, currentMode, currentPalette, setMode, setPalette, type Mode, type Palette } from '@/lib/palette'

const PALETTES: { id: Palette; name: string; hint: string; c1: string; c2: string; bg: string }[] = [
  { id: 'classic', name: 'Klassik', hint: "To'q sariq — asl dizayn", c1: '#ffb357', c2: '#ff6600', bg: '#05060a' },
  { id: 'green', name: 'Yashil', hint: 'Tabiiy neon yashil', c1: '#4cf08f', c2: '#16a34a', bg: '#040b07' },
  { id: 'yellow', name: 'Sariq', hint: "To'q ko'k + oltin", c1: '#ffe27a', c2: '#f5b50b', bg: '#0e1020' },
]

export default function SettingsPage() {
  const t = useT()
  const user = useUser()
  const router = useRouter()
  const { lang, setLang } = useI18n()
  const { openModal } = useSd()
  const [palette, setPal] = useState<Palette>('classic')
  const [mode, setMd] = useState<Mode>('light')

  useEffect(() => {
    const sync = () => {
      setPal(currentPalette())
      setMd(currentMode())
    }
    sync()
    window.addEventListener(PALETTE_EVENT, sync)
    return () => window.removeEventListener(PALETTE_EVENT, sync)
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  const isPro = user.plan === 'premium'
  const trial = isPro && !!user.trialDaysLeft

  return (
    <div className="sd-settings">
      {/* ---------- account ---------- */}
      <div className="sp-glass rounded-2xl p-5 sm:p-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="sd-set-avatar">{user.firstName.slice(0, 2).toUpperCase()}</div>
          <div>
            <div className="font-extrabold text-[19px] text-sp-text">
              {user.firstName} {user.lastName ?? ''}
            </div>
            <div className="text-[13.5px] text-sp-text-muted flex items-center gap-1.5 mt-0.5">
              {isPro ? (
                <>
                  <Crown size={13} className="text-sp-yellow" /> {trial ? t('PRO · {n} kun', { n: user.trialDaysLeft ?? 0 }) : t("Premium a'zo")}
                </>
              ) : (
                t('Bepul tarif')
              )}
            </div>
            {user.email && <div className="text-[12.5px] text-sp-text-muted mt-0.5">{user.email}</div>}
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-[12.5px] font-semibold bg-sp-input px-3 py-1.5 rounded-full text-sp-text-muted">
          <ShieldCheck size={14} /> {t('Xavfsiz va shaxsiy')}
        </span>
      </div>

      <div className="sd-set-grid">
        {/* ---------- appearance ---------- */}
        <section className="sp-glass rounded-2xl sd-set-card">
          <h3>
            <PaletteIcon size={17} /> {t('Mavzu')}
          </h3>
          <p className="sd-set-sub">{t('Sayt ranglarini tanlang — tanlov shu qurilmada saqlanadi.')}</p>
          <div className="sd-pal-list" role="radiogroup" aria-label={t('Mavzu')}>
            {PALETTES.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={palette === p.id}
                className={`sd-pal ${palette === p.id ? 'on' : ''}`}
                onClick={() => setPalette(p.id)}
              >
                <span className="sd-pal-swatch" style={{ background: `radial-gradient(circle at 75% 20%, ${p.c1}55, transparent 60%), ${p.bg}` }}>
                  <span style={{ background: `linear-gradient(140deg, ${p.c1}, ${p.c2})` }} />
                </span>
                <span className="sd-pal-txt">
                  <b>{t(p.name)}</b>
                  <small>{t(p.hint)}</small>
                </span>
                <span className="sd-pal-check">{palette === p.id && <Check size={14} strokeWidth={3} />}</span>
              </button>
            ))}
          </div>

          <div className="sd-set-row">
            <span className="sd-set-label">{t('Rejim')}</span>
            <div className="sd-seg" role="radiogroup" aria-label={t('Rejim')}>
              <button type="button" role="radio" aria-checked={mode === 'light'} className={mode === 'light' ? 'on' : ''} onClick={() => setMode('light')}>
                <Sun size={15} /> {t('Kunduzgi')}
              </button>
              <button type="button" role="radio" aria-checked={mode === 'dark'} className={mode === 'dark' ? 'on' : ''} onClick={() => setMode('dark')}>
                <MoonStar size={15} /> {t('Tungi')}
              </button>
            </div>
          </div>
        </section>

        {/* ---------- language ---------- */}
        <section className="sp-glass rounded-2xl sd-set-card">
          <h3>
            <Globe size={17} /> {t('Til')}
          </h3>
          <p className="sd-set-sub">{t('Sayt interfeysi tili.')}</p>
          <div className="sd-lang-list" role="radiogroup" aria-label={t('Til')}>
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                role="radio"
                aria-checked={lang === l.code}
                className={`sd-lang ${lang === l.code ? 'on' : ''}`}
                onClick={() => {
                  setLang(l.code)
                  router.refresh()
                }}
              >
                <span className="sd-lang-flag">{l.flag}</span>
                <b>{l.native}</b>
                {lang === l.code && <Check size={15} strokeWidth={3} className="sd-lang-ok" />}
              </button>
            ))}
          </div>
        </section>

        {/* ---------- PRO ---------- */}
        <section className="sp-glass rounded-2xl sd-set-card sd-set-pro">
          <h3>
            <Sparkles size={17} /> PRO
          </h3>
          <div className="sd-pro-head">
            <BrandMark size={44} />
            <div>
              <b>{isPro ? (trial ? t('PRO faol · yana {n} kun', { n: user.trialDaysLeft ?? 0 }) : t('PRO faol')) : t('Hozir: FREE tarif')}</b>
              <small>
                {t('PRO — {p} so‘mdan / oy', { p: formatSom(PRO_PLANS[0].price) })}
              </small>
            </div>
          </div>
          <ul className="sd-pro-list">
            <li>{t('Kuniga 4 ta mock (FREE: 3 ta)')}</li>
            <li>{t('Pullik mocklar va to‘liq tahlil')}</li>
            <li>{t('Barcha bepul imkoniyatlar')}</li>
            <li>{t('Ustuvor yordam')}</li>
          </ul>
          <div className="sd-pro-actions">
            <button type="button" className="sd-primary" onClick={() => openModal('plans')}>
              {isPro && !trial ? t('Tariflarni ko‘rish') : isPro ? t('PRO ni uzaytirish') : t("PRO ga o'tish")}
            </button>
          </div>
        </section>

        {/* ---------- logout ---------- */}
        <section className="sp-glass rounded-2xl sd-set-card sd-set-logout">
          <div>
            <h3 className="!text-red-400">
              <LogOut size={17} /> {t('Chiqish')}
            </h3>
            <p className="sd-set-sub !mb-0">{t('Ushbu qurilmada hisobingizdan chiqing.')}</p>
          </div>
          <button onClick={logout} className="sd-logout-btn">
            {t('Chiqish')}
          </button>
        </section>
      </div>
    </div>
  )
}
