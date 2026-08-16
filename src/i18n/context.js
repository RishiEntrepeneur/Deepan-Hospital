import { createContext, useContext } from 'react'

export const LanguageContext = createContext(null)

/** Access the active language, `t()` and `tl()` helpers. */
export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>')
  return ctx
}
