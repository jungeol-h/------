import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import CounselingTabContent from '../../components/counseling/CounselingTabContent.jsx'

export default function CounselingTab() {
  const { currentUser } = useAuth()
  const { data } = useData()

  // 매니저: 본인이 작성한 상담만 열람, 담당 학생만 작성 대상.
  const records = data.counselingRecords
    .filter((r) => r.educatorId === currentUser?.id)
    .slice()
    .reverse()

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
