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

/**
 * Forgets that this browser has been here before.
 *
 * The real app shows the opening screen and the tour once per device, which is
 * right for a patient and wrong for a preview: every published build lands on
 * the same claude.ai origin and therefore shares one localStorage, so the flag
 * a previous preview set makes the next one open on the bare home page. That
 * looked exactly like the opening screen having failed to ship.
 *
 * Cleared at boot rather than never written, so the flags still work within a
 * visit — dismissing the opening keeps it dismissed while you click around.
 */
for (const key of ['deepan_opening_seen', 'deepan_tour_seen']) {
  /*
   * Both stores, because the app does not use one.
   *
   * The opening screen is remembered for the *visit* (sessionStorage) so that
   * reloading mid-booking does not replay it, while the tour is remembered for
   * the *device* (localStorage). Clearing only localStorage here left the
   * opening suppressed for the entire life of a browser tab: it played once,
   * and every reload after that went straight to the home page. Nothing looked
   * broken, which is why it survived — a demo that quietly stops showing its
   * opening reads as a demo that never had one.
   */
  for (const store of [localStorage, sessionStorage]) {
    try {
      store.removeItem(key)
    } catch {
      /* private mode — nothing was remembered to begin with */
    }
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <CatalogProvider>
        <App />
      </CatalogProvider>
    </LanguageProvider>
  </StrictMode>,
)
