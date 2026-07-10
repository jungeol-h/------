import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import CounselingTabContent from '../../components/counseling/CounselingTabContent.jsx'

export default function CounselingTab() {
  const { currentUser } = useAuth()
  const { data } = useData()

  // 매니저: 담당 학생의 상담 기록을 작성자 무관 전체 열람
  // (2026-07 클라이언트: 학생별 기록은 모든 강사 열람. fetch도 student_id 기준으로 변경됨).
  // 수정/삭제는 본인 작성분만. 작성 대상은 담당 학생만.
  // 최신 상담이 위로(date 내림차순, 같은 날은 id 내림차순으로 안정 정렬).
  const records = data.counselingRecords
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
      showAuthor
    />
  )
}
