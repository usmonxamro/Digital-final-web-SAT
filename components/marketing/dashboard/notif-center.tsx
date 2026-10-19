'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import { Bell, CheckCheck, Megaphone, MessageCircleReply, Sparkles, X } from 'lucide-react'
import { useI18n } from '@/components/i18n-provider'
import type { NotifItem } from '@/app/api/notifications/route'

const POP_KEY = 'sp-notif-popped'

/**
 * The bell: unread badge, dropdown list (new mocks, admin messages, replies to error reports)
 * and a circular "grow out of the bell" popup for a message that arrived while the student was away.
 */
export function NotifCenter() {
  const { t, lang } = useI18n()
  const [items, setItems] = useState<NotifItem[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [pop, setPop] = useState<NotifItem | null>(null)
  const [popOn, setPopOn] = useState(false)
  const [origin, setOrigin] = useState({ x: 0, y: 0 })
  const btn = useRef<HTMLButtonElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const [portalRoot, setPortalRoot] = useState<Element | null>(null)
  useEffect(() => setPortalRoot(document.querySelector('.sd-root') ?? document.body), [])

  const load = useCallback(async () => {
    const d = await fetch('/api/notifications', { cache: 'no-store' }).then((r) => r.json()).catch(() => null)
    if (!d) return
    const list: NotifItem[] = d.items ?? []
    setItems(list)
    setUnread(d.unread ?? 0)
    // Pop up the newest unread message that the student has not seen as a popup yet.
    let last = 0
    try {
      last = Number(localStorage.getItem(POP_KEY) ?? 0)
    } catch {}
    const fresh = list.find((i) => i.kind !== 'mocks' && i.unread && new Date(i.created_at).getTime() > last)
    if (fresh) {
      const r = btn.current?.getBoundingClientRect()
      if (r) setOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
      const show = () => setPop((cur) => cur ?? fresh)
      // Let the first-visit tour finish before a popup covers the screen.
      if (document.documentElement.dataset.spTour === '1') window.addEventListener('sp-tour-end', show, { once: true })
      else show()
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 60_000)
    const onVis = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [load])

  // Grow the popup on the next frame so the clip-path transition runs.
  useEffect(() => {
    if (!pop) return setPopOn(false)
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setPopOn(true)))
    return () => cancelAnimationFrame(id)
  }, [pop])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function markSeen() {
    fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'seen' }) }).catch(() => {})
    setUnread(0)
    setItems((l) => l.map((i) => ({ ...i, unread: false })))
  }
  function toggle() {
    setOpen((v) => {
      if (!v) setTimeout(markSeen, 1200) // keep the "new" highlights visible for a moment
      return !v
    })
  }
  function closePop() {
    if (pop) {
      try {
        localStorage.setItem(POP_KEY, String(new Date(pop.created_at).getTime()))
      } catch {}
    }
    setPopOn(false)
    setTimeout(() => setPop(null), 450)
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString(lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-GB' : 'uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tashkent' })

  return (
    <div className="sd-notif" ref={wrap}>
      <button ref={btn} className="sd-pill-bell" onClick={toggle} aria-label={t('Bildirishnomalar')} aria-expanded={open}>
        <Bell />
        {unread > 0 && <span className="sd-bell-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="sd-notif-panel" role="dialog" aria-label={t('Bildirishnomalar')}>
          <div className="sd-notif-head">
            <b>{t('Bildirishnomalar')}</b>
            {unread > 0 && (
              <button onClick={markSeen} className="sd-notif-all">
                <CheckCheck size={14} /> {t("Hammasini o'qilgan qilish")}
              </button>
            )}
          </div>
          <div className="sd-notif-list">
            {items.length === 0 && <p className="sd-notif-empty">{t("Hozircha yangi bildirishnomalar yo'q.")}</p>}
            {items.map((i) => {
              const inner = (
                <>
                  <span className={`sd-notif-ic ${i.kind}`}>{i.kind === 'mocks' ? <Sparkles /> : i.kind === 'reply' ? <MessageCircleReply /> : <Megaphone />}</span>
                  <span className="sd-notif-txt">
                    <strong>{i.kind === 'mocks' ? t('{n} ta yangi mock qo‘shildi', { n: i.title }) : i.title}</strong>
                    {i.kind === 'mocks' ? <small>{t('Hozir ko‘rish →')}</small> : <small>{i.body}</small>}
                    <em>{fmt(i.created_at)}</em>
                  </span>
                  {i.unread && <i className="sd-notif-dot" />}
                </>
              )
              return i.href ? (
                <Link key={i.id} href={i.href} className="sd-notif-item" onClick={() => setOpen(false)}>
                  {inner}
                </Link>
              ) : (
                <div key={i.id} className="sd-notif-item">
                  {inner}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {pop && portalRoot && createPortal(
        <div
          className={`sd-burst ${popOn ? 'on' : ''}`}
          style={{ ['--bx' as string]: `${origin.x}px`, ['--by' as string]: `${origin.y}px` }}
          onMouseDown={(e) => e.target === e.currentTarget && closePop()}
        >
          <div className="sd-burst-card" role="alertdialog" aria-label={pop.title}>
            <button className="sd-modal-close" onClick={closePop} aria-label={t("Yopish")}>
              <X size={15} />
            </button>
            <div className="sd-modal-icon">{pop.kind === 'reply' ? <MessageCircleReply /> : <Megaphone />}</div>
            <h2>{pop.title}</h2>
            <p>{pop.body}</p>
            <button className="sd-primary" onClick={closePop}>
              {t('Tushunarli')}
            </button>
          </div>
        </div>,
        portalRoot,
      )}
    </div>
  )
}
