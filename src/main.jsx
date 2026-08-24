import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { LanguageProvider } from './i18n/LanguageContext.jsx'
import { CatalogProvider } from './lib/CatalogContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <CatalogProvider>
          <App />
        </CatalogProvider>
      </LanguageProvider>
    </ErrorBoundary>
  </StrictMode>,
)
