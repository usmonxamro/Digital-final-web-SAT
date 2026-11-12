/**
 * Landing: «Matematik darajangizni aniqlang» (til tanlash bilan test) bo‘limi. lp-books.ts bilan bir xil naqsh:
 * T(uz, ru, en) matn + tarjimani birga ro‘yxatdan o‘tkazadi. Yozilib-o‘chadigan animatsiya lp-effects.ts da.
 */
const ru: Record<string, string> = {}
const en: Record<string, string> = {}
function T(uz: string, r: string, e: string): string {
  ru[uz] = r
  en[uz] = e
  return uz
}

const phrases = [
  T('Ingliz tilini bilmasangiz ham', 'Даже если вы не знаете английский', 'Even if you don’t speak English'),
  T('Matematik darajangizni sinab ko‘ring', 'Проверьте свой уровень математики', 'Test your math level'),
  T('Test to‘liq o‘zbek tilida', 'Тест полностью на узбекском', 'The test is fully in Uzbek'),
]

export const LP_DARAJA = `
<!-- DARAJA: language-choice level test -->
<section class="daraja" id="daraja">
  <div class="container">
    <div class="dj-box">
      <span class="pill"><span class="dot"></span>${T('Darajani aniqlash', 'Определение уровня', 'Level check')}</span>
      <h2 class="dj-type" data-typewriter><span class="dj-tw-text">${phrases[0]}</span><span class="dj-caret"></span>
        <span class="dj-tw-src" hidden>${phrases.map((p) => `<i>${p}</i>`).join('')}</span></h2>
      <p>${T(
        '44 ta savol, o‘zbek yoki ingliz tilida — o‘zingiz tanlaysiz. Natija SAT shkalasida (200–800) chiqadi. SAT’ga tayyorlanmagan bo‘lsangiz ham, bahoyingiz adolatli hisoblanadi.',
        '44 вопроса на узбекском или английском — выбираете сами. Результат в шкале SAT (200–800). Даже если вы не готовились к SAT, оценка будет справедливой.',
        '44 questions in Uzbek or English — you choose. The result comes on the SAT scale (200–800). Even if you haven’t prepared for the SAT, your score is calculated fairly.',
      )}</p>
      <div class="dj-pts">
        <span>${T('🇺🇿 O‘zbekcha yoki 🇬🇧 inglizcha', '🇺🇿 Узбекский или 🇬🇧 английский', '🇺🇿 Uzbek or 🇬🇧 English')}</span>
        <span>${T('Tayyorgarlik darajangizga qarab baholash', 'Оценка с учётом вашей подготовки', 'Scored by your prep level')}</span>
        <span>${T('Ro‘yxatdan o‘tish shart emas', 'Регистрация не нужна', 'No sign-up needed')}</span>
      </div>
      <a href="/daraja" class="btn btn-orange">${T('Darajamni aniqlash', 'Узнать свой уровень', 'Find my level')}</a>
    </div>
  </div>
</section>
`

export const DARAJA_I18N = { ru, en }
