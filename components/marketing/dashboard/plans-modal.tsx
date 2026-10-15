'use client'

import { Gift } from 'lucide-react'
import { useT } from '@/components/i18n-provider'
import { useUser } from '@/components/marketing/dashboard/user-context'

/** Balansim → tariffs: Free (3 mocks/day) vs Pro (4 mocks/day + extras). */
export function PlansModal({ onHelp }: { onHelp: () => void }) {
  const t = useT()
  const user = useUser()
  const isPro = user.plan === 'premium'
  const trial = isPro && !!user.trialDaysLeft
  return (
    <>
      <h2>{t('Tariflar')}</h2>
      <p>{t('Sizga mos rejani tanlang')}</p>
      {trial && (
        <div className="sd-promo-note">
          <Gift size={18} style={{ flex: 'none', color: 'var(--sp-orange)' }} />
          <span>{t('Ishga tushirish aksiyasi: PRO bepul — yana {n} kun.', { n: user.trialDaysLeft ?? 0 })}</span>
        </div>
      )}
      <div className="sd-plans">
        <div className={`sd-plan-card ${!isPro ? 'cur' : ''}`}>
          {!isPro && <span className="sd-plan-tag">{t('Joriy reja')}</span>}
          <h3>FREE</h3>
          <div className="price">{t('Bepul')}</div>
          <ul>
            <li>{t('Kuniga 3 ta mock')}</li>
            <li>{t('Bepul mocklar va Past Exams')}</li>
            <li>{t('Savol banki')}</li>
            <li className="off">{t('Pullik mocklar')}</li>
          </ul>
        </div>
        <div className={`sd-plan-card pro ${isPro ? 'cur' : ''}`}>
          {isPro && <span className="sd-plan-tag">{t('Joriy reja')}</span>}
          <h3>PRO</h3>
          <div className="price">{t('Maxsus imkoniyatlar')}</div>
          <ul>
            <li>{t('Kuniga 4 ta mock')}</li>
            <li>{t('Barcha bepul imkoniyatlar')}</li>
            <li>{t('Pullik mocklar')}</li>
            <li>{t('Ustuvor yordam')}</li>
          </ul>
        </div>
      </div>
      <div className="sd-plan-elite">
        <h3>
          ELITE <i>{t('Guruh o‘quvchilari')}</i>
        </h3>
        <p>{t('Kunlik limit guruh o‘quvchilari uchun 7 ta mock. Kurs guruhiga qo‘shilgan o‘quvchilar avtomatik ELITE rejimga o‘tadi.')}</p>
      </div>
      {!isPro && (
        <button className="sd-primary" onClick={onHelp}>
          {t("PRO ga o'tish")}
        </button>
      )}
      <p style={{ marginTop: 14, marginBottom: 0, fontSize: 11.5 }}>{t("Kurs guruhlari vazifalari PRO ga kirmaydi — ular faqat Telegram bot kodi orqali ochiladi.")}</p>
    </>
  )
}
