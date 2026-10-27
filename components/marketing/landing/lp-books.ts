import { SAT_SQB, BOOK_BOT_URL } from '@/lib/books'

/**
 * Landing's "Mualliflik kitobi" section (static markup, like LP_BODY) + its RU/EN texts.
 * Every visible text goes through T(uz, ru, en): the Uzbek text is both the markup and the translation key,
 * so the markup and the dictionaries can never drift apart. Behaviour (preview lightbox) lives in lp-effects.ts.
 */

const ru: Record<string, string> = {}
const en: Record<string, string> = {}

function T(uz: string, r: string, e: string): string {
  ru[uz] = r
  en[uz] = e
  return uz
}

const B = SAT_SQB
const BOT = BOOK_BOT_URL

const EYE =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'
const LOCK =
  '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>'
const BOOK =
  '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>'
const TICK =
  '<span class="ochk"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg></span>'
const TG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 11.5l17-7-3 15-5-4-3 3v-5l8-7-10 6z"/></svg>'

const items = [
  T('4 ta domen asosidagi savollar', 'Вопросы по 4 доменам', 'Questions across 4 domains'),
  T('19 ta mavzu bo‘yicha tartiblangan mashqlar', 'Упражнения по 19 темам в нужном порядке', 'Practice organized across 19 topics'),
  T('Real imtihon uslubidagi SQB savollar', 'Вопросы SQB в стиле реального экзамена', 'SQB questions in the style of the real exam'),
  T('Oxirida javoblar kaliti', 'Ключ с ответами в конце', 'Answer key at the end'),
  T('Telefon va kompyuterda qulay PDF', 'Удобный PDF для телефона и компьютера', 'PDF that reads well on phone and computer'),
]

const peek = B.previews
  .map(
    (src, i) =>
      `<button type="button" class="bk-thumb" data-bk-open="${i}" aria-label="${i + 1}"><img src="${src}" alt="" width="993" height="1404" loading="lazy" decoding="async" draggable="false"><span class="n">${i + 1}</span></button>`,
  )
  .join('\n        ')

export const LP_BOOKS = `
<!-- BOOKS: author's book + preview + coming-soon card -->
<section class="books" id="books">
  <div class="container">
    <div class="sec-head">
      <span class="pill"><span class="dot"></span>${T('Mualliflik kitobi', 'Авторская книга', 'Author’s book')}</span>
      <h2>${T('Usmon Xamroyevning SAT Math kitobi', 'Книга по SAT Math от Усмона Хамроева', 'The SAT Math book by Usmon Xamroyev')}</h2>
      <p>${T(
        'Saralangan SAT Math savollari 4 ta domen va 19 ta mavzu bo‘yicha. Kitob bepul: uni Telegram bot orqali 5 ta do‘stingizni taklif qilib olasiz.',
        'Отобранные вопросы SAT Math по 4 доменам и 19 темам. Книга бесплатная: вы получите её в Telegram-боте, пригласив 5 друзей.',
        'Curated SAT Math questions across 4 domains and 19 topics. The book is free: get it in our Telegram bot by inviting 5 friends.',
      )}</p>
    </div>

    <div class="bk-grid">
      <article class="bk-main">
        <div class="bk-cover">
          <img src="${B.cover}" alt="${B.title} — ${B.author}" width="720" height="1018" loading="lazy" decoding="async" draggable="false">
          <span class="bk-free">${T('BEPUL', 'БЕСПЛАТНО', 'FREE')}</span>
        </div>
        <div class="bk-info">
          <h3>${B.title}</h3>
          <p class="bk-by">${B.author}</p>
          <p class="bk-desc">${T(
            'SAT Math bo‘yicha tayyorlangan savollar to‘plami: har bir mavzu real imtihon uslubidagi savollar bilan, mustaqil mashq qilish uchun qulay tuzilmada.',
            'Сборник вопросов по SAT Math: каждая тема — с вопросами в стиле реального экзамена, в удобной структуре для самостоятельной практики.',
            'A collection of SAT Math questions: every topic comes with real exam-style questions, laid out for independent practice.',
          )}</p>
          <div class="bk-stats">
            <div><b>${B.pagesLabel}</b><span>${T('sahifa', 'страниц', 'pages')}</span></div>
            <div><b>${B.domains}</b><span>${T('ta domen', 'домена', 'domains')}</span></div>
            <div><b>${B.topics}</b><span>${T('ta mavzu', 'тем', 'topics')}</span></div>
          </div>
          <ul class="bk-list">
            ${items.map((x) => `<li>${TICK}${x}</li>`).join('\n            ')}
          </ul>
          <div class="bk-cta">
            <a href="${BOT}" target="_blank" rel="noopener noreferrer" class="btn btn-orange">${TG}${T('Botda bepul olish', 'Получить бесплатно в боте', 'Get it free in the bot')}</a>
            <button type="button" class="btn btn-white" data-bk-open="0">${EYE}${T('Dastlabki sahifalar', 'Первые страницы', 'First pages')}</button>
          </div>
          <p class="bk-note"><span>${T('Ro‘yxatdan o‘tish shart emas — hammasi Telegramda.', 'Регистрация на сайте не нужна — всё в Telegram.', 'No sign-up on the website needed — it all happens in Telegram.')}</span></p>
        </div>
      </article>

      <aside class="bk-soon">
        <div class="bk-ghost" aria-hidden="true">${BOOK}<b>2</b></div>
        <span class="bk-soon-tag">${T('Tez orada', 'Скоро', 'Coming soon')}</span>
        <h3>${T('Ikkinchi kitob', 'Вторая книга', 'Second book')}</h3>
        <p>${T(
          'Yangi mualliflik kitobimiz ustida ishlayapmiz. Chiqishi bilan shu yerda e‘lon qilamiz.',
          'Мы работаем над новой авторской книгой. Как только она выйдет — объявим здесь.',
          'We’re working on our next book. We’ll announce it here as soon as it’s out.',
        )}</p>
        <a href="https://t.me/SATbyUsmon" target="_blank" rel="noopener noreferrer" class="bk-soon-link">${TG}${T('Telegramda kuzatib boring', 'Следите в Telegram', 'Follow on Telegram')}</a>
      </aside>
    </div>

    <div class="bk-steps">
      <h3>${T('Kitobni qanday olaman?', 'Как получить книгу?', 'How do I get the book?')}</h3>
      <ol>
        <li><b>1</b><span>${T('Telegramda botni oching', 'Откройте бота в Telegram', 'Open the bot in Telegram')}</span></li>
        <li><b>2</b><span>${T('Botdagi «📚 Bepul kitob» tugmasini bosib, shaxsiy havolangizni oling', 'Нажмите в боте «📚 Bepul kitob» и получите личную ссылку', 'Tap “📚 Bepul kitob” in the bot to get your personal link')}</span></li>
        <li><b>3</b><span>${T('Havolani 5 ta do‘stingizga yuboring', 'Отправьте ссылку 5 друзьям', 'Send the link to 5 friends')}</span></li>
        <li><b>4</b><span>${T('Do‘stlaringiz bot orqali kanallarga obuna bo‘lishi bilan, bot kitobni sizga avtomatik yuboradi', 'Как только друзья подпишутся на каналы через бота, бот автоматически пришлёт вам книгу', 'As soon as your friends subscribe to the channels through the bot, the bot sends you the book automatically')}</span></li>
      </ol>
      <a href="${BOT}" target="_blank" rel="noopener noreferrer" class="btn btn-orange">${TG}${T('Botni ochish', 'Открыть бота', 'Open the bot')}</a>
    </div>

    <div class="bk-peek">
      <div class="bk-peek-head">
        <h3>${T('Kitob ichidan ko‘ring', 'Загляните внутрь книги', 'Take a look inside')}</h3>
        <span>${T('Dastlabki 6 sahifa. To‘liq kitob Telegram bot orqali beriladi.', 'Первые 6 страниц. Полная книга выдаётся через Telegram-бота.', 'The first 6 pages. The full book is delivered through our Telegram bot.')}</span>
      </div>
      <div class="bk-strip">
        ${peek}
        <a class="bk-lock" href="${BOT}" target="_blank" rel="noopener noreferrer">${LOCK}<b>${T('To‘liq kitob', 'Полная книга', 'Full book')}</b><span>${T('Botda 5 do‘st taklif qilib oching', 'Откроется в боте за 5 приглашённых друзей', 'Unlock it in the bot by inviting 5 friends')}</span></a>
      </div>
    </div>

    <div class="bk-lb" data-pages='${JSON.stringify(B.previews)}' role="dialog" aria-modal="true" aria-hidden="true" aria-label="${B.title}">
      <div class="bk-lb-bar">
        <span class="bk-lb-title">${B.title}</span>
        <span class="bk-lb-count"></span>
        <button type="button" class="bk-lb-x" data-bk-close aria-label="Close"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div class="bk-lb-stage">
        <button type="button" class="bk-lb-nav prev" data-bk-step="-1" aria-label="Previous"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>
        <img class="bk-lb-img" alt="" draggable="false">
        <button type="button" class="bk-lb-nav next" data-bk-step="1" aria-label="Next"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></button>
      </div>
      <div class="bk-lb-foot">
        <span>${T('Bu faqat dastlabki sahifalar. To‘liq kitob bepul — Telegram bot orqali.', 'Это только первые страницы. Полная книга бесплатна — через Telegram-бота.', 'These are just the first pages. The full book is free — through our Telegram bot.')}</span>
        <a href="${BOT}" target="_blank" rel="noopener noreferrer" class="btn btn-orange">${TG}${T('Botda bepul olish', 'Получить бесплатно в боте', 'Get it free in the bot')}</a>
      </div>
    </div>
  </div>
</section>
`

/** Texts for the books section and the header link; merged into the landing dictionaries in lp-i18n.ts. */
T('Kitoblar', 'Книги', 'Books')
T('Ro‘yxatdan o‘tish', 'Регистрация', 'Sign up')
export const BOOKS_I18N = { ru, en }
