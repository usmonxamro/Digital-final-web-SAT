'use client'

import { useState } from 'react'
import { BookOpen, ChevronDown, Download, Loader2, Send } from 'lucide-react'
import { BOOKS, type AvailableBook } from '@/lib/books'
import { useT } from '@/components/i18n-provider'

/** Mualliflik kitoblari: faqat tizimga kirgan foydalanuvchi shu yerdan yuklab oladi (to'liq PDF yopiq bucket'da turadi). */
export default function BooksPage() {
  const t = useT()

  return (
    <>
      <div className="sd-page-header">
        <div>
          <div className="sd-eyebrow">{t('SAT Akademiyasi / Kitoblar')}</div>
          <h1>{t('Kitoblar')}</h1>
        </div>
        <span className="sd-pill">{t('Mualliflik kitoblari')}</span>
      </div>

      <div className="sd-bk-list">
        {BOOKS.map((b) => (b.status === 'available' ? <BookCard key={b.slug} book={b} /> : <SoonCard key={b.slug} />))}
      </div>
    </>
  )
}

function BookCard({ book }: { book: AvailableBook }) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tocOpen, setTocOpen] = useState(false)

  async function download() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const r = await fetch(`/api/books/download?slug=${encodeURIComponent(book.slug)}`)
      const d = (await r.json().catch(() => ({}))) as { url?: string; name?: string; error?: string; code?: string }
      if (r.status === 401) {
        window.location.href = '/login?next=%2Fdashboard%2Fbooks'
        return
      }
      if (!r.ok || !d.url) {
        setError(t(d.error ?? 'Kitob fayli hozircha tayyor emas. Iltimos, keyinroq urinib ko‘ring.'))
        return
      }
      // The signed link answers with "attachment", so the browser just saves the file and the page stays put.
      const a = document.createElement('a')
      a.href = d.url
      a.download = d.name ?? ''
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch {
      setError(t('Aloqa xatosi. Internetni tekshirib, qayta urinib ko‘ring.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="sd-bk-card">
      <div className="sd-bk-cover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={book.cover} alt={`${book.title} — ${book.author}`} width={720} height={1018} decoding="async" draggable={false} />
      </div>

      <div className="sd-bk-body">
        <span className="sd-fm-kicker">
          <BookOpen /> {t('Mualliflik kitobi')}
        </span>
        <h2>{book.title}</h2>
        <div className="sd-bk-by">{book.author}</div>
        <p className="sd-bk-desc">
          {t('SAT Math bo‘yicha tayyorlangan savollar to‘plami: har bir mavzu real imtihon uslubidagi savollar bilan, mustaqil mashq qilish uchun qulay tuzilmada.')}
        </p>

        <div className="sd-bk-stats">
          <span>
            <b>{book.pagesLabel}</b> {t('sahifa')}
          </span>
          <span>
            <b>{book.domains}</b> {t('ta domen')}
          </span>
          <span>
            <b>{book.topics}</b> {t('ta mavzu')}
          </span>
        </div>

        <div className="sd-bk-actions">
          <button type="button" className="sd-primary" onClick={download} disabled={busy}>
            {busy ? <Loader2 className="sd-bk-spin" /> : <Download />} {busy ? t('Tayyorlanmoqda…') : t('PDF yuklab olish')}
          </button>
          <button type="button" className="sd-soft" onClick={() => setTocOpen((v) => !v)} aria-expanded={tocOpen}>
            {t('Mundarija')} <ChevronDown className={tocOpen ? 'sd-bk-up' : ''} />
          </button>
          <span className="sd-bk-size">{book.sizeLabel}</span>
        </div>

        {error && (
          <div className="sd-bk-error" role="alert">
            {error}
          </div>
        )}

        {tocOpen && (
          <div className="sd-bk-toc">
            {book.toc.map((d) => (
              <div key={d.name} className="sd-bk-dom" style={{ ['--tone' as string]: d.tone }}>
                <div className="sd-bk-dom-name">{d.name}</div>
                <ol>
                  {d.topics.map((tp) => (
                    <li key={tp.n}>
                      <i>{tp.n}</i>
                      <span>{tp.name}</span>
                      <em>{tp.page}</em>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function SoonCard() {
  const t = useT()
  return (
    <section className="sd-bk-card sd-bk-soon">
      <div className="sd-bk-ghost" aria-hidden="true">
        <BookOpen />
        <b>2</b>
      </div>
      <div className="sd-bk-body">
        <span className="sd-fm-kicker">{t('Tez orada')}</span>
        <h2>{t('Ikkinchi kitob')}</h2>
        <p className="sd-bk-desc">{t('Yangi mualliflik kitobimiz tayyorlanmoqda. Chiqishi bilan shu yerda paydo bo‘ladi.')}</p>
        <div className="sd-bk-actions">
          <a className="sd-soft" href="https://t.me/SATbyUsmon" target="_blank" rel="noopener noreferrer">
            <Send /> {t('Telegramda kuzatib boring')}
          </a>
        </div>
      </div>
    </section>
  )
}
