import { useState, useEffect } from 'react'
import { Download, X, Smartphone } from 'lucide-react'

export default function InstallButton() {
  const [promptEvent, setPromptEvent] = useState(null)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSGuide, setShowIOSGuide] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // 이미 standalone(설치됨) 상태면 버튼 숨김
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
      return
    }

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
    setIsIOS(ios)

    const handler = (e) => {
      e.preventDefault()
      setPromptEvent(e)
    }
    window.addEventListener('beforeinstallprompt', handler)

    window.addEventListener('appinstalled', () => setInstalled(true))

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSGuide(true)
      return
    }
    if (!promptEvent) return
    promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setPromptEvent(null)
  }

  // 설치됨이거나, Android인데 프롬프트도 없으면 숨김
  if (installed) return null
  if (!isIOS && !promptEvent) return null

  return (
    <>
      <button
        onClick={handleInstall}
        className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 border border-violet-300 rounded-lg px-2 py-1.5 flex-shrink-0 font-medium"
        title="앱 설치"
      >
        <Download size={13} />
        <span>앱 설치</span>
      </button>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowIOSGuide(false)} />
          <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone size={18} className="text-violet-600" />
                <h2 className="font-bold text-gray-900 text-base">홈 화면에 추가하기</h2>
              </div>
              <button onClick={() => setShowIOSGuide(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <ol className="flex flex-col gap-3 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                <span>Safari 하단의 <strong>공유 버튼(↑)</strong>을 탭하세요.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                <span>스크롤해서 <strong>"홈 화면에 추가"</strong>를 탭하세요.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                <span>오른쪽 위 <strong>"추가"</strong>를 탭하면 완료!</span>
              </li>
            </ol>
            <p className="text-xs text-gray-400 text-center">* Safari 브라우저에서만 설치 가능합니다.</p>
          </div>
        </div>
      )}
    </>
  )
}
