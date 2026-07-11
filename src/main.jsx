import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initSentry, Sentry } from './platform/lib/sentry.js'
import { registerServiceWorker } from './registerServiceWorker.js'
import CrashFallback from './platform/components/CrashFallback.jsx'

initSentry()
registerServiceWorker()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<CrashFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
