/**
 * Entry point for the standalone demo build only — see mock-api.js.
 *
 * The same as src/main.jsx, with the fake server installed first. Ordering
 * matters and is not obvious: ES imports are all evaluated before any statement
 * in this file, so installing the mock cannot rely on sitting above an import.
 * It works because nothing fetches at import time — the catalogue is requested
 * when CatalogProvider mounts, which is inside render() below.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installMockApi } from './mock-api.js'
import '../src/index.css'
import App from '../src/App.jsx'
import { LanguageProvider } from '../src/i18n/LanguageContext.jsx'
import { CatalogProvider } from '../src/lib/CatalogContext.jsx'

installMockApi()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <CatalogProvider>
        <App />
      </CatalogProvider>
    </LanguageProvider>
  </StrictMode>,
)
