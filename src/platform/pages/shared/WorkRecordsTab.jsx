import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import { WORK_RECORD_MENUS, ADMIN_ONLY_MENUS } from '../../data/workRecordTypes.js'
import CounselingTabContent from '../../components/counseling/CounselingTabContent.jsx'
import ManagementReportSection from '../../components/workRecords/ManagementReportSection.jsx'
import FinanceSection from '../../components/workRecords/FinanceSection.jsx'
import LessonReportSection from '../../components/workRecords/LessonReportSection.jsx'
import NoticeSection from '../../components/workRecords/NoticeSection.jsx'
import WorkPlanTab from '../admin/WorkPlanTab.jsx'
import { isActiveStudent } from '../../data/studentStatus.js'

// 업무기록 통합 탭 — 5메뉴(업무계획·관리보고·재정·상담보고·수업보고), 전 역할 공용.
// 권한(2026-07 클라이언트 확정):
//  - admin(센터장): 전체 편집
//  - viewer(본부장·공무원): 전체 열람 + 출력(엑셀/PDF)만
//  - manager/instructor/consultant: 상담보고·수업보고 작성(본인 것만 수정·삭제),
//    업무계획·관리보고·재정 메뉴는 보이되 잠금(클릭 시 관리자 전용 안내 — 명시 요구)
export default function WorkRecordsTab() {
  const { currentUser } = useAuth()
  const { data } = useData()
  const [searchParams, setSearchParams] = useSearchParams()

  const role = currentUser?.role
  const isAdmin = role === 'admin'
  const isViewer = role === 'viewer'
  const readOnly = isViewer

  const defaultMenu = isAdmin || isViewer ? 'plans' : 'counseling'
  const rawMenu = searchParams.get('menu')
  const menu = WORK_RECORD_MENUS.some((m) => m.key === rawMenu) ? rawMenu : defaultMenu

  const isLocked = (key) => !isAdmin && !isViewer && ADMIN_ONLY_MENUS.includes(key)

  const selectMenu = (key) => {
    setSearchParams({ menu: key }, { replace: true })
  }

  // 최신 상담이 위로(date 내림차순, 같은 날은 id 내림차순으로 안정 정렬).
  const counselingRecords = useMemo(
    () => data.counselingRecords
      .slice()
      .sort((a, b) => (a.date === b.date ? (a.id < b.id ? 1 : -1) : a.date < b.date ? 1 : -1)),
    [data.counselingRecords]
  )

  // 작성 대상 학생 — 매니저는 담당 학생만, 나머지는 활성 학생 전체.
  // (매니저 fetch는 담당 학생만 담고 있어 필터는 방어적 중복이다.)
  const counselingStudents = useMemo(() => {
    if (isAdmin || isViewer) return data.students
    if (role === 'manager') {
      const myIds = new Set(
        data.assignments.filter((a) => a.educatorId === currentUser?.id).map((a) => a.studentId)
      )
      return data.students.filter((s) => myIds.has(s.id))
    }
    return data.students.filter(isActiveStudent)
  }, [data.students, data.assignments, role, isAdmin, isViewer, currentUser?.id])

  const lessonStudents = useMemo(
    () => counselingStudents.filter(isActiveStudent),
    [counselingStudents]
  )

  const renderContent = () => {
    if (isLocked(menu)) {
      return (
        <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-gray-400 mt-6">
          <Lock size={22} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm font-semibold text-gray-500">관리자 전용 메뉴입니다</p>
          <p className="text-xs mt-1">업무계획·관리보고·재정은 센터장만 작성·열람할 수 있어요.</p>
        </div>
      )
    }
    switch (menu) {
      case 'plans':
        return <WorkPlanTab readOnly={readOnly} />
      case 'management':
        return <div className="py-6"><ManagementReportSection readOnly={readOnly} /></div>
      case 'finance':
        return <div className="py-6"><FinanceSection readOnly={readOnly} /></div>
      case 'lesson':
        return <div className="py-6"><LessonReportSection students={lessonStudents} readOnly={readOnly} /></div>
      case 'notices':
        return <div className="py-6"><NoticeSection readOnly={readOnly} /></div>
      case 'counseling':
      default:
        return (
          <CounselingTabContent
            students={counselingStudents}
            records={counselingRecords}
            showAuthor
            authorId={currentUser?.id}
            readOnly={readOnly}
          />
        )
    }
  }

  return (
    <div className="pt-6">
      <div className="grid grid-cols-6 gap-1 rounded-xl bg-gray-100 p-1">
        {WORK_RECORD_MENUS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => selectMenu(m.key)}
            className={`h-10 rounded-lg text-[11px] sm:text-xs font-bold transition-colors flex items-center justify-center gap-0.5 ${
              menu === m.key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'
            }`}
          >
            {isLocked(m.key) && <Lock size={10} className="flex-shrink-0" />}
            {m.label}
          </button>
        ))}
      </div>

      {renderContent()}
    </div>
  )
}
