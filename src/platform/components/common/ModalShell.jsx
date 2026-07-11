// 하단 시트형 모달 공통 셸 — 오버레이(z-50) + 흰 패널 + 제목/닫기(X) 헤더.
// 프로젝트 표준 모달 패턴이므로 새 모달은 이 컴포넌트를 사용할 것.
// z-index 규칙: Header/TabBar z-40, 모달 z-50.
//
// 참고: admin 일부 모달(StudentFormModal 등)은 데스크톱 중앙정렬(sm:items-center)
// + 고정 헤더/푸터 구조라 이 셸을 쓰지 않는다 — 필요하면 별도 변형을 만들 것.
import { X } from 'lucide-react'

export default function ModalShell({
  title,
  onClose,
  children,
  maxWidth = 'max-w-lg', // 패널 최대 폭
  maxHeight = 'max-h-[90vh]', // 패널 최대 높이 (넘치면 내부 스크롤)
  panelClass = 'p-5 space-y-4', // 패널 패딩·간격 — 기존 모달과 동일한 기본값
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center px-4 pb-4">
      <div className={`bg-white rounded-3xl w-full overflow-y-auto ${maxWidth} ${maxHeight} ${panelClass}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-base">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
