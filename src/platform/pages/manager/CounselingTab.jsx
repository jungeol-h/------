import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import CounselingTabContent from '../../components/counseling/CounselingTabContent.jsx'

export default function CounselingTab() {
  const { currentUser } = useAuth()
  const { data } = useData()

  // 매니저: 본인이 작성한 상담만 열람, 담당 학생만 작성 대상.
  // 최신 상담이 위로(date 내림차순, 같은 날은 id 내림차순으로 안정 정렬).
  const records = data.counselingRecords
    .filter((r) => r.educatorId === currentUser?.id)
    .slice()
    .sort((a, b) => (a.date === b.date ? (a.id < b.id ? 1 : -1) : a.date < b.date ? 1 : -1))

  const myStudentIds = data.assignments
    .filter((a) => a.educatorId === currentUser?.id)
    .map((a) => a.studentId)
  const myStudents = data.students.filter((s) => myStudentIds.includes(s.id))

  return (
    <CounselingTabContent
      students={myStudents}
      records={records}
      authorId={currentUser?.id}
    />
  )
}
