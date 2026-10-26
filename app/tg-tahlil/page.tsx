'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import { StudentsPanel } from '@/components/admin/students-panel'
import { TAHLIL_HEADER } from '@/lib/tahlil-link-client'

/**
 * "O'quvchilar tahlili" inside Telegram: the bot's "📊 O'quvchilar tahlili" button opens
 * /tg-tahlil?k=<signed key>. No site login is needed; the key only unlocks this read-only page.
 */
type TgWebApp = { ready: () => void; expand: () => void }

export default function TgTahlilPage() {
  const [key, setKey] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    // the bot puts the key in ?k=… (Telegram adds its own data to the #hash); #k=… works too
    const fromHash = new URLSearchParams(window.location.search).get('k') || new URLSearchParams(window.location.hash.slice(1)).get('k')
    let k = fromHash
    try {
      if (fromHash) sessionStorage.setItem('tahlil-key', fromHash)
      else k = sessionStorage.getItem('tahlil-key')
    } catch {
      /* private mode: the hash alone is enough */
    }
    if (fromHash) history.replaceState(null, '', window.location.pathname + window.location.hash) // keep the key out of copied links
    setKey(k || null)
  }, [])

  function onTelegram() {
    const tg = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp
    if (!tg) return
    tg.ready()
    tg.expand()
  }

  return (
    <div className="admin-root min-h-screen bg-bg">
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" onLoad={onTelegram} />
      <div className="adm-content mx-auto max-w-[1280px] px-3 py-4 sm:px-6">
        {key === undefined ? null : key ? (
          <StudentsPanel headers={{ [TAHLIL_HEADER]: key }} />
        ) : (
          <div className="rounded-2xl border border-line bg-white p-5 text-[13.5px] text-ink">
            <b>Havola eskirgan yoki noto&apos;g&apos;ri.</b>
            <p className="mt-1 text-ink-soft">Botda &quot;📊 O&apos;quvchilar tahlili&quot; tugmasini qayta bosing — yangi havola beriladi (12 soat amal qiladi).</p>
          </div>
        )}
      </div>
    </div>
  )
}
