'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, Mail, Send, CheckCircle2, X } from 'lucide-react'
import { useT } from '@/components/i18n-provider'
import { CONTACT_EMAIL, SITE_DOMAIN, TG_CHANNELS, TG_PERSONAL, TG_PERSONAL_URL } from '@/lib/contact'

/** Shrinks a screenshot to a small JPEG data URL (≤ ~600 KB) so it can be stored with the message. */
async function compress(file: File): Promise<string> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(bmp, 0, 0, c.width, c.height)
  for (const q of [0.8, 0.65, 0.5, 0.35]) {
    const url = c.toDataURL('image/jpeg', q)
    if (url.length < 600_000) return url
  }
  throw new Error('big')
}

export function HelpModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [text, setText] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  async function pick(f: File | undefined) {
    if (!f) return
    setError(null)
    try {
      setImage(await compress(f))
    } catch {
      setError(t('Rasmni o‘qib bo‘lmadi yoki juda katta.'))
    }
  }

  async function send() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, image }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setError(d.error ?? t('Yuborib bo‘lmadi.'))
      else setSent(true)
    } catch {
      setError(t("Server bilan bog'lanib bo'lmadi."))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <>
        <div className="sd-modal-icon sd-pop">
          <CheckCircle2 />
        </div>
        <h2>{t('Xabaringiz yuborildi!')}</h2>
        <p>{t('Tez orada ko‘rib chiqamiz. Shoshilinch bo‘lsa, Telegramda ham yozishingiz mumkin.')}</p>
        <button className="sd-primary" onClick={onClose}>
          {t('Yopish')}
        </button>
      </>
    )
  }

  return (
    <div className="sd-help">
      <h2>{t('Yordam markazi')}</h2>
      <p>{t('Sayt xatosi yoki savolingiz bormi? Quyidagi shakl orqali yozing, yoki to‘g‘ridan-to‘g‘ri bog‘laning.')}</p>

      <div className="sd-help-links">
        <a href={TG_PERSONAL_URL} target="_blank" rel="noopener noreferrer" className="sd-primary">
          <Send size={15} /> Telegram {TG_PERSONAL}
        </a>
        <a href={`mailto:${CONTACT_EMAIL}`} className="sd-help-alt">
          <Mail size={15} /> {CONTACT_EMAIL}
        </a>
      </div>

      <label className="sd-help-label">{t('Xabar yuborish (xato, kamchilik yoki taklif)')}</label>
      <textarea
        className="sd-help-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        maxLength={3000}
        placeholder={t('Nima bo‘ldi? Qaysi sahifada? Iloji bo‘lsa batafsil yozing…')}
      />
      {image ? (
        <div className="sd-help-shot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt={t('Skrinshot')} />
          <button onClick={() => setImage(null)} aria-label={t('Rasmni olib tashlash')}>
            <X size={13} />
          </button>
        </div>
      ) : (
        <button type="button" className="sd-help-attach" onClick={() => file.current?.click()}>
          <ImagePlus size={16} /> {t('Skrinshot qo‘shish')}
        </button>
      )}
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      {error && <div className="sd-code-error">{error}</div>}
      <button className="sd-primary" onClick={send} disabled={busy || text.trim().length < 5}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : t('Yuborish')}
      </button>

      <div className="sd-help-foot">
        {TG_CHANNELS.map((c) => (
          <a key={c.handle} href={c.url} target="_blank" rel="noopener noreferrer">
            {c.handle}
          </a>
        ))}
        <span>{SITE_DOMAIN}</span>
      </div>
    </div>
  )
}
