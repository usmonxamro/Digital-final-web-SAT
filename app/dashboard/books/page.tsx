'use client'

import { useState } from 'react'
import { BookOpen, ChevronDown, Send } from 'lucide-react'
import { BOOKS, BOOK_BOT_URL, type AvailableBook } from '@/lib/books'
import { useT } from '@/components/i18n-provider'

/** Bepul kitoblar. Hozircha kitob Telegram bot orqali beriladi (5 ta do'st taklif qilish); sayt orqali yuklab olish o'chirilgan. */
export default function BooksPage() {
  const t = useT()

  return (
    <>
      <div className="sd-page-header">
        <div>
          <div className="sd-eyebrow">{t('SAT Akademiyasi / Kitoblar')}</div>
          <h1>{t('Kitoblar')}</h1>
        </div>
        <span className="sd-pill">{t('Bepul kitoblar')}</span>
      </div>

      <div className="sd-bk-list">
        {BOOKS.map((b) => (b.status === 'available' ? <BookCard key={b.slug} book={b} /> : <SoonCard key={b.slug} />))}
      </div>
    </>
  )
}

function BookCard({ book }: { book: AvailableBook }) {
  const t = useT()
  const [tocOpen, setTocOpen] = useState(false)

  return (
    <section className="sd-bk-card">
      <div className="sd-bk-cover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={book.cover} alt={`${book.title} — ${book.author}`} width={720} height={1018} decoding="async" draggable={false} />
      </div>

      <div className="sd-bk-body">
        <span className="sd-fm-kicker">
          <BookOpen /> {t('Bepul kitob')}
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

        <ol className="sd-bk-steps">
          <li>
            <b>1</b>
            <span>{t('Telegramda botni oching')}</span>
          </li>
          <li>
            <b>2</b>
            <span>{t('Botdagi «📚 Bepul kitob» tugmasini bosib, shaxsiy havolangizni oling')}</span>
          </li>
          <li>
            <b>3</b>
            <span>{t('Havolani 5 ta do‘stingizga yuboring')}</span>
          </li>
          <li>
            <b>4</b>
            <span>{t('Do‘stlaringiz bot orqali kanallarga obuna bo‘lishi bilan, bot kitobni sizga avtomatik yuboradi')}</span>
          </li>
        </ol>

        <div className="sd-bk-actions">
          <a className="sd-primary" href={BOOK_BOT_URL} target="_blank" rel="noopener noreferrer">
            <Send /> {t('Botda bepul olish')}
          </a>
          <button type="button" className="sd-soft" onClick={() => setTocOpen((v) => !v)} aria-expanded={tocOpen}>
            {t('Mundarija')} <ChevronDown className={tocOpen ? 'sd-bk-up' : ''} />
          </button>
          <span className="sd-bk-size">{book.sizeLabel}</span>
        </div>

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
        <p className="sd-bk-desc">{t('Navbatdagi kitobimiz tayyorlanmoqda. Chiqishi bilan shu yerda paydo bo‘ladi.')}</p>
        <div className="sd-bk-actions">
          <a className="sd-soft" href="https://t.me/SATbyUsmon" target="_blank" rel="noopener noreferrer">
            <Send /> {t('Telegramda kuzatib boring')}
          </a>
        </div>
      </div>
    </section>
  )
}
