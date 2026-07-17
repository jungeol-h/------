// PWA 설치 강제 게이트 (모바일 전용, App 루트에서 렌더).
// 모바일 브라우저(비-standalone) 접속 시 전체 화면을 덮어 설치를 유도하고 조작을 차단한다.
// - Android: beforeinstallprompt로 즉시 설치 버튼 / 없으면 수동 안내
// - iOS: 공유 → 홈 화면에 추가 수동 안내 (프로그래매틱 설치 불가)
// - 인앱 브라우저(카카오톡 등): PWA 설치 자체가 불가 → 외부 브라우저로 열기 안내
// 데스크톱은 게이트 대상 아님. 비상 우회: ?browser=1 (sessionStorage, 탭 닫으면 소멸).

import { useState, useEffect } from 'react'
import { Share, MoreVertical, Plus, Smartphone, Download, ExternalLink, CheckCircle2 } from 'lucide-react'

const BYPASS_KEY = 'namaek-pwa-gate-bypass'

function detectEnv() {
  const ua = navigator.userAgent
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  // iPadOS 13+는 데스크톱 UA를 쓰므로 Mac + 멀티터치로 판별
  const isIPadDesktopUA = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  const isIOS = (/iphone|ipad|ipod/i.test(ua) && !window.MSStream) || isIPadDesktopUA
  const isAndroid = /android/i.test(ua)
  const isKakao = /KAKAOTALK/i.test(ua)
  // 인앱 브라우저: PWA 설치 불가 환경 (카카오톡·네이버·인스타·페북·라인·다음·일반 WebView)
  const isInApp = isKakao || /NAVER\(inapp|Instagram|FBAN|FBAV|Line\/|DaumApps|; wv\)/i.test(ua)
  return { isStandalone, isIOS, isAndroid, isKakao, isInApp, isMobile: isIOS || isAndroid }
}

function checkBypass() {
  try {
    if (new URLSearchParams(window.location.search).get('browser') === '1') {
      sessionStorage.setItem(BYPASS_KEY, '1')
    }
    return sessionStorage.getItem(BYPASS_KEY) === '1'
  } catch {
    return false
  }
}

export default function InstallGate() {
  const [env] = useState(detectEnv)
  const [bypass] = useState(checkBypass)
  const [promptEvent, setPromptEvent] = useState(null)
  const [justInstalled, setJustInstalled] = useState(false)

  const gated = env.isMobile && !env.isStandalone && !bypass

  useEffect(() => {
    if (!gated || env.isIOS) return undefined
    const onPrompt = (e) => {
      e.preventDefault()
      setPromptEvent(e)
    }
    const onInstalled = () => setJustInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [gated, env.isIOS])

  if (!gated) return null

  const handleInstall = async () => {
    if (!promptEvent) return
    promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === 'accepted') setJustInstalled(true)
    setPromptEvent(null)
  }

  const openExternalKakao = () => {
    window.location.href =
      'kakaotalk://web/openExternal?url=' + encodeURIComponent(window.location.href)
  }

  return (
    <div className="fixed inset-0 z-[100] bg-gray-50 overflow-y-auto">
      <div className="max-w-lg mx-auto px-5 py-10 flex flex-col gap-6 min-h-full justify-center">
        {/* 공통 헤더 */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center">
            <Smartphone size={30} className="text-violet-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">나매크 앱으로 이용해 주세요</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            알림 등 앱 기능을 위해 <strong className="text-gray-700">앱 설치 후 이용</strong>이
            필요해요.
            <br />
            아래 안내를 따라 설치해 주세요. (30초면 끝나요)
          </p>
        </div>

        {justInstalled ? (
          <div className="bg-white rounded-2xl shadow-sm border border-emerald-200 px-5 py-6 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 size={36} className="text-emerald-500" />
            <p className="font-bold text-gray-900">설치 완료!</p>
            <p className="text-sm text-gray-600 leading-relaxed">
              이 창을 닫고 <strong>홈 화면의 나매크 아이콘</strong>을 눌러 접속해 주세요.
            </p>
          </div>
        ) : env.isInApp ? (
          <InAppGuide isKakao={env.isKakao} onOpenKakao={openExternalKakao} />
        ) : env.isIOS ? (
          <IOSGuide />
        ) : (
          <AndroidGuide promptEvent={promptEvent} onInstall={handleInstall} />
        )}

        <p className="text-center text-xs text-gray-400">
          이미 설치했다면 홈 화면의 <strong>나매크 아이콘</strong>으로 접속해 주세요.
        </p>
      </div>
    </div>
  )
}

function InAppGuide({ isKakao, onOpenKakao }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-amber-500 px-5 py-3">
        <span className="text-white font-bold text-sm">
          {isKakao ? '카카오톡' : '앱 내'} 브라우저에서는 설치할 수 없어요
        </span>
      </div>
      <div className="px-5 py-4 space-y-4">
        {isKakao ? (
          <>
            <p className="text-sm text-gray-700 leading-relaxed">
              아래 버튼을 눌러 <strong>외부 브라우저</strong>로 열어주세요.
            </p>
            <button
              onClick={onOpenKakao}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm rounded-xl py-3.5"
            >
              <ExternalLink size={16} />
              외부 브라우저로 열기
            </button>
          </>
        ) : (
          <>
            <Step num={1}>
              화면 오른쪽 위(또는 아래)의{' '}
              <InlineIcon>
                <MoreVertical size={14} />
              </InlineIcon>{' '}
              메뉴 버튼을 탭
            </Step>
            <Step num={2}>
              <strong>"다른 브라우저로 열기"</strong> 또는 <strong>"기본 브라우저로 열기"</strong>{' '}
              선택
            </Step>
          </>
        )}
        <div className="bg-amber-50 rounded-xl px-4 py-3 text-xs text-amber-700 leading-relaxed">
          💡 안 되면 주소를 복사해서 Chrome이나 Safari에 붙여넣어 주세요:{' '}
          <strong className="text-amber-800">gooooookee.com</strong>
        </div>
      </div>
    </div>
  )
}

function IOSGuide() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-blue-500 px-5 py-3">
        <span className="text-white font-bold text-sm">iPhone / iPad 설치 방법</span>
      </div>
      <div className="px-5 py-4 space-y-4">
        <Step num={1}>
          하단 가운데{' '}
          <InlineIcon>
            <Share size={14} />
          </InlineIcon>{' '}
          공유 버튼을 탭
        </Step>
        <Step num={2}>
          아래로 스크롤해서 <strong>"홈 화면에 추가"</strong> 탭
          <InlineIconLabel>
            <Plus size={12} />
            <span>홈 화면에 추가</span>
          </InlineIconLabel>
        </Step>
        <Step num={3}>
          오른쪽 위 <strong>"추가"</strong> 탭
        </Step>
        <Step num={4}>
          Safari를 닫고 <strong>홈 화면의 나매크 아이콘</strong>으로 접속하면 완료!
        </Step>
        <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-700 leading-relaxed">
          ※ 공유 버튼이 없다면 <strong className="text-blue-800">Safari</strong>로{' '}
          <strong className="text-blue-800">gooooookee.com</strong>에 접속해 주세요.
        </div>
      </div>
    </div>
  )
}

function AndroidGuide({ promptEvent, onInstall }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-emerald-500 px-5 py-3">
        <span className="text-white font-bold text-sm">Android 설치 방법</span>
      </div>
      <div className="px-5 py-4 space-y-4">
        {promptEvent ? (
          <>
            <p className="text-sm text-gray-700 leading-relaxed">
              아래 버튼을 누르면 바로 설치할 수 있어요.
            </p>
            <button
              onClick={onInstall}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm rounded-xl py-3.5"
            >
              <Download size={16} />
              앱 설치하기
            </button>
          </>
        ) : (
          <>
            <Step num={1}>
              주소창 오른쪽{' '}
              <InlineIcon>
                <MoreVertical size={14} />
              </InlineIcon>{' '}
              메뉴 버튼을 탭
            </Step>
            <Step num={2}>
              <strong>"앱 설치"</strong> 또는 <strong>"홈 화면에 추가"</strong> 탭
            </Step>
            <Step num={3}>
              설치 후 <strong>홈 화면의 나매크 아이콘</strong>으로 접속하면 완료!
            </Step>
            <div className="bg-emerald-50 rounded-xl px-4 py-3 text-xs text-emerald-700 leading-relaxed">
              💡 메뉴에 설치 항목이 없다면 <strong className="text-emerald-800">Chrome</strong>으로{' '}
              <strong className="text-emerald-800">gooooookee.com</strong>에 접속해 주세요.
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Step({ num, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center mt-0.5">
        {num}
      </span>
      <p className="text-sm text-gray-700 leading-relaxed">{children}</p>
    </div>
  )
}

function InlineIcon({ children }) {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 bg-gray-100 rounded align-middle mx-0.5">
      {children}
    </span>
  )
}

function InlineIconLabel({ children }) {
  return (
    <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs rounded-lg px-2 py-0.5 mt-1 ml-1 align-middle">
      {children}
    </span>
  )
}
