'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { LANG_COOKIE, LANG_SET_COOKIE, isLang, translate, type Lang } from '@/lib/i18n'

type Ctx = {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<Ctx>({ lang: 'uz', setLang: () => {}, t: (k) => k })

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
}

/** Site language (uz default). The server reads the cookie, so there is no flash of the wrong language. */
export function I18nProvider({ initial, children }: { initial: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(isLang(initial) ? initial : 'uz')

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    writeCookie(LANG_COOKIE, l)
    writeCookie(LANG_SET_COOKIE, '1')
  }, [])

  const t = useCallback((key: string, vars?: Record<string, string | number>) => translate(key, lang, vars), [lang])

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}

export const useI18n = () => useContext(I18nContext)
export const useT = () => useContext(I18nContext).t
