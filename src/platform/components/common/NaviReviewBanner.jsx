// 나비 후기 배너 — 학생·학부모·강사 홈 상단. 탭하면 후기 양식(ModalShell)이 열린다.
// 제출 전: 눈에 띄는 CTA / 제출 후: 작은 '내 후기 수정하기' 줄 (계정당 1건, 수정 가능).
// 후기 테이블이 아직 없어도 배너는 항상 보인다 (저장 시에만 오류 — naviReviewsDomain).

import { useState } from 'react'
import { Sparkles, Pencil, ChevronRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import NaviReviewFormModal from './NaviReviewFormModal.jsx'

export default function NaviReviewBanner() {
  const { currentUser } = useAuth()
  const { data } = useData()
  const [open, setOpen] = useState(false)

  const mine = data.naviReviews.find((r) => r.userId === currentUser?.id) ?? null

  return (
    <>
      {mine ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-between gap-2 bg-white rounded-xl shadow-sm px-4 py-2.5 text-left active:scale-[0.99] transition"
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-gray-600">
            <Pencil size={13} className="text-amber-500" />
            내 후기 수정하기
          </span>
          <ChevronRight size={14} className="text-gray-300" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-3 rounded-2xl p-4 text-left text-white shadow-sm bg-gradient-to-r from-amber-400 to-orange-500 active:scale-[0.99] transition"
        >
          <span className="w-10 h-10 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0">
            <Sparkles size={20} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-base font-bold">나비 후기 남기기</span>
            <span className="block text-xs opacity-90 mt-0.5">나비 센터에서의 경험을 들려주세요</span>
          </span>
          <ChevronRight size={18} className="flex-shrink-0 opacity-80" />
        </button>
      )}
      {open && <NaviReviewFormModal existing={mine} onClose={() => setOpen(false)} />}
    </>
  )
}
