import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import CounselingTabContent from '../../components/counseling/CounselingTabContent.jsx'

export default function CounselingTab() {
  const { currentUser } = useAuth()
  const { data } = useData()

  // 관리자: 전체 상담 기록 열람·작성, 전체 학생 대상, 작성자 표시.
  // 최신 상담이 위로(date 내림차순, 같은 날은 id 내림차순으로 안정 정렬).
  const records = data.counselingRecords
    .slice()
    .sort((a, b) => (a.date === b.date ? (a.id < b.id ? 1 : -1) : a.date < b.date ? 1 : -1))

  return (
    <CounselingTabContent
      students={data.students}
      records={records}
      showAuthor
      authorId={currentUser?.id}
    />
  )
}
