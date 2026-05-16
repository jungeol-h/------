import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initSentry, Sentry } from './platform/lib/sentry.js'

initSentry()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<CrashFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)

// 렌더링 크래시 시 흰 화면 대신 보여줄 안내 — 침묵 실패(빈 화면) 방지.
function CrashFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="text-center max-w-sm">
        <p className="text-base font-bold text-gray-800">화면을 표시하지 못했습니다</p>
        <p className="text-sm text-gray-500 mt-1">
          오류가 자동으로 보고되었습니다. 잠시 후 다시 시도해 주세요.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-xl"
        >
          새로고침
        </button>
      </div>
    </div>
  )
}
