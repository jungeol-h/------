import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import CounselingTabContent from '../../components/counseling/CounselingTabContent.jsx'

// 교과강사/컨설턴트 상담 탭.
// 본인이 작성한 상담만 열람, 작성 대상은 전체 활성 학생(배정 필터 없음).
export default function EducatorCounselingTab() {
  const { currentUser } = useAuth()
  const { data } = useData()

  const records = data.counselingRecords
    .filter((r) => r.educatorId === currentUser?.id)
    .slice()
    .sort((a, b) => (a.date === b.date ? (a.id < b.id ? 1 : -1) : a.date < b.date ? 1 : -1))

  const students = data.students.filter((s) => s.status !== 'inactive')

  return (
    <CounselingTabContent
      students={students}
      records={records}
      authorId={currentUser?.id}
    />
  )
}
