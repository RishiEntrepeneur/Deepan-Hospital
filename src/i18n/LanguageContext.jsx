import { useCallback, useEffect, useMemo, useState } from 'react'
import { LANGUAGES, translations } from './translations'
import { LanguageContext } from './context'

const STORAGE_KEY = 'deepan_lang'

function readInitialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && translations[saved]) return saved
  } catch {
    /* private mode / storage disabled — fall through to the default */
  }
  // Follow the device language where we speak it. A phone set to Tamil or
  // Hindi almost certainly belongs to someone who would rather read it.
  const device = typeof navigator !== 'undefined' ? navigator.language?.toLowerCase() : ''
  const match = LANGUAGES.find((l) => device?.startsWith(l.code))
  return match?.code ?? 'en'
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(readInitialLang)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang
  }, [lang])

  /** Translate a dictionary key, interpolating `{placeholders}`. */
  const t = useCallback(
    (key, vars) => {
      const raw = translations[lang]?.[key] ?? translations.en[key] ?? key
      if (!vars) return raw
      return raw.replace(/\{(\w+)\}/g, (match, name) =>
        Object.hasOwn(vars, name) ? String(vars[name]) : match,
      )
    },
    [lang],
  )

  /** Pick the active-language side of a `{ en, ta }` pair coming from mock data. */
  const tl = useCallback(
    (pair) => {
      if (pair == null) return ''
      if (typeof pair === 'string') return pair
      return pair[lang] ?? pair.en ?? ''
    },
    [lang],
  )

  /**
   * Step to the next language. Was a straight en↔ta flip; with three languages
   * it cycles, so nothing is unreachable from a keyboard shortcut or a narrow
   * screen where the full switcher is collapsed.
   */
  const toggleLang = useCallback(
    () =>
      setLang((current) => {
        const at = LANGUAGES.findIndex((l) => l.code === current)
        return LANGUAGES[(at + 1) % LANGUAGES.length].code
      }),
    [],
  )

  const value = useMemo(
    () => ({ lang, setLang, toggleLang, t, tl, languages: LANGUAGES }),
    [lang, toggleLang, t, tl],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
