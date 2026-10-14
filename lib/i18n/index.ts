import { ru } from '@/lib/i18n/ru'
import { en } from '@/lib/i18n/en'

export type Lang = 'uz' | 'ru' | 'en'
export const LANG_COOKIE = 'sp-lang'
export const LANG_SET_COOKIE = 'sp-lang-set'

export const LANGS: { code: Lang; label: string; native: string; flag: string }[] = [
  { code: 'uz', label: 'UZ', native: "O'zbekcha", flag: '🇺🇿' },
  { code: 'ru', label: 'RU', native: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'EN', native: 'English', flag: '🇬🇧' },
]

export const isLang = (v: unknown): v is Lang => v === 'uz' || v === 'ru' || v === 'en'

/**
 * The Uzbek text is the key: translate('Kirish', 'ru') → 'Войти'. A missing
 * translation falls back to the Uzbek text, so nothing ever renders empty.
 * `{name}`-style placeholders are filled from `vars`.
 */
export function translate(key: string, lang: Lang, vars?: Record<string, string | number>): string {
  const table = lang === 'ru' ? ru : lang === 'en' ? en : null
  let s = (table && table[key]) || key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
  return s
}
