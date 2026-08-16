import { useContext } from 'react'
import { CatalogContext } from './catalogContext.js'

export function useCatalog() {
  const ctx = useContext(CatalogContext)
  if (!ctx) throw new Error('useCatalog must be used inside <CatalogProvider>')
  return ctx
}
