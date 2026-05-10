import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Share, MoreVertical, Plus, Smartphone } from 'lucide-react'

export default function InstallGuidePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center px-4 h-14 gap-3">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-gray-500">
            <ChevronLeft size={22} />
          </button>
          <h1 className="font-bold text-gray-900 text-base">앱 설치 가이드</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {/* 소개 */}
        <div className="bg-violet-50 border border-violet-100 rounded-2xl px-5 py-4 flex items-start gap-3">
          <Smartphone size={22} className="text-violet-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-violet-900 text-sm">나르샤를 앱처럼 설치하세요</p>
            <p className="text-xs text-violet-700 mt-0.5 leading-relaxed">홈 화면에 추가하면 앱처럼 빠르게 실행할 수 있어요. 아래 기기에 맞는 방법을 따라해 보세요.</p>
          </div>
        </div>

        {/* Android 가이드 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-emerald-500 px-5 py-3 flex items-center gap-2">
            <span className="text-white font-bold text-sm">Android (갤럭시, LG 등)</span>
          </div>
          <div className="px-5 py-4 space-y-4">
            <Step num={1}>
              Chrome 브라우저로 <strong>andong.gooooookee.com</strong> 접속
            </Step>
            <Step num={2}>
              주소창 오른쪽 <InlineIcon><MoreVertical size={14} /></InlineIcon> 메뉴 버튼을 탭
            </Step>
            <Step num={3}>
              <strong>"앱 설치"</strong> 또는 <strong>"홈 화면에 추가"</strong> 탭
            </Step>
            <Step num={4}>
              확인 버튼을 누르면 설치 완료!
            </Step>
            <div className="bg-emerald-50 rounded-xl px-4 py-3 text-xs text-emerald-700 leading-relaxed">
              💡 페이지 상단에 <strong className="text-emerald-800">"앱 설치"</strong> 버튼이 보이면 바로 탭해도 됩니다.
            </div>
          </div>
        </div>

        {/* iOS 가이드 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-blue-500 px-5 py-3 flex items-center gap-2">
            <span className="text-white font-bold text-sm">iPhone / iPad (iOS)</span>
          </div>
          <div className="px-5 py-4 space-y-4">
            <Step num={1}>
              <strong>Safari</strong> 브라우저로 <strong>andong.gooooookee.com</strong> 접속
              <span className="block text-xs text-gray-400 mt-0.5">※ Safari가 아니면 설치가 안 돼요</span>
            </Step>
            <Step num={2}>
              하단 가운데 <InlineIcon><Share size={14} /></InlineIcon> 공유 버튼을 탭
            </Step>
            <Step num={3}>
              아래로 스크롤해서 <strong>"홈 화면에 추가"</strong> 탭
              <InlineIconLabel>
                <Plus size={12} />
                <span>홈 화면에 추가</span>
              </InlineIconLabel>
            </Step>
            <Step num={4}>
              오른쪽 위 <strong>"추가"</strong>를 탭하면 완료!
            </Step>
            <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-700 leading-relaxed">
              💡 페이지 상단에 <strong className="text-blue-800">"앱 설치"</strong> 버튼을 탭하면 단계별 안내가 나와요.
            </div>
          </div>
        </div>

        {/* 로그인 안내 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 space-y-2">
          <p className="font-semibold text-gray-800 text-sm">로그인 방법</p>
          <ul className="text-xs text-gray-600 space-y-1.5">
            <li className="flex items-start gap-1.5">
              <span className="text-gray-400 mt-0.5">•</span>
              <span>아이디와 비밀번호는 담당 선생님에게 받은 계정을 사용하세요.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-gray-400 mt-0.5">•</span>
              <span>학생 초기 비밀번호는 <strong>생년월일 8자리</strong>예요. (예: 20100315)</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-gray-400 mt-0.5">•</span>
              <span>로그인이 안 되면 담당 선생님께 문의해 주세요.</span>
            </li>
          </ul>
        </div>

        <p className="text-center text-xs text-gray-400 pb-4">산청 우정학사 · 나르샤 베타테스트 2026</p>
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
